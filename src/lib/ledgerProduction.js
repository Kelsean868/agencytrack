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
  policyContribution,
  derivePolicyLens,
  ledgerExportDate,
  RULE_7_CREDIT_TABLE,
  DEFAULT_INC_PPP_APP_THRESHOLD,
} from './policyCampaignLens';
import { isConfirmed, policyRole } from './policyStatusTokens';
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

// L0 — "in the pipeline": gone in, not settled/confirmed, and not a terminal
// EXIT (ntu, denied, lapsed). Reuses policyStatusTokens.js's own role
// classification (`hard` = ntu/denied, `closed` = lapsed) rather than a second
// hardcoded status list — the orchestrator's ruling for the two-layer ring's
// "pending" arc.
function isTerminalOut(policy) {
  const role = policyRole(policy);
  return role === 'hard' || role === 'closed';
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
 *   pending:   { api: number, apps: number, count: number },
 *   weekly:    { ytdApi: number, weekApi: number },
 *   mismatch:  { ytd: number, week: number },
 * }}
 *
 * `pending` (L0, two-layer ring) is NOT `submitted.api - settled.api` — that
 * subtraction mixes two different date bases (submitted is dated by submit
 * date, settled by issue date) and is not "waiting to settle". `pending` is
 * its own pass: Life policies that have gone in (not `written`), are not yet
 * settled/confirmed, and have not exited terminally (ntu / denied / lapsed —
 * see `isTerminalOut`), dated the same way as `submitted` (submit date, else
 * written date, else issue date) and falling in the year. Self/family
 * policies are included here, same as the rest of this function (the hero
 * counts them; the campaign lens excludes them separately).
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
  const pending = { api: 0, apps: 0, count: 0 };

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

      if (!isSettled(p) && !isTerminalOut(p) && inYear(date, y)) {
        pending.api += credit.api;
        pending.apps += credit.apps;
        pending.count += 1;
      }
    }
  }

  settled.api = cents(settled.api);
  submitted.api = cents(submitted.api);
  submitted.weekApi = cents(submitted.weekApi);
  pending.api = cents(pending.api);

  const weekly = weeklyReported(submissions, y, weekStarting);
  return {
    year: y,
    settled,
    submitted,
    pending,
    weekly,
    mismatch: {
      ytd: cents(weekly.ytdApi - submitted.api),
      week: cents(weekly.weekApi - submitted.weekApi),
    },
  };
}

// ─── L1 · the award lens (docs/briefs/ledger-lens-build.md § L1) ─────────────
//
// ONE rules engine. Every "counts / waiting / doesn't count" decision the
// Policy Ledger's award lens shows comes from here, and here re-uses the rules
// the Awards tab and the hero already run:
//
//   · settled test      — `isSettled` (settled, or manager-confirmed)
//   · credit            — `productionCredit` (R3), or the campaign's own
//                         `policyContribution` for a campaign
//   · date (R5)         — a settled policy belongs to the period its
//                         `dateIssued` falls in, and nowhere else
//   · family / self     — excluded everywhere except MDRT (Kyron, 23 Sep 2026)
//   · pending (L0)      — gone in, not settled, not a terminal exit
//                         (ntu / denied / lapsed), placed by the L0 date: submit
//                         date, else written, else issue date, in the award's
//                         year — and only while the period is still open
//
// `award` is a descriptor from `awardLensPeriods` (src/utils/awardsEngine.js).
// Nothing is stored: the lens is recomputed from the policy list on every read.

export const AWARD_LENS_GROUPS = Object.freeze(['counting', 'pending', 'not']);

export const FAMILY_LENS_REASON = 'Family policy — counts for MDRT only';

const ZERO_CREDIT = Object.freeze({ api: 0, apps: 0 });

function lensRow(group, credit, reason) {
  return { group, credit: { api: cents(credit?.api ?? 0), apps: credit?.apps ?? 0 }, reason };
}

