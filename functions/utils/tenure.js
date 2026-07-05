'use strict';

/**
 * Whole completed years between a YYYY-MM-DD date string and "now", measured in
 * Trinidad & Tobago local time (permanent UTC-4, no DST).
 *
 * Parses the date parts out of the string rather than `new Date(dateStr)` so the
 * midnight UTC-4 boundary can never shift the calendar day (a naive parse treats
 * 'YYYY-MM-DD' as UTC midnight, which is the previous evening in T&T). `nowMs` is
 * injected (`Date.now()`) so callers and tests stay deterministic.
 *
 * Returns 0 for a missing / empty / malformed / future date — the safe default is
 * "no tenure credit", so the tenure floor marker only fires when we can positively
 * establish >= N whole years of service.
 *
 * @param {string} dateStr - contract start date, 'YYYY-MM-DD' (extra time suffix ignored).
 * @param {number} nowMs   - current epoch milliseconds (e.g. Date.now()).
 * @returns {number} whole completed years (>= 0).
 */
function wholeYearsSince(dateStr, nowMs) {
  if (typeof dateStr !== 'string') return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return 0;
  const cy = Number(m[1]);
  const cm = Number(m[2]);
  const cd = Number(m[3]);
  // "Today" in T&T = UTC shifted -4h, then read the UTC calendar parts.
  const tt = new Date(nowMs - 4 * 60 * 60 * 1000);
  const ty = tt.getUTCFullYear();
  const tm = tt.getUTCMonth() + 1;
  const td = tt.getUTCDate();
  let years = ty - cy;
  if (tm < cm || (tm === cm && td < cd)) years -= 1;
  return Math.max(0, years);
}

module.exports = { wholeYearsSince };
