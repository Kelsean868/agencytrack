/**
 * weeklyReport schema constants and factory.
 *
 * V1 (legacy): single flat `apiSold` field representing New Business only.
 * V2 (this PR):  3-source split — New Business, PPP Increases, Lumpsums.
 *
 * Firestore collection: tenants/{tenantId}/submissions/{subId}
 *
 * Tatil business rules encoded here:
 *   - PPP Increases are a production credit only — ZERO commission.
 *   - Lumpsums earn a fixed API credit (10%) and commission (0.5%),
 *     independent of the agent's personal commission rate.
 *   - Minimum PPP Increase that qualifies = $2,400 annual API increase.
 */

export const WEEKLY_REPORT_VERSION = 2;

/** Minimum PPP apiIncrease (TTD) that qualifies as a valid PPP transaction. */
export const MIN_PPP_INCREASE = 2400;

/** Fraction of a lumpsum's grossAmount credited as API. */
export const LMPS_CREDIT_RATE = 0.10;

/** Fixed commission rate on lumpsums (NOT the agent's personal commissionRate). */
export const LMPS_COMMISSION_RATE = 0.005;

/**
 * Returns a zeroed V2 production-source shape for the three Tatil
 * production types. Merge this into a full submission doc alongside the
 * existing activity/goal fields that the wizard still owns.
 *
 * @param {Date|string} weekStarting - Must be a Sunday.
 * @returns {object}
 */
export function createEmptyWeeklyReport(weekStarting = null) {
  return {
    version: WEEKLY_REPORT_VERSION,
    weekStarting: weekStarting ?? null,
    newBusiness: { apps: 0, api: 0 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums: { grossAmount: 0, apiCredit: 0, commission: 0 },
    totalProductionCredit: 0,
    totalCommission: 0,
  };
}
