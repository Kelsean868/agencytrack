import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function getWeeklySubmissions(tenantId, weekStarting) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers(tenantId) {
  const snap = await getDocs(collection(db, `tenants/${tenantId}/users`));
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
