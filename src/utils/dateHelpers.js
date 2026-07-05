export function getMostRecentSunday() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());
  return toDateString(d);
}

export function getLastNSundays(n) {
  const sundays = [];
  const base = new Date();
  base.setDate(base.getDate() - base.getDay());
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i * 7);
    sundays.push(toDateString(d));
  }
  return sundays;
}

export function getLastNSundaysForDropdown(n = 6) {
  return getLastNSundays(n).map((value) => ({
    value,
    label: new Date(value + 'T12:00:00Z').toLocaleDateString('en-TT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }),
  }));
}

function toDateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sunday-anchored, floored week-of-year number (matches Daily Capture's
 * historical `isoWeekNumber` and the manager roster's `isoWeekNum`).
 *
 * Accepts either a live `Date` or a `'YYYY-MM-DD'` string. Both inputs are
 * reduced to a UTC-midnight calendar day before the identical week arithmetic,
 * so a live evening `Date` in Trinidad (UTC−4) yields the same week as the
 * Daily-Capture local-date string for that same calendar day — no intraday
 * drift, no timezone roll-over divergence.
 *
 * @param {Date|string} dateOrStr - a Date, or 'YYYY-MM-DD'. Defaults to now.
 * @returns {number} week of year (1-based, floored).
 */
export function weekNumber(dateOrStr = new Date()) {
  let dayUTC;
  let year;
  if (typeof dateOrStr === 'string') {
    // Parse the calendar day at noon UTC to avoid any DST/offset edge, then
    // read UTC getters (the string carries no local-time meaning).
    const d = new Date(dateOrStr + 'T12:00:00Z');
    year = d.getUTCFullYear();
    dayUTC = Date.UTC(year, d.getUTCMonth(), d.getUTCDate());
  } else {
    // Live Date: normalize to the LOCAL calendar day so an evening TT time
    // does not roll to the next UTC day.
    year = dateOrStr.getFullYear();
    dayUTC = Date.UTC(year, dateOrStr.getMonth(), dateOrStr.getDate());
  }
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const diffDays = Math.floor((dayUTC - jan1.getTime()) / 86400000);
  return Math.ceil((diffDays + jan1.getUTCDay() + 1) / 7);
}
