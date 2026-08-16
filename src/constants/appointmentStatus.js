/**
 * APPOINTMENT_STATUSES — the single source of truth for the appointment STATUS
 * vocabulary (v3 rule 1, applied to the second vocabulary after activity codes).
 *
 * Before this file the vocabulary lived in two places that could not see each
 * other: the `{ key, label }` contract enum in `plannerService.js`, and the
 * `COMPLETED_STATUSES` / `RETIRED_STATUSES` Sets in `planner.helpers.js`. Both
 * are now derived from the table below, so adding or reclassifying a status is
 * one edit here.
 *
 * WHY THIS IS WORTH A LEAF OF ITS OWN. `completed` is the predicate that decides
 * whether an appointment counts as EVIDENCE on the activity ledger
 * (`src/lib/activityLedger.js`). A ledger that gets "done" wrong does not throw —
 * it silently drops work an agent actually did, on the one surface where the
 * product cannot afford to be wrong about a named agent. A locally-defined copy
 * of that predicate would be a twin of `COMPLETED_STATUSES`, guarded by nothing.
 *
 * `src/lib/` may not import from `src/services/` or `src/components/`, so a
 * shared leaf under `src/constants/` is the only placement that lets the ledger,
 * the service and the planner components all read one definition.
 *
 * This file is a LEAF: it imports nothing.
 *
 * ── Fields ──────────────────────────────────────────────────────────────────
 *   key        the stored enum value (mirrored in firestore.rules — see below)
 *   label      display form
 *   completed  the plan was carried out; counts as evidence on the ledger
 *   retired    the slot is retained but is no longer active (dimmed / struck).
 *              Retired is NOT the negation of completed — `scheduled` is neither.
 *
 * ── Mirrored in firestore.rules ─────────────────────────────────────────────
 * `validApptWrite` carries a literal `d.status in [...]` allowlist. KEY ORDER IS
 * LOAD-BEARING for `STATUS_KEYS`, which `plannerService.test.js` pins exactly;
 * adding a status here requires the rules literal to be extended in the same
 * human-merge PR, then deployed, exactly as for activity codes.
 */

export const APPOINTMENT_STATUSES = Object.freeze([
  Object.freeze({ key: 'scheduled', label: 'Scheduled', completed: false, retired: false }),
  Object.freeze({ key: 'confirmed', label: 'Confirmed', completed: false, retired: false }),
  Object.freeze({ key: 'kept',      label: 'Kept',      completed: true,  retired: false }),
  Object.freeze({ key: 'done',      label: 'Done',      completed: true,  retired: false }),
  Object.freeze({ key: 'postponed', label: 'Postponed', completed: false, retired: true }),
  Object.freeze({ key: 'cancelled', label: 'Cancelled', completed: false, retired: true }),
]);

/** Ordered enum keys. Order is pinned by plannerService.test.js — do not sort. */
export const STATUS_KEYS = Object.freeze(APPOINTMENT_STATUSES.map((s) => s.key));

/** Statuses that count as the plan being carried out. */
export const COMPLETED_STATUSES = Object.freeze(
  new Set(APPOINTMENT_STATUSES.filter((s) => s.completed).map((s) => s.key)),
);

/** Statuses that RETAIN a slot but read as "no longer active" (dimmed/struck). */
export const RETIRED_STATUSES = Object.freeze(
  new Set(APPOINTMENT_STATUSES.filter((s) => s.retired).map((s) => s.key)),
);

/**
 * True when an appointment counts as EVIDENCE: it was carried out and was not
 * retired. Both arms are required — they are independent flags, not opposites.
 * This is the ledger's `done` predicate; see the file header before changing it.
 */
export function isEvidenced(status) {
  return COMPLETED_STATUSES.has(status) && !RETIRED_STATUSES.has(status);
}
