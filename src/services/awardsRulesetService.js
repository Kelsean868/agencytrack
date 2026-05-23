import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';

export async function getAwardsRuleset(tenantId, year = 2026) {
  const ref = doc(db, `tenants/${tenantId}/config/awardsRuleset_${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : DEFAULT_RULESET_2026;
}
