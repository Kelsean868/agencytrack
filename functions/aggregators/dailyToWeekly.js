/**
 * CommonJS twin of src/lib/schema/dailyActivity.aggregator.js.
 *
 * Cloud Functions runtime is CommonJS (no "type":"module" in functions/);
 * we cannot require() the ESM client copy directly. The math is small
 * enough that maintaining a parallel file is cheaper than introducing a
 * bundler.
 *
 * MUST stay in sync with src/lib/schema/dailyActivity.aggregator.js.
 * Vitest covers the canonical client copy (src/lib/schema/dailyActivity.test.js).
 */

const LMPS_CREDIT_RATE = 0.10;
const LMPS_COMMISSION_RATE = 0.005;
const WEEKLY_REPORT_VERSION = 2;

const p = (v) => parseFloat(v) || 0;
const i = (v) => parseInt(v, 10) || 0;

/**
 * True iff `dateStr` ('YYYY-MM-DD') falls on a weekend day — the opening
 * Sunday (day 0) or the Saturday (day 6) of the Trinidad (Sun-start) week.
 *
 * Anchored to noon-UTC so the day-of-week derives from the calendar date
 * itself, never the runtime's local timezone (the UTC-4 trap). Mirrors the
 * date math in getSundayOf() / deriveWeekStripDays().
 */
function isWeekendDate(dateStr) {
  if (!dateStr) return false;
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function computeLumpsumCredit(grossAmount) {
  return p(grossAmount) * LMPS_CREDIT_RATE;
}

function computeLumpsumCommission(grossAmount) {
  return p(grossAmount) * LMPS_COMMISSION_RATE;
}

function computeTotalProductionCredit(report) {
  const nb = p(report && report.newBusiness && report.newBusiness.api);
  const ppp = p(report && report.pppIncreases && report.pppIncreases.apiIncrease);
  const lmps = p(report && report.lumpsums && report.lumpsums.apiCredit);
  return nb + ppp + lmps;
}

function computeTotalCommission(report, agentRateFraction) {
  const nbApi = p(report && report.newBusiness && report.newBusiness.api);
  const lmpsComm = p(report && report.lumpsums && report.lumpsums.commission);
  const rate = p(agentRateFraction);
  return nbApi * rate + lmpsComm;
}

function aggregateDailyToWeekly(dailyEntries, commissionRate = 0) {
  const entries = Array.isArray(dailyEntries) ? dailyEntries : [];

  const sumInt = (key) => entries.reduce((acc, e) => acc + i(e && e[key]), 0);
  const sumFloat = (key) => entries.reduce((acc, e) => acc + p(e && e[key]), 0);
  const sumPath = (key, sub) =>
    entries.reduce((acc, e) => acc + p(e && e[key] && e[key][sub]), 0);
  const sumPathInt = (key, sub) =>
    entries.reduce((acc, e) => acc + i(e && e[key] && e[key][sub]), 0);

  const nbApps = sumPathInt('newBusiness', 'apps');
  const nbApi = sumPath('newBusiness', 'api');

  const pppApps = sumPathInt('pppIncreases', 'apps');
  const pppInc = sumPath('pppIncreases', 'apiIncrease');

  const lmpsGross = sumPath('lumpsums', 'grossAmount');
  const lmpsCredit = computeLumpsumCredit(lmpsGross);
  const lmpsCommission = computeLumpsumCommission(lmpsGross);

  const productionShape = {
    newBusiness: { apps: nbApps, api: nbApi },
    pppIncreases: { apps: pppApps, apiIncrease: pppInc },
    lumpsums: { grossAmount: lmpsGross, apiCredit: lmpsCredit, commission: lmpsCommission },
  };

  const totalProductionCredit = computeTotalProductionCredit(productionShape);
  const totalCommission = computeTotalCommission(productionShape, p(commissionRate) / 100);

  // DCv2 Phase 5 — emergent effort signals derived in-place from the per-day
  // docs (each carries its own `date`). daysWorked mirrors the agent strip's
  // own predicate: a day "counts" iff a daily doc exists for it (distinct
  // dates), NOT a separate non-empty-value rule. weekendApi uses the same
  // basis as the manager's API column (totalProductionCredit) restricted to
  // weekend-day entries. MUST stay byte-identical to the ESM twin.
  const workedDates = new Set();
  let weekendNbApi = 0;
  let weekendPppInc = 0;
  let weekendLmpsGross = 0;
  for (const e of entries) {
    const date = e && e.date;
    if (!date) continue;
    workedDates.add(date);
    if (isWeekendDate(date)) {
      weekendNbApi += p(e && e.newBusiness && e.newBusiness.api);
      weekendPppInc += p(e && e.pppIncreases && e.pppIncreases.apiIncrease);
      weekendLmpsGross += p(e && e.lumpsums && e.lumpsums.grossAmount);
    }
  }
  const daysWorked = workedDates.size;
  const weekendWorked = [...workedDates].some(isWeekendDate);
  const weekendApi = weekendNbApi + weekendPppInc + computeLumpsumCredit(weekendLmpsGross);

  return {
    version: WEEKLY_REPORT_VERSION,

    qualifiedApproaches: sumInt('qualifiedApproaches'),
    appointmentsSet: sumInt('appointmentsSet'),
    ffisScheduled: sumInt('ffisScheduled'),
    ffiConducted: sumInt('ffiConducted'),
    solutionPresentations: sumInt('solutionPresentations'),
    newCIBooked: sumInt('newCIBooked'),
    oldCIBooked: sumInt('oldCIBooked'),
    ciConducted: sumInt('ciConducted'),

    newBusiness: productionShape.newBusiness,
    pppIncreases: productionShape.pppIncreases,
    lumpsums: productionShape.lumpsums,
    totalProductionCredit,
    totalCommission,

    namesFromOther: sumInt('newNamesAdded'),
    oldNamesPool: sumInt('oldNamesWorked'),
    serviceContacts: sumInt('serviceContacts'),

    // v2 1a daily fields — prospecting & outreach
    prospectingLettersSent: sumInt('prospectingLettersSent'),
    seminarsConducted:      sumInt('seminarsConducted'),
    dials:                  sumInt('dials'),
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

module.exports = { aggregateDailyToWeekly };
