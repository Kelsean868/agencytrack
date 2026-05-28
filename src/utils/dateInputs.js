/**
 * dateInputs.js — TT-local date parsing utilities.
 *
 * Convention (from docs/h3-tt-timezone-investigation.md):
 *   Trinidad & Tobago observes permanent AST (UTC-4, no DST).
 *   A date input of type="date" yields a bare "YYYY-MM-DD" string.
 *   `new Date("YYYY-MM-DD")` parses as UTC midnight (ECMAScript §20.4.1.15).
 *   UTC midnight = TT 20:00 the *previous* day — a 4-hour skew that causes
 *   period-key splits on month boundaries (awards engine sees UTC month;
 *   manager filter sees TT local month).
 *
 *   Fix: interpret bare date strings as TT-local midnight = 04:00 UTC same day.
 *   Use these helpers everywhere a YYYY-MM-DD form input is stored as a Timestamp.
 */

/**
 * parseDateOnlyTT — parse a YYYY-MM-DD string as TT-local midnight.
 *
 * Returns a JS Date whose UTC value is 04:00 on the given calendar day,
 * which is exactly midnight in America/Port_of_Spain (UTC-4).
 *
 * @param {string} s — date string in "YYYY-MM-DD" format
 * @returns {Date}
 * @throws if the string is missing or produces an invalid Date
 */
export function parseDateOnlyTT(s) {
  if (!s || typeof s !== 'string') throw new Error(`parseDateOnlyTT: expected string, got ${s}`);
  const d = new Date(`${s}T04:00:00Z`);
  if (isNaN(d.getTime())) throw new Error(`parseDateOnlyTT: invalid date string "${s}"`);
  return d;
}

/**
 * getTodayTT — today's date as "YYYY-MM-DD" in the TT timezone.
 *
 * Safe to call at module load; always reflects the current TT calendar day.
 * Uses en-CA locale which formats as YYYY-MM-DD natively.
 *
 * @returns {string} — e.g. "2025-01-15"
 */
export function getTodayTT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
}
