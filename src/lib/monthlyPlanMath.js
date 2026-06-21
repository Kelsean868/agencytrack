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
import { deriveAnnualApps } from './deriveApps';

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
 * autoDistributeRemainder — fill the empty (TT$0) months with what's left of the
 * annual target, preserving every month the agent has already typed a value into.
 *
 * "Typed" = any month with a value > 0 (non-zero heuristic — no new state field,
 * no schema change). The distributable remainder is:
 *     remainder = anchorAPI − Σ(months with value > 0)
 * which is spread evenly across the months currently at 0 that are editable
 * (current + future, i.e. index >= currentMonthIndex). Past months are never
 * touched — a past month at 0 stays 0.
 *
 * Rounding rule: each empty month receives round(remainder / n, 2dp); the LAST
 * empty month absorbs the rounding residue (remainder − perMonth × (n − 1)) so
 * the distributed portion sums to `remainder` exactly, hence Σ(all 12) === anchor.
 *
 * Clamp: if remainder <= 0 (already balanced or over-allocated) or there are no
 * empty editable months, the array is returned unchanged — the remainder is never
 * pushed negative into a month.
 *
 * Accepted v1 consequences (by design, not bugs):
 *   (a) an intentional TT$0 month cannot be represented — a 0 reads as empty and
 *       receives a share;
 *   (b) the button is effectively one-shot — once empty months are filled they
 *       read as typed, so a second click redistributes nothing until months are
 *       cleared back to 0.
 *
 * @param {number[]} targets
 * @param {number} anchorAPI — full TTD annual target
 * @param {number} currentMonthIndex — 0-based (January = 0)
 * @returns {number[12]}
 */
export function autoDistributeRemainder(targets, anchorAPI, currentMonthIndex) {
  const anchor = parseFloat(anchorAPI) || 0;
  const t = (targets || []).map((v) => parseFloat(v) || 0);

  // Preserve typed months (value > 0); the remainder is what the annual target
  // has left over once those are subtracted.
  const typedSum = t.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const remainder = parseFloat((anchor - typedSum).toFixed(2));

  // Empty months eligible to receive: at 0 and not in the past.
  const emptyIndices = [];
  for (let i = currentMonthIndex; i < 12; i++) {
    if (t[i] === 0) emptyIndices.push(i);
  }

  // Clamp: nothing to place, or nowhere to place it → unchanged.
  if (remainder <= 0 || emptyIndices.length === 0) return t;

  const perMonth = Math.round((remainder / emptyIndices.length) * 100) / 100;
  for (let i = 0; i < emptyIndices.length - 1; i++) {
    t[emptyIndices[i]] = perMonth;
  }
  // Last empty month absorbs the rounding residue so Σ(filled) === remainder exactly.
  const lastIdx = emptyIndices[emptyIndices.length - 1];
  t[lastIdx] = parseFloat((remainder - perMonth * (emptyIndices.length - 1)).toFixed(2));
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
export function monthlyPace(target, year, monthIndex, actualToDate, todayTT, avgPolicyAPI = AVG_POLICY_API) {
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
  const toFinishApps = parseFloat(deriveAnnualApps(toFinishAPI, avgPolicyAPI).toFixed(4));

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

// ── Recovery & Catch-up ───────────────────────────────────────────────────────

const RECOVERY_STRETCH_MULTIPLE = 1.5;

/**
 * recoveryPace — pace readout for catch-up planning.
 *
 * Settled months are those with indices < currentMonthIndex (completed).
 * Remaining months are currentMonthIndex through 11 (current + future).
 *
 * @param {number} anchorAPI — full TTD annual target
 * @param {number[]} actualByMonth — from bucketActualsByMonth
 * @param {number} currentMonthIndex — 0-based
 * @returns {{
 *   settledToDate: number,
 *   stillNeeded: number,
 *   remainingCount: number,
 *   pacePerMonth: number,
 *   originalPerMonth: number,
 *   isStretch: boolean
 * }}
 */
export function recoveryPace(anchorAPI, actualByMonth, currentMonthIndex) {
  const anchor = parseFloat(anchorAPI) || 0;
  const actuals = actualByMonth || [];

  const completed = [];
  for (let i = 0; i < currentMonthIndex; i++) completed.push(i);

  const settledToDate = completed.reduce(
    (s, i) => s + (parseFloat(actuals[i]) || 0),
    0,
  );
  const settledToDateRounded = parseFloat(settledToDate.toFixed(2));

  const remainingCount = 12 - currentMonthIndex;
  const stillNeeded = Math.max(0, anchor - settledToDateRounded);
  const pacePerMonth = remainingCount > 0
    ? parseFloat((stillNeeded / remainingCount).toFixed(2))
    : 0;
  const originalPerMonth = parseFloat((anchor / 12).toFixed(2));
  const isStretch = pacePerMonth > originalPerMonth * RECOVERY_STRETCH_MULTIPLE;

  return {
    settledToDate: settledToDateRounded,
    stillNeeded: parseFloat(stillNeeded.toFixed(2)),
    remainingCount,
    pacePerMonth,
    originalPerMonth,
    isStretch,
  };
}

/**
 * absorbShortfall — re-base settled months to actuals, re-spread remainder.
 *
 * Returns a new targets array where:
 * - Settled months (indices < currentMonthIndex) = actualByMonth[i]
 * - Remaining months (indices >= currentMonthIndex) = pacePerMonth (from recoveryPace)
 * - Last remaining month set exactly so Σ targets === anchorAPI
 *
 * @param {number[]} targets — current plan targets
 * @param {number} anchorAPI — full TTD annual target
 * @param {number[]} actualByMonth — from bucketActualsByMonth
 * @param {number} currentMonthIndex — 0-based
 * @returns {number[12]}
 */
export function absorbShortfall(targets, anchorAPI, actualByMonth, currentMonthIndex) {
  const anchor = parseFloat(anchorAPI) || 0;
  const t = (targets || []).map((v) => parseFloat(v) || 0);
  const actuals = actualByMonth || [];

  const pace = recoveryPace(anchor, actuals, currentMonthIndex);
  const { pacePerMonth } = pace;

  const next = [...t];

  // Re-base settled months to actuals
  for (let i = 0; i < currentMonthIndex; i++) {
    next[i] = parseFloat((parseFloat(actuals[i]) || 0).toFixed(2));
  }

  // Spread pacePerMonth across remaining months
  for (let i = currentMonthIndex; i < 12; i++) {
    next[i] = pacePerMonth;
  }

  // Last remaining month set exactly so Σ === anchor
  const lastIdx = 11;
  const sumWithoutLast = next.reduce((s, v, i) => (i === lastIdx ? s : s + v), 0);
  next[lastIdx] = parseFloat((anchor - sumWithoutLast).toFixed(2));

  return next;
}
