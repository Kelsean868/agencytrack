'use strict';

// CJS twin of computeDayPoints in src/components/daily/DailyCaptureV2.helpers.js
// (the Daily Capture pace badge's per-day score). Used by the leaderboard
// aggregate to score a week that has no submitted report (FR Leaderboard L-1,
// dispatcher ruling on D5).
//
// Drift guard: src/lib/__tests__/dayPoints.cross-check.test.js runs shared
// fixtures through both runtimes and asserts identical output.

const { computePoints } = require('./computePoints');

const intOrZero   = (v) => parseInt(v, 10) || 0;
const floatOrZero = (v) => parseFloat(v) || 0;

/**
 * Map a daily entry to the weekly-report field shape computePoints (and the
 * server's extractActivityFields) expect. Mapping identical to the client:
 *   dials → coldCalls (other call types 0) · newBusiness.{apps,api} →
 *   applicationsSold/apiSold · newNamesAdded → namesFromOther ·
 *   serviceCalls → serviceCalls · version pinned to 1 (daily version is a
 *   different namespace from the weekly `version`).
 *
 * One mapping for points AND activity counts (FR Leaderboard A1-D3), so the two
 * can never drift apart. `entry` must be a daily entry object.
 */
function mapDayToReportFields(entry) {
  return {
    ...entry,
    coldCalls:             floatOrZero(entry.dials),
    referralCalls:         0,
    followUpCalls:         0,
    seminarTradeshowCalls: 0,
    applicationsSold: intOrZero(entry.newBusiness?.apps),
    apiSold:          floatOrZero(entry.newBusiness?.api),
    namesFromOther: intOrZero(entry.newNamesAdded),
    serviceCalls: intOrZero(entry.serviceCalls),
    version: 1,
  };
}

/** Score a daily entry: computePoints over the mapped report fields. */
function computeDayPoints(entry) {
  return entry ? computePoints(mapDayToReportFields(entry)) : 0;
}

module.exports = { computeDayPoints, mapDayToReportFields };
