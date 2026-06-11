import { POINTS_WEIGHTS } from './gamificationConfig.js';

/**
 * Computes gamification points for one submitted weekly report.
 * Pure function — reads from POINTS_WEIGHTS, no Firestore, no side effects.
 *
 * ESM twin of functions/lib/computePoints.js (CJS).
 * Drift guard: src/lib/__tests__/computePoints.cross-check.test.js asserts
 * output equality on shared fixtures. Keep in sync with the CJS version.
 *
 * @param {object} fields  Raw Firestore submission document data (after.data()).
 * @returns {number}       Integer point total for this submission.
 */
function computePoints(fields) {
  if (!fields) return 0;
  const n = (v) => Math.max(0, parseFloat(v) || 0);

  // Dial types are summed first, then floored as a unit — preserves the
  // original behaviour where e.g. 1.5 + 1.5 = 3 (not 1+1 = 2).
  const dials =
    n(fields.referralCalls) +
    n(fields.followUpCalls) +
    n(fields.coldCalls) +
    n(fields.seminarTradeshowCalls);

  // otherNewNames: all new-name channels except referrals (scored separately at 3pt).
  // Seminar/tradeshow name yields included — events score for effort, names
  // score for pipeline yield ("a name is a name", Phase 1 ruling).
  const otherNewNames =
    n(fields.namesFromColdCanvass) +
    n(fields.namesFromOther) +
    n(fields.namesFromSeminarsConducted) +
    n(fields.namesFromTradeshowsAttended);

  // Mirror extractFields.js:95-97 — v2 nested shape (version === 2) first,
  // v1 flat fallback with full priority chain. Keep in sync with extractFields.js.
  const appsSoldVal =
    fields.version === 2 ? fields.newBusiness?.apps : (fields.applicationsSold ?? fields.appsSold);
  const apiSoldVal =
    fields.version === 2 ? fields.newBusiness?.api  : (fields.apiSold || fields.api || fields.annualPremium);

  return (
    // ── Prospecting ────────────────────────────────────────────────────────────
    Math.floor(dials)                                               * POINTS_WEIGHTS.dials +
    Math.min(Math.floor(n(fields.prospectingLettersSent)), 20)     * POINTS_WEIGHTS.prospectingLettersSent +
    Math.floor(n(fields.referralsObtained))                        * POINTS_WEIGHTS.referralsObtained +
    Math.floor(otherNewNames)                                      * POINTS_WEIGHTS.otherNewNames +
    Math.floor(n(fields.seminarsConducted))                        * POINTS_WEIGHTS.seminarsConducted +
    Math.floor(n(fields.tradeshowsAttended))                       * POINTS_WEIGHTS.tradeshowsAttended +
    // ── Advancing ──────────────────────────────────────────────────────────────
    Math.floor(n(fields.f2fAttempts))                              * POINTS_WEIGHTS.f2fAttempts +
    Math.floor(n(fields.appointmentsSet))                          * POINTS_WEIGHTS.appointmentsSet +
    Math.floor(n(fields.ffiConducted))                             * POINTS_WEIGHTS.ffiConducted +
    Math.floor(n(fields.ciConducted))                              * POINTS_WEIGHTS.ciConducted +
    // ── Closing ────────────────────────────────────────────────────────────────
    Math.floor(n(appsSoldVal))                                     * POINTS_WEIGHTS.applicationsSold +
    Math.floor(n(apiSoldVal) / 1000)                               * POINTS_WEIGHTS.apiPerThousand +
    // ── Service ────────────────────────────────────────────────────────────────
    Math.floor(n(fields.serviceCalls))                             * POINTS_WEIGHTS.serviceCalls +
    Math.floor(n(fields.policiesDelivered))                        * POINTS_WEIGHTS.policiesDelivered +
    Math.floor(n(fields.premiumCollectionMeetings))                * POINTS_WEIGHTS.premiumCollectionMeetings +
    Math.floor(n(fields.annualReviews))                            * POINTS_WEIGHTS.annualReviews +
    Math.floor(n(fields.orphanReviews))                            * POINTS_WEIGHTS.orphanReviews +
    Math.floor(n(fields.orphansAdopted))                           * POINTS_WEIGHTS.orphansAdopted +
    Math.floor(n(fields.reinstatementsSubmitted))                  * POINTS_WEIGHTS.reinstatementsSubmitted +
    Math.floor(n(fields.reinstatementAPI) / 1000)                  * POINTS_WEIGHTS.reinstatedApiPerThousand +
    Math.floor(n(fields.policyChanges))                            * POINTS_WEIGHTS.policyChanges
  );
}

export { computePoints };
