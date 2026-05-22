// Track I · I3a — Tier 1 accountability flag.
//
// Pure helper: given a WAR (or WAR-shaped object) and a resolved-standards map
// (output of getResolvedStandards), return the list of activities the WAR is
// under target on. Used by ManagerWarTab + ManagerWarDetail flag panels and
// the TeamWarsTab list-row badge.
//
// "Missed" semantics (locked by spec §2/§4):
//   - Numeric activity: actual < target, ONLY when target is set (numeric > 0).
//     No target = not measured = never missed.
//   - Boolean expectation: expected === true AND actual === false.
//     No expectation (expected !== true) = not measured = never missed.

import {
  NUMERIC_STANDARDS,
  BOOLEAN_STANDARDS,
} from '../services/managerActivityStandardsService';

// Labels mirror the long-form already used by ManagerWarTab / ManagerWarDetail
// so the flag panel reads the same as the inline overlay.
export const STANDARD_LABELS = {
  jfwCount:             'Joint Field Work (JFW)',
  oneOnOnesConducted:   'One-on-One Pipeline Reviews',
  namesSourced:         'Names Sourced',
  interviewsConducted:  'Initial Interviews Conducted',
  recruitsInFirstWeeks: 'New Recruits in First Weeks',
  trainingSessions:     'Training Sessions Delivered',
  unitMeetingHeld:      'Unit / Branch Meeting Held',
  dashboardReviewDone:  'Planning & Dashboard Review Done',
};

function hasNumericTarget(target) {
  if (target == null) return false;
  const n = Number(target);
  return Number.isFinite(n) && n > 0;
}

/**
 * Compute the missed-activity list for a single WAR.
 *
 * @param {object} war  WAR-shaped object with the activity fields at the root
 *                      (jfwCount, oneOnOnesConducted, namesSourced,
 *                       interviewsConducted, recruitsInFirstWeeks,
 *                       trainingSessions, unitMeetingHeld, dashboardReviewDone).
 *                      Missing or null fields are treated as 0 / false.
 * @param {object} resolvedStandards  output of getResolvedStandards (per-key
 *                      target/expectation, override ?? org-default).
 * @returns {Array<{ key: string, label: string, actual: number|boolean,
 *                   target: number|true, type: 'numeric'|'boolean' }>}
 */
export function computeMissedActivities(war, resolvedStandards) {
  if (!war || !resolvedStandards) return [];
  const missed = [];

  for (const key of NUMERIC_STANDARDS) {
    const target = resolvedStandards[key];
    if (!hasNumericTarget(target)) continue;
    const raw = war[key];
    const actual = raw == null ? 0 : Number(raw);
    if (!Number.isFinite(actual)) continue;
    if (actual < Number(target)) {
      missed.push({
        key,
        label: STANDARD_LABELS[key] ?? key,
        actual,
        target: Number(target),
        type: 'numeric',
      });
    }
  }

  for (const key of BOOLEAN_STANDARDS) {
    const expected = resolvedStandards[key];
    if (expected !== true) continue;
    const actual = war[key] === true;
    if (!actual) {
      missed.push({
        key,
        label: STANDARD_LABELS[key] ?? key,
        actual: false,
        target: true,
        type: 'boolean',
      });
    }
  }

  return missed;
}
