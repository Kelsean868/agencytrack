import {
  doc, getDoc, getDocs, setDoc, writeBatch,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, getTenantId } from '../firebase';

function persistencyDocId(agentId, year, month) {
  const mm = String(month).padStart(2, '0');
  return `${agentId}_${year}_${mm}`;
}

export async function getMonthlyPersistency(year, month) {
  const mm = String(month).padStart(2, '0');
  const q = query(
    collection(db, `tenants/${getTenantId()}/persistency`),
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

export async function getAgentPersistency(agentId, year) {
  const q = query(
    collection(db, `tenants/${getTenantId()}/persistency`),
    where('agentId', '==', agentId),
    where('year', '==', year)
  );
  const snap = await getDocs(q);
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    map[d.id] = data;
  });
  return map;
}

export async function getAllPersistencyForYear(year) {
  const q = query(
    collection(db, `tenants/${getTenantId()}/persistency`),
    where('year', '==', year)
  );
  const snap = await getDocs(q);
  // Returns { [agentId]: [persistencyDoc, ...] }
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    const id = data.agentId;
    if (!id) return;
    if (!map[id]) map[id] = [];
    map[id].push(data);
  });
  return map;
}

export async function savePersistencyBatch(entries, enteredBy) {
  const tid = getTenantId();
  const batch = writeBatch(db);
  entries.forEach(({ agentId, agentName, year, month, persistency }) => {
    const ref = doc(
      db,
      `tenants/${tid}/persistency/${persistencyDocId(agentId, year, month)}`
    );
    batch.set(ref, {
      agentId,
      agentName,
      tenantId: tid,
      year,
      month,
      persistency: parseFloat(persistency) || 0,
      enteredBy,
      enteredAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
