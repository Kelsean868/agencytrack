import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

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

  // BM / TA / PA: full query unchanged.
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

  // SHAKEDOWN-002: unit_manager callers see only their own unit's agents.
  // Other manager roles retain full branch/tenant visibility.
  const col = collection(db, `tenants/${tenantId}/users`);
  const q = claims.role === 'unit_manager'
    ? query(col, where('unitId', '==', callerUid))
    : col;

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
