/**
 * monthlyPlanMath.js — pure monthly-plan math helpers (Game Plan Step 3, Slice 1).
 *
 * No React, no Firebase: deterministic transforms the Monthly Plan panel will
 * consume (Slice 2) and the StepRail/cascade wiring will read (Slice 3).
 *
 * Write / plan side:
 *   seedEvenSplit, balanceDelta, autoDistributeRemainder, monthEditable
 *
 * Read / pace side:
 *   bucketActualsByMonth, monthlyPace, ytdDelta
 *
 * Reuse map (brief Reconciliation 3):
 *   - extractTotalProductionCredit (extractFields) — per-submission API
 *   - parseDateOnlyTT (dateInputs) — TT-local date parsing for month bucketing
 *   - PACE_ON_TRACK_FRACTION (planVariance) — band threshold, single-sourced
 *   - DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI (goalDecomposition) — apps conversion
 *
 * Invariant: Σ targets === anchorAPI (enforced by helpers + asserted in tests).
 */

import { extractTotalProductionCredit } from '../utils/extractFields';
import { parseDateOnlyTT } from '../utils/dateInputs';
import { PACE_ON_TRACK_FRACTION } from '../utils/planVariance';
import { DEFAULT_DECOMPOSITION_INPUTS } from '../utils/goalDecomposition';

const AVG_POLICY_API = DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI;

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// ── Write / plan side ─────────────────────────────────────────────────────────

/**
 * seedEvenSplit — 12 equal targets summing to anchorAPI exactly.
 * Last month absorbs the rounding remainder so Σ === anchorAPI precisely.
 *
 * @param {number} anchorAPI — full TTD annual target
 * @returns {number[12]}
 */
export function seedEvenSplit(anchorAPI) {
  const anchor = parseFloat(anchorAPI) || 0;
  const perMonth = Math.round((anchor / 12) * 100) / 100;
  const targets = Array(11).fill(perMonth);
  targets.push(parseFloat((anchor - perMonth * 11).toFixed(2)));
  return targets;
}

/**
 * balanceDelta — Σ targets − anchorAPI.
 * 0 = balanced; positive = over-allocated; negative = under-allocated.
 * The panel's "vs annual" readout; Save is gated on === 0.
 *
 * @param {number[]} targets
 * @param {number} anchorAPI
 * @returns {number}
 */
export function balanceDelta(targets, anchorAPI) {
  const anchor = parseFloat(anchorAPI) || 0;
  const sum = (targets || []).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  return parseFloat((sum - anchor).toFixed(2));
}

/**
 * autoDistributeRemainder — spread the delta evenly across untouched future
 * months (indices > currentMonthIndex). Last future month absorbs rounding so
 * the result sums to anchorAPI exactly. Past + current months are not touched.
 *
 * @param {number[]} targets
 * @param {number} anchorAPI
 * @param {number} currentMonthIndex — 0-based (January = 0)
 * @returns {number[12]}
 */
export function autoDistributeRemainder(targets, anchorAPI, currentMonthIndex) {
  const anchor = parseFloat(anchorAPI) || 0;
  const t = (targets || []).map((v) => parseFloat(v) || 0);
  const futureIndices = [];
  for (let i = currentMonthIndex + 1; i < 12; i++) futureIndices.push(i);
  if (!futureIndices.length) return t;

  const delta = t.reduce((s, v) => s + v, 0) - anchor;
  if (delta === 0) return t;

  const perMonth = Math.round((delta / futureIndices.length) * 100) / 100;
  for (let i = 0; i < futureIndices.length - 1; i++) {
    t[futureIndices[i]] = parseFloat((t[futureIndices[i]] - perMonth).toFixed(2));
  }
  // Last future month set exactly so Σ === anchor
  const lastIdx = futureIndices[futureIndices.length - 1];
  const sumWithoutLast = t.reduce((s, v, i) => (i === lastIdx ? s : s + v), 0);
  t[lastIdx] = parseFloat((anchor - sumWithoutLast).toFixed(2));
  return t;
}

