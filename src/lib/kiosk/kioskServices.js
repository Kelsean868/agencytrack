import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { kioskDb } from './kioskFirebase';
import {
  getCurrentMonthKey, getPrevMonthKey, isWithinEditWindow,
} from '../../services/agentOfMonthService';

export async function getKioskYTDSubmissions(tenantId) {
  const year = new Date().getFullYear();
  const q = query(
    collection(kioskDb, `tenants/${tenantId}/submissions`),
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