/** Why a terminally-exited policy counts nowhere. */
function exitReason(policy) {
  switch (policy?.status) {
    case 'ntu': {
      const replaced = policy?.replacedBy ? String(policy.replacedBy).slice(-4) : null;
      return replaced ? `NTU — replaced by ···${replaced}` : 'NTU — not taken up';
    }
    case 'denied':
      return 'Denied — never went in force';
    case 'lapsed':
      return 'Lapsed — no longer in force';
    default:
      return 'Closed — no longer in force';
  }
}

const EXIT_STATUSES = new Set(['ntu', 'denied', 'lapsed']);

function campaignLensRow(policy, award) {
  const c = policyContribution(policy, award.campaign);
  if (c.state === 'counts') return lensRow('counting', { api: c.value, apps: c.apps }, c.reason);
  if (c.state === 'pending') {
    if (award.closed) return lensRow('not', ZERO_CREDIT, 'Not settled before the campaign closed');
    return lensRow('pending', { api: c.pendingValue ?? 0, apps: c.pendingApps ?? 0 }, 'Counts when settled');
  }
  // The campaign engine's own reason, except a terminal exit is named for what
  // it is ("NTU", "Lapsed") rather than the generic "lapsed / closed".
  return lensRow('not', ZERO_CREDIT, EXIT_STATUSES.has(policy?.status) ? exitReason(policy) : c.reason);
}

/**
 * awardLensForPolicy(policy, award) — one policy through one award.
 *
 * @returns {{ group: 'counting'|'pending'|'not', credit: { api: number, apps: number }, reason: string }}
 *   `credit` is what the policy earns (counting) or WOULD earn if it settled
 *   today (pending); 0/0 when not counting.
 */
export function awardLensForPolicy(policy, award) {
  if (!award) throw new Error('awardLensForPolicy: award descriptor is required');
  if (!policy) return lensRow('not', ZERO_CREDIT, 'No policy');
  if (!isLife(policy)) {
    return lensRow('not', ZERO_CREDIT, 'Non-Life — does not count toward Tatil Life awards');
  }
  if (policy.isSelfOrFamily === true && !award.includeFamily) {
    return lensRow('not', ZERO_CREDIT, FAMILY_LENS_REASON);
  }
  if (award.kind === 'campaign') return campaignLensRow(policy, award);

  if (isSettled(policy)) {
    const issued = toDateStr(policy.dateIssued);
    if (!issued) return lensRow('not', ZERO_CREDIT, 'No issue date recorded');
    if (issued < award.start) return lensRow('not', ZERO_CREDIT, `Issued before ${award.periodName}`);
    if (issued > award.end) return lensRow('not', ZERO_CREDIT, `Issued after ${award.periodName}`);
    const credit = productionCredit(policy);
    if (credit.apps === 0 && credit.api === 0) return lensRow('not', ZERO_CREDIT, credit.reason);
    return lensRow('counting', credit, credit.reason);
  }

  if (isTerminalOut(policy)) return lensRow('not', ZERO_CREDIT, exitReason(policy));
  if (!hasGoneIn(policy)) return lensRow('not', ZERO_CREDIT, 'Written — not submitted yet');

  const { date } = submitDate(policy);
  if (!date) return lensRow('not', ZERO_CREDIT, 'No submit date recorded');
  if (award.closed) {
    return lensRow('not', ZERO_CREDIT, 'Not settled in time — it counts in the period it is issued');
  }
  if (!inYear(date, award.year) || date > award.end) {
    return lensRow('not', ZERO_CREDIT, `Submitted outside ${award.periodName}`);
  }
  const credit = productionCredit(policy);
  if (credit.apps === 0 && credit.api === 0) return lensRow('not', ZERO_CREDIT, credit.reason);
  return lensRow('pending', credit, 'Counts when settled');
}

