/**
 * goalDecomposition.js — the shared income→activity goal-decomposition engine.
 *
 * Extracted from CommissionPlayground/tabs/GoalDecompositionTab.jsx (the math
 * formerly lived inline in that tab's `computed` / ratio-auto-population
 * useMemos) so the Commission Playground AND the Game Plan hub's Weekly Planner
 * card derive weekly activity from a SINGLE source of truth — no duplicated
 * LIMRA chain, no drift.
 *
 * The chain (A–J, per the Goals System Plan):
 *   income → pre-tax → first-year commission → persistency-adjusted
 *          → API to write → API to settle
 *          → applications (÷ avg policy API)
 *          → CIs (× ciToSaleRatio) → dials (× dialsToCIRatio)
 *          → prospects (× prospectRatio)
 *
 * Zero-behavior-change vs the former inline math is guarded by the
 * characterization tests in __tests__/goalDecomposition.test.js (captured from
 * the pre-extraction inline math).
 */

// Nearest-$10 (currency) and whole-count rounding — shared with the Playground
// OutputTable and the Weekly Planner card so both round identically.
export const roundTo10    = (v) => Math.round(parseFloat(v) / 10) * 10;
export const roundToWhole = (v) => Math.round(parseFloat(v));

// 10-month Tatil production year ≈ 43 selling weeks (mirrors the Playground's
// weekly period divisor). Annual chain ÷ WEEKLY_DIVISOR → weekly target.
export const WEEKLY_DIVISOR = 43;

// Default decomposition inputs (formerly DEFAULT_INPUTS in GoalDecompositionTab).
export const DEFAULT_DECOMPOSITION_INPUTS = Object.freeze({
  incomeGoal:      300000,
  taxRate:         25,
  renewalIncome:   0,
  settlementRate:  90,
  commissionRate:  35,
  avgPolicyAPI:    12000,
  persistencyRate: 90,
  ciToSaleRatio:   2,
  dialsToCIRatio:  2.5,
  prospectRatio:   2,
});

/**
 * decomposeFromAPI — the API → activity half of the chain.
 *
 * Given a committed annual API anchor + the agent's ratios, derive the
 * downstream activity (applications, CIs, dials, prospects). This is what the
 * Weekly Planner card consumes: it starts from a committed personalAnnualAPI,
 * so it never re-runs the income→API half.
 *
 * @param {{ apiToWrite:number, avgPolicyAPI:number, ciToSaleRatio:number,
 *           dialsToCIRatio:number, prospectRatio:number }} params
 * @returns {{ apiToWrite:number, applications:number, ci:number,
 *             dials:number, prospects:number }}
 */
export function decomposeFromAPI({ apiToWrite, avgPolicyAPI, ciToSaleRatio, dialsToCIRatio, prospectRatio }) {
  const api          = parseFloat(apiToWrite) || 0;
  const applications = avgPolicyAPI > 0 ? api / avgPolicyAPI : 0;
  const ci           = applications * ciToSaleRatio;
  const dials        = ci * dialsToCIRatio;
  const prospects    = dials * prospectRatio;
  return { apiToWrite: api, applications, ci, dials, prospects };
}

/**
 * decomposeFromIncome — the full income → activity chain.
 *
 * Exact relocation of the math formerly inline in GoalDecompositionTab's
 * `computed` useMemo. The Commission Playground consumes this; the result shape
 * is unchanged from the tab's prior `computed` object.
 *
 * @param {object} inputs — the 10 decomposition inputs (see DEFAULT_DECOMPOSITION_INPUTS).
 * @returns {{ incomeGoal:number, apiToWrite:number, apiToSettle:number,
 *             applications:number, ci:number, dials:number, prospects:number }}
 */
export function decomposeFromIncome(inputs) {
  const {
    incomeGoal, taxRate, renewalIncome, settlementRate,
    commissionRate, avgPolicyAPI, persistencyRate,
    ciToSaleRatio, dialsToCIRatio, prospectRatio,
    preTaxAlreadyApplied,
  } = inputs;

  const preTaxIncome = preTaxAlreadyApplied
    ? incomeGoal
    : (taxRate < 100 ? incomeGoal / (1 - taxRate / 100) : 0);
  const firstYearCommRequired  = Math.max(0, preTaxIncome - renewalIncome);
  const adjustedForPersistency = persistencyRate > 0 ? firstYearCommRequired / (persistencyRate / 100) : 0;
  const apiToWrite             = commissionRate > 0 ? adjustedForPersistency / (commissionRate / 100) : 0;
  const apiToSettle            = apiToWrite * (settlementRate / 100);
  const applications           = avgPolicyAPI > 0 ? apiToWrite / avgPolicyAPI : 0;
  const ci                     = applications * ciToSaleRatio;
  const dials                  = ci * dialsToCIRatio;
  const prospects              = dials * prospectRatio;

  return { incomeGoal, apiToWrite, apiToSettle, applications, ci, dials, prospects };
}

/**
 * deriveRatiosFromHistory — auto-populate the CI-to-sale and dials-to-CI ratios
 * from the agent's submitted history (8+ weeks required).
 *
 * Relocated unchanged from GoalDecompositionTab's ratio-auto-population useMemo
 * so the Playground and the Weekly Planner card derive the SAME personalized
 * ratios. Under 8 submitted weeks → `hasHistory: false` and null ratios (the
 * card falls back to the company floor; the Playground keeps its defaults).
 *
 * @param {Array<object>} submissions — the agent's submission docs.
 * @returns {{ autoCiToSale:number|null, autoDialsToCI:number|null,
 *             hasHistory:boolean, weeksUsed:number }}
 */
export function deriveRatiosFromHistory(submissions) {
  const submitted = (submissions ?? [])
    .filter((s) => s.status === 'submitted')
    .slice(0, 12);

  if (submitted.length < 8) {
    return { autoCiToSale: null, autoDialsToCI: null, hasHistory: false, weeksUsed: submitted.length };
  }

  const totalCI    = submitted.reduce((sum, s) => sum + (parseFloat(s.ciConducted) || 0), 0);
  const totalApps  = submitted.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);
  const totalDials = submitted.reduce(
    (sum, s) =>
      sum +
      (parseFloat(s.referralCalls) || 0) +
      (parseFloat(s.followUpCalls) || 0) +
      (parseFloat(s.coldCalls) || 0) +
      (parseFloat(s.seminarTradeshowCalls) || 0),
    0,
  );

  const autoCiToSale  = totalApps > 0 ? totalCI / totalApps : null;
  const autoDialsToCI = totalCI   > 0 ? totalDials / totalCI : null;
  return {
    autoCiToSale,
    autoDialsToCI,
    hasHistory: autoCiToSale !== null && autoDialsToCI !== null,
    weeksUsed: submitted.length,
  };
}
