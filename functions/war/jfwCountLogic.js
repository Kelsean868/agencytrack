'use strict';

/**
 * Pure logic for the onWarWrite CF — no Firebase deps, exportable for unit tests.
 * Mirror of getOwnJfwCount in managerWarService.js (must stay in sync).
 */

/**
 * Derive the exclusive week-end date string from a Sunday weekStart.
 * Uses UTC-noon anchor (T12:00:00Z) to avoid DST edge-cases, identical
 * to the client-side getOwnJfwCount implementation.
 */
function computeWeekEnd(weekStart) {
  const d = new Date(weekStart + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Count joint-call docs where appointmentKept === true (strict boolean).
 * Applied client-side after the Firestore query, mirroring getOwnJfwCount.
 *
 * @param {Array<{data: () => object}>} docs - Firestore QueryDocumentSnapshot array
 */
function computeJfwCount(docs) {
  return docs.filter((d) => d.data().appointmentKept === true).length;
}

/**
 * Loop-guard: only write back to Firestore if the recomputed count differs
 * from what is already stored on the WAR doc.
 */
function shouldWriteBack(stored, computed) {
  return stored !== computed;
}

module.exports = { computeWeekEnd, computeJfwCount, shouldWriteBack };
