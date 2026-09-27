/**
 * policiesDerivation.js — pure, zero-Firestore-SDK functions derived from policy docs.
 *
 * Extracted from src/services/policiesService.js so this logic can be:
 *   1. Imported directly by the H3 parity harness (Node.js, Admin SDK context) without
 *      pulling in the client-SDK chain (firebase/firestore).
 *   2. Kept in sync with the production service via a single import rather than an
 *      inline copy that can silently drift.
 *
 * No firebase/firestore imports. No side effects. Pure functions only.
 */

// `.js` extension on purpose: Node imports this file directly (h3-parity-test.mjs).
import { ymdUTC } from '../utils/dateInputs.js';

/**
 * settlementShapeFromPolicies — derives a confirmedData-compatible array from
 * settled policy docs for the awards engine.
 *
 * Groups settled policies by month via dateIssued (Firestore Timestamp or Date →
 * YYYY-MM periodKey). Only 'settled' status counts — lapsed policies were deducted
 * and are excluded. Persistency is not sourced here; caller merges from the
 * persistency/settlement collection.
 *
 * @param {Array<object>} policies — array of Firestore policy docs. Each doc must have:
 *   - status: string ('settled' | 'lapsed' | ...)
 *   - dateIssued: Firestore Timestamp (with .toDate()) or Date-like value
 *   - settledAPI: number | string (coerced via parseFloat)
 * @returns {Array<{periodKey: string, settledAPI: number, settledApps: number, persistency: number}>}
 */
export function settlementShapeFromPolicies(policies) {
  // Guard: caller may pass null/undefined when the policies query hasn't resolved.
  if (!Array.isArray(policies)) return [];
  const map = {};
  for (const policy of policies) {
    if (policy.status !== 'settled') continue;
    const dateIssued = policy.dateIssued;
    if (!dateIssued) continue;
    const d = dateIssued.toDate ? dateIssued.toDate() : new Date(dateIssued);
    // Guard invalid dates — NaN.toISOString() throws RangeError.
    if (isNaN(d.getTime())) continue;
    const periodKey = ymdUTC(d).slice(0, 7);
    if (!map[periodKey]) map[periodKey] = { periodKey, settledAPI: 0, settledApps: 0, persistency: 0 };
    map[periodKey].settledAPI += parseFloat(policy.settledAPI) || 0;
    map[periodKey].settledApps += 1;
  }
  return Object.values(map);
}
