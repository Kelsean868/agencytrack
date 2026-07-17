// Track K — Strategic Plan · period model + window keying (pure, no Firestore).
//
// A "window" is an inclusive date span { startYMD, endYMD } of "YYYY-MM-DD"
// strings. `weekStarting` (always a Sunday) and any dateIssued-derived YMD sort
// lexicographically, so span membership is a plain string comparison.
//
// Dispatcher RULING 1 (2026-07-17): this module replaces deriveBranchWindows.
//   • Production API is summed ONLY via extractTotalProductionCredit (never
//     apiSold / newBusiness.api). Apps + activity metrics come from extractFields.
//   • An EMPTY window returns zeros with count 0 — it NEVER substitutes another
//     window's submissions (deriveBranchWindows' `x.length ? x : subs` fallback
//     is deliberately not reproduced).

import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';

export const GRANULARITIES = ['quarter', 'half'];

/** Default plan period — current calendar year, quarter granularity. */
export function defaultPeriod(now = new Date()) {
  return { year: now.getFullYear(), granularity: 'quarter' };
}

/** Full-year window for a plan year (the Agent Tracker + annual Production use this). */
export function yearWindow(year) {
  return { key: 'FY', label: `FY ${year}`, startYMD: `${year}-01-01`, endYMD: `${year}-12-31`, months: 12 };
}

/** Quarter (Q1–Q4) or half (H1/H2) windows for the period's granularity. */
export function periodWindows(period) {
  const y = period.year;
  if (period.granularity === 'half') {
    return [
      { key: 'H1', label: 'H1', startYMD: `${y}-01-01`, endYMD: `${y}-06-30`, months: 6 },
      { key: 'H2', label: 'H2', startYMD: `${y}-07-01`, endYMD: `${y}-12-31`, months: 6 },
    ];
  }
  // quarter is the default granularity
  return [
    { key: 'Q1', label: 'Q1', startYMD: `${y}-01-01`, endYMD: `${y}-03-31`, months: 3 },
    { key: 'Q2', label: 'Q2', startYMD: `${y}-04-01`, endYMD: `${y}-06-30`, months: 3 },
    { key: 'Q3', label: 'Q3', startYMD: `${y}-07-01`, endYMD: `${y}-09-30`, months: 3 },
    { key: 'Q4', label: 'Q4', startYMD: `${y}-10-01`, endYMD: `${y}-12-31`, months: 3 },
  ];
}

/** True when a "YYYY-MM-DD" string falls inside the window (inclusive). */
export function ymdInWindow(ymd, window) {
  return typeof ymd === 'string' && ymd >= window.startYMD && ymd <= window.endYMD;
}

// Sum production for submissions whose weekStarting falls in `window`.
// TRUE empty state (RULING 1): an empty window yields all-zero totals + count 0;
// there is NO substitution of another window's submissions.
export function sumProductionWindow(submissions, window) {
  const inWin = (submissions || []).filter(
    (s) => s.status === 'submitted' && ymdInWindow(s.weekStarting, window),
  );
  let api = 0;
  let apps = 0;
  let calls = 0;
  let contacts = 0;
  let factFinds = 0;
  let closingInterviews = 0;
  for (const s of inWin) {
    const f = extractFields(s);
    api += extractTotalProductionCredit(s);       // RULING 1 — the ONLY API accessor
    apps += f.applicationsSold || 0;
    calls += f.totalTelAttempts || 0;
    contacts += f.telContacts || 0;
    factFinds += f.ffiConducted || 0;
    closingInterviews += f.ciConducted || 0;
  }
  return { api, apps, calls, contacts, factFinds, closingInterviews, count: inWin.length };
}

/** Prorate an annual quota to a month span (months=12 → full quota). */
export function prorateQuota(annualQuota, months) {
  const q = Number(annualQuota) || 0;
  const m = Number(months) || 0;
  return q * (m / 12);
}

// Fraction of a window elapsed as of `now`, clamped to [0, 1]. Drives the
// run-rate EOY projection (brief §3 decision 6): projected = actual ÷ fraction.
// A past-year window returns 1 (projection == actual, no extrapolation).
export function periodElapsedFraction(window, now = new Date()) {
  const start = new Date(`${window.startYMD}T00:00:00Z`).getTime();
  const end = new Date(`${window.endYMD}T23:59:59Z`).getTime();
  const total = end - start;
  if (!(total > 0)) return 1;
  const elapsed = now.getTime() - start;
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 1;
  return elapsed / total;
}

// Whole months elapsed in a calendar year as of `now` (1–12). A past year
// returns 12; a future year returns 0. Used for the prorated monthly table.
export function monthsElapsedInYear(year, now = new Date()) {
  if (now.getFullYear() > year) return 12;
  if (now.getFullYear() < year) return 0;
  return now.getMonth() + 1;
}
