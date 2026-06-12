import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// Fetches agent UIDs for a branch. Single-field query (no composite index).
// Role filter applied client-side to avoid requiring a (branchId, role) index.
async function getBranchAgentIds(tenantId, branchId) {
  const snap = await getDocs(query(
    collection(db, `tenants/${tenantId}/users`),
    where('branchId', '==', branchId)
  ));
  return snap.docs
    .filter((d) => d.data().role === 'agent')
    .map((d) => d.id);
}

export async function getWeeklySubmissions(tenantId, weekStarting) {
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('unitId', '==', callerUid),
      where('weekStarting', '==', weekStarting)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (claims.role === 'branch_manager' && claims.branchId) {
    const agentIds = await getBranchAgentIds(tenantId, claims.branchId);
    if (agentIds.length === 0) return [];
    const branchSet = new Set(agentIds);
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('weekStarting', '==', weekStarting)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => branchSet.has(s.agentId ?? s.userId ?? ''));
  }

  // TA / PA: full query.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers(tenantId, { includeInactive = false } = {}) {
  const { claims } = await auth.currentUser.getIdTokenResult();
  const callerUid = auth.currentUser.uid;

  const col = collection(db, `tenants/${tenantId}/users`);
  let q;
  if (claims.role === 'unit_manager') {
    q = query(col, where('unitId', '==', callerUid));
  } else if (claims.role === 'branch_manager' && claims.branchId) {
    q = query(col, where('branchId', '==', claims.branchId));
  } else {
    q = col;
  }

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true && (includeInactive || u.active !== false));
}

export async function getAllYTDSubmissions(tenantId) {
  const year = new Date().getFullYear();
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    // status filtered client-side to avoid a 3-field compound index
    // (unitId + weekStarting range + status).
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('unitId', '==', callerUid),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.status === 'submitted');
  }

  if (claims.role === 'branch_manager' && claims.branchId) {
    const agentIds = await getBranchAgentIds(tenantId, claims.branchId);
    if (agentIds.length === 0) return [];
    const branchSet = new Set(agentIds);
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`),
      where('status', '==', 'submitted')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => branchSet.has(s.agentId ?? s.userId ?? ''));
  }

  // TA / PA: full query.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
