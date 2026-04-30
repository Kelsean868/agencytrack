import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function getGoals(tenantId, agentId) {
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getCompanyMinimums(tenantId) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { annualAPI: 200000, annualApps: 42, persistency: 90 };
}

export async function setGoals(tenantId, agentId, data, setBy, setByName) {
  const p = (v) => parseFloat(v) || 0;
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);

  const payload = { agentId, tenantId, setBy, setByName, updatedAt: serverTimestamp() };

  // Manager target fields — write all if any target* key is present
  if ('targetAnnualAPI' in data || 'targetWeeklyAPI' in data) {
    payload.targetAnnualAPI         = p(data.targetAnnualAPI);
    payload.targetAnnualApps        = p(data.targetAnnualApps);
    payload.targetAnnualPersistency = p(data.targetAnnualPersistency);
    payload.targetWeeklyAPI         = p(data.targetWeeklyAPI);
    payload.targetWeeklyApps        = p(data.targetWeeklyApps);
    payload.targetWeeklyDials       = p(data.targetWeeklyDials);
    payload.targetWeeklyFFI         = p(data.targetWeeklyFFI);
    payload.notes                   = String(data.notes ?? '');
  }

  // Personal agent goals — enforce company floor before writing
  const hasPersonal =
    'personalAnnualAPI' in data ||
    'personalAnnualApps' in data ||
    'personalAnnualPersistency' in data;

  if (hasPersonal) {
    const mins = await getCompanyMinimums(tenantId);
    if ('personalAnnualAPI' in data && p(data.personalAnnualAPI) < mins.annualAPI) {
      throw new Error(`Annual API must be at least TTD ${mins.annualAPI.toLocaleString()} (company minimum).`);
    }
    if ('personalAnnualApps' in data && p(data.personalAnnualApps) < mins.annualApps) {
      throw new Error(`Annual Apps must be at least ${mins.annualApps} (company minimum).`);
    }
    if ('personalAnnualPersistency' in data && p(data.personalAnnualPersistency) < mins.persistency) {
      throw new Error(`Persistency must be at least ${mins.persistency}% (company minimum).`);
    }
    if ('personalAnnualAPI' in data)         payload.personalAnnualAPI         = p(data.personalAnnualAPI);
    if ('personalAnnualApps' in data)        payload.personalAnnualApps        = p(data.personalAnnualApps);
    if ('personalAnnualPersistency' in data) payload.personalAnnualPersistency = p(data.personalAnnualPersistency);
  }

  // Playground assumption fields
  const pgKeys = [
    'playgroundIncomeGoal', 'playgroundTaxRate', 'playgroundRenewalIncome',
    'playgroundCommissionRate', 'playgroundAvgPolicyAPI', 'playgroundPersistencyRate',
    'playgroundCiToSaleRatio', 'playgroundDialsToCIRatio', 'playgroundProspectRatio',
  ];
  pgKeys.forEach((key) => {
    if (key in data) payload[key] = p(data[key]);
  });

  await setDoc(ref, payload, { merge: true });
}
