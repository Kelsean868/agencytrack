import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export async function getWeeklySubmissions(tenantId, weekStarting) {
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    // Submissions don't carry unitId, so resolve the UM's agent UIDs from users first.
    // SHAKEDOWN-002B: same defense-in-depth pattern as getTenantUsers / getAllUsers.
    const agentsSnap = await getDocs(
      query(collection(db, `tenants/${tenantId}/users`), where('unitId', '==', callerUid))
    );
    // TODO: chunk into ≤30-item batches if units ever exceed Firestore `in` cap
    const agentUids = agentsSnap.docs
      .filter((d) => d.data().provisioning !== true)
      .map((d) => d.id);
    if (agentUids.length === 0) return [];
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('weekStarting', '==', weekStarting),
      where('agentId', 'in', agentUids)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // BM / TA / PA: full query unchanged.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers(tenantId) {
  const { claims } = await auth.currentUser.getIdTokenResult();
  const callerUid = auth.currentUser.uid;

  // SHAKEDOWN-002: unit_manager callers see only their own unit's agents.
  // Other manager roles retain full branch/tenant visibility.
  const col = collection(db, `tenants/${tenantId}/users`);
  const q = claims.role === 'unit_manager'
    ? query(col, where('unitId', '==', callerUid))
    : col;

  const snap = await getDocs(q);
  // PR-1: hide provisioning users from every list-style UI consumer (9 callers).
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}

export async function getAllYTDSubmissions(tenantId) {
  const year = new Date().getFullYear();
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    // Submissions don't carry unitId — resolve agent UIDs from users first.
    // SHAKEDOWN-002B: same pattern as getWeeklySubmissions.
    const agentsSnap = await getDocs(
      query(collection(db, `tenants/${tenantId}/users`), where('unitId', '==', callerUid))
    );
    // TODO: chunk into ≤30-item batches if units ever exceed Firestore `in` cap
    const agentUids = agentsSnap.docs
      .filter((d) => d.data().provisioning !== true)
      .map((d) => d.id);
    if (agentUids.length === 0) return [];
    // status filtered client-side to avoid a 3-field compound index (agentId + weekStarting range + status).
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('agentId', 'in', agentUids),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.status === 'submitted');
  }

  // BM / TA / PA: full query unchanged.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