/**
 * monthEditable — past months are locked, current + future are editable.
 *
 * @param {number} monthIndex — 0-based
 * @param {number} currentMonthIndex — 0-based
 * @returns {boolean}
 */
export function monthEditable(monthIndex, currentMonthIndex) {
  return monthIndex >= currentMonthIndex;
}

// ── Read / pace side ──────────────────────────────────────────────────────────

/**
 * bucketActualsByMonth — group submissions' API into a 12-slot actuals array.
 *
 * Each submission belongs to the month of its weekStarting Sunday (TT-local).
 * Weeks straddling a month boundary are assigned by their Sunday — the simple,
 * explainable rule (Reconciliation 2). Subs outside `year` are ignored.
 *
 * @param {object[]} submissions — raw submission docs (any schema variant)
 * @param {number} year
 * @returns {number[12]} full-TTD actuals per month
 */
export function bucketActualsByMonth(submissions, year) {
  const buckets = Array(12).fill(0);
  for (const sub of (submissions || [])) {
    if (!sub?.weekStarting) continue;
    let d;
    try { d = parseDateOnlyTT(sub.weekStarting); } catch { continue; }
    if (d.getFullYear() !== year) continue;
    buckets[d.getMonth()] += extractTotalProductionCredit(sub);
  }
  return buckets.map((v) => parseFloat(v.toFixed(2)));
}

/**
 * monthlyPace — pace + variance for one month.
 *
 * expectedToDate = target × elapsedCalendarDays ÷ daysInMonth (TT-time).
 * State reuses planVariance's band thresholds (PACE_ON_TRACK_FRACTION = 0.9).
 * Only meaningful for the current month; past = settled, future = target-only.
 *
 * @param {number} target — full-TTD monthly target
 * @param {number} year
 * @param {number} monthIndex — 0-based
 * @param {number} actualToDate — full-TTD actuals so far this month
 * @param {string} todayTT — YYYY-MM-DD in TT timezone (from getTodayTT())
 * @returns {{ expectedToDate:number, state:'ahead'|'on-track'|'behind', toFinishAPI:number, toFinishApps:number }}
 */
export function monthlyPace(target, year, monthIndex, actualToDate, todayTT) {
  const t = parseFloat(target) || 0;
  const actual = parseFloat(actualToDate) || 0;
  const dim = daysInMonth(year, monthIndex);

  let elapsed = 0;
  if (todayTT) {
    const today = parseDateOnlyTT(todayTT);
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    if (todayYear === year && todayMonth === monthIndex) {
      elapsed = today.getDate();
    } else if (todayYear > year || (todayYear === year && todayMonth > monthIndex)) {
      elapsed = dim;
    }
    // future month → elapsed stays 0
  }

  const expectedToDate = dim > 0 ? parseFloat((t * elapsed / dim).toFixed(2)) : 0;

  let state;
  if (t <= 0) {
    state = 'on-track';
  } else if (actual >= t) {
    state = 'ahead';
  } else if (expectedToDate <= 0) {
    state = 'on-track';
  } else if (actual >= PACE_ON_TRACK_FRACTION * expectedToDate) {
    state = 'on-track';
  } else {
    state = 'behind';
  }

  const toFinishAPI = parseFloat(Math.max(0, t - actual).toFixed(2));
  const toFinishApps = parseFloat((AVG_POLICY_API > 0 ? toFinishAPI / AVG_POLICY_API : 0).toFixed(4));

  return { expectedToDate, state, toFinishAPI, toFinishApps };
}

/**
 * ytdDelta — Σ(actual − target) over completed months only (indices < currentMonthIndex).
 * The "+9K ahead" YTD pace figure for the panel header.
 *
 * @param {number[]} actualByMonth — from bucketActualsByMonth
 * @param {number[]} targets — plan targets
 * @param {number} currentMonthIndex — 0-based
 * @returns {number}
 */
export function ytdDelta(actualByMonth, targets, currentMonthIndex) {
  let delta = 0;
  for (let i = 0; i < currentMonthIndex; i++) {
    delta += (parseFloat(actualByMonth?.[i]) || 0) - (parseFloat(targets?.[i]) || 0);
  }
  return parseFloat(delta.toFixed(2));
}
