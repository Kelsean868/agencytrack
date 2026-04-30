import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function getGoals(tenantId, agentId) {
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setGoals(tenantId, agentId, data, setBy, setByName) {
  const p = (v) => parseFloat(v) || 0;
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  await setDoc(
    ref,
    {
      agentId,
      tenantId,
      targetAnnualAPI:         p(data.targetAnnualAPI),
      targetAnnualApps:        p(data.targetAnnualApps),
      targetAnnualPersistency: p(data.targetAnnualPersistency),
      targetWeeklyAPI:         p(data.targetWeeklyAPI),
      targetWeeklyApps:        p(data.targetWeeklyApps),
      targetWeeklyDials:       p(data.targetWeeklyDials),
      targetWeeklyFFI:         p(data.targetWeeklyFFI),
      notes:                   String(data.notes ?? ''),
      setBy,
      setByName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
