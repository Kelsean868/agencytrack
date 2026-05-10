import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, getTenantId } from '../firebase';

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function getTriniNow() {
  return new Date(Date.now() - TRINI_OFFSET_MS);
}

function toMonthKey(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getCurrentMonthKey() {
  return toMonthKey(getTriniNow());
}

export function getPrevMonthKey() {
  const d = getTriniNow();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return toMonthKey(d);
}

export function isWithinEditWindow() {
  return getTriniNow().getUTCDate() <= 7;
}

export async function getAgentOfMonth(monthKey) {
  const tenantId = getTenantId();
  const snap = await getDoc(doc(db, `tenants/${tenantId}/agentOfMonth/${monthKey}`));
  return snap.exists() ? snap.data() : null;
}

// Kiosk: reads current month, falls back to prior month during the 7-day edit window.
export async function getAgentOfMonthForKiosk() {
  const current = getCurrentMonthKey();
  let data = await getAgentOfMonth(current);
  if (!data && isWithinEditWindow()) {
    data = await getAgentOfMonth(getPrevMonthKey());
  }
  return data;
}

export async function getCandidates({ branchId, monthKey }) {
  const fn = httpsCallable(functions, 'getAgentOfMonthCandidates');
  const result = await fn({ branchId, monthKey });
  return result.data;
}

export async function setAgentOfMonth({ branchId, monthKey, category, agentUid }) {
  const fn = httpsCallable(functions, 'setAgentOfMonth');
  const result = await fn({ branchId, monthKey, category, agentUid });
  return result.data;
}
