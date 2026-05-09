/**
 * Pure aggregation: array of daily entries → V2-shaped weekly draft fragment.
 *
 * Used by:
 *   - functions/aggregators/sundayDailyToWeekly.js (Sunday cron)
 *   - mode-switch logic when agent flips daily → weekly mid-week
 *
 * Output is a partial submissions doc; Cloud Function merges it into the
 * existing draft path (tenants/{tid}/submissions/{uid}_{weekStarting}) with
 * { merge: true } so any agent-edited wizard fields (Step 1 prospecting,
 * Step 5 names breakdown, Step 6 deliveries, Step 7+8 reflection, Step 9
 * goals) are preserved.
 *
 * Lumpsum apiCredit and commission are RECOMPUTED at the week-level total,
 * not summed from per-day computed values, so rounding compounds at most once.
 *
 * totalProductionCredit and totalCommission are computed once at the week
 * level using the agent's commissionRate, mirroring submissionService.sanitize.
 */

import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  computeTotalCommission,
} from './weeklyReport.computations.js';
import { WEEKLY_REPORT_VERSION } from './weeklyReport.js';

const p = (v) => parseFloat(v) || 0;
const i = (v) => parseInt(v, 10) || 0;

/**
 * @param {Array<object>} dailyEntries - dailyActivity docs for a single week.
 * @param {number} commissionRate       - Agent's commissionRate as a percentage
 *                                        (e.g. 35 for 35%). Same shape as
 *                                        userProfile.commissionRate.
 * @returns {object} V2-shaped weekly draft fragment.
 */
export function aggregateDailyToWeekly(dailyEntries, commissionRate = 0) {
  const entries = Array.isArray(dailyEntries) ? dailyEntries : [];

  const sumInt   = (key) => entries.reduce((acc, e) => acc + i(e?.[key]), 0);
  const sumFloat = (key) => entries.reduce((acc, e) => acc + p(e?.[key]), 0);
  const sumPath  = (key, sub) => entries.reduce((acc, e) => acc + p(e?.[key]?.[sub]), 0);
  const sumPathInt = (key, sub) => entries.reduce((acc, e) => acc + i(e?.[key]?.[sub]), 0);

  const nbApps  = sumPathInt('newBusiness', 'apps');
  const nbApi   = sumPath('newBusiness', 'api');

  const pppApps  = sumPathInt('pppIncreases', 'apps');
  const pppInc   = sumPath('pppIncreases', 'apiIncrease');

  const lmpsGross   = sumPath('lumpsums', 'grossAmount');
  const lmpsCredit  = computeLumpsumCredit(lmpsGross);
  const lmpsCommission = computeLumpsumCommission(lmpsGross);

  const productionShape = {
    newBusiness:  { apps: nbApps, api: nbApi },
    pppIncreases: { apps: pppApps, apiIncrease: pppInc },
    lumpsums:     { grossAmount: lmpsGross, apiCredit: lmpsCredit, commission: lmpsCommission },
  };

  const totalProductionCredit = computeTotalProductionCredit(productionShape);
  const totalCommission       = computeTotalCommission(productionShape, p(commissionRate) / 100);

  return {
    version: WEEKLY_REPORT_VERSION,

    qualifiedApproaches:    sumInt('qualifiedApproaches'),
    appointmentsSet:        sumInt('appointmentsSet'),
    ffisScheduled:          sumInt('ffisScheduled'),
    ffiConducted:           sumInt('ffiConducted'),
    solutionPresentations:  sumInt('solutionPresentations'),
    newCIBooked:            sumInt('newCIBooked'),
    oldCIBooked:            sumInt('oldCIBooked'),
    ciConducted:            sumInt('ciConducted'),

    ...productionShape,
    totalProductionCredit,
    totalCommission,

    namesFromOther:  sumInt('newNamesAdded'),
    oldNamesPool:    sumInt('oldNamesWorked'),
    serviceContacts: sumInt('serviceContacts'),

    aggregatedFromDaily: true,
  };
}
