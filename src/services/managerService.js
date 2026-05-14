import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export async function getWeeklySubmissions(tenantId, weekStarting) {
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
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
