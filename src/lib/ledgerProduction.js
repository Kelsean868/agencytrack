/**
 * ledgerProduction.js — the ONE derivation every production hero reads.
 *
 * Kyron's rulings, 23 Sep 2026 (docs/briefs/hero-ledger-truth.md):
 *
 *   R1  The Policy Ledger is the source of record for production. Weekly
 *       reports record activity and a SELF-REPORTED submitted figure; that
 *       figure appears only as a reconciliation note (R4), never as a hero.
 *   R2  Four headline figures, all from the ledger, all for one year:
 *         Settled API / apps   — settled or confirmed, `dateIssued` in the year.
 *         Submitted API / apps — every policy that WENT IN during the year,
 *                                whatever happened after. Dated by
 *                                `dateSubmitted`, else `dateWritten`, else
 *                                `dateIssued` — and the last one is flagged
 *                                (`datedByIssue`) so nobody reads an issue date
 *                                as a submit date. Every imported doc today has
 *                                only `dateIssued`.
 *   R3  Apps and API follow Tatil's production rules through ONE helper,
 *       `productionCredit` below, which reuses the campaign's `creditFor`.
 *   R4  The weekly figure is compared with the ledger's SUBMITTED figure, and
 *       the gap is reported, not hidden.
 *   R5  Origin never decides eligibility for current-year production; date
 *       does. Nothing here reads `importSource`.
 *
 * Pure functions only — no SDK, no JSX. Nothing here is stored (derived, never
 * stored); every figure is recomputed from the policy list the caller already
 * holds.
 */
import {
  creditFor,
  toDateStr,
  RULE_7_CREDIT_TABLE,
  DEFAULT_INC_PPP_APP_THRESHOLD,
} from './policyCampaignLens';
import { isConfirmed } from './policyStatusTokens';
import { STATUS_SOURCE_IMPORT } from './portfolioImport/oipaImportConfig';
import { extractTotalProductionCredit } from '../utils/extractFields';

// ─── R3 · the general production-credit table ────────────────────────────────
//
// NOT a second table. It is the campaign's Rule 7 table with the ONE row where
// the general rule and the campaign disagree replaced:
//
//   Lump sums / deposits — general rule: 10% of API, never an application.
//                          Christmas campaign Rule 7: 0% of API, no application.
//
// The general helper uses the general rule; the campaign keeps its own table
// (policyCampaignLens.js is untouched in behaviour). Every other row — new
// business in full, an increase earning one app only at TTD 2,400 or more,
// replacements on the API difference, S.P.I.A. nothing, Platinum Edge an app
// with no API — is the same row, read from the same frozen object.
export const GENERAL_CREDIT_TABLE = Object.freeze({
  ...RULE_7_CREDIT_TABLE,
  lumpsum: Object.freeze({ apps: 'none', api: 0.1, label: 'Lump sum' }),
});

const GENERAL_CREDIT = Object.freeze({
  credit: Object.freeze({
    table: GENERAL_CREDIT_TABLE,
    incPppAppThreshold: DEFAULT_INC_PPP_APP_THRESHOLD,
  }),
});

/** Apps and API one policy earns under Tatil's general production rules. */
export function productionCredit(policy) {
  return creditFor(policy, GENERAL_CREDIT);
}

/** The gap (in TTD) above which weekly reports and the ledger disagree. */
export const MISMATCH_TOLERANCE = 1;

/** True when a reconciliation gap is big enough to flag. */
export function isMismatch(gap) {
  return Math.abs(Number(gap) || 0) > MISMATCH_TOLERANCE;
}

const SETTLED_STATUSES = new Set(['settled', 'confirmed']);

function isSettled(policy) {
  return isConfirmed(policy) || SETTLED_STATUSES.has(policy?.status);
}

// A `written` policy is signed-for but not yet sent in, so it has not "gone in".
// Every other status — submitted, rated, postponed, settled, confirmed, lapsed,
// ntu, denied — has.
function hasGoneIn(policy) {
  return policy?.status !== 'written';
}

// Tatil Life production is Life business. An absent productLine is Life,
// matching the campaign lens and the ledger create form.
function isLife(policy) {
  return (policy?.productLine ?? 'life') === 'life';
}

/** The date a policy WENT IN, and whether it had to fall back to the issue date. */
function submitDate(policy) {
  const submitted = toDateStr(policy?.dateSubmitted) ?? toDateStr(policy?.dateWritten);
  if (submitted) return { date: submitted, byIssue: false };
  const issued = toDateStr(policy?.dateIssued);
  return issued ? { date: issued, byIssue: true } : { date: null, byIssue: false };
}

function inYear(date, year) {
  return typeof date === 'string' && date.startsWith(`${year}-`);
}

