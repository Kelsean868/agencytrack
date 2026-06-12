import { describe, it, expect } from 'vitest';
import {
  seedEvenSplit,
  balanceDelta,
  autoDistributeRemainder,
  monthEditable,
  bucketActualsByMonth,
  monthlyPace,
  ytdDelta,
} from '../monthlyPlanMath';

// ── seedEvenSplit ─────────────────────────────────────────────────────────────

describe('seedEvenSplit', () => {
  it('returns an array of exactly 12 numbers', () => {
    expect(seedEvenSplit(120000)).toHaveLength(12);
  });

  it('sums to anchorAPI exactly (last-month rounding absorption)', () => {
    const targets = seedEvenSplit(100000);
    const sum = targets.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(100000);
  });

  it('last month absorbs the rounding remainder', () => {
    const anchor = 100000;
    const targets = seedEvenSplit(anchor);
    const perMonth = targets[0];
    const lastMonth = targets[11];
    const sumFirst11 = targets.slice(0, 11).reduce((s, v) => s + v, 0);
    expect(parseFloat((sumFirst11 + lastMonth).toFixed(2))).toBe(anchor);
    // last month differs from perMonth by at most a rounding cent
    expect(Math.abs(lastMonth - perMonth)).toBeLessThan(1);
  });

  it('returns 12 zeros for anchorAPI = 0', () => {
    expect(seedEvenSplit(0)).toEqual(Array(12).fill(0));
  });

  it('handles a value that divides evenly (120000 / 12 = 10000)', () => {
    const targets = seedEvenSplit(120000);
    expect(targets.every((v) => v === 10000)).toBe(true);
  });
});

// ── balanceDelta ──────────────────────────────────────────────────────────────

describe('balanceDelta', () => {
  it('returns 0 when targets sum to anchorAPI exactly', () => {
    const targets = seedEvenSplit(120000);
    expect(balanceDelta(targets, 120000)).toBe(0);
  });

  it('returns positive delta when over-allocated', () => {
    const targets = [10000, 10000, 10000, 10000, 10000, 10000,
                     10000, 10000, 10000, 10000, 10000, 11000]; // 121000 vs 120000
    expect(balanceDelta(targets, 120000)).toBe(1000);
  });

  it('returns negative delta when under-allocated', () => {
    const targets = [9000, 10000, 10000, 10000, 10000, 10000,
                     10000, 10000, 10000, 10000, 10000, 10000]; // 119000 vs 120000
    expect(balanceDelta(targets, 120000)).toBe(-1000);
  });
});

// ── autoDistributeRemainder ───────────────────────────────────────────────────

describe('autoDistributeRemainder', () => {
  it('rebalances to Σ === anchorAPI after a custom edit', () => {
    // Month 0 increased; remainder redistributed across months 1–11
    const targets = [15000, 10000, 10000, 10000, 10000, 10000,
                     10000, 10000, 10000, 10000, 10000, 10000]; // over by 5000
    const result = autoDistributeRemainder(targets, 120000, 0);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(120000);
  });

  it('does not touch past + current months (only future indices > currentMonthIndex)', () => {
    const targets = [15000, 10000, 10000, 10000, 10000, 10000,
                     10000, 10000, 10000, 10000, 10000, 10000];
    const result = autoDistributeRemainder(targets, 120000, 0);
    expect(result[0]).toBe(15000); // current month (0) untouched
  });

  it('returns targets unchanged when delta is already 0', () => {
    const targets = seedEvenSplit(120000);
    const result = autoDistributeRemainder(targets, 120000, 3);
    expect(result).toEqual(targets);
  });

  it('returns targets unchanged when there are no future months', () => {
    const targets = seedEvenSplit(120000);
    const result = autoDistributeRemainder(targets, 120000, 11);
    expect(result).toEqual(targets);
  });

  it('last future month absorbs rounding so sum is exact', () => {
    // anchorAPI not evenly divisible — triggers rounding
    const targets = [5000, 5000, 5000, 5000, 5000, 5000,
                     5000, 5000, 5000, 5000, 5000, 6001]; // over by 1
    const anchor = 60000;
    const result = autoDistributeRemainder(targets, anchor, 5);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(anchor);
  });
});

// ── monthEditable ─────────────────────────────────────────────────────────────

describe('monthEditable', () => {
  it('past months (< currentMonthIndex) are locked', () => {
    expect(monthEditable(0, 3)).toBe(false);
    expect(monthEditable(2, 3)).toBe(false);
  });

  it('current month is editable', () => {
    expect(monthEditable(3, 3)).toBe(true);
  });

  it('future months are editable', () => {
    expect(monthEditable(4, 3)).toBe(true);
    expect(monthEditable(11, 3)).toBe(true);
  });

  it('all months editable when currentMonthIndex is 0', () => {
    for (let i = 0; i < 12; i++) {
      expect(monthEditable(i, 0)).toBe(true);
    }
  });
});

// ── bucketActualsByMonth ──────────────────────────────────────────────────────

