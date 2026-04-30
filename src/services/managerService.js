import {
  collection, query, where, getDocs, orderBy,
} from 'firebase/firestore';
import { db, tenantId } from '../firebase';

export async function getWeeklySubmissions(weekStarting) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers() {
  const snap = await getDocs(collection(db, `tenants/${tenantId}/users`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
