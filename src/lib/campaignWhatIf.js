/**
 * campaignWhatIf.js — the Campaign screen's "what if" slider maths (R2 block 5,
 * docs/briefs/home-campaign-redesign.md). API only: applications and the
 * persistency gate still have to be met for the prize, and the caller is
 * expected to say so beside the result (never implied here).
 *
 * Pure functions only. Nothing here is stored, and nothing here reads a clock —
 * `today` and `endDate` are supplied by the caller (TT calendar dates,
 * `YYYY-MM-DD`), the same contract `persistencyOutlook.js` uses.
 */

import { parseDateOnlyTT, ymdUTC } from '../utils/dateInputs';

const MS_PER_DAY = 86400000;

/** Whole days between two `YYYY-MM-DD` TT dates (`toDate` − `fromDate`). */
function daysBetween(fromDate, toDate) {
  return Math.round((parseDateOnlyTT(toDate).getTime() - parseDateOnlyTT(fromDate).getTime()) / MS_PER_DAY);
}

/** `today` advanced by a (possibly fractional) number of days, rounded UP —
 * you cannot bank a fraction of a day's business, so the projected date is
 * always the day the target is guaranteed reached, never a day early. */
function addDaysCeil(dateStr, days) {
  const d = parseDateOnlyTT(dateStr);
  d.setUTCDate(d.getUTCDate() + Math.ceil(days));
  return ymdUTC(d);
}

/**
 * The tiers still above the agent's current API, ascending by API. Shared by
 * the tier ladder (R2 block 4) and the what-if projection (block 5) so the two
 * blocks can never name a different "next tier".
 */
export function reachableTiers(tiers, apiCurrent) {
  const current = Number(apiCurrent) || 0;
  return (Array.isArray(tiers) ? tiers : [])
    .map((t) => ({ name: t?.name ?? null, api: Number(t?.api), cash: Number(t?.cash) || 0 }))
    .filter((t) => Number.isFinite(t.api) && t.api > current)
    .sort((a, b) => a.api - b.api);
}

/**
 * whatIfProjection({ apiCurrent, tiers, weeklyRate, today, endDate })
 *
 * Projects the next TWO tiers above the agent's current API at a flat weekly
 * API rate, starting today. A tier whose projected date falls after
 * `endDate` is returned as `notReachedTier` instead of a date, and no tier
 * further up the ladder is evaluated (if the near one isn't reached in time,
 * neither is the one above it).
 *
 * @returns {{
 *   reaches: Array<{ name: string, api: number, cash: number, date: string }>,
 *   notReachedTier: { name: string, api: number, cash: number } | null,
 * }}
 *   Both empty/null when there is no tier left above the agent (already at
 *   the top) or the rate is not a usable positive number.
 */
export function whatIfProjection({ apiCurrent, tiers, weeklyRate, today, endDate }) {
  const upcoming = reachableTiers(tiers, apiCurrent).slice(0, 2);
  const rate = Number(weeklyRate);
  if (!Number.isFinite(rate) || rate <= 0 || upcoming.length === 0) {
    return { reaches: [], notReachedTier: null };
  }

  const totalDaysLeft = typeof endDate === 'string' ? daysBetween(today, endDate) : null;
  const reaches = [];
  for (const tier of upcoming) {
    const remaining = Math.max(0, tier.api - (Number(apiCurrent) || 0));
    const daysNeeded = (remaining / rate) * 7;
    if (totalDaysLeft != null && daysNeeded > totalDaysLeft) {
      return { reaches, notReachedTier: tier };
    }
    reaches.push({ ...tier, date: addDaysCeil(today, daysNeeded) });
  }
  return { reaches, notReachedTier: null };
}

/** 5,000–40,000 in 1,000 steps — the slider's own contract (R2 block 5). */
export const WHAT_IF_MIN = 5000;
export const WHAT_IF_MAX = 40000;
export const WHAT_IF_STEP = 1000;

/** Clamp + round any starting guess onto the slider's own step grid. */
export function clampToWhatIfStep(value) {
  const v = Number(value);
  const rounded = Number.isFinite(v) ? Math.round(v / WHAT_IF_STEP) * WHAT_IF_STEP : WHAT_IF_MIN;
  return Math.min(WHAT_IF_MAX, Math.max(WHAT_IF_MIN, rounded));
}