describe('bucketActualsByMonth', () => {
  it('returns an array of 12 zeros for empty submissions', () => {
    expect(bucketActualsByMonth([], 2026)).toEqual(Array(12).fill(0));
  });

  it('buckets a submission into the correct month by its weekStarting Sunday', () => {
    const subs = [
      { weekStarting: '2026-03-01', totalProductionCredit: 50000 }, // March Sunday
      { weekStarting: '2026-07-05', totalProductionCredit: 30000 }, // July Sunday
    ];
    const result = bucketActualsByMonth(subs, 2026);
    expect(result[2]).toBe(50000);  // March = index 2
    expect(result[6]).toBe(30000);  // July = index 6
  });

  it('sums multiple submissions in the same month', () => {
    const subs = [
      { weekStarting: '2026-01-04', totalProductionCredit: 20000 },
      { weekStarting: '2026-01-11', totalProductionCredit: 30000 },
    ];
    const result = bucketActualsByMonth(subs, 2026);
    expect(result[0]).toBe(50000); // January = index 0
  });

  it('assigns month-boundary week by its Sunday (weekStarting month)', () => {
    // Sunday Jan 26 starts a week that runs Jan 26–Feb 1 — assigned to January
    const subs = [{ weekStarting: '2026-01-25', totalProductionCredit: 40000 }];
    const result = bucketActualsByMonth(subs, 2026);
    expect(result[0]).toBe(40000); // January
    expect(result[1]).toBe(0);     // February gets nothing
  });

  it('ignores submissions outside the given year', () => {
    const subs = [{ weekStarting: '2025-06-01', totalProductionCredit: 99999 }];
    const result = bucketActualsByMonth(subs, 2026);
    expect(result.every((v) => v === 0)).toBe(true);
  });

  it('skips submissions with missing weekStarting', () => {
    const subs = [{ totalProductionCredit: 50000 }];
    expect(bucketActualsByMonth(subs, 2026)).toEqual(Array(12).fill(0));
  });
});

// ── monthlyPace ───────────────────────────────────────────────────────────────

describe('monthlyPace', () => {
  it('expectedToDate is proportional to elapsed calendar days', () => {
    // January 2026 has 31 days; today is Jan 16 (day 16)
    const { expectedToDate } = monthlyPace(31000, 2026, 0, 0, '2026-01-16');
    // 31000 × 16 ÷ 31 = 16000
    expect(expectedToDate).toBe(16000);
  });

  it('state is "ahead" when actual >= expectedToDate and actual >= target', () => {
    const { state } = monthlyPace(31000, 2026, 0, 31000, '2026-01-16');
    expect(state).toBe('ahead');
  });

  it('state is "on-track" when actual exceeds pace but is still under target', () => {
    // expected = 16000; actual = 20000 — ahead of pace but < target(31000) → on-track
    const { state } = monthlyPace(31000, 2026, 0, 20000, '2026-01-16');
    expect(state).toBe('on-track');
  });

  it('state is "on-track" when actual >= 90% of expectedToDate', () => {
    // expected = 16000; 90% = 14400; actual = 15000
    const { state } = monthlyPace(31000, 2026, 0, 15000, '2026-01-16');
    expect(state).toBe('on-track');
  });

  it('state is "behind" when actual < 90% of expectedToDate', () => {
    // expected = 16000; 90% = 14400; actual = 10000
    const { state } = monthlyPace(31000, 2026, 0, 10000, '2026-01-16');
    expect(state).toBe('behind');
  });

  it('state is "on-track" for a future month (no time elapsed)', () => {
    const { state, expectedToDate } = monthlyPace(30000, 2026, 11, 0, '2026-01-16');
    expect(expectedToDate).toBe(0);
    expect(state).toBe('on-track');
  });

  it('elapsed = daysInMonth for a past month (all days elapsed)', () => {
    // February 2026 has 28 days; today is March 1
    const { expectedToDate } = monthlyPace(28000, 2026, 1, 0, '2026-03-01');
    expect(expectedToDate).toBe(28000); // 28000 × 28 ÷ 28 = 28000
  });

  it('toFinishAPI = max(0, target − actual)', () => {
    const { toFinishAPI } = monthlyPace(30000, 2026, 0, 10000, '2026-01-16');
    expect(toFinishAPI).toBe(20000);
  });

  it('toFinishAPI is 0 when actual >= target', () => {
    const { toFinishAPI } = monthlyPace(30000, 2026, 0, 35000, '2026-01-16');
    expect(toFinishAPI).toBe(0);
  });

  it('toFinishApps = toFinishAPI ÷ avgPolicyAPI (12000)', () => {
    const { toFinishApps } = monthlyPace(12000, 2026, 0, 0, '2026-01-16');
    expect(toFinishApps).toBeCloseTo(1, 2);
  });
});

// ── ytdDelta ──────────────────────────────────────────────────────────────────

describe('ytdDelta', () => {
  it('sums actual − target over completed months only', () => {
    const actuals  = [11000, 9000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const targets  = [10000, 10000, 10000, 10000, 10000, 10000,
                      10000, 10000, 10000, 10000, 10000, 10000];
    // currentMonthIndex = 3 → completed = 0,1,2
    // delta = (11000-10000) + (9000-10000) + (10000-10000) = 1000 - 1000 + 0 = 0
    expect(ytdDelta(actuals, targets, 3)).toBe(0);
  });

  it('returns positive when ahead YTD', () => {
    const actuals = [12000, 11000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const targets = [10000, 10000, 10000, 10000, 10000, 10000,
                     10000, 10000, 10000, 10000, 10000, 10000];
    // completed months 0,1 → (12000-10000) + (11000-10000) = 3000
    expect(ytdDelta(actuals, targets, 2)).toBe(3000);
  });

  it('returns 0 when currentMonthIndex is 0 (no completed months yet)', () => {
    const actuals = Array(12).fill(10000);
    const targets = Array(12).fill(10000);
    expect(ytdDelta(actuals, targets, 0)).toBe(0);
  });

  it('ignores the current and future months', () => {
    const actuals = [5000, 5000, 99999, 99999]; // months 2+ should be ignored
    const targets = [10000, 10000, 10000, 10000];
    // currentMonthIndex = 2 → only indices 0,1 counted
    expect(ytdDelta(actuals, targets, 2)).toBe(-10000);
  });
});
