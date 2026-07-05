import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { kioskDb } from './kioskFirebase';
import {
  getCurrentMonthKey, getPrevMonthKey, isWithinEditWindow,
} from '../../services/agentOfMonthService';

// FU SEC-012: branchId filter is required — the branch-scoped kiosk submissions
// list rule denies any query that isn't constrained to the kiosk's own branch.
// Served by the existing (branchId, status, weekStarting) composite index.
export async function getKioskYTDSubmissions(tenantId, branchId) {
  // Defensive: a falsy branchId in where('branchId','==',…) throws a FirebaseError
  // that would reject the whole KioskShell load. branchId is always present from
  // the validated kiosk token, but degrade to [] rather than crash if it isn't.
  if (!tenantId || !branchId) return [];
  const year = new Date().getFullYear();
  const q = query(
    collection(kioskDb, `tenants/${tenantId}/submissions`),
    where('branchId', '==', branchId),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getKioskTenantUsers(tenantId) {
  const snap = await getDocs(collection(kioskDb, `tenants/${tenantId}/users`));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true && u.active !== false);
}

async function getKioskAgentOfMonthForKey(tenantId, monthKey) {
  const snap = await getDoc(doc(kioskDb, `tenants/${tenantId}/agentOfMonth/${monthKey}`));
  return snap.exists() ? snap.data() : null;
}

export async function getKioskAgentOfMonth(tenantId) {
  const current = getCurrentMonthKey();
  let data = await getKioskAgentOfMonthForKey(tenantId, current);
  if (!data && isWithinEditWindow()) {
    data = await getKioskAgentOfMonthForKey(tenantId, getPrevMonthKey());
  }
  return data;
}
