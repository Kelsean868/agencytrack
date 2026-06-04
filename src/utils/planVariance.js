/**
 * planVariance.js — pure plan-vs-actual + variance logic for the Weekly Planner
 * (Game Plan v2 Slice 3a). Sibling of goalDecomposition.js / weeklyPlanAssembly.js.
 *
 * NO React, NO Firebase: just the deterministic transforms the committed-plan
 * pace rows need, so they unit-test in isolation and Slice 3b (WeeklyStandardCard)
 * can consume the SAME API. All date math is TT-safe (UTC-4, no DST) via the
 * dateInputs helpers — the canonical Trinidad timezone trap applies to "elapsed
 * working days" and week membership.
 *
 * Source-of-record switch (brief D3):
 *   · a submitted weekly report for the plan's week → actuals are FINAL (read via
 *     extractFields — the single sanctioned submission reader), chip "final · submitted".
 *   · otherwise → actuals aggregate the week's dailyActivity docs, chip
 *     "mid-week · daily capture", pace marker live.
 *
 * Per-metric actual sources (brief D1, verified 2026-06-04):
 *   callsMade            weekly = computeProspectingCallsActual: 4-sum
 *                                 (referral+followUp+cold+seminarTradeshow; NO serviceCalls).
 *                                 Ratified 2026-06-04: serviceCalls excluded from
 *                                 effort/floor/plan surfaces. Wizard Step-2 displayed
 *                                 total stays the 5-sum (data-entry, unchanged by design).
 *                        daily  = NONE — Daily Capture has no calls/dials field, so the
 *                                   calls row is the hatched "weekly only · no daily pace"
 *                                   state mid-week and only resolves once submitted.
 *   contactsMade         weekly = qualifiedApproaches (telContacts is a read-time alias)
 *                        daily  = qualifiedApproaches
 *   factFindsCompleted   weekly = ffiConducted          daily = ffiConducted
 *   closingInterviewsKept weekly = ciConducted          daily = ciConducted
 *   applicationsSubmitted weekly = newBusiness.apps (via extractFields v2 arm)
 *                        daily  = newBusiness.apps
 *
 * Variance semantics (brief D2, operator-default):
 *   Ahead    actual ≥ plan
 *   On-track actual ≥ 90% of pace
 *   Behind   actual < 90% of pace
 *   · Day-1 suppression — no Behind state until the 2nd working day of the week.
 *   · Elapsed days — working days Mon–Sat (Sunday excluded from the pace denominator;
 *     the week still starts Sunday per domain rules).
 *   · Floor-above-plan — no special state; the floor tick renders wherever it falls,
 *     clamped to the visible track (the plan cap is the right edge of the scale).
 */

import { extractFields } from './extractFields';
import { parseDateOnlyTT } from './dateInputs';
import { PLAN_METRIC_KEYS } from './weeklyPlanAssembly';

export { PLAN_METRIC_KEYS };

// Pace denominator: working days Mon–Sat (Sunday excluded). Brief D2 (locked).
export const PACE_WORKING_DAYS = 6;

// Variance "on-track" floor as a fraction of pace. Brief D2.
export const PACE_ON_TRACK_FRACTION = 0.9;

// Display metadata for the five plan metrics, in render order. `clarifier` is an
// honesty sublabel where the stored field differs from the plain-language name
// (brief D1: Contacts is qualified-approaches under the hood). `hasDailySource`
// marks which metrics Daily Capture can supply mid-week.
export const PACE_METRIC_META = Object.freeze({
  callsMade:             { label: 'Prospecting calls', clarifier: null,               hasDailySource: false },
  contactsMade:          { label: 'Contacts made', clarifier: 'qualified approaches', hasDailySource: true  },
  factFindsCompleted:    { label: 'Fact-finds',    clarifier: null,                  hasDailySource: true  },
  closingInterviewsKept: { label: 'CIs kept',      clarifier: null,                  hasDailySource: true  },
  applicationsSubmitted: { label: 'Applications',  clarifier: null,                  hasDailySource: true  },
});

