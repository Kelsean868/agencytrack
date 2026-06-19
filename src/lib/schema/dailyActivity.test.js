import { describe, it, expect } from 'vitest';
import {
  createEmptyDailyEntry,
  normalizeDailyEntry,
  getSundayOf,
  DAILY_ACTIVITY_VERSION,
} from './dailyActivity.js';
import { aggregateDailyToWeekly } from './dailyActivity.aggregator.js';
import { LMPS_CREDIT_RATE, LMPS_COMMISSION_RATE } from './weeklyReport.js';

// ── createEmptyDailyEntry ─────────────────────────────────────────────────────

describe('createEmptyDailyEntry', () => {
  it('returns the V2 shape with all numeric defaults at 0', () => {
    const entry = createEmptyDailyEntry('2026-05-12', 'agent-uid-1', 'Test Agent');
    expect(entry.version).toBe(DAILY_ACTIVITY_VERSION);
    expect(entry.date).toBe('2026-05-12');
    expect(entry.agentId).toBe('agent-uid-1');
    expect(entry.agentName).toBe('Test Agent');
    expect(entry.weekStarting).toBe('2026-05-10'); // Sunday before Tue May 12
    // existing fields
    expect(entry.qualifiedApproaches).toBe(0);
    expect(entry.appointmentsSet).toBe(0);
    expect(entry.ffisScheduled).toBe(0);
    expect(entry.ffiConducted).toBe(0);
    expect(entry.solutionPresentations).toBe(0);
    expect(entry.newCIBooked).toBe(0);
    expect(entry.oldCIBooked).toBe(0);
    expect(entry.ciConducted).toBe(0);
    expect(entry.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(entry.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(entry.lumpsums).toEqual({ grossAmount: 0 });
    expect(entry.newNamesAdded).toBe(0);
    expect(entry.oldNamesWorked).toBe(0);
    expect(entry.serviceContacts).toBe(0);
    // v2 1a new fields — prospecting & outreach
    expect(entry.prospectingLettersSent).toBe(0);
    expect(entry.seminarsConducted).toBe(0);
    expect(entry.dials).toBe(0);
    expect(entry.telContacts).toBe(0);
    expect(entry.f2fAttempts).toBe(0);
    // social
    expect(entry.socialPostsTotal).toBe(0);
    expect(entry.socialEngagementTotal).toBe(0);
    expect(entry.socialInboxEnquiries).toBe(0);
    expect(entry.namesFromSocial).toBe(0);
    expect(entry.socialPlatformBreakdown).toEqual({ facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 });
    // production & delivery
    expect(entry.livesSold).toBe(0);
    expect(entry.policiesDelivered).toBe(0);
    // hours (production tracking)
    expect(entry.officeHours).toBe(0);
    expect(entry.fieldHours).toBe(0);
  });

  it('reflection fields default to null/empty (optional)', () => {
    const entry = createEmptyDailyEntry('2026-05-12', 'a', 'A');
    expect(entry.hoursWorked).toBeNull();
    expect(entry.wins).toBe('');
    expect(entry.blockers).toBe('');
    expect(entry.notes).toBe('');
  });

  it('catch-up flag defaults to false / null', () => {
    const entry = createEmptyDailyEntry('2026-05-12', 'a', 'A');
    expect(entry.isCatchUp).toBe(false);
    expect(entry.catchUpStartDate).toBeNull();
    expect(entry.catchUpEndDate).toBeNull();
  });
});

// ── getSundayOf ───────────────────────────────────────────────────────────────

describe('getSundayOf', () => {
  it('Sunday → same Sunday', () => {
    expect(getSundayOf('2026-05-10')).toBe('2026-05-10'); // Sun
    expect(getSundayOf('2026-05-17')).toBe('2026-05-17'); // Sun
  });

  it('Monday → previous Sunday', () => {
    expect(getSundayOf('2026-05-11')).toBe('2026-05-10');
  });

  it('Tuesday → previous Sunday', () => {
    expect(getSundayOf('2026-05-12')).toBe('2026-05-10');
  });

  it('Saturday → previous Sunday (start of week)', () => {
    expect(getSundayOf('2026-05-16')).toBe('2026-05-10');
  });

  it('crosses a month boundary', () => {
    // Sat May 2 2026 → previous Sunday is Apr 26 2026
    expect(getSundayOf('2026-05-02')).toBe('2026-04-26');
  });

  it('crosses a year boundary', () => {
    // Fri Jan 2 2026 → previous Sunday is Dec 28 2025
    expect(getSundayOf('2026-01-02')).toBe('2025-12-28');
  });
});

// ── aggregateDailyToWeekly ────────────────────────────────────────────────────

describe('aggregateDailyToWeekly', () => {
  it('empty array → zero rollup with V2 marker', () => {
    const out = aggregateDailyToWeekly([], 35);
    expect(out.version).toBe(2);
    expect(out.aggregatedFromDaily).toBe(true);
    expect(out.qualifiedApproaches).toBe(0);
    expect(out.appointmentsSet).toBe(0);
    expect(out.ffisScheduled).toBe(0);
    expect(out.ffiConducted).toBe(0);
    expect(out.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(out.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(out.lumpsums).toEqual({ grossAmount: 0, apiCredit: 0, commission: 0 });
    expect(out.totalProductionCredit).toBe(0);
    expect(out.totalCommission).toBe(0);
    expect(out.namesFromOther).toBe(0);
    expect(out.oldNamesPool).toBe(0);
    expect(out.serviceContacts).toBe(0);
  });

  it('single day with NB only — totals match input, commission = NB.api × rate', () => {
    const day = {
      qualifiedApproaches: 5,
      ffiConducted: 2,
      ciConducted: 1,
      newBusiness:  { apps: 1, api: 5000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0 },
      newNamesAdded: 4,
    };
    const out = aggregateDailyToWeekly([day], 40);
    expect(out.qualifiedApproaches).toBe(5);
    expect(out.ffiConducted).toBe(2);
    expect(out.ciConducted).toBe(1);
    expect(out.newBusiness).toEqual({ apps: 1, api: 5000 });
    expect(out.totalProductionCredit).toBe(5000);
    // Commission = 5000 × 0.40 = 2000
    expect(out.totalCommission).toBeCloseTo(2000, 6);
    expect(out.namesFromOther).toBe(4);
  });

  it('three days with NB + LMPS — sums correct, LMPS apiCredit/commission recomputed at total', () => {
    const days = [
      { newBusiness: { apps: 1, api: 4000 }, lumpsums: { grossAmount: 10000 } },
      { newBusiness: { apps: 0, api: 0 },    lumpsums: { grossAmount: 5000 } },
      { newBusiness: { apps: 2, api: 6000 }, lumpsums: { grossAmount: 0 } },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.newBusiness).toEqual({ apps: 3, api: 10000 });
    // Lumpsum gross sums to 15000; apiCredit = 1500, commission = 75
    expect(out.lumpsums.grossAmount).toBe(15000);
    expect(out.lumpsums.apiCredit).toBeCloseTo(15000 * LMPS_CREDIT_RATE, 6);
    expect(out.lumpsums.commission).toBeCloseTo(15000 * LMPS_COMMISSION_RATE, 6);
    // Total production credit = NB.api 10000 + PPP.apiIncrease 0 + LMPS.apiCredit 1500 = 11500
    expect(out.totalProductionCredit).toBeCloseTo(11500, 6);
    // Total commission = NB.api × 0.35 + LMPS.commission = 3500 + 75 = 3575
    expect(out.totalCommission).toBeCloseTo(3575, 6);
  });

  it('day with PPP increase — PPP rolls into production credit but NOT into commission', () => {
    const days = [
      { newBusiness: { apps: 1, api: 3000 }, pppIncreases: { apps: 1, apiIncrease: 2400 } },
    ];
    const out = aggregateDailyToWeekly(days, 50);
    expect(out.pppIncreases).toEqual({ apps: 1, apiIncrease: 2400 });
    // Production credit = 3000 + 2400 = 5400
    expect(out.totalProductionCredit).toBeCloseTo(5400, 6);
    // Commission = NB.api × 0.50 = 1500. PPP excluded.
    expect(out.totalCommission).toBeCloseTo(1500, 6);
  });

  it('catch-up entry counts toward week totals like any other entry', () => {
    const catchUp = {
      qualifiedApproaches: 12, // pretend Mon-Wed catch-up bundled into one entry
      newBusiness: { apps: 2, api: 8000 },
      isCatchUp: true,
      catchUpStartDate: '2026-05-11',
      catchUpEndDate: '2026-05-13',
    };
    const thursday = { qualifiedApproaches: 4, newBusiness: { apps: 1, api: 3000 } };
    const out = aggregateDailyToWeekly([catchUp, thursday], 30);
    expect(out.qualifiedApproaches).toBe(16);
    expect(out.newBusiness).toEqual({ apps: 3, api: 11000 });
    expect(out.totalProductionCredit).toBeCloseTo(11000, 6);
    expect(out.totalCommission).toBeCloseTo(11000 * 0.3, 6);
  });

  it('coerces string numerics safely (parseFloat / parseInt)', () => {
    const days = [{ qualifiedApproaches: '7', newBusiness: { apps: '2', api: '1500' } }];
    const out = aggregateDailyToWeekly(days, 25);
    expect(out.qualifiedApproaches).toBe(7);
    expect(out.newBusiness).toEqual({ apps: 2, api: 1500 });
    expect(out.totalCommission).toBeCloseTo(1500 * 0.25, 6);
  });

  it('NaN / undefined fields treated as 0', () => {
    const days = [{ qualifiedApproaches: undefined, newBusiness: { apps: NaN, api: null } }];
    const out = aggregateDailyToWeekly(days, 0);
    expect(out.qualifiedApproaches).toBe(0);
    expect(out.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(out.totalCommission).toBe(0);
  });

  it('non-array input → empty rollup', () => {
    const out = aggregateDailyToWeekly(null, 35);
    expect(out.qualifiedApproaches).toBe(0);
    expect(out.totalProductionCredit).toBe(0);
  });
});

// ── DCv2 Phase 5: emergent days-worked + weekend signals ──────────────────────
// Week of Sun 2026-05-10 (opening Sunday) … Sat 2026-05-16.
describe('aggregateDailyToWeekly — emergent effort signals', () => {
  it('empty week → daysWorked 0, weekendWorked false, weekendApi 0', () => {
    const out = aggregateDailyToWeekly([], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  it('5 weekday-only days → daysWorked 5, weekendWorked false', () => {
    const days = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15']
      .map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(5);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  it('opening-Sunday-only week → weekendWorked true (TT-anchored: 2026-05-10 is a Sunday)', () => {
    // The opening Sunday is detected via the noon-UTC anchor, so this holds
    // regardless of the test runner's local timezone (the UTC-4 trap).
    const out = aggregateDailyToWeekly([{ date: '2026-05-10', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  it('Saturday-only week → weekendWorked true', () => {
    const out = aggregateDailyToWeekly([{ date: '2026-05-16', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  it('full 7-day week → daysWorked 7, weekendWorked true', () => {
    const days = [
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
      '2026-05-14', '2026-05-15', '2026-05-16',
    ].map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(7);
    expect(out.weekendWorked).toBe(true);
  });

  it('two docs on the same date count once (distinct-date dedupe guard)', () => {
    const days = [
      { date: '2026-05-12', qualifiedApproaches: 1 },
      { date: '2026-05-12', qualifiedApproaches: 1 },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(1);
  });

  it('weekendApi sums NB.api + PPP.apiIncrease + LMPS credit from weekend entries only', () => {
    const days = [
      // Saturday — counts toward weekendApi
      { date: '2026-05-16', newBusiness: { api: 5000 }, pppIncreases: { apiIncrease: 2000 }, lumpsums: { grossAmount: 10000 } },
      // Friday — excluded from weekendApi (still in week totals)
      { date: '2026-05-15', newBusiness: { api: 3000 } },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    // weekend: 5000 + 2000 + (10000 × 0.10 credit) = 8000
    expect(out.weekendApi).toBeCloseTo(8000, 6);
    // whole-week totalProductionCredit includes the Friday too
    expect(out.totalProductionCredit).toBeCloseTo(5000 + 3000 + 2000 + 1000, 6);
    expect(out.weekendWorked).toBe(true);
    expect(out.daysWorked).toBe(2);
  });

  it('entries without a date field do not crash and contribute 0 distinct days', () => {
    const out = aggregateDailyToWeekly([{ qualifiedApproaches: 5 }], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });
});

// ── normalizeDailyEntry ───────────────────────────────────────────────────────

describe('normalizeDailyEntry', () => {
  it('empty call → all numeric fields default to 0', () => {
    const n = normalizeDailyEntry({});
    expect(n.prospectingLettersSent).toBe(0);
    expect(n.seminarsConducted).toBe(0);
    expect(n.dials).toBe(0);
    expect(n.telContacts).toBe(0);
    expect(n.f2fAttempts).toBe(0);
    expect(n.socialPostsTotal).toBe(0);
    expect(n.socialEngagementTotal).toBe(0);
    expect(n.socialInboxEnquiries).toBe(0);
    expect(n.namesFromSocial).toBe(0);
    expect(n.socialPlatformBreakdown).toEqual({ facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 });
    expect(n.livesSold).toBe(0);
    expect(n.policiesDelivered).toBe(0);
    expect(n.officeHours).toBe(0);
    expect(n.fieldHours).toBe(0);
    expect(n.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(n.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(n.lumpsums).toEqual({ grossAmount: 0 });
  });

  it('no-arg call → same as empty object', () => {
    const n = normalizeDailyEntry();
    expect(n.dials).toBe(0);
    expect(n.telContacts).toBe(0);
  });

  it('accepts valid numeric values', () => {
    const n = normalizeDailyEntry({
      prospectingLettersSent: 3,
      dials: 42,
      telContacts: 10,
      f2fAttempts: 2,
      socialPostsTotal: 5,
      livesSold: 1,
      policiesDelivered: 2,
      officeHours: 4.5,
      fieldHours: 3.5,
      newBusiness: { apps: 2, api: 7500 },
    });
    expect(n.prospectingLettersSent).toBe(3);
    expect(n.dials).toBe(42);
    expect(n.telContacts).toBe(10);
    expect(n.f2fAttempts).toBe(2);
    expect(n.socialPostsTotal).toBe(5);
    expect(n.livesSold).toBe(1);
    expect(n.policiesDelivered).toBe(2);
    expect(n.officeHours).toBe(4.5);
    expect(n.fieldHours).toBe(3.5);
    expect(n.newBusiness).toEqual({ apps: 2, api: 7500 });
  });

  it('coerces string numerics to numbers', () => {
    const n = normalizeDailyEntry({
      dials: '15',
      telContacts: '7',
      officeHours: '3.5',
      fieldHours: '2.0',
      livesSold: '2',
      socialPlatformBreakdown: { facebook: '4', instagram: '1', whatsapp: '0', linkedin: '2' },
    });
    expect(n.dials).toBe(15);
    expect(n.telContacts).toBe(7);
    expect(n.officeHours).toBe(3.5);
    expect(n.fieldHours).toBe(2);
    expect(n.livesSold).toBe(2);
    expect(n.socialPlatformBreakdown).toEqual({ facebook: 4, instagram: 1, whatsapp: 0, linkedin: 2 });
  });

  it('treats NaN / undefined / null / non-numeric strings as 0 (reject bad types)', () => {
    const n = normalizeDailyEntry({
      dials: undefined,
      telContacts: null,
      livesSold: NaN,
      officeHours: 'abc',
      fieldHours: {},
      socialPostsTotal: [],
      socialPlatformBreakdown: { facebook: undefined, instagram: null, whatsapp: NaN, linkedin: 'x' },
    });
    expect(n.dials).toBe(0);
    expect(n.telContacts).toBe(0);
    expect(n.livesSold).toBe(0);
    expect(n.officeHours).toBe(0);
    expect(n.fieldHours).toBe(0);
    expect(n.socialPostsTotal).toBe(0);
    expect(n.socialPlatformBreakdown).toEqual({ facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 });
  });

  it('handles missing nested objects gracefully (no socialPlatformBreakdown key)', () => {
    const n = normalizeDailyEntry({ dials: 5 });
    expect(n.socialPlatformBreakdown).toEqual({ facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 });
    expect(n.newBusiness).toEqual({ apps: 0, api: 0 });
  });
});
