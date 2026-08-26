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

  // Daily v2 — call-type split. `dials` stays the authoritative total; the
  // per-entry `dialsByType` breakdown is additive (brief decision 1).
  //
  // The fallback is decided PER ENTRY, not per week: an entry with any non-zero
  // bucket contributes its breakdown, an entry with none contributes its whole
  // `dials` to cold — pre-v2 behaviour. Per-week would break the sum in a mixed
  // week, and sum-preservation is what makes the split points-neutral.
  //
  // The invariant (sum of buckets === dials) is the WRITER's contract and is
  // property-tested at the schema layer. Deliberately NOT reconciled here.
  // Behaviour must match the ESM twin; the idiom differs (explicit && chains).
  const callSplit = entries.reduce(
    function (acc, e) {
      const b = (e && e.dialsByType) || {};
      const cold = i(b.cold);
      const ref = i(b.referral);
      const fu = i(b.followUp);
      const st = i(b.seminarTradeshow);
      if (cold || ref || fu || st) {
        acc.cold += cold;
        acc.referral += ref;
        acc.followUp += fu;
        acc.seminarTradeshow += st;
      } else {
        acc.cold += i(e && e.dials);
      }
      return acc;
    },
    { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 }
  );

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

  // Hoisted because both keys are conditionally emitted below — see the
  // OMITTED WHEN ZERO note beside `serviceCalls`.
  const serviceCallsTotal = sumInt('serviceCalls');
  const referralsObtainedTotal = sumInt('referralsObtained');

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
    // D-SC (26 Aug 2026): serviceCalls is now written, sourced from the real
    // daily `serviceCalls` field — NOT from `serviceContacts`. Closes the
    // disagreement where the daily pace badge scored service activity and the
    // aggregated weekly draft did not. Still excluded from every funnel and
    // plan sum (funnelModel.js, planVariance.js) — unchanged by this ruling.
    //
    // OMITTED WHEN ZERO — and this is the one place that differs from the four
    // call fields below, so the difference is stated rather than left to be
    // inferred. `coldCalls` and its siblings are always written because a daily
    // `dials` total exists and an agent-entered weekly value would double-count
    // against it. `serviceCalls` and `referralsObtained` have NO daily writer
    // yet — the KQM Calls ingest endpoint is not built — so writing a derived 0
    // over an agent-entered weekly value destroys real data and replaces it with
    // nothing. `referralsObtained` is worth 3pt, so the loss is visible.
    // The key returns the moment a daily source populates it, and derived still
    // wins over typed at that point, exactly as it does for the call fields.
    ...(serviceCallsTotal > 0 ? { serviceCalls: serviceCallsTotal } : {}),

    // v2 1a daily fields — prospecting & outreach
    prospectingLettersSent: sumInt('prospectingLettersSent'),
    ...(referralsObtainedTotal > 0 ? { referralsObtained: referralsObtainedTotal } : {}),
    seminarsConducted:      sumInt('seminarsConducted'),
    dials:                  sumInt('dials'),
    // M3 + daily v2: aggregated fast-path drafts earn call points. All four
    // fields are ALWAYS written (never omitted) so a { merge: true } write
    // overwrites stale agent-entered values and prevents double-counting in
    // computePoints / extractFields. With no breakdown present this reduces to
    // the pre-v2 behaviour exactly: coldCalls = sum of dials, siblings 0.
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

module.exports = { aggregateDailyToWeekly };
