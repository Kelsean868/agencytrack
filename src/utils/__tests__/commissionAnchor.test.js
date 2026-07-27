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
// today = 2026-06-05 (Thursday TT); maxWK = Sun May 31 04:00Z
// Trailing window: Apr 12 – May 31 (8 calendar weeks, zero-filled)
// elapsedTTYearWeeks = 23 (Dec 28 2025 wk → May 31 2026 wk, inclusive)

describe('runRate', () => {
  const today = new Date('2026-06-05T14:00:00Z'); // Thursday UTC = still Thursday TT

  function makeWeekPolicies(sundayDates, commission = 1000) {
    return sundayDates.map((d) => policy({ dateIssued: ts(d), earnedCommission: commission }));
  }

  it('span ≥ 8 calendar weeks → trailing arm (isLinear:false)', () => {
    // Jan 5 → week Jan 4; span ~21 weeks → trailing arm
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 1000 }),
      policy({ dateIssued: ts('2026-04-20'), earnedCommission: 2000 }), // week Apr 19, in window
      policy({ dateIssued: ts('2026-05-18'), earnedCommission: 3000 }), // week May 17, in window
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(3);
    expect(result.window).toBe('trailing-8wk');
    // Jan 4 wk outside trailing window (Apr 12–May 31) contributes 0; Apr 19 + May 17 = 5000
    expect(result.value).toBeCloseTo((5000 / 8) * 52);
  });

  it('span < 8 calendar weeks → linear arm (isLinear:true)', () => {
    // Apr 19 (Sunday) → week Apr 19; span = (May 31 – Apr 19) / 7 = 6 weeks < 8 → linear arm
    const policies = makeWeekPolicies(
      ['2026-04-19', '2026-04-26', '2026-05-03', '2026-05-10', '2026-05-17', '2026-05-24'],
      1000,
    );
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(6);
  });

  it('trailing arm: data outside 8-calendar-week window contributes 0', () => {
    // Jan span >> 8 → trailing; Jan data before Apr 12 window start is excluded
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 9000 }), // week Jan 4, outside window
      policy({ dateIssued: ts('2026-05-04'), earnedCommission: 2000 }), // week May 3, in window
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(2);
    expect(result.value).toBeCloseTo((2000 / 8) * 52);
    expect(result.value).not.toBeCloseTo(((9000 + 2000) / 8) * 52);
    expect(result.window).toBe('trailing-8wk');
  });

  it('groups multiple policies in the same calendar week (trailing arm)', () => {
    // Jan anchor sets span; two policies in week of May 3 get summed
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 500 }),  // sets span
      policy({ dateIssued: ts('2026-05-04'), earnedCommission: 2000 }), // Monday → week May 3
      policy({ dateIssued: ts('2026-05-05'), earnedCommission: 3000 }), // Tuesday → week May 3
      policy({ dateIssued: ts('2026-05-18'), earnedCommission: 4000 }), // Monday → week May 17
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.weekCount).toBe(3); // Jan 4, May 3 (grouped), May 17
    // trailing: Jan 4 (outside window) = 0; May 3 = 5000; May 17 = 4000 → total 9000
    expect(result.value).toBeCloseTo((9000 / 8) * 52);
  });

  it('returns zero with no-data marker when no settled policies', () => {
    const result = runRate([], today);
    expect(result.value).toBe(0);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(0);
    expect(result.window).toBe('no data');
  });

  it("excludes policies with future dateIssued (beyond today's week)", () => {
    // A policy in week of 2026-06-07 (next Sunday) should be excluded when today is 2026-06-05
    const futurePolicy = policy({ dateIssued: ts('2026-06-08'), earnedCommission: 9999 });
    const result = runRate([futurePolicy], today);
    expect(result.weekCount).toBe(0);
  });

  it('window chip uses "trailing-8wk" for span ≥ 8 calendar weeks', () => {
    // Jan/Feb data → span >> 8 → trailing arm → window = 'trailing-8wk'
    const sundays = [
      '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25',
      '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22',
    ];
    const result = runRate(makeWeekPolicies(sundays), today);
    expect(result.window).toBe('trailing-8wk');
  });

  it('window chip uses "based on N weeks" format for span < 8 weeks', () => {
    // Apr 13 (Monday) → week Apr 12; span = 7 weeks < 8 → linear arm; elapsedTTYearWeeks = 23
    const result = runRate([policy({ dateIssued: ts('2026-04-13') })], today);
    expect(result.window).toBe('based on 23 weeks');
  });

  // Dispatcher cases — corrected semantics: arm by SPAN, divisor by elapsed TT-year weeks

  it('1 settled week within 8-week span → linear-YTD arm: ytdEarned ÷ elapsedYearWeeks', () => {
    // Apr 13 → week Apr 12; span = 7 weeks < 8 → linear; elapsedTTYearWeeks = 23
    const result = runRate([policy({ dateIssued: ts('2026-04-13'), earnedCommission: 9450 })], today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(1);
    expect(result.value).toBeCloseTo((9450 / 23) * 52);
    expect(result.window).toBe('based on 23 weeks');
  });

  it('3 settled weeks within span < 8 → linear-YTD arm, divisor = elapsedYearWeeks (23), not weekCount (3)', () => {
    const policies = [
      policy({ dateIssued: ts('2026-04-13'), earnedCommission: 1000 }),
      policy({ dateIssued: ts('2026-04-20'), earnedCommission: 2000 }),
      policy({ dateIssued: ts('2026-04-27'), earnedCommission: 3000 }),
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(true);
    expect(result.weekCount).toBe(3);
    expect(result.value).toBeCloseTo(((1000 + 2000 + 3000) / 23) * 52);
    expect(result.value).not.toBeCloseTo(((1000 + 2000 + 3000) / 3) * 52);
  });

  it('span = 8 calendar weeks (boundary) → trailing arm; data outside window zero-contributed', () => {
    // Apr 6 (Monday) → week Apr 5 = maxWK − 8wk → span=8 → trailing arm
    // Apr 5 is NOT in trailing window (which starts Apr 12); Apr 20 → week Apr 19 IS in window
    const policies = [
      policy({ dateIssued: ts('2026-04-06'), earnedCommission: 5000 }), // week Apr 5, outside
      policy({ dateIssued: ts('2026-04-20'), earnedCommission: 2000 }), // week Apr 19, inside
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.window).toBe('trailing-8wk');
    expect(result.value).toBeCloseTo((2000 / 8) * 52);
    expect(result.value).not.toBeCloseTo(((5000 + 2000) / 8) * 52);
  });

  it('span > 8 weeks → trailing arm: Σ(trailing-8 calendar weeks) ÷ 8 × 52', () => {
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 1000 }), // outside window, sets span
      policy({ dateIssued: ts('2026-05-04'), earnedCommission: 3000 }), // week May 3, in window
      policy({ dateIssued: ts('2026-05-18'), earnedCommission: 4000 }), // week May 17, in window
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.value).toBeCloseTo((7000 / 8) * 52);
  });

  it('stale producer — all settlements > 8 calendar weeks ago → trailing arm, rate = 0', () => {
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 10000 }),
      policy({ dateIssued: ts('2026-02-02'), earnedCommission: 8000 }),
      policy({ dateIssued: ts('2026-03-02'), earnedCommission: 6000 }),
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.value).toBe(0);
    expect(result.window).toBe('trailing-8wk');
  });

  it('sparse window — data in 3 of 8 trailing calendar weeks → ÷8 (zero-filled), not ÷3', () => {
    const policies = [
      policy({ dateIssued: ts('2026-01-05'), earnedCommission: 999 }),   // old, sets span
      policy({ dateIssued: ts('2026-04-13'), earnedCommission: 1000 }),  // week Apr 12, i=7 in window
      policy({ dateIssued: ts('2026-05-11'), earnedCommission: 2000 }),  // week May 10, i=3 in window
      policy({ dateIssued: ts('2026-06-01'), earnedCommission: 3000 }),  // week May 31, i=0 in window
    ];
    const result = runRate(policies, today);
    expect(result.isLinear).toBe(false);
    expect(result.value).toBeCloseTo(((1000 + 2000 + 3000) / 8) * 52);
    expect(result.value).not.toBeCloseTo(((1000 + 2000 + 3000) / 3) * 52);
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
    // `decimal`, not `pct` — the stored E3 value is a decimal in [0, 1+].
    expect(result.decimal).toBe(0.92);
    expect(result.monthKey).toBe('2026-03');
  });

  it('handles single-entry history', () => {
    const result = latestPersistency([{ monthKey: '2026-05', persistency: 0.95 }]);
    expect(result.decimal).toBe(0.95);
    expect(result.monthKey).toBe('2026-05');
  });

  // Scale lock: the returned field is the raw decimal, never a pre-scaled
  // percentage. A future edit that multiplies here would double-convert at the
  // consumer (CommissionAnchorStrip does `* 100`), rendering 9500%.
  it('returns the DECIMAL, not a percentage', () => {
    const result = latestPersistency([{ monthKey: '2026-05', persistency: 0.95 }]);
    expect(result.decimal).toBeLessThanOrEqual(1.5);
    expect(result.decimal).not.toBe(95);
  });

  it('returns null when latest record has no persistency', () => {
    const history = [{ monthKey: '2026-04', persistency: null }];
    expect(latestPersistency(history)).toBeNull();
  });
});
