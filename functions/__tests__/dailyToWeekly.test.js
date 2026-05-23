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
});
