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

  // Daily v2 — call-type split. `dials` stays the authoritative total; the
  // per-entry `dialsByType` breakdown is additive (brief decision 1).
  //
  // The fallback is decided PER ENTRY, not per week: an entry with any non-zero
  // bucket contributes its breakdown, an entry with none contributes its whole
  // `dials` to cold — today's behaviour. Per-week would break the sum in a mixed
  // week where some days carry a breakdown and others do not, and the
  // sum-preservation is what makes the split points-neutral (computePoints sums
  // the four types then floors ONCE).
  //
  // The invariant (Σbuckets === dials) is the WRITER's contract and is
  // property-tested at the schema layer. It is deliberately NOT reconciled here:
  // `dials` is emitted independently, so a contract violation shows up as a
  // visible disagreement rather than being silently patched into `cold`.
  const callSplit = entries.reduce(
    (acc, e) => {
      const b    = e?.dialsByType;
      const cold = i(b?.cold);
      const ref  = i(b?.referral);
      const fu   = i(b?.followUp);
      const st   = i(b?.seminarTradeshow);
      if (cold || ref || fu || st) {
        acc.cold             += cold;
        acc.referral         += ref;
        acc.followUp         += fu;
        acc.seminarTradeshow += st;
      } else {
        acc.cold += i(e?.dials);
      }
      return acc;
    },
    { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 }
  );

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
    // D-SC (26 Aug 2026): the aggregator now writes serviceCalls, sourced from
    // the real daily `serviceCalls` field — NOT from `serviceContacts`. Closes
    // the disagreement where the daily pace badge scored service activity and
    // the aggregated weekly draft did not. serviceCalls stays excluded from
    // every funnel and plan sum (funnelModel.js, planVariance.js) — unchanged.
    serviceCalls:    sumInt('serviceCalls'),

    // v2 1a daily fields — prospecting & outreach
    prospectingLettersSent: sumInt('prospectingLettersSent'),
    referralsObtained:      sumInt('referralsObtained'),
    seminarsConducted:      sumInt('seminarsConducted'),
    dials:                  sumInt('dials'),
    // M3 + daily v2: aggregated fast-path drafts earn call points. All four
    // fields are ALWAYS written (never omitted) so a { merge: true } write
    // overwrites stale agent-entered values and prevents double-counting in
    // computePoints / extractFields. With no breakdown present this reduces to
    // the pre-v2 behaviour exactly: coldCalls = Σdials, siblings 0.
    coldCalls:              callSplit.cold,
    referralCalls:          callSplit.referral,
    followUpCalls:          callSplit.followUp,
    seminarTradeshowCalls:  callSplit.seminarTradeshow,
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
