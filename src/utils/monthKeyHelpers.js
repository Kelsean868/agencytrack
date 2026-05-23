/**
 * monthKeyHelpers.js — YYYY-MM ↔ MM-YYYY conversion + picker generation.
 *
 * Rule (locked in I2 brief): monthKey is STORED as 'YYYY-MM' (ISO, sorts
 * chronologically as a plain string). It is DISPLAYED as 'MM-YYYY' (T&T
 * convention). Never invert: storing MM-YYYY would break index/range queries.
 *
 * All callers that render a month to the user go through formatMonthKey().
 * All callers that store a month go through currentMonthKey() / recentMonthKeys()
 * — which return YYYY-MM directly — or accept user picker values already in
 * YYYY-MM (the picker's option value is YYYY-MM; the label uses formatMonthKey).
 */

/**
 * Store → display: 'YYYY-MM' → 'MM-YYYY'.
 * Returns the input unchanged if it does not match the expected format.
 */
export function formatMonthKey(monthKey) {
  if (typeof monthKey !== 'string') return '';
  const m = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!m) return monthKey;
  return `${m[2]}-${m[1]}`;
}

/**
 * Display → store: 'MM-YYYY' → 'YYYY-MM'.
 * Returns the input unchanged if it does not match the expected format.
 * Used when a picker value arrives in display format (edge case — prefer
 * keeping picker values in YYYY-MM at the option level).
 */
export function parseMonthKey(displayKey) {
  if (typeof displayKey !== 'string') return '';
  const m = displayKey.match(/^(\d{2})-(\d{4})$/);
  if (!m) return displayKey;
  return `${m[2]}-${m[1]}`;
}

/**
 * Current calendar month as 'YYYY-MM' (UTC-safe).
 */
export function currentMonthKey() {
  const now = new Date();
  const y  = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}`;
}

/**
 * Returns the last `count` calendar months as 'YYYY-MM' strings, newest first.
 * Uses UTC arithmetic to avoid DST-related month-boundary issues.
 */
export function recentMonthKeys(count = 12) {
  const keys = [];
  const now  = new Date();
  for (let i = 0; i < count; i++) {
    const d  = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${mo}`);
  }
  return keys;
}
