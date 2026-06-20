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
 * True iff `dateStr` ('YYYY-MM-DD') falls on a weekend day — the opening
 * Sunday (day 0) or the Saturday (day 6) of the Trinidad (Sun-start) week.
 *
 * Anchored to noon-UTC so the day-of-week derives from the calendar date
 * itself, never the runner's local timezone (the UTC-4 trap). Mirrors the
 * date math in getSundayOf() / deriveWeekStripDays().
 */
function isWeekendDate(dateStr) {
  if (!dateStr) return false;
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

/**
 * @param {Array<object>} dailyEntries - dailyActivity docs for a single week.
 * @param {number} commissionRate       - Agent's commissionRate as a percentage
 *                                        (e.g. 35 for 35%). Same shape as
 *                                        userProfile.commissionRate.
 * @returns {object} V2-shaped weekly draft fragment.
 */
export function aggregateDailyToWeekly(dailyEntries, commissionRate = 0) {
  const entries = Array.isArray(dailyEntries) ? dailyEntries : [];

  const sumInt     = (key)      => entries.reduce((acc, e) => acc + i(e?.[key]), 0);
  const sumFloat   = (key)      => entries.reduce((acc, e) => acc + p(e?.[key]), 0);
  const sumPath    = (key, sub) => entries.reduce((acc, e) => acc + p(e?.[key]?.[sub]), 0);
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

  // DCv2 Phase 5 — emergent effort signals derived in-place from the per-day
  // docs (each carries its own `date`). daysWorked mirrors the agent strip's
  // own predicate: a day "counts" iff a daily doc exists for it (distinct
  // dates), NOT a separate non-empty-value rule. weekendApi uses the same
  // basis as the manager's API column (totalProductionCredit) restricted to
  // weekend-day entries.
  const workedDates = new Set();
  let weekendNbApi = 0;
  let weekendPppInc = 0;
  let weekendLmpsGross = 0;
  for (const e of entries) {
    const date = e?.date;
    if (!date) continue;
    workedDates.add(date);
    if (isWeekendDate(date)) {
      weekendNbApi     += p(e?.newBusiness?.api);
      weekendPppInc    += p(e?.pppIncreases?.apiIncrease);
      weekendLmpsGross += p(e?.lumpsums?.grossAmount);
    }
  }
  const daysWorked    = workedDates.size;
  const weekendWorked = [...workedDates].some(isWeekendDate);
  const weekendApi    = weekendNbApi + weekendPppInc + computeLumpsumCredit(weekendLmpsGross);

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

    // v2 1a daily fields — prospecting & outreach
    prospectingLettersSent: sumInt('prospectingLettersSent'),
    seminarsConducted:      sumInt('seminarsConducted'),
    dials:                  sumInt('dials'),
    // M3: mirrors computeDayPoints mapping so aggregated fast-path drafts earn
    // call points. coldCalls === dials total; referralCalls/followUpCalls/
    // seminarTradeshowCalls stay absent (0) to avoid double-counting.
    coldCalls:              sumInt('dials'),
    telContacts:            sumInt('telContacts'),
    f2fAttempts:            sumInt('f2fAttempts'),
    // Social (live platform shape)
    socialPostsTotal:      sumInt('socialPostsTotal'),
    socialEngagementTotal: sumInt('socialEngagementTotal'),
    socialInboxEnquiries:  sumInt('socialInboxEnquiries'),
    namesFromSocial:       sumInt('namesFromSocial'),
    socialPlatformBreakdown: {
      facebook:  sumPathInt('socialPlatformBreakdown', 'facebook'),
      instagram: sumPathInt('socialPlatformBreakdown', 'instagram'),
      whatsapp:  sumPathInt('socialPlatformBreakdown', 'whatsapp'),
      linkedin:  sumPathInt('socialPlatformBreakdown', 'linkedin'),
    },
    // Production & delivery
    livesSold:         sumInt('livesSold'),
    policiesDelivered: sumInt('policiesDelivered'),
    // Hours (production tracking, distinct from reflection hoursWorked)
    officeHours: sumFloat('officeHours'),
    fieldHours:  sumFloat('fieldHours'),

    // DCv2 Phase 5 — emergent effort signals (render-only in MasterSheet)
    daysWorked,
    weekendWorked,
    weekendApi,

    aggregatedFromDaily: true,
  };
}
