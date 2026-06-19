/**
 * Pure helpers for DailyCaptureV2 — kept out of the component file so
 * Fast Refresh (react-refresh/only-export-components) stays happy and so
 * the count-strip math is testable in isolation.
 *
 * Binds to verified source keys: qualifiedApproaches, ffiConducted,
 * ciConducted, newBusiness.apps. (Aggregator file untouched — this is a
 * parallel display sum that mirrors aggregator's sumInt over the same keys.)
 */

import { computePoints } from '../../lib/computePoints';

const intOrZero  = (v) => parseInt(v, 10) || 0;
const floatOrZero = (v) => parseFloat(v) || 0;

function sumIntsAcross(entries, key) {
  return entries.reduce((acc, e) => acc + intOrZero(e?.[key]), 0);
}

function sumPathIntsAcross(entries, key, sub) {
  return entries.reduce((acc, e) => acc + intOrZero(e?.[key]?.[sub]), 0);
}

/**
 * Derive the four week-to-date count-strip chips from a list of daily docs.
 * @param {Array<object>} weekDocs - this agent's dailyActivity docs for the week
 * @returns {{appr:number, ffi:number, ci:number, apps:number}}
 */
export function deriveCountStripChips(weekDocs) {
  const entries = Array.isArray(weekDocs) ? weekDocs : [];
  return {
    appr: sumIntsAcross(entries, 'qualifiedApproaches'),
    ffi:  sumIntsAcross(entries, 'ffiConducted'),
    ci:   sumIntsAcross(entries, 'ciConducted'),
    apps: sumPathIntsAcross(entries, 'newBusiness', 'apps'),
  };
}

/**
 * Map a daily entry to the field shape expected by computePoints, then score it.
 *
 * computePoints expects weekly-report field names; daily uses a simplified schema.
 * Key mappings:
 *   daily.dials (single total)     → coldCalls bucket (feeds the dials accumulator)
 *   daily.newBusiness.{apps,api}   → applicationsSold, apiSold (version=1 path)
 *   daily.newNamesAdded            → namesFromOther
 *   daily.serviceContacts          → serviceCalls
 *
 * @param {object} entry - daily activity entry (from Firestore or UI state)
 * @returns {number} integer point total for this day
 */
export function computeDayPoints(entry) {
  if (!entry) return 0;
  return computePoints({
    ...entry,
    // dials: single daily total → coldCalls bucket; zero out the other call types
    coldCalls:             floatOrZero(entry.dials),
    referralCalls:         0,
    followUpCalls:         0,
    seminarTradeshowCalls: 0,
    // production: version=1 flat key names
    applicationsSold: intOrZero(entry.newBusiness?.apps),
    apiSold:          floatOrZero(entry.newBusiness?.api),
    // names
    namesFromOther: intOrZero(entry.newNamesAdded),
    // service
    serviceCalls: intOrZero(entry.serviceContacts),
  });
}

/**
 * Derive Mon–Sat week-strip day descriptors for the current week.
 *
 * @param {Array<object>} weekDocs    - dailyActivity docs for the current week
 * @param {string}        today       - 'YYYY-MM-DD' in TT timezone
 * @param {string}        weekStarting - 'YYYY-MM-DD' (the Sunday that opens the week)
 * @returns {Array<{date,label,dayNum,isToday,isPast,isFuture,isLogged,isOff}>}
 *   6 items: Mon(+1) … Sat(+6) relative to weekStarting
 */
export function deriveWeekStripDays(weekDocs, today, weekStarting) {
  const entries  = Array.isArray(weekDocs) ? weekDocs : [];
  const docDates = new Set(entries.map((d) => d.date));
  const todayD   = new Date(today + 'T12:00:00Z');
  const weekStartD = new Date(weekStarting + 'T12:00:00Z');
  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStartD);
    d.setUTCDate(d.getUTCDate() + i + 1); // i=0 → Mon, i=5 → Sat
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return {
      date:     dateStr,
      label:    DAY_LABELS[d.getUTCDay()],
      dayNum:   d.getUTCDate(),
      isToday:  dateStr === today,
      isPast:   d < todayD,
      isFuture: d > todayD,
      isLogged: docDates.has(dateStr),
      isOff:    d.getUTCDay() === 6, // Saturday
    };
  });
}

