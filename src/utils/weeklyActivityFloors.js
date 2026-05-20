// Tatil manager workshop 2026-05-19 — Appendix A. Subject to managers' 6-month review.
// Canonical mapping is documented in docs/briefs/weekly-activity-floors-kickoff.md.
export const DEFAULT_WEEKLY_ACTIVITY_FLOORS = Object.freeze({
  callsMade:             60,
  contactsMade:          40,
  appointmentsScheduled: 20,
  interviewsKept:        15,
  factFindsCompleted:    10,
  closingInterviewsKept: 10,
  applicationsSubmitted: 1,
  clientsSold:           1,
  api:                   4800,
  referralsNewLeads:     100,
});

// Display order + presentation metadata. Row #2 carries a footnote because
// telContacts resolves to qualifiedApproaches via the existing extractFields
// fallback until a true telephone-contacts wizard field exists.
export const WEEKLY_ACTIVITY_FLOOR_ROWS = Object.freeze([
  { key: 'callsMade',             label: 'Calls Made',             isCurrency: false },
  { key: 'contactsMade',          label: 'Contacts Made',          isCurrency: false, footnote: 'Currently uses qualified approaches as a proxy until a dedicated telephone-contacts field exists.' },
  { key: 'appointmentsScheduled', label: 'Appointments Scheduled', isCurrency: false },
  { key: 'interviewsKept',        label: 'Interviews Kept',        isCurrency: false },
  { key: 'factFindsCompleted',    label: 'Fact Finds Completed',   isCurrency: false },
  { key: 'closingInterviewsKept', label: 'Closing Interviews Kept', isCurrency: false },
  { key: 'applicationsSubmitted', label: 'Applications Submitted', isCurrency: false },
  { key: 'clientsSold',           label: 'Clients Sold',           isCurrency: false },
  { key: 'api',                   label: 'API (TTD)',              isCurrency: true  },
  { key: 'referralsNewLeads',     label: 'Referrals / New Leads',  isCurrency: false },
]);

// Per-row status. green ≥ expected, amber ≥ 70% of expected, red below.
// Expected = 0 (defensive) is treated as green when actual is also 0.
export function floorStatus(expected, actual) {
  const e = parseFloat(expected) || 0;
  const a = parseFloat(actual)   || 0;
  if (e <= 0) return a > 0 ? 'green' : 'green';
  if (a >= e)       return 'green';
  if (a >= e * 0.7) return 'amber';
  return 'red';
}

// Derive the 10 weekly-floor actuals from a single submission's extractFields()
// output. `fields` is the object returned by extractFields(submission).
// Per the corrected brief mapping:
//   #1  callsMade            → totalTelAttempts  (excludes serviceCalls by design)
//   #2  contactsMade         → telContacts       (resolves to qualifiedApproaches via fallback)
//   #3  appointmentsScheduled → appointmentsSet
//   #4  interviewsKept       → ffiConducted + ciConducted
//   #5  factFindsCompleted   → ffiConducted
//   #6  closingInterviewsKept → ciConducted
//   #7  applicationsSubmitted → applicationsSold
//   #8  clientsSold          → livesSold
//   #9  api                  → apiSold
//   #10 referralsNewLeads    → totalNewNames     (derived 7-sum)
export function deriveWeeklyFloorActuals(fields) {
  if (!fields) {
    return {
      callsMade: 0, contactsMade: 0, appointmentsScheduled: 0,
      interviewsKept: 0, factFindsCompleted: 0, closingInterviewsKept: 0,
      applicationsSubmitted: 0, clientsSold: 0, api: 0, referralsNewLeads: 0,
    };
  }
  const ffi = parseFloat(fields.ffiConducted) || 0;
  const ci  = parseFloat(fields.ciConducted)  || 0;
  return {
    callsMade:             parseFloat(fields.totalTelAttempts) || 0,
    contactsMade:          parseFloat(fields.telContacts)      || 0,
    appointmentsScheduled: parseFloat(fields.appointmentsSet)  || 0,
    interviewsKept:        ffi + ci,
    factFindsCompleted:    ffi,
    closingInterviewsKept: ci,
    applicationsSubmitted: parseFloat(fields.applicationsSold) || 0,
    clientsSold:           parseFloat(fields.livesSold)        || 0,
    api:                   parseFloat(fields.apiSold)          || 0,
    referralsNewLeads:     parseFloat(fields.totalNewNames)    || 0,
  };
}
