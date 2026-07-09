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

/**
 * Compute WAR KPI completion for the CompletionRing (item 2.1).
 *
 * Honest denominator: ONLY KPIs that carry a configured target count toward the
 * ring — a numeric standard set (> 0) or a boolean expectation (=== true). KPIs
 * with no configured target are EXCLUDED from the denominator rather than
 * fabricated as "met" (this deliberately diverges from the war-v2 mockup's
 * warCompletion(), which counts all six KPIs and treats no-target KPIs as met
 * on any activity). "met" is derived as measured − missed, reusing
 * computeMissedActivities for a single source of truth on the met/under rule.
 *
 * @param {object} war   WAR-shaped object (activity fields at the root). For My
 *                       WAR the caller must inject the live jfwCount
 *                       (getOwnJfwCount), since it is not part of the form.
 * @param {object} resolvedStandards  per-key resolved target/expectation map.
 * @returns {{ met: number, total: number, pct: number|null }}
 *          total = configured-target count; pct = null when total === 0.
 */
export function computeWarCompletion(war, resolvedStandards) {
  if (!war || !resolvedStandards) return { met: 0, total: 0, pct: null };

  let total = 0;
  for (const key of NUMERIC_STANDARDS) {
    if (hasNumericTarget(resolvedStandards[key])) total++;
  }
  for (const key of BOOLEAN_STANDARDS) {
    if (resolvedStandards[key] === true) total++;
  }

  if (total === 0) return { met: 0, total: 0, pct: null };

  const missed = computeMissedActivities(war, resolvedStandards).length;
  const met = Math.max(0, total - missed);
  return { met, total, pct: Math.round((met / total) * 100) };
}
