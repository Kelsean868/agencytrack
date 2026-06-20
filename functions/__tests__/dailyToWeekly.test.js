'use strict';

const { aggregateDailyToWeekly } = require('../aggregators/dailyToWeekly');

describe('aggregateDailyToWeekly', () => {
  test('returns zero-filled report for empty entries array', () => {
    const result = aggregateDailyToWeekly([]);
    expect(result.qualifiedApproaches).toBe(0);
    expect(result.ffiConducted).toBe(0);
    expect(result.newBusiness.api).toBe(0);
    expect(result.aggregatedFromDaily).toBe(true);
    expect(result.version).toBe(2);
  });

  test('sums integer activity fields across multiple daily entries', () => {
    const entries = [
      { qualifiedApproaches: 3, ffiConducted: 1, ciConducted: 0 },
      { qualifiedApproaches: 2, ffiConducted: 2, ciConducted: 1 },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.qualifiedApproaches).toBe(5);
    expect(result.ffiConducted).toBe(3);
    expect(result.ciConducted).toBe(1);
  });

  test('sums nested newBusiness api correctly', () => {
    const entries = [
      { newBusiness: { apps: 2, api: 5000 } },
      { newBusiness: { apps: 1, api: 3000 } },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.newBusiness.apps).toBe(3);
    expect(result.newBusiness.api).toBe(8000);
  });

  test('computes lumpsum credit (10%) and commission (0.5%) from grossAmount', () => {
    const entries = [{ lumpsums: { grossAmount: 10000 } }];
    const result = aggregateDailyToWeekly(entries);
    expect(result.lumpsums.apiCredit).toBeCloseTo(1000);
    expect(result.lumpsums.commission).toBeCloseTo(50);
  });

  test('totalProductionCredit sums newBusiness api + ppp apiIncrease + lumpsums apiCredit', () => {
    const entries = [
      {
        newBusiness: { api: 5000 },
        pppIncreases: { apiIncrease: 1000 },
        lumpsums: { grossAmount: 10000 }, // apiCredit = 1000
      },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.totalProductionCredit).toBeCloseTo(7000);
  });

  test('handles null/undefined entries gracefully', () => {
    expect(() => aggregateDailyToWeekly(null)).not.toThrow();
    expect(() => aggregateDailyToWeekly(undefined)).not.toThrow();
    expect(aggregateDailyToWeekly(null).qualifiedApproaches).toBe(0);
  });

  test('totalCommission uses commissionRate / 100 applied to newBusiness.api + lumpsum commission', () => {
    const entries = [
      { newBusiness: { api: 10000 }, lumpsums: { grossAmount: 0 } },
    ];
    const result = aggregateDailyToWeekly(entries, 10); // 10% commission rate
    // nbApi * (10/100) + lumpsumCommission = 10000 * 0.1 + 0 = 1000
    expect(result.totalCommission).toBeCloseTo(1000);
  });

  // ── DCv2 Phase 5: emergent days-worked + weekend signals ────────────────────
  // MUST stay in sync with the ESM twin's cases (src/lib/schema/dailyActivity.test.js).
  // Week of Sun 2026-05-10 (opening Sunday) … Sat 2026-05-16.
  test('empty week → daysWorked 0, weekendWorked false, weekendApi 0', () => {
    const out = aggregateDailyToWeekly([], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  test('5 weekday-only days → daysWorked 5, weekendWorked false', () => {
    const days = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15']
      .map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(5);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  test('opening-Sunday-only week → weekendWorked true (TT-anchored)', () => {
    const out = aggregateDailyToWeekly([{ date: '2026-05-10', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  test('Saturday-only week → weekendWorked true', () => {
    const out = aggregateDailyToWeekly([{ date: '2026-05-16', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  test('full 7-day week → daysWorked 7, weekendWorked true', () => {
    const days = [
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
      '2026-05-14', '2026-05-15', '2026-05-16',
    ].map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(7);
    expect(out.weekendWorked).toBe(true);
  });

  test('two docs on the same date count once (distinct-date dedupe guard)', () => {
    const days = [
      { date: '2026-05-12', qualifiedApproaches: 1 },
      { date: '2026-05-12', qualifiedApproaches: 1 },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(1);
  });

  test('weekendApi sums NB.api + PPP.apiIncrease + LMPS credit from weekend entries only', () => {
    const days = [
      { date: '2026-05-16', newBusiness: { api: 5000 }, pppIncreases: { apiIncrease: 2000 }, lumpsums: { grossAmount: 10000 } },
      { date: '2026-05-15', newBusiness: { api: 3000 } },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.weekendApi).toBeCloseTo(8000, 6);
    expect(out.totalProductionCredit).toBeCloseTo(5000 + 3000 + 2000 + 1000, 6);
    expect(out.weekendWorked).toBe(true);
    expect(out.daysWorked).toBe(2);
  });

  test('entries without a date field contribute 0 distinct days and do not crash', () => {
    const out = aggregateDailyToWeekly([{ qualifiedApproaches: 5 }], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });
});

// ── M3 points-fix: coldCalls === dials parity (CJS twin) ─────────────────────
// MUST stay in sync with the ESM twin's M3 cases (src/lib/schema/dailyActivity.test.js).
// computePoints is ESM-only; point-value assertions live in the ESM test.
describe('aggregateDailyToWeekly CJS twin — M3 coldCalls parity', () => {
  test('coldCalls equals the summed dials total', () => {
    const out = aggregateDailyToWeekly([{ dials: 10 }, { dials: 15 }], 0);
    expect(out.dials).toBe(25);
    expect(out.coldCalls).toBe(25);
  });

  test('coldCalls equals dials when dials is 0 (safe zero)', () => {
    const out = aggregateDailyToWeekly([], 0);
    expect(out.coldCalls).toBe(0);
    expect(out.dials).toBe(0);
  });

  test('referralCalls / followUpCalls / seminarTradeshowCalls explicitly 0 — merge-safe', () => {
    const out = aggregateDailyToWeekly([{ dials: 5 }], 0);
    // Explicit zeros overwrite stale agent-entered values via { merge: true }
    expect(out.referralCalls).toBe(0);
    expect(out.followUpCalls).toBe(0);
    expect(out.seminarTradeshowCalls).toBe(0);
  });

  test('explicit zeros prevent double-count when prior doc had agent-entered call breakdown', () => {
    // Mirrors ESM twin test. computePoints is ESM-only; assert the shape is
    // merge-safe so the ESM point-value assertion is the authoritative proof.
    const out = aggregateDailyToWeekly([{ dials: 8 }], 0);
    expect(out.referralCalls).toBe(0);
    expect(out.followUpCalls).toBe(0);
    expect(out.seminarTradeshowCalls).toBe(0);
    expect(out.coldCalls).toBe(8);
  });
});
