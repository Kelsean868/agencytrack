import {
  collection, doc, addDoc, updateDoc, writeBatch,
  query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function createNotification(tenantId, userId, { type, title, body, link = null }) {
  await addDoc(collection(db, `tenants/${tenantId}/notifications`), {
    userId,
    tenantId,
    type,
    title,
    body,
    link,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markRead(tenantId, notificationId) {
  const ref = doc(db, `tenants/${tenantId}/notifications/${notificationId}`);
  await updateDoc(ref, { read: true });
}

export async function markAllRead(tenantId, userId) {
  const q = query(
    collection(db, `tenants/${tenantId}/notifications`),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
