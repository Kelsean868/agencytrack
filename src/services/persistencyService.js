import {
  doc, getDoc, getDocs, setDoc, writeBatch,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, tenantId } from '../firebase';

function persistencyDocId(agentId, year, month) {
  const mm = String(month).padStart(2, '0');
  return `${agentId}_${year}_${mm}`;
}

export async function getMonthlyPersistency(year, month) {
  const mm = String(month).padStart(2, '0');
  const q = query(
    collection(db, `tenants/${tenantId}/persistency`),
    where('year', '==', year),
    where('month', '==', month)
  );
  const snap = await getDocs(q);
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    map[data.agentId] = data;
  });
  return map;
}

export async function savePersistencyBatch(entries, enteredBy) {
  const batch = writeBatch(db);
  entries.forEach(({ agentId, agentName, year, month, persistency }) => {
    const ref = doc(
      db,
      `tenants/${tenantId}/persistency/${persistencyDocId(agentId, year, month)}`
    );
    batch.set(ref, {
      agentId,
      agentName,
      tenantId,
      year,
      month,
      persistency: parseFloat(persistency) || 0,
      enteredBy,
      enteredAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