// Working days per week — Phase 3b replaces this with the per-tenant configurable value.
export const WORKING_DAYS = 5;

/**
 * Map a weekly-activity-floor object to the computePoints field shape and return
 * the total floor-equivalent point value.
 *
 * Each floor key counted ONCE (de-dup guard):
 *   callsMade             → coldCalls (dials bucket)      × 1
 *   appointmentsScheduled → appointmentsSet               × 3
 *   factFindsCompleted    → ffiConducted                  × 5
 *   closingInterviewsKept → ciConducted                   × 10
 *   applicationsSubmitted → applicationsSold              × 25
 *   api                   → apiSold (÷1000)               × 1
 *   referralsNewLeads     → namesFromOther (@1pt floor)   × 1
 *
 * Intentionally excluded:
 *   interviewsKept  — ≡ ffiConducted + ciConducted (double-count)
 *   telContacts     — unscored in computePoints
 *   clientsSold     — unscored in computePoints
 */
export function mapFloorToPoints(floors) {
  if (!floors) return 0;
  const f = (v) => parseFloat(v) || 0;
  return computePoints({
    coldCalls:             f(floors.callsMade),
    referralCalls:         0,
    followUpCalls:         0,
    seminarTradeshowCalls: 0,
    appointmentsSet:       f(floors.appointmentsScheduled),
    ffiConducted:          f(floors.factFindsCompleted),
    ciConducted:           f(floors.closingInterviewsKept),
    applicationsSold:      f(floors.applicationsSubmitted),
    apiSold:               f(floors.api),
    namesFromOther:        f(floors.referralsNewLeads),
  });
}

/**
 * Count Mon–Fri working days elapsed from week start through today (inclusive).
 * Saturday does not add a day; Sunday returns 0 (pill is hidden on Sunday anyway).
 *
 * @param {string} today        - 'YYYY-MM-DD'
 * @param {string} weekStarting - 'YYYY-MM-DD' (the Sunday that opens the week)
 * @returns {number} 0–5
 */
export function elapsedWorkingDays(today, weekStarting) {
  const todayD     = new Date(today       + 'T12:00:00Z');
  const weekStartD = new Date(weekStarting + 'T12:00:00Z');
  let count = 0;
  for (let i = 1; i <= WORKING_DAYS; i++) {
    const d = new Date(weekStartD);
    d.setUTCDate(d.getUTCDate() + i);
    if (d <= todayD) count++;
  }
  return count;
}

/**
 * Derive the week-to-date pace state.
 * Band: ±5% of the pro-rated floor target.
 *
 * @param {number} weekPoints       - points earned so far this week
 * @param {number} weekToDateTarget - expected floor-pace points by today
 * @returns {'behind' | 'on-pace' | 'ahead'}
 */
export function computePaceState(weekPoints, weekToDateTarget) {
  if (weekToDateTarget <= 0) return 'on-pace';
  const ratio = weekPoints / weekToDateTarget;
  if (ratio < 0.95) return 'behind';
  if (ratio > 1.05) return 'ahead';
  return 'on-pace';
}

/**
 * Count the current logging streak (consecutive non-Sunday days with saved entries,
 * counting backward from today; today is included when already logged).
 *
 * @param {Array<object>} weekDocs - dailyActivity docs for the current week
 * @param {string}        today    - 'YYYY-MM-DD' in TT timezone
 * @returns {number}
 */
export function computeStreak(weekDocs, today) {
  const entries  = Array.isArray(weekDocs) ? weekDocs : [];
  const docDates = new Set(entries.map((d) => d.date));
  const todayD   = new Date(today + 'T12:00:00Z');

  // If today is already logged, start counting from today; else start from yesterday.
  const startOffset = docDates.has(today) ? 0 : 1;
  let streak = 0;

  for (let i = startOffset; i < startOffset + 6; i++) {
    const d = new Date(todayD);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getUTCDay() === 0) continue; // skip Sundays (off/confirm day)
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (docDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
