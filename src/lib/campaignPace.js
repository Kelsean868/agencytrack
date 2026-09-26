/**
 * campaignPace.js — the "what it takes per week" maths for a campaign card.
 *
 * Home redesign R1 (docs/briefs/home-campaign-redesign.md § R1 block 3): the
 * compact campaign card's pace line is "remaining ÷ weeks left to
 * `campaign.endDate`". R2's Campaign screen reuses the same function so the two
 * surfaces cannot disagree.
 *
 * Pure functions only. Nothing here is stored.
 */

const DAYS_PER_WEEK = 7;

/** Weeks left from a whole-day count (fractional: 96 days → 13.714…). Null when none left. */
export function weeksLeftFromDays(daysLeft) {
  const d = Number(daysLeft);
  if (!Number.isFinite(d) || d <= 0) return null;
  return d / DAYS_PER_WEEK;
}

/**
 * campaignPace({ apiCurrent, apiTarget, appsCurrent, appsTarget, daysLeft })
 *
 * @returns {null | {
 *   weeksLeft: number,
 *   apiRemaining: number, apiPerWeek: number,
 *   appsRemaining: number, appsPerWeekLow: number, appsPerWeekHigh: number,
 * }}
 * Null when the campaign has ended or there is no target to pace toward.
 * Apps per week is a whole-number range (floor–ceil of the exact rate): an
 * agent writes whole applications, so 2.48 a week reads as "2–3".
 */
export function campaignPace({ apiCurrent, apiTarget, appsCurrent, appsTarget, daysLeft }) {
  const weeksLeft = weeksLeftFromDays(daysLeft);
  if (weeksLeft == null) return null;
  const hasApiTarget = Number.isFinite(Number(apiTarget)) && apiTarget != null;
  const hasAppsTarget = Number.isFinite(Number(appsTarget)) && appsTarget != null;
  if (!hasApiTarget && !hasAppsTarget) return null;

  const apiRemaining = hasApiTarget ? Math.max(0, Number(apiTarget) - (Number(apiCurrent) || 0)) : 0;
  const appsRemaining = hasAppsTarget ? Math.max(0, Number(appsTarget) - (Number(appsCurrent) || 0)) : 0;
  const appsRate = appsRemaining / weeksLeft;

  return {
    weeksLeft,
    apiRemaining,
    apiPerWeek: apiRemaining / weeksLeft,
    appsRemaining,
    appsPerWeekLow: Math.floor(appsRate),
    appsPerWeekHigh: Math.ceil(appsRate),
  };
}

/**
 * Compact money/count label: 14660.6 → "14.7K", 275000 → "275K", 1250000 → "1.25M",
 * 950 → "950". Trailing ".0" is dropped. Used where a card has no room for the
 * full figure; the full value always goes in the aria-label.
 */
export function formatCompact(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  if (abs >= 1_000_000) return `${trim((v / 1_000_000).toFixed(2))}M`;
  if (abs >= 1_000) return `${trim((v / 1_000).toFixed(1))}K`;
  return String(Math.round(v));
}

/** "2–3" or "2" when the range collapses. */
export function formatAppsRange(low, high) {
  return low === high ? String(low) : `${low}–${high}`;
}

/** The pace sentence, or null when there is nothing to pace toward. */
export function paceLine(pace) {
  if (!pace) return null;
  const parts = [];
  if (pace.apiRemaining > 0) parts.push(`TTD ${formatCompact(pace.apiPerWeek)}`);
  if (pace.appsRemaining > 0) parts.push(`${formatAppsRange(pace.appsPerWeekLow, pace.appsPerWeekHigh)} apps`);
  if (parts.length === 0) return 'Next-tier targets met';
  return `Pace: ${parts.join(' + ')} / week`;
}
