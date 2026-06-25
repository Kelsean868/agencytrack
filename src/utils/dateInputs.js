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

/**
 * computeMonthsFromDate — whole months elapsed from a YYYY-MM-DD date to today (TT).
 *
 * Uses TT-local midnight for both endpoints (parseDateOnlyTT) so the result
 * matches TT calendar months, not UTC months.
 *
 * @param {string} dateStr — "YYYY-MM-DD" start date
 * @returns {number} — whole months elapsed, minimum 0
 */
export function computeMonthsFromDate(dateStr) {
  try {
    const start = parseDateOnlyTT(dateStr);
    const today = parseDateOnlyTT(getTodayTT());
    const yearDiff  = today.getUTCFullYear() - start.getUTCFullYear();
    const monthDiff = today.getUTCMonth()    - start.getUTCMonth();
    let months = yearDiff * 12 + monthDiff;
    if (today.getUTCDate() < start.getUTCDate()) months--;
    return Math.max(0, months);
  } catch {
    return 0;
  }
}

const MONTH_KEY_RE = /^\d{4}_\d{2}$/;

/**
 * monthKeyFromDate — the "YYYY_MM" ledger month key for a YYYY-MM-DD date.
 *
 * Pure string slice (no Date math, no timezone) — the calendar month is taken
 * verbatim from the bare date string. Used to anchor the financing ledger to
 * the effectiveDate's first month (Track K · K2).
 *
 * @param {string} dateStr — "YYYY-MM-DD"
 * @returns {string} — "YYYY_MM"
 * @throws if the string is not YYYY-MM-DD
 */
export function monthKeyFromDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`monthKeyFromDate: expected YYYY-MM-DD, got ${dateStr}`);
  }
  return `${dateStr.slice(0, 4)}_${dateStr.slice(5, 7)}`;
}

/**
 * monthsBetweenKeys — whole calendar months from `fromKey` to `toKey`.
 *
 * Pure integer math on "YYYY_MM" keys; ignores day-of-month entirely (a ledger
 * month is a whole calendar month). Negative when `toKey` precedes `fromKey`.
 *
 * @param {string} fromKey — "YYYY_MM"
 * @param {string} toKey — "YYYY_MM"
 * @returns {number} — (toYear*12+toMonth) - (fromYear*12+fromMonth)
 * @throws if either key is not YYYY_MM
 */
export function monthsBetweenKeys(fromKey, toKey) {
  if (!MONTH_KEY_RE.test(fromKey ?? '')) throw new Error(`monthsBetweenKeys: bad fromKey ${fromKey}`);
  if (!MONTH_KEY_RE.test(toKey ?? ''))   throw new Error(`monthsBetweenKeys: bad toKey ${toKey}`);
  const [fy, fm] = fromKey.split('_').map(Number);
  const [ty, tm] = toKey.split('_').map(Number);
  return (ty * 12 + tm) - (fy * 12 + fm);
}

/**
 * enumerateMonthKeys — the inclusive list of "YYYY_MM" keys from `fromKey` to
 * `toKey` (chronological). Returns [] when `toKey` precedes `fromKey`.
 *
 * Used to detect skipped months in the financing ledger (Track K · K2): the
 * full expected month sequence minus the entered set = the gaps.
 *
 * @param {string} fromKey — "YYYY_MM"
 * @param {string} toKey — "YYYY_MM"
 * @returns {string[]} — ["YYYY_MM", …] inclusive of both endpoints
 * @throws if either key is not YYYY_MM
 */
export function enumerateMonthKeys(fromKey, toKey) {
  const span = monthsBetweenKeys(fromKey, toKey);
  if (span < 0) return [];
  const [fy, fm] = fromKey.split('_').map(Number);
  const out = [];
  for (let i = 0; i <= span; i++) {
    const total = (fy * 12 + (fm - 1)) + i; // 0-based month ordinal
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    out.push(`${String(y).padStart(4, '0')}_${String(m).padStart(2, '0')}`);
  }
  return out;
}
