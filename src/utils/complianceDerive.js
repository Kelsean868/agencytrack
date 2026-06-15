/**
 * complianceDerive.js — Compliance v2 (S1) filing-status derivations.
 *
 * Pure, TT-safe, framework-free (no React, no Firebase). The on-time deadline
 * definition is CREATED here — the repo has no prior deadline concept
 * (validators.js only knows validateSundayDate / getRecentSundays).
 *
 * D2 on-time semantics (operator default, 2026-06-04):
 *   A weekly report covers the Sun–Sat week beginning on `weekStart`
 *   (a YYYY-MM-DD Sunday). It is ON-TIME iff submittedAt ≤ the Sunday
 *   23:59:59 AST immediately following that covered week — i.e. in before the
 *   Monday review. Trinidad & Tobago is permanent AST (UTC-4, no DST).
 *
 *   Deadline instant = TT-midnight of weekStart (parseDateOnlyTT → 04:00 UTC
 *   same day) + 8 days − 1 second = (weekStart + 8d) 03:59:59 UTC
 *                                  = (weekStart + 7d) 23:59:59 AST.
 *   The +8d−1s form is the exact UTC-4 boundary trap, isolated here once.
 */

import { parseDateOnlyTT } from './dateInputs';

// UMs become mandatory filers from this Sunday onward (>= inclusive).
// Operator-adjustable: set to the real pilot go-live Sunday if it differs.
export const UM_MANDATORY_FILING_CUTOFF = '2026-06-14';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * toDateSafe — normalise a submittedAt-style value to a JS Date.
 * Accepts a Firestore Timestamp (.toDate()), a plain {seconds,nanoseconds}
 * Timestamp shape, a Date, an epoch-millis number, or an ISO string.
 * Returns null for anything unparseable (kept internal — callers treat
 * "no usable timestamp" as not-on-time).
 */
function toDateSafe(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6);
  }
  return null;
}

/**
 * filingDeadline — the on-time cutoff instant for a covered week.
 * @param {string} weekStart — YYYY-MM-DD Sunday that starts the covered week.
 * @returns {Date} the following Sunday 23:59:59 AST, as a JS Date.
 * @throws via parseDateOnlyTT if weekStart is missing / malformed.
 */
export function filingDeadline(weekStart) {
  return new Date(parseDateOnlyTT(weekStart).getTime() + 8 * DAY_MS - 1000);
}

/**
 * isOnTime — was this submission filed on or before the week's deadline?
 * Returns false when the submission is absent or carries no usable
 * submittedAt (a submitted-but-timeless doc is treated conservatively as NOT
 * on-time → classifies as 'late', never silently 'on-time').
 * @param {object|null} submission — a submission doc (root-level submittedAt).
 * @param {string} weekStart — YYYY-MM-DD Sunday.
 */
export function isOnTime(submission, weekStart) {
  if (!submission || !weekStart) return false;
  const submittedAt = toDateSafe(submission.submittedAt);
  if (!submittedAt) return false;
  return submittedAt.getTime() <= filingDeadline(weekStart).getTime();
}

/**
 * classifyWeek — single-week filing status.
 * @returns {'on-time'|'late'|'not-in'}
 *   not-in : no submission, or status !== 'submitted' (drafts are not-in).
 *   on-time: submitted and within the deadline.
 *   late   : submitted but after the deadline (or without a usable timestamp).
 */
export function classifyWeek(submission, weekStart) {
  if (!submission || submission.status !== 'submitted') return 'not-in';
  return isOnTime(submission, weekStart) ? 'on-time' : 'late';
}

/**
 * onTimeStreak — count of consecutive most-recent weeks filed on-time.
 * @param {Array<{weekStart: string, submission: object|null}>} submissionsByWeek
 *        ordered MOST-RECENT-FIRST. Any week that is late or not-in (incl. a
 *        missing/null submission) breaks the streak.
 * @param {number} weeks — window cap (default 8).
 * @returns {number} 0..weeks
 */
export function onTimeStreak(submissionsByWeek, weeks = 8) {
  if (!Array.isArray(submissionsByWeek)) return 0;
  const limit = Math.min(submissionsByWeek.length, weeks);
  let streak = 0;
  for (let i = 0; i < limit; i++) {
    const entry = submissionsByWeek[i];
    if (!entry || classifyWeek(entry.submission, entry.weekStart) !== 'on-time') break;
    streak += 1;
  }
  return streak;
}
