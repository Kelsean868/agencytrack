/**
 * clawbackClock.js — DISPLAY-ONLY derivation of the 30-day policy-delivery
 * clawback clock (Tier-3 3.1, CRO / back-office).
 *
 * The rule (per docs/design-system/screens-v2/cro-v2-shared.jsx + the H-track
 * workshop lock): commission on a SETTLED policy is withheld / clawed back if
 * the policy is not DELIVERED within 30 days of its issue date. This module
 * derives the countdown purely for rendering — NOTHING here is ever stored.
 * The stored delivery fields (`policyDeliveryDate`/`deliveredBy`/`deliveredAt`)
 * are written by policiesService.recordPolicyDelivery, gated by rules Arm E.
 *
 * Anchor divergence from the mockup (documented): cro-v2-shared.jsx anchors the
 * clock to a fabricated head-office `sent` dispatch date. The REAL policies doc
 * has no such field — the locked contract anchors the clock to `dateIssued`
 * (the settlement-time issue date). This module uses `dateIssued`.
 *
 * Dates are reckoned in TT-local calendar days (America/Port_of_Spain, permanent
 * AST) so boundaries line up with dateInputs.js storage semantics.
 */
import { parseDateOnlyTT, getTodayTT } from './dateInputs';

export const CLAWBACK_DAYS = 30;
export const AT_RISK_DAYS = 7; // days-left <= this (and >= 0) → at-risk tone

/**
 * toTTDayString — normalise a Firestore Timestamp | Date | ms | YYYY-MM-DD to
 * the TT-local calendar-day string "YYYY-MM-DD". Returns null when unparseable.
 */
export function toTTDayString(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  }
  let date;
  if (typeof value === 'number') {
    date = new Date(value);
  } else if (typeof value.toDate === 'function') {
    // Firestore Timestamp
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value.seconds === 'number') {
    // Serialized Timestamp shape { seconds, nanoseconds }
    date = new Date(value.seconds * 1000);
  } else {
    return null;
  }
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(date);
}

/**
 * daysBetweenTT — whole TT-local calendar days from `fromDayStr` to `toDayStr`
 * (both "YYYY-MM-DD"). Positive when `toDayStr` is later.
 */
export function daysBetweenTT(fromDayStr, toDayStr) {
  const a = parseDateOnlyTT(fromDayStr);
  const b = parseDateOnlyTT(toDayStr);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * deriveClawback — the display state of one policy's delivery clock.
 *
 * @param {*} dateIssued — the policy's issue date (Timestamp | Date | ms | string)
 * @param {object} [opts]
 * @param {boolean} [opts.delivered=false] — true when policyDeliveryDate is set
 * @param {string}  [opts.today] — override "today" (YYYY-MM-DD); defaults to TT today
 * @returns {{
 *   valid: boolean, delivered: boolean, daysSinceIssue: number|null,
 *   daysLeft: number|null, tone: 'delivered'|'overdue'|'at-risk'|'within'|'unknown',
 *   overdue: boolean, atRisk: boolean
 * }}
 *
 * Tone thresholds (against days-since-issue, deadline = 30):
 *   delivered → 'delivered'
 *   daysLeft < 0  (day 31+) → 'overdue'   (danger)
 *   0 <= daysLeft <= 7 (day 23..30) → 'at-risk' (warning)
 *   daysLeft > 7  (day 0..22) → 'within'  (teal/primary)
 */
export function deriveClawback(dateIssued, { delivered = false, today } = {}) {
  const todayStr = today || getTodayTT();
  const issuedDay = toTTDayString(dateIssued);

  if (delivered) {
    // A delivered policy's clock is closed regardless of issue date parseability.
    return {
      valid: true, delivered: true,
      daysSinceIssue: issuedDay ? Math.max(0, daysBetweenTT(issuedDay, todayStr)) : null,
      daysLeft: null, tone: 'delivered', overdue: false, atRisk: false,
    };
  }

  if (!issuedDay) {
    return {
      valid: false, delivered: false, daysSinceIssue: null,
      daysLeft: null, tone: 'unknown', overdue: false, atRisk: false,
    };
  }

  const daysSinceIssue = daysBetweenTT(issuedDay, todayStr);
  const daysLeft = CLAWBACK_DAYS - daysSinceIssue;
  const overdue = daysLeft < 0;
  const atRisk = !overdue && daysLeft <= AT_RISK_DAYS;
  const tone = overdue ? 'overdue' : atRisk ? 'at-risk' : 'within';

  return { valid: true, delivered: false, daysSinceIssue, daysLeft, tone, overdue, atRisk };
}
