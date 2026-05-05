import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, getTenantId } from '../firebase';

export async function getWeeklySubmissions(weekStarting) {
  const q = query(
    collection(db, `tenants/${getTenantId()}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers() {
  const snap = await getDocs(collection(db, `tenants/${getTenantId()}/users`));
  // PR-1: hide provisioning users from every list-style UI consumer (9 callers).
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}

export async function getAllYTDSubmissions() {
  const year = new Date().getFullYear();
  const q = query(
    collection(db, `tenants/${getTenantId()}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
