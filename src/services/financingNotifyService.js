import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Track K · K7 — client wrapper for the notifyFinancingAdjustment CF plus the
// deterministic-ID cooldown read that powers the manager's 24h notify chip.
//
// The CF resolves the configured recipient server-side, writes the bell + the
// tenant-scoped audit + a cooldown record (in the existing nudges collection, id
// `{agentId}_{type}_{month}`), and queues the email. The read here is a single
// deterministic-ID GET — never a list query, never an index (the nudges rule has
// no list arm by design). Mirrors nudgeService.

export const FINANCING_NOTIFY_TYPE = 'financing.adjustment.notify';
export const FINANCING_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // re-enables after 24h

/**
 * Fire the clause-5.3 notify duty for one agent-month.
 * @param {string} agentId
 * @param {string} month     YYYY_MM
 * @param {object} payload   { adjustmentPct, monthLabel, agentName } — copy inputs
 * @returns CF result: { success, recipientUid?, reason?, emailQueued? }
 *   reason 'no-recipient' | 'recipient-not-found' when success is false.
 */
export async function notifyFinancingAdjustment(agentId, month, payload = {}) {
  if (!agentId) throw new Error('agentId required');
  if (!month) throw new Error('month required');
  const fn = httpsCallable(getFunctions(), 'notifyFinancingAdjustment');
  const result = await fn({ agentId, month, payload });
  return result.data;
}

// Normalize a Firestore timestamp (or millis/seconds shape) to epoch millis.
function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Deterministic-ID GET for the cooldown chip:
 * nudges/{agentId}_{FINANCING_NOTIFY_TYPE}_{month}. A denied/absent GET resolves
 * to null (treated as "not yet notified"). No list query.
 * @returns {Promise<number|null>} createdAt epoch millis, or null.
 */
export async function getFinancingNotifyRecord(tenantId, agentId, month) {
  if (!tenantId || !agentId || !month) return null;
  const id = `${agentId}_${FINANCING_NOTIFY_TYPE}_${month}`;
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/nudges/${id}`));
    return snap.exists() ? tsToMillis(snap.data().createdAt) : null;
  } catch {
    return null;
  }
}
