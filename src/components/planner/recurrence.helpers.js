/**
 * recurrence.helpers.js — pure (React-free) helpers for recurring appointments.
 *
 * The Planner materializes a series as N CONCRETE appointment docs (one per
 * occurrence), each carrying series metadata (seriesId / repeatRule / seriesPos
 * / seriesTotal / daysOfWeek?). These helpers own the occurrence-date expansion,
 * the plain-language series preview (create sheet, state 1), the row series line
 * (state 2), and the "next occurrence" used by the postpone consequence panel
 * (state 4). All date math is UTC-noon anchored (same idiom as
 * planner.helpers.buildWeekDates) so it never drifts across TT (UTC-4) days.
 *
 * Design source: docs/design-system/screens-v2/design_handoff_sheet_celebrations_
 * planner/README.md §3 + mockups/planner-recurrence.jsx.
 */

import { formatTime12 } from './planner.helpers';
import { ymdUTC } from '../../utils/dateInputs';

// Repeat cadences (mockup: None / Daily / Weekly / Custom days). 'none' is the
// non-repeating default — a one-off appointment carries NO repeatRule field.
export const REPEAT_RULES = ['none', 'daily', 'weekly', 'custom'];

// Day-of-week keys, indexed by JS Date.getUTCDay() (0=Sun … 6=Sat).
export const DOW_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
// Mockup picker order (M T W T F S S) — Monday-first for the 7-chip picker.
export const DOW_PICKER_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WD_SHORT = { SUN: 'Sun', MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat' };

// Client-side sanity cap on how many concrete instances a single series books
// (one year of weekly). Firestore batched writes cap at 500 — 52 is well under.
export const MAX_SERIES_INSTANCES = 52;

function addDaysUTC(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymdUTC(d);
}
function dowKey(dateStr) {
  return DOW_KEYS[new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
}
function shortDate(dateStr) {
  if (!dateStr) return '';
  // Month-first ("Sep 8") per the mockup preview grammar. en-TT would render
  // day-first ("8 Sep"); en-US gives the designed month-first form.
  return new Date(`${dateStr}T12:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Expand a recurrence rule into an ascending array of 'YYYY-MM-DD' occurrence
 * dates (the first is always `startDate`). Terminates on the end condition and
 * is hard-capped at MAX_SERIES_INSTANCES.
 *
 * @param {object} p
 * @param {string} p.startDate      'YYYY-MM-DD' anchor (first occurrence)
 * @param {string} p.repeatRule     'daily' | 'weekly' | 'custom'
 * @param {string[]} [p.daysOfWeek] subset of DOW_KEYS (custom only)
 * @param {object} p.endCondition   { type: 'count', count } | { type: 'date', onDate }
 * @returns {string[]}
 */
export function expandSeriesDates({ startDate, repeatRule, daysOfWeek = [], endCondition } = {}) {
  if (!startDate) return [];
  if (!repeatRule || repeatRule === 'none') return [startDate];

  const cap = MAX_SERIES_INSTANCES;
  const byCount = endCondition?.type === 'count';
  const count = byCount
    ? Math.max(1, Math.min(cap, parseInt(endCondition.count, 10) || 1))
    : cap;
  const onDate = endCondition?.type === 'date' ? endCondition.onDate : null;
  const out = [];

  if (repeatRule === 'daily') {
    for (let i = 0; i < cap; i += 1) {
      const d = addDaysUTC(startDate, i);
      if (onDate && d > onDate) break;
      out.push(d);
      if (byCount && out.length >= count) break;
    }
  } else if (repeatRule === 'weekly') {
    for (let i = 0; i < cap; i += 1) {
      const d = addDaysUTC(startDate, i * 7);
      if (onDate && d > onDate) break;
      out.push(d);
      if (byCount && out.length >= count) break;
    }
  } else if (repeatRule === 'custom') {
    const set = new Set((daysOfWeek && daysOfWeek.length) ? daysOfWeek : [dowKey(startDate)]);
    // Walk day-by-day; a full year of days is the outer bound (cap*7 is safe).
    for (let i = 0; i < cap * 7 && out.length < cap; i += 1) {
      const d = addDaysUTC(startDate, i);
      if (onDate && d > onDate) break;
      if (set.has(dowKey(d))) {
        out.push(d);
        if (byCount && out.length >= count) break;
      }
    }
  }
  return out.slice(0, cap);
}

/**
 * Human cadence phrase. Weekly → "every Tue"; daily → "every day"; custom →
 * "Tue & Thu" (DOW-ordered, Sun-first). Matches the mockup preview grammar.
 */
export function cadenceLabel({ repeatRule, daysOfWeek = [], startDate } = {}) {
  if (repeatRule === 'daily') return 'every day';
  if (repeatRule === 'weekly') return `every ${WD_SHORT[dowKey(startDate)]}`;
  if (repeatRule === 'custom') {
    const ks = (daysOfWeek && daysOfWeek.length) ? daysOfWeek : [dowKey(startDate)];
    const ordered = DOW_KEYS.filter((k) => ks.includes(k));
    return ordered.map((k) => WD_SHORT[k]).join(' & ');
  }
  return '';
}

/**
 * The mono series line under a recurring row (state 2): "Every Tue · 4 of 12".
 * Capitalizes the cadence phrase; omits position when unknown.
 */
export function seriesRowLabel({ repeatRule, daysOfWeek = [], startDate, seriesPos, seriesTotal } = {}) {
  const cad = cadenceLabel({ repeatRule, daysOfWeek, startDate });
  const cap = cad ? cad.charAt(0).toUpperCase() + cad.slice(1) : '';
  if (seriesPos && seriesTotal) return `${cap} · ${seriesPos} of ${seriesTotal}`;
  return cap;
}

/**
 * Plain-language series preview (create sheet, state 1):
 *   "Books 12 appointments · every Tue, 5:00 PM · through Sep 8"   (count)
 *   "Books 28 appointments · Tue & Thu, 5:00 PM · until Sep 30"    (on-date)
 * Returns '' for a non-repeating rule.
 */
export function buildSeriesPreview({ startDate, startTime, repeatRule, daysOfWeek = [], endCondition } = {}) {
  if (!repeatRule || repeatRule === 'none' || !startDate) return '';
  const dates = expandSeriesDates({ startDate, repeatRule, daysOfWeek, endCondition });
  const n = dates.length;
  if (!n) return '';
  const cad = cadenceLabel({ repeatRule, daysOfWeek, startDate });
  const time = formatTime12(startTime);
  const endLabel = endCondition?.type === 'date'
    ? `until ${shortDate(endCondition.onDate)}`
    : `through ${shortDate(dates[dates.length - 1])}`;
  const plural = n === 1 ? 'appointment' : 'appointments';
  return `Books ${n} ${plural} · ${cad}, ${time} · ${endLabel}`;
}

/**
 * The next occurrence date strictly after `date` for a cadence — drives the
 * postpone consequence panel's "series stays … next: <date>" line (state 4).
 * Returns null when unknown.
 */
export function nextOccurrenceDate({ date, repeatRule, daysOfWeek = [] } = {}) {
  if (!date) return null;
  if (repeatRule === 'weekly') return addDaysUTC(date, 7);
  if (repeatRule === 'daily') return addDaysUTC(date, 1);
  if (repeatRule === 'custom') {
    const set = new Set((daysOfWeek && daysOfWeek.length) ? daysOfWeek : [dowKey(date)]);
    for (let i = 1; i <= 7; i += 1) {
      const d = addDaysUTC(date, i);
      if (set.has(dowKey(d))) return d;
    }
  }
  return null;
}

/** The DOW_KEYS key for a 'YYYY-MM-DD' date (e.g. '2026-07-14' → 'TUE'). */
export function dayOfWeekKey(dateStr) {
  return dowKey(dateStr);
}

/** Weekday + month + day label, comma-stripped ("Thu Jun 26") — consequence copy. */
export function slotDayLabel(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T12:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .replace(/,/g, '');
}

// Re-exported for callers building consequence copy (postpone sheet).
export { shortDate as formatShortDate };
