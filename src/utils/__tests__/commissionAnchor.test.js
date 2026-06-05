import { describe, it, expect } from 'vitest';
import { ytdEarned, runRate, gapToGoal, latestPersistency } from '../commissionAnchor';

// Helpers — dateIssued stored as T04:00:00Z (TT midnight per parseDateOnlyTT convention)
function ts(isoDate) {
  // Returns a Firestore-like Timestamp stub
  const d = new Date(`${isoDate}T04:00:00Z`);
  return { toDate: () => d };
}

function policy(overrides = {}) {
  return {
    status: 'settled',
    dateIssued: ts('2026-06-01'),
    earnedCommission: 5000,
    ...overrides,
  };
}

// --- ytdEarned ---

describe('ytdEarned', () => {
  it('sums earnedCommission for settled policies in the given TT year', () => {
    const policies = [
      policy({ dateIssued: ts('2026-01-15'), earnedCommission: 4000 }),
      policy({ dateIssued: ts('2026-11-30'), earnedCommission: 6000 }),
    ];
    expect(ytdEarned(policies, 2026)).toBe(10000);
  });

  it('excludes non-settled policies', () => {
    const policies = [
      policy({ status: 'submitted', earnedCommission: 9000 }),
      policy({ earnedCommission: 5000 }),
    ];
    expect(ytdEarned(policies, 2026)).toBe(5000);
  });

  it('excludes policies from other years', () => {
    const policies = [
      policy({ dateIssued: ts('2025-12-31'), earnedCommission: 3000 }),
      policy({ dateIssued: ts('2026-01-01'), earnedCommission: 7000 }),
    ];
    expect(ytdEarned(policies, 2026)).toBe(7000);
  });

  it('handles TT-year boundary — 2026-01-01 at T04:00Z is 2026, not 2025', () => {
    const p = policy({ dateIssued: ts('2026-01-01'), earnedCommission: 1234 });
    expect(ytdEarned([p], 2026)).toBe(1234);
    expect(ytdEarned([p], 2025)).toBe(0);
  });

  it('returns 0 for empty list', () => {
    expect(ytdEarned([], 2026)).toBe(0);
  });

  it('excludes policies with no dateIssued', () => {
    const p = policy({ dateIssued: null, earnedCommission: 5000 });
    expect(ytdEarned([p], 2026)).toBe(0);
  });
});

// --- runRate ---

describe('runRate', () => {
  const today = new Date('2026-06-05T14:00:00Z'); // Thursday UTC = still Thursday TT

  function makeWeekPolicies(sundayDates, commission = 1000) {
    return sundayDates.map((d) => policy({ dateIssued: ts(d), earnedCommission: commission }));
  }

  it('returns isLinear:false when exactly 8 distinct settled weeks present', () => {
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
    ];
    const policies = makeWeekPolicies(sundays, 1000);
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(8);
    expect(result.value).toBeCloseTo((8000 / 8) * 52);
  });

  it('returns isLinear:true when exactly 7 distinct settled weeks present (fallback trigger)', () => {
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15',
    ];
    const policies = makeWeekPolicies(sundays, 1000);
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(7);
  });

  it('> 8 settled weeks — uses fixed trailing-8 window (8 most recent; oldest excluded)', () => {
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
      '2026-03-01', '2026-03-08', '2026-03-15',
    ];
    const policies = makeWeekPolicies(sundays, 1000);
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(11);
    // trailing-8 sum: 8 most recent × 1000 = 8000 (Jan 04 + Jan 11 + Jan 18 excluded)
    expect(result.value).toBeCloseTo((8000 / 8) * 52);
    expect(result.window).toBe('trailing-8wk');
  });

  it('groups multiple policies in the same week correctly', () => {
    const policies = [
      policy({ dateIssued: ts('2026-03-16'), earnedCommission: 2000 }), // Monday in week of Mar 15
      policy({ dateIssued: ts('2026-03-17'), earnedCommission: 3000 }), // Tuesday same week
    ];
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
    ];
    const base = makeWeekPolicies(sundays, 1000);
    const result = runRate([...base, ...policies], today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(9);
    // trailing-8: week of Mar 15 (5000) + 7 most-recent base weeks (7000) = 12000; Jan 04 excluded
    expect(result.value).toBeCloseTo((12000 / 8) * 52);
  });

  it('returns zero with no-data marker when no settled policies', () => {
    const result = runRate([], today);
    expect(result.value).toBe(0);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(0);
    expect(result.window).toBe('no data');
  });

  it('excludes policies with future dateIssued (beyond today\'s week)', () => {
    // A policy in week of 2026-06-07 (next Sunday) should be excluded when today is 2026-06-05
    const futurePolicy = policy({ dateIssued: ts('2026-06-08'), earnedCommission: 9999 });
    const result = runRate([futurePolicy], today);
    expect(result.weekCount).toBe(0);
  });

  it('window chip uses "trailing-Nwk" format for >= 8 weeks', () => {
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
    ];
    const result = runRate(makeWeekPolicies(sundays), today);
    expect(result.window).toBe('trailing-8wk');
  });

  it('window chip uses "based on N weeks" format for < 8 weeks', () => {
    const result = runRate([policy({ dateIssued: ts('2026-03-01') })], today);
    expect(result.window).toBe('based on 1 weeks');
  });

  // Dispatcher cases — arm and divisor assertions
  it('1 settled week — linear-YTD fallback arm, divisor = 1', () => {
    const result = runRate([policy({ dateIssued: ts('2026-03-02'), earnedCommission: 9450 })], today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(1);
    expect(result.value).toBeCloseTo((9450 / 1) * 52);
    expect(result.window).toBe('based on 1 weeks');
  });

  it('3 settled weeks — linear-YTD fallback arm, divisor = 3', () => {
    const policies = [
      policy({ dateIssued: ts('2026-01-04'), earnedCommission: 1000 }),
      policy({ dateIssued: ts('2026-01-11'), earnedCommission: 2000 }),
      policy({ dateIssued: ts('2026-01-18'), earnedCommission: 3000 }),
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(3);
    expect(result.value).toBeCloseTo(((1000 + 2000 + 3000) / 3) * 52);
  });

  it('exactly 8 settled weeks — trailing-8 arm, divisor = 8, window = "trailing-8wk"', () => {
    const commissions = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
    ];
    const policies = sundays.map((d, i) => policy({ dateIssued: ts(d), earnedCommission: commissions[i] }));
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(8);
    expect(result.value).toBeCloseTo((commissions.reduce((s, v) => s + v, 0) / 8) * 52);
    expect(result.window).toBe('trailing-8wk');
  });

  it('9+ settled weeks — trailing-8 arm excludes oldest week (sum uses 8 most recent only)', () => {
    const oldest  = '2026-01-04'; // will be excluded from trailing-8 sum
    const recent8 = [
      '2026-01-11', '2026-01-18', '2026-01-25', '2026-02-01',
      '2026-02-08', '2026-02-15', '2026-02-22', '2026-03-01',
    ];
    const policies = [
      policy({ dateIssued: ts(oldest), earnedCommission: 10000 }), // large value — exclusion is detectable
      ...recent8.map((d) => policy({ dateIssued: ts(d), earnedCommission: 1000 })),
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(9);
    // trailing-8 = 8 recent × 1000 = 8000 (oldest 10000 excluded)
    expect(result.value).toBeCloseTo((8000 / 8) * 52); // 52000
    // if oldest were included: (18000/9)*52 = 104000 — confirms exclusion
    expect(result.value).not.toBeCloseTo((18000 / 9) * 52);
  });
});

