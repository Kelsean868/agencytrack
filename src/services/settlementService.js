import {
  doc, setDoc, getDocs, deleteDoc,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

function settlementDocId(agentId, year, periodKey) {
  return `${agentId}_${year}_${periodKey}`;
}

export async function getSettlements(tenantId, agentId, year) {
  const q = query(
    collection(db, `tenants/${tenantId}/settlements`),
    where('agentId', '==', agentId),
    where('year', '==', year)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSettlementsForUnit(tenantId, agentIds, year) {
  if (!agentIds || agentIds.length === 0) return [];

  // Firestore 'in' queries support up to 30 values; batch if needed
  const batches = [];
  for (let i = 0; i < agentIds.length; i += 30) {
    batches.push(agentIds.slice(i, i + 30));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const q = query(
        collection(db, `tenants/${tenantId}/settlements`),
        where('agentId', 'in', batch),
        where('year', '==', year)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    })
  );

  return results.flat();
}

export async function confirmSettlement(tenantId, agentId, data, confirmedBy, confirmedByName) {
  const year = new Date().getFullYear();
  const docId = settlementDocId(agentId, year, data.periodKey);
  const ref = doc(db, `tenants/${tenantId}/settlements/${docId}`);

  await setDoc(ref, {
    agentId,
    tenantId,
    year,
    periodKey:    data.periodKey,
    periodType:   data.periodType ?? 'monthly',
    settledAPI:   parseFloat(data.settledAPI ?? 0) || 0,
    settledApps:  parseFloat(data.settledApps ?? 0) || 0,
    persistency:  parseFloat(data.persistency ?? 0) || 0,
    notes:        data.notes ?? '',
    confirmedBy,
    confirmedByName,
    confirmedAt:  serverTimestamp(),
  });
}

export async function deleteSettlement(tenantId, agentId, periodKey, year) {
  const docId = settlementDocId(agentId, year, periodKey);
  const ref = doc(db, `tenants/${tenantId}/settlements/${docId}`);
  await deleteDoc(ref);
}
