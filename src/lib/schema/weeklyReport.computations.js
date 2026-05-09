/**
 * Pure computation functions for the V2 weekly report 3-source schema.
 *
 * All functions:
 *   - accept plain objects (no class instances)
 *   - call parseFloat() on every numeric input (project rule)
 *   - never mutate inputs
 *   - return 0 for missing/NaN inputs rather than NaN
 *
 * Tatil commission rules:
 *   - New Business earns commission at the agent's personal commissionRate.
 *   - PPP Increases earn ZERO commission (production credit only).
 *   - Lumpsums earn 0.5% commission on grossAmount regardless of agent rate.
 */

import {
  LMPS_CREDIT_RATE,
  LMPS_COMMISSION_RATE,
  MIN_PPP_INCREASE,
} from './weeklyReport.js';

const p = (v) => parseFloat(v) || 0;

// ── Lumpsum computations ──────────────────────────────────────────────────────

/**
 * API credit earned from a lumpsum transaction.
 * = grossAmount × 10%
 */
export function computeLumpsumCredit(grossAmount) {
  return p(grossAmount) * LMPS_CREDIT_RATE;
}

/**
 * Commission earned from a lumpsum transaction.
 * Fixed at 0.5% of grossAmount — NOT the agent's commissionRate.
 */
export function computeLumpsumCommission(grossAmount) {
  return p(grossAmount) * LMPS_COMMISSION_RATE;
}

// ── Production credit ─────────────────────────────────────────────────────────

/**
 * Total production credit for the week (the number that appears on the
 * Tatil branch whiteboard as "Total").
 *
 *   = NB.api + PPP.apiIncrease + LMPS.apiCredit
 *
 * @param {object} report - V2 weekly report shape
 */
export function computeTotalProductionCredit(report) {
  const nb   = p(report?.newBusiness?.api);
  const ppp  = p(report?.pppIncreases?.apiIncrease);
  const lmps = p(report?.lumpsums?.apiCredit);
  return nb + ppp + lmps;
}

// ── Commission ────────────────────────────────────────────────────────────────

/**
 * Total commission earned for the week.
 *
 *   = NB.api × agentRateFraction + LMPS.commission
 *
 * PPP intentionally excluded — production credit only, zero commission.
 *
 * @param {object} report           - V2 weekly report shape
 * @param {number} agentRateFraction - Agent's commission rate as a fraction
 *                                    (e.g. 0.35 for 35%). Use
 *                                    userProfile.commissionRate / 100 at
 *                                    the call site.
 */
export function computeTotalCommission(report, agentRateFraction) {
  const nbApi   = p(report?.newBusiness?.api);
  const lmpsComm = p(report?.lumpsums?.commission);
  const rate    = p(agentRateFraction);
  return nbApi * rate + lmpsComm;
}

// ── V1 field-name normalisation ───────────────────────────────────────────────
// These mirror the priority order in extractFields.js so migration reads
// match exactly what the production read path does.

/**
 * Read the V1 API (Annual Premium Income) field from a raw Firestore doc.
 * Priority: apiSold → api → annualPremium  (matches extractFields.js:91)
 */
export function readV1Api(doc) {
  return p(doc?.apiSold) || p(doc?.api) || p(doc?.annualPremium);
}

/**
 * Read the V1 applications-sold count from a raw Firestore doc.
 * Priority: applicationsSold → appsSold  (matches extractFields.js:89)
 */
export function readV1Apps(doc) {
  return p(doc?.applicationsSold) || p(doc?.appsSold);
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Returns true if a PPP apiIncrease amount is large enough to qualify.
 * Tatil rule: minimum = $2,400 annual API increase.
 */
export function validatePppIncrease(amount) {
  return p(amount) >= MIN_PPP_INCREASE;
}

/**
 * Validates a V2 weekly report's production fields.
 * Returns { valid: boolean, errors: string[] }.
 *
 * Does NOT validate activity counts or other wizard fields — only the
 * 3-source production section.
 */
export function validateReport(report) {
  const errors = [];

  const nbApps = p(report?.newBusiness?.apps);
  const nbApi  = p(report?.newBusiness?.api);
  const pppApps = p(report?.pppIncreases?.apps);
  const pppInc  = p(report?.pppIncreases?.apiIncrease);
  const lmpsGross = p(report?.lumpsums?.grossAmount);
  const lmpsCredit = p(report?.lumpsums?.apiCredit);
  const lmpsComm  = p(report?.lumpsums?.commission);

  if (nbApps < 0) errors.push('newBusiness.apps cannot be negative');
  if (nbApi  < 0) errors.push('newBusiness.api cannot be negative');
  if (pppApps < 0) errors.push('pppIncreases.apps cannot be negative');
  if (pppInc  < 0) errors.push('pppIncreases.apiIncrease cannot be negative');
  if (lmpsGross  < 0) errors.push('lumpsums.grossAmount cannot be negative');
  if (lmpsCredit < 0) errors.push('lumpsums.apiCredit cannot be negative');
  if (lmpsComm   < 0) errors.push('lumpsums.commission cannot be negative');

  // PPP increase, when non-zero, must meet the minimum threshold.
  if (pppInc > 0 && pppInc < MIN_PPP_INCREASE) {
    errors.push(`pppIncreases.apiIncrease ${pppInc} is below minimum ${MIN_PPP_INCREASE}`);
  }

  return { valid: errors.length === 0, errors };
}