/** YYYY-MM-DD six days after a YYYY-MM-DD Sunday, or null. */
function weekEnd(weekStarting) {
  if (typeof weekStarting !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStarting)) return null;
  const d = new Date(`${weekStarting}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

const cents = (n) => Math.round(n * 100) / 100;

/** The self-reported submitted figure from weekly reports (R4's "X" and "Y"). */
function weeklyReported(submissions, year, weekStarting) {
  let ytdApi = 0;
  let weekApi = 0;
  for (const s of Array.isArray(submissions) ? submissions : []) {
    if (s?.status !== 'submitted') continue;
    const ws = String(s.weekStarting ?? '');
    if (!ws.startsWith(`${year}-`)) continue;
    const api = extractTotalProductionCredit(s);
    ytdApi += api;
    if (weekStarting && ws === weekStarting) weekApi += api;
  }
  return { ytdApi: cents(ytdApi), weekApi: cents(weekApi) };
}

/**
 * awardRowsFromLedger(policies) — the Policy Ledger in the shape the awards
 * engine reads: `[{ periodKey: 'YYYY-MM', settledAPI, settledApps, persistency: 0 }]`.
 *
 * R5 · the date test for awards. A policy belongs to the month its
 * `dateIssued` falls in, and to nothing else. The awards engine then picks the
 * rows for the award's own period (this month, this quarter, this year), so an
 * imported policy issued 15 Aug 2026 lands in the August row and counts toward
 * August, Q3 and 2026; one issued in 2019 lands in a 2019 row that no current
 * award ever reads. `importSource` is never consulted.
 *
 * Same settled test and same R3 credit (`productionCredit`) as the Settled
 * figure in `deriveYearProduction`, so an award and the hero differ only by
 * self/family business (below). API is NOT read from `settledAPI`: every imported doc
 * carries `settledAPI: null`, and the credit helper already falls back to
 * `proposedAPI` through `policyValue`.
 *
 * Self/family policies (`isSelfOrFamily`) do NOT count toward awards (Kyron,
 * 23 Sep 2026): their API goes to `selfFamilyAPI`, never to `settledAPI` or
 * `settledApps`. MDRT is the one award that adds it back (awardsEngine). The
 * home hero (`deriveYearProduction`) still counts them.
 *
 * Persistency is not a ledger figure; the caller merges it per periodKey.
 */
export function awardRowsFromLedger(policies) {
  const byMonth = new Map();
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || !isLife(p) || !isSettled(p)) continue;
    const issued = toDateStr(p.dateIssued);
    if (!issued || !/^\d{4}-\d{2}-/.test(issued)) continue;
    const periodKey = issued.slice(0, 7);
    const credit = productionCredit(p);
    const row = byMonth.get(periodKey)
      ?? { periodKey, settledAPI: 0, settledApps: 0, selfFamilyAPI: 0, persistency: 0 };
    byMonth.set(periodKey, p.isSelfOrFamily === true
      ? { ...row, selfFamilyAPI: row.selfFamilyAPI + credit.api }
      : { ...row, settledAPI: row.settledAPI + credit.api, settledApps: row.settledApps + credit.apps });
  }
  return [...byMonth.values()]
    .map((row) => ({ ...row, settledAPI: cents(row.settledAPI), selfFamilyAPI: cents(row.selfFamilyAPI) }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

/**
 * deriveYearProduction(policies, { year, weekStarting, submissions })
 *
 * `policies` MUST be the unfiltered list (`getOwnPolicies`, no excludeImported):
 * R5 decides by date, so filtering by origin first would hide the business this
 * function exists to count.
 *
 * @returns {{
 *   year: number,
 *   settled:   { api: number, apps: number, count: number, fromHeadOffice: number, selfConfirmed: number },
 *   submitted: { api: number, apps: number, count: number, datedByIssue: boolean, weekApi: number },
 *   weekly:    { ytdApi: number, weekApi: number },
 *   mismatch:  { ytd: number, week: number },
 * }}
 * `mismatch` is weekly minus ledger-submitted: positive means the weekly
 * reports claim more than the ledger holds.
 *
 * Provenance (Kyron, 26 Sep 2026 — BUG-01 option B): agent-declared settled
 * policies keep counting; the hero states where each settled policy's status
 * came from instead. `fromHeadOffice` counts settled policies whose status the
 * OIPA export set (`statusSource === 'oipa_import'`); `selfConfirmed` is every
 * other settled policy. The two always sum to `settled.count`.
 */
export function deriveYearProduction(policies, { year, weekStarting = null, submissions = [] } = {}) {
  const y = Number(year);
  const end = weekEnd(weekStarting);
  const settled = { api: 0, apps: 0, count: 0, fromHeadOffice: 0, selfConfirmed: 0 };
  const submitted = { api: 0, apps: 0, count: 0, datedByIssue: false, weekApi: 0 };

  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || !isLife(p)) continue;
    const credit = productionCredit(p);

    if (isSettled(p) && inYear(toDateStr(p.dateIssued), y)) {
      settled.api += credit.api;
      settled.apps += credit.apps;
      settled.count += 1;
      if (p.statusSource === STATUS_SOURCE_IMPORT) settled.fromHeadOffice += 1;
      else settled.selfConfirmed += 1;
    }

    if (hasGoneIn(p)) {
      const { date, byIssue } = submitDate(p);
      if (inYear(date, y)) {
        submitted.api += credit.api;
        submitted.apps += credit.apps;
        submitted.count += 1;
        if (byIssue) submitted.datedByIssue = true;
        if (end && date >= weekStarting && date <= end) submitted.weekApi += credit.api;
      }
    }
  }

  settled.api = cents(settled.api);
  submitted.api = cents(submitted.api);
  submitted.weekApi = cents(submitted.weekApi);

  const weekly = weeklyReported(submissions, y, weekStarting);
  return {
    year: y,
    settled,
    submitted,
    weekly,
    mismatch: {
      ytd: cents(weekly.ytdApi - submitted.api),
      week: cents(weekly.weekApi - submitted.weekApi),
    },
  };
}