// Provenance-chip copy + statusToken role per source (brief D3). 'settled' → success
// family, 'soft' → warning family (see policyStatusTokens.js).
export const SOURCE_CHIP = Object.freeze({
  final: { label: 'final · submitted',      role: 'settled' },
  daily: { label: 'mid-week · daily capture', role: 'soft'   },
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPct(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/**
 * computeProspectingCallsActual — the 4-sum prospecting calls from an extractFields() output.
 *
 * Ratified 2026-06-04: service calls do NOT count toward effort/floor/plan surfaces.
 * Service-originated production is fully credited downstream (approaches, FFIs, CIs, apps
 * are call-type-agnostic); counting raw service-call volume credits only the gameable,
 * low-signal part and hides absent prospecting muscle in developing agents.
 *
 * Sum: referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls (NO serviceCalls).
 * The wizard Step-2 displayed total is still the 5-sum (data-entry; unchanged by design).
 * extractFields.totalTelAttempts (also 4-sum, same components) is unchanged and remains
 * the source for YTD/kiosk/PDF/CSV/century-milestone surfaces — those are informational.
 *
 * @param {object} extractedFields — output of extractFields(submission)
 * @returns {number}
 */
export function computeProspectingCallsActual(extractedFields) {
  return (
    num(extractedFields?.referralCalls) +
    num(extractedFields?.followUpCalls) +
    num(extractedFields?.coldCalls) +
    num(extractedFields?.seminarTradeshowCalls)
    // serviceCalls intentionally excluded — see rationale above
  );
}

/**
 * elapsedWorkingDays — working days elapsed in the plan's week, TT-safe.
 *
 * weekStart is the week's Sunday (YYYY-MM-DD). Working days are Mon(1)…Sat(6);
 * Sunday contributes 0. A `today` in a later week caps at PACE_WORKING_DAYS; a
 * `today` before the week start is 0.
 *
 * @param {string} weekStart — YYYY-MM-DD Sunday
 * @param {string} todayTT   — YYYY-MM-DD (TT calendar day, e.g. from getTodayTT())
 * @returns {number} 0…6
 */
export function elapsedWorkingDays(weekStart, todayTT) {
  if (!weekStart || !todayTT) return 0;
  const start = parseDateOnlyTT(weekStart);
  const today = parseDateOnlyTT(todayTT);
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 0;                       // Sunday (start) or earlier
  if (diffDays >= PACE_WORKING_DAYS) return PACE_WORKING_DAYS; // Saturday or later
  return diffDays;                                   // Mon…Fri → 1…5
}

/**
 * computeWeeklyActuals — the five plan-metric actuals from a submitted report.
 * Reads through extractFields (the single sanctioned submission reader); the
 * calls actual is the 4-sum prospecting calls (ratified 2026-06-04 — serviceCalls
 * excluded from effort/floor/plan surfaces; see computeProspectingCallsActual).
 *
 * @param {object} submission — a raw submission doc (any schema variant)
 * @returns {Record<string, number>} keyed by PLAN_METRIC_KEYS
 */
export function computeWeeklyActuals(submission) {
  const f = extractFields(submission) ?? {};
  return {
    callsMade: computeProspectingCallsActual(f),
    contactsMade:          num(f.qualifiedApproaches),
    factFindsCompleted:    num(f.ffiConducted),
    closingInterviewsKept: num(f.ciConducted),
    applicationsSubmitted: num(f.applicationsSold),
  };
}

/**
 * aggregateDailyActuals — sum the four daily-sourced metrics across the week's
 * dailyActivity docs. callsMade is null — Daily Capture has no calls source.
 *
 * @param {Array<object>} dailyDocs — dailyActivity docs for the week (any subset)
 * @returns {Record<string, number|null>} keyed by PLAN_METRIC_KEYS
 */
export function aggregateDailyActuals(dailyDocs) {
  const docs = Array.isArray(dailyDocs) ? dailyDocs : [];
  const acc = {
    callsMade:             null, // no daily source — hatched
    contactsMade:          0,
    factFindsCompleted:    0,
    closingInterviewsKept: 0,
    applicationsSubmitted: 0,
  };
  for (const d of docs) {
    if (!d) continue;
    acc.contactsMade          += num(d.qualifiedApproaches);
    acc.factFindsCompleted    += num(d.ffiConducted);
    acc.closingInterviewsKept += num(d.ciConducted);
    acc.applicationsSubmitted += num(d.newBusiness?.apps);
  }
  return acc;
}

/**
 * varianceState — Ahead / On-track / Behind for one metric (brief D2).
 *
 * Pace = full plan for a final (submitted) source; plan × elapsed ÷ 6 mid-week.
 * Day-1 suppression (no Behind before the 2nd working day) applies to the
 * mid-week source only — a final report is the whole week, nothing to suppress.
 *
 * @param {{ actual:number, plan:number, elapsed:number, source:('final'|'daily') }} p
 * @returns {'ahead'|'on-track'|'behind'}
 */
export function varianceState({ actual, plan, elapsed, source }) {
  const a = num(actual);
  const p = num(plan);
  if (p <= 0) return a >= p ? 'ahead' : 'on-track'; // no plan target → nothing to be behind on
  if (a >= p) return 'ahead';

  const pace = source === 'final' ? p : (p * num(elapsed)) / PACE_WORKING_DAYS;
  if (a >= PACE_ON_TRACK_FRACTION * pace) return 'on-track';

  // Would be Behind — suppress on the first working day mid-week.
  if (source !== 'final' && num(elapsed) <= 1) return 'on-track';
  return 'behind';
}

/**
 * buildPaceRows — the full view-model for the committed-plan pace rows.
 *
 * Resolves the source (final vs daily), assembles per-metric actuals, derives
 * variance + the track render percentages (plan cap = 100% scale; floor and
 * actual clamp to the visible track), and the provenance chip + pace readout.
 *
 * Returns null when there's no committed plan to render against — the card keeps
 * its S1/S2 suggestion/edit surface in that case.
 *
 * @param {{
 *   committedPlan: ({ targets?:object, provenance?:object }|null),
 *   weekSubmission?: (object|null),
 *   dailyDocs?: Array<object>,
 *   floors?: (object|null),
 *   weekStart: string,
 *   todayTT: string,
 * }} input
 * @returns {({ source, chip, elapsed, paceFraction, rows }|null)}
 */
export function buildPaceRows({
  committedPlan,
  weekSubmission = null,
  dailyDocs = [],
  floors = null,
  weekStart,
  todayTT,
}) {
  const targets = committedPlan?.targets;
  if (!targets || typeof targets !== 'object') return null;

  const source = weekSubmission ? 'final' : 'daily';
  const actuals = weekSubmission
    ? computeWeeklyActuals(weekSubmission)
    : aggregateDailyActuals(dailyDocs);

  const elapsed = elapsedWorkingDays(weekStart, todayTT);
  const paceFraction = source === 'final' ? 1 : elapsed / PACE_WORKING_DAYS;

  const rows = PLAN_METRIC_KEYS.map((key) => {
    const meta = PACE_METRIC_META[key] ?? { label: key, clarifier: null, hasDailySource: true };
    const plan = num(targets?.[key]);
    const floor = num(floors?.[key]);
    const provenance = committedPlan?.provenance?.[key] ?? null;

    // Mid-week, a metric Daily Capture can't supply is the hatched no-source state.
    const noDailySource = source === 'daily' && !meta.hasDailySource;
    const rawActual = actuals?.[key];
    const actual = noDailySource || rawActual == null ? null : num(rawActual);

    const variance = actual == null ? null : varianceState({ actual, plan, elapsed, source });

    // Track render — plan cap anchors the scale to 100% (the right edge). Floor
    // and actual clamp to the visible track; the pace marker sits at elapsed ÷ 6.
    const fillPct = actual == null ? 0 : (plan > 0 ? clampPct((actual / plan) * 100) : (actual > 0 ? 100 : 0));
    const floorPct = plan > 0 ? clampPct((floor / plan) * 100) : (floor > 0 ? 100 : 0);
    const pacePct = clampPct(paceFraction * 100);
    const showPace = source === 'daily' && !noDailySource;

    return {
      key,
      label: meta.label,
      clarifier: meta.clarifier,
      plan,
      floor,
      actual,
      provenance,
      noDailySource,
      variance,
      fillPct,
      floorPct,
      pacePct,
      showPace,
    };
  });

  return {
    source,
    chip: SOURCE_CHIP[source],
    elapsed,
    paceFraction,
    rows,
  };
}