/**
 * The head-office flag ("Not on the head-office list yet — check with HO").
 *
 * True only when the ledger can PROVE the policy is absent from the latest
 * head-office import: it is settled, its status was NOT set by that import
 * (`statusSource !== 'oipa_import'`), and it was issued AFTER the latest
 * export's as-at date — an export cannot list a policy issued after it ran.
 *
 * A self-confirmed policy issued ON OR BEFORE the export date may or may not
 * be on it, and the data cannot tell: an import leaves an unchanged policy
 * unwritten, so its `exportDate` stays at the older export, and no per-policy
 * field records "seen in the latest export". Those are NOT flagged — hide
 * rather than guess (docs/FOLLOW_UPS.md § Head-office flag needs a per-import
 * manifest).
 */
export function notOnHeadOfficeList(policy, latestExportDate) {
  if (!policy || !latestExportDate) return false;
  if (!isSettled(policy)) return false;
  if (policy.statusSource === STATUS_SOURCE_IMPORT) return false;
  const issued = toDateStr(policy.dateIssued);
  return Boolean(issued) && issued > latestExportDate;
}

/**
 * deriveAwardLens(policies, award, { targetTierName }) — the whole lens for one
 * award: every policy's row, the three groups, and the totals.
 *
 * `policies` MUST be the unfiltered list (R5 decides by date, not origin).
 * For a campaign the targets come from `derivePolicyLens` — the same call the
 * Campaign screen and Home make — measured against the agent's chosen tier.
 *
 * @returns {{
 *   award: object,
 *   rows: Array<{ policy: object, group: string, credit: {api:number,apps:number}, reason: string, hoFlag: boolean }>,
 *   groups: { counting: object[], pending: object[], not: object[] },
 *   settled: { api: number, apps: number, count: number },
 *   pending: { api: number, apps: number, count: number },
 *   target: { api: number|null, apps: number|null, tier: object|null },
 *   campaignLens: object|null,
 *   exportDate: string|null,
 * }}
 */
export function deriveAwardLens(policies, award, { targetTierName = null } = {}) {
  if (!award) throw new Error('deriveAwardLens: award descriptor is required');
  const list = (Array.isArray(policies) ? policies : []).filter(Boolean);
  const exportDate = ledgerExportDate(list);

  const rows = list.map((policy) => ({
    policy,
    ...awardLensForPolicy(policy, award),
    hoFlag: notOnHeadOfficeList(policy, exportDate),
  }));

  const groups = { counting: [], pending: [], not: [] };
  const settled = { api: 0, apps: 0, count: 0 };
  const pending = { api: 0, apps: 0, count: 0 };
  for (const row of rows) {
    groups[row.group].push(row);
    const bucket = row.group === 'counting' ? settled : row.group === 'pending' ? pending : null;
    if (bucket) {
      bucket.api += row.credit.api;
      bucket.apps += row.credit.apps;
      bucket.count += 1;
    }
  }
  settled.api = cents(settled.api);
  pending.api = cents(pending.api);

  let target = { api: award.target ?? null, apps: null, tier: null };
  let campaignLens = null;
  if (award.kind === 'campaign') {
    campaignLens = derivePolicyLens(list, award.campaign, { targetTierName });
    target = {
      api: campaignLens?.api?.target ?? null,
      apps: campaignLens?.apps?.target ?? null,
      tier: campaignLens?.targetTier ?? null,
    };
  }

  return { award, rows, groups, settled, pending, target, campaignLens, exportDate };
}

/**
 * awardWindowsForPolicy(policy, awards) — every award window a policy counts
 * toward, or will once settled. Built for L3's "Counts toward" chips so the
 * chips and the lens can never disagree: same engine, same rows.
 */
export function awardWindowsForPolicy(policy, awards) {
  return (Array.isArray(awards) ? awards : [])
    .map((award) => ({ award, row: awardLensForPolicy(policy, award) }))
    .filter(({ row }) => row.group !== 'not')
    .map(({ award, row }) => ({ key: award.key, label: award.label, kind: award.kind, group: row.group }));
}
