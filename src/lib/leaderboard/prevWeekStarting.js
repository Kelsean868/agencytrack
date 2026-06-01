/**
 * prevWeekStarting — client-side mirror of the leaderboard CF's
 * `priorWeekStartingString`.
 *
 * Returns the YYYY-MM-DD Sunday of the most-recently-completed WAR week in
 * Trinidad time (UTC-4, no DST). This is the SAME doc-id the
 * leaderboard-aggregate Cloud Function writes to
 * `tenants/{tenantId}/weeklyChampions/{weekStarting}` (P5-prep).
 *
 * Why this isn't `getLastNSundays(2)[1]` (the retired banner's formula):
 *   `getLastNSundays(2)[1]` calls `Date.getDay()` against the browser's
 *   LOCAL timezone. Tatil agents in Trinidad are UTC-4 — local time matches
 *   TT exactly, so the legacy formula works for them. But the smoke harness
 *   runs from a non-TT host AND any agent traveling outside TT (or whose
 *   system clock has drifted) would silently compute a DIFFERENT Sunday
 *   from the CF — reading a doc that doesn't exist → permanently-empty
 *   banner regardless of real champion data.
 *
 * Mirrors `functions/leaderboard/leaderboardAggregate.js`:
 *   - referenceDate − 7 days → priorRef (a date inside last week, in UTC)
 *   - getPeriodBoundaries('week', priorRef) → that week's TT-aware Sunday
 *     (TT-anchored boundary expressed as a UTC Date)
 *   - shift back to TT-local components → YYYY-MM-DD
 *
 * Uses the ESM `getPeriodBoundaries` (the source-of-truth), which is
 * cross-checked at 85 tests against the CJS twin the CF imports. The
 * client and the CF therefore compute the same key by construction.
 */

import { getPeriodBoundaries } from '../productionReport/computations';

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function padDateString(yyyy, mm, dd) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function prevWeekStarting(referenceDate = new Date()) {
  const priorRef = new Date(referenceDate.getTime() - 7 * 24 * 3600 * 1000);
  const { start } = getPeriodBoundaries('week', priorRef);
  // `start` is the Trinidad-local Sunday 00:00 expressed as a UTC Date.
  // Shift back by the TT offset to read YYYY-MM-DD in TT-local components.
  const tt = new Date(start.getTime() - TRINI_OFFSET_MS);
  return padDateString(tt.getUTCFullYear(), tt.getUTCMonth() + 1, tt.getUTCDate());
}