// --- gapToGoal ---

describe('gapToGoal', () => {
  const ratios = { modeMix: { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 }, commissionRate: 35 };

  it('converts API to commission and returns gap vs run-rate', () => {
    // API 857142.86 × 35% × 1.0 = TTD 300K goal
    const committedAPI = 300000 / 0.35;
    const result = gapToGoal(committedAPI, 245000, ratios);
    expect(result).not.toBeNull();
    expect(result.goalAsCommission).toBeCloseTo(300000, 0);
    expect(result.gap).toBeCloseTo(245000 - 300000, 0); // negative = behind
  });

  it('returns null when committedAnnualAPI is null', () => {
    expect(gapToGoal(null, 200000, ratios)).toBeNull();
  });

  it('returns null when committedAnnualAPI is 0', () => {
    expect(gapToGoal(0, 200000, ratios)).toBeNull();
  });

  it('uses default mode mix (all-annual) when ratios.modeMix not provided', () => {
    const result = gapToGoal(100000, 0, { commissionRate: 40 });
    expect(result.goalAsCommission).toBeCloseTo(40000);
  });

  it('uses default commissionRate 35 when ratios not provided', () => {
    const result = gapToGoal(100000, 0, null);
    expect(result.goalAsCommission).toBeCloseTo(35000);
  });

  it('returns positive gap when run-rate exceeds goal (on track)', () => {
    const result = gapToGoal(100000, 45000, { commissionRate: 35, modeMix: { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 } });
    // goal = 35000; runRate = 45000; gap = +10000
    expect(result.gap).toBeCloseTo(10000);
  });

  it('uses mixed modeMix correctly via characterized engine values', () => {
    // commissionThisMonth({ totalApi: 100000, modeMix: { annual:0.5, semiAnnual:0.5 }, commissionRate: 40 })
    // = 100000 × 0.40 × (0.5 × 1.0 + 0.5 × 0.5) = 100000 × 0.40 × 0.75 = 30000
    const result = gapToGoal(100000, 0, {
      modeMix: { annual: 0.5, semiAnnual: 0.5, quarterly: 0, monthly: 0 },
      commissionRate: 40,
    });
    expect(result.goalAsCommission).toBeCloseTo(30000);
  });
});

// --- latestPersistency ---

describe('latestPersistency', () => {
  it('returns null for empty history', () => {
    expect(latestPersistency([])).toBeNull();
    expect(latestPersistency(null)).toBeNull();
  });

  it('returns the most recent month entry', () => {
    const history = [
      { monthKey: '2026-01', persistency: 0.88 },
      { monthKey: '2026-03', persistency: 0.92 },
      { monthKey: '2026-02', persistency: 0.85 },
    ];
    const result = latestPersistency(history);
    expect(result.pct).toBe(0.92);
    expect(result.monthKey).toBe('2026-03');
  });

  it('handles single-entry history', () => {
    const result = latestPersistency([{ monthKey: '2026-05', persistency: 0.95 }]);
    expect(result.pct).toBe(0.95);
    expect(result.monthKey).toBe('2026-05');
  });

  it('returns null when latest record has no persistency', () => {
    const history = [{ monthKey: '2026-04', persistency: null }];
    expect(latestPersistency(history)).toBeNull();
  });
});
