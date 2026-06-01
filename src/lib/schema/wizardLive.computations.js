/**
 * Wizard v2 PR2 — Live-compute lib (pure functions, unit-tested in isolation).
 *
 * Powers the WeekSoFarPanel hero + 2×2 scorecards + 6-week sparkline. All
 * outputs are derived from the wizard's in-progress `formData` shape (NOT a
 * persisted submission), with two exceptions: `apiSparkline` derives from
 * the agent's recent persisted submissions, and `lastWeek*` derivers operate
 * on a single persisted submission doc (`lastWeekData`).
 *
 * Decisions encoded here (locked in the brief):
 *   (C) Conversion = newBusinessApps / ciConducted (canonical "CI → App"
 *       direction — matches `extractFields.js:181` `closingRatio` and the
 *       AgentReportDocument funnel).
 *   (D) Production API = the SHARED canonical formula imported from
 *       `weeklyReport.computations.js`. NEVER re-implemented here.
 *   (E) Lumpsum rates come from `wizardLive.config.js` (which re-exports
 *       the canonical constants in `weeklyReport.js`). Agent commission
 *       rate is read per-call.
 *
 * NAMES uses the canonical `computeTotalNewNames` from `extractFields.js`
 * (7-field sum; intentionally excludes `namesFromSocial` — see FOLLOW_UPS).
 */

import {
  computeTotalProductionCredit,
  computeLumpsumCredit,
} from './weeklyReport.computations.js';
import { LMPS_COMMISSION_RATE } from './wizardLive.config.js';
import { computeTotalNewNames } from '../../utils/extractFields.js';

const p = (v) => Number(v) || 0;

/**
 * Build the canonical submission-shape from in-progress wizard formData.
 *
 * Live `formData` carries lumpsums.grossAmount but NOT lumpsums.apiCredit
 * (apiCredit is only populated by `sanitize()` at write time). The panel
 * computes apiCredit live via the canonical `computeLumpsumCredit` helper
 * so the canonical `computeTotalProductionCredit` reads consistent shape.
 */
function canonicalShape(formData) {
  const nbApi    = p(formData?.newBusiness?.api);
  const pppInc   = p(formData?.pppIncreases?.apiIncrease);
  const lmpsGross = p(formData?.lumpsums?.grossAmount);
  // Decision D — apiCredit derived via the canonical helper, not a literal.
  const lmpsApiCredit = computeLumpsumCredit(lmpsGross);
  return {
    newBusiness:  { api: nbApi },
    pppIncreases: { apiIncrease: pppInc },
    lumpsums:     { apiCredit: lmpsApiCredit, grossAmount: lmpsGross },
  };
}

// ─── Hero metrics ──────────────────────────────────────────────────────────

/**
 * Total Production API for the week-in-progress. Decision D: this is the
 * SHARED canonical formula. The compute lib delegates to the same function
 * the leaderboard CF, `sanitize()`, and the whiteboard "Total" already use.
 */
export function totalProductionAPI(formData) {
  return computeTotalProductionCredit(canonicalShape(formData));
}

/**
 * Estimated commission for the week-in-progress.
 *
 *   = NB.api × commissionRate% + lumpsumGross × LMPS_COMMISSION_RATE
 *
 * PPP intentionally excluded (zero commission per Tatil rules — same
 * exclusion the canonical `computeTotalCommission` honors).
 *
 * @param {object} formData - live wizard formData
 * @param {number} commissionRate - agent's personal rate as a percentage
 *   (e.g. 7.5 for 7.5%). Use userProfile.commissionRate verbatim — the
 *   helper converts to a fraction internally.
 */
export function estCommission(formData, commissionRate) {
  const nbApi = p(formData?.newBusiness?.api);
  const lmpsGross = p(formData?.lumpsums?.grossAmount);
  const rateFrac = p(commissionRate) / 100;
  return nbApi * rateFrac + lmpsGross * LMPS_COMMISSION_RATE;
}

// ─── Scorecard metrics ─────────────────────────────────────────────────────

/** Total apps written this week = NB.apps + PPP.apps. */
export function totalApps(formData) {
  return p(formData?.newBusiness?.apps) + p(formData?.pppIncreases?.apps);
}

/**
 * CI → App conversion %, decision (C). Canonical formula from
 * `extractFields.js:181` `closingRatio` = applicationsSold (= NB.apps) /
 * ciConducted. Guarded to 0 when ciConducted == 0.
 */
export function ciConv(formData) {
  const apps = p(formData?.newBusiness?.apps);
  const ci   = p(formData?.ciConducted);
  if (ci <= 0) return 0;
  return Math.round((apps / ci) * 100);
}

/** Sum of the 5 telephone fields (mirrors `Step2Telephone.jsx:6-12`). */
export function totalCalls(formData) {
  return (
    p(formData?.referralCalls) +
    p(formData?.followUpCalls) +
    p(formData?.coldCalls) +
    p(formData?.seminarTradeshowCalls) +
    p(formData?.serviceCalls)
  );
}

/** Three-of-five sub-counter for the CALLS scorecard "Ref · F-up · Cold" sub. */
export function refFupCold(formData) {
  return (
    p(formData?.referralCalls) +
    p(formData?.followUpCalls) +
    p(formData?.coldCalls)
  );
}

/**
 * Canonical NAMES total — delegates to `computeTotalNewNames` from
 * extractFields.js. Decision: app-wide single source of truth.
 */
export function totalNames(formData) {
  return computeTotalNewNames(formData);
}

// ─── lastWeek.* deriverssAll five operate on a single persisted submission ─

/**
 * Derive the 5 lastWeek.* values from a persisted submission doc for the
 * panel's delta chips. Returns `null` when the input is null/undefined —
 * caller skips delta rendering on the first-ever submission case.
 *
 * All 5 derivations are pure functions of the same compute lib above, so
 * the lastWeek.* numbers symmetrically match how the live numbers compute.
 * In particular `ciConv` direction matches (decision C).
 */
export function deriveLastWeek(submission) {
  if (!submission) return null;
  return {
    api:     totalProductionAPI(submission),
    apps:    totalApps(submission),
    ciConv:  ciConv(submission),
    calls:   totalCalls(submission),
    names:   totalNames(submission),
  };
}

// ─── 6-week sparkline series ───────────────────────────────────────────────

/**
 * Convert an array of `getRecentSubmissions` docs (newest-first) into a
 * 6-bar sparkline-friendly oldest→newest series of Production-API values.
 *
 * The panel overlays the "live in progress" value onto the last bar when
 * the most-recent submission is the same weekStarting as the wizard's
 * current draft; otherwise the panel appends live as a 7th bar shape.
 * (Panel handles that overlay locally — this helper returns the historical
 * series only.)
 *
 * Always returns an array of exactly 6 numbers, left-padded with 0 when
 * the agent has fewer than 6 submissions (so the sparkline keeps its bar
 * count and visual stability across early-tenure agents).
 */
export function buildApiSparkline(recentSubmissions) {
  const submissions = Array.isArray(recentSubmissions) ? recentSubmissions : [];
  const newestFirst = submissions.slice(0, 6).map((s) => totalProductionAPI(s));
  const oldestFirst = newestFirst.reverse();
  const padded = [];
  for (let i = 0; i < 6 - oldestFirst.length; i++) padded.push(0);
  return padded.concat(oldestFirst);
}
