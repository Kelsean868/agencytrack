'use strict';

const { POINTS_WEIGHTS } = require('./gamificationConfig');

/**
 * Computes gamification points for one submitted weekly report.
 * Pure function — reads from POINTS_WEIGHTS, no Firestore, no side effects.
 *
 * @param {object} fields  Raw Firestore submission document data (after.data()).
 * @returns {number}       Integer point total for this submission.
 */
function computePoints(fields) {
  const n = (v) => parseFloat(v) || 0;

  // Dial types are summed first, then floored as a unit — preserves the
  // original behaviour where e.g. 1.5 + 1.5 = 3 (not 1+1 = 2).
  const dials =
    n(fields.referralCalls) +
    n(fields.followUpCalls) +
    n(fields.coldCalls) +
    n(fields.seminarTradeshowCalls);

  return (
    Math.floor(dials)                                            * POINTS_WEIGHTS.dials +
    Math.floor(n(fields.f2fAttempts))                           * POINTS_WEIGHTS.f2fAttempts +
    Math.floor(n(fields.ffiConducted))                          * POINTS_WEIGHTS.ffiConducted +
    Math.floor(n(fields.ciConducted))                           * POINTS_WEIGHTS.ciConducted +
    Math.floor(n(fields.applicationsSold || fields.appsSold))   * POINTS_WEIGHTS.applicationsSold +
    Math.floor(n(fields.apiSold) / 1000)                        * POINTS_WEIGHTS.apiPerThousand
  );
}

module.exports = { computePoints };
