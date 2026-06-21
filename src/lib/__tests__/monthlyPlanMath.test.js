import { describe, it, expect } from 'vitest';
import {
  seedEvenSplit,
  balanceDelta,
  autoDistributeRemainder,
  monthEditable,
  bucketActualsByMonth,
  monthlyPace,
  ytdDelta,
  recoveryPace,
  absorbShortfall,
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

describe('autoDistributeRemainder (fill empty months, preserve typed)', () => {
  it('all-empty: spreads the annual evenly across all 12, including current', () => {
    const targets = Array(12).fill(0);
    const result = autoDistributeRemainder(targets, 120000, 0);
    expect(result).toEqual(Array(12).fill(10000));
    const sum = result.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(120000);
  });

  it('some typed: remainder = annual − Σtyped, spread only across the zeros; typed untouched', () => {
    // Jan & Feb typed (30000 + 20000 = 50000); months 2–11 empty.
    // remainder = 120000 − 50000 = 70000 across 10 zeros = 7000 each.
    const targets = [30000, 20000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = autoDistributeRemainder(targets, 120000, 0);
    expect(result[0]).toBe(30000); // typed, preserved
    expect(result[1]).toBe(20000); // typed, preserved
    for (let i = 2; i < 12; i++) expect(result[i]).toBe(7000);
    expect(parseFloat(result.reduce((s, v) => s + v, 0).toFixed(2))).toBe(120000);
  });

  it('Σtyped ≥ annual: remainder ≤ 0 → zeros stay 0 (clamp; never negative)', () => {
    // Typed sum 130000 > annual 120000 → remainder negative → no change.
    const targets = [70000, 60000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = autoDistributeRemainder(targets, 120000, 0);
    expect(result[0]).toBe(70000);
    expect(result[1]).toBe(60000);
    for (let i = 2; i < 12; i++) expect(result[i]).toBe(0); // zeros stay 0
  });

  it('rounding: distributed portion reconciles to the remainder exactly (last empty absorbs)', () => {
    // annual 100000, all empty → remainder 100000 / 12 not evenly divisible.
    const result = autoDistributeRemainder(Array(12).fill(0), 100000, 0);
    expect(result.slice(0, 11).every((v) => v === 8333.33)).toBe(true);
    expect(result[11]).toBe(8333.37); // residue absorbed
    expect(parseFloat(result.reduce((s, v) => s + v, 0).toFixed(2))).toBe(100000);
  });

  it('current-month inclusion: the current month receives a share when it is at 0', () => {
    // currentMonthIndex = 5 (June). Past months 0–4 hold settled values (untouched);
    // June (5) is at 0 and must receive a share — the off-by-one fix.
    const targets = [5000, 5000, 5000, 5000, 5000, 0, 0, 0, 0, 0, 0, 0];
    const result = autoDistributeRemainder(targets, 95000, 5);
    // typedSum = 25000; remainder = 70000 across 7 zeros (indices 5–11) = 10000 each.
    for (let i = 0; i < 5; i++) expect(result[i]).toBe(5000); // past untouched
    expect(result[5]).toBe(10000); // current month included
    for (let i = 6; i < 12; i++) expect(result[i]).toBe(10000);
    expect(parseFloat(result.reduce((s, v) => s + v, 0).toFixed(2))).toBe(95000);
  });

  it('past months at 0 are not filled (only current + future are eligible)', () => {
    // currentMonthIndex = 3; months 0–2 at 0 are PAST → stay 0.
    const targets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = autoDistributeRemainder(targets, 90000, 3);
    for (let i = 0; i < 3; i++) expect(result[i]).toBe(0); // past zeros untouched
    // 9 eligible months (3–11) share 90000 = 10000 each.
    for (let i = 3; i < 12; i++) expect(result[i]).toBe(10000);
  });

  it('no empty months → returned unchanged', () => {
    const targets = seedEvenSplit(120000); // all 10000, none at 0
    expect(autoDistributeRemainder(targets, 120000, 3)).toEqual(targets);
  });

  it('small remainder over many empty months never goes negative (floor distribution)', () => {
    // 6 typed months (indices 6–11) sum to exactly 100000.00; the anchor leaves a
    // 4-cent remainder to spread across the 6 empty months (indices 0–5).
    // Math.round would give 0.01 each → 5 × 0.01 = 0.05 > 0.04 → last month −0.01.
    // Math.floor gives 0 to the leading empties and the full residue to the last.
    const targets = [0, 0, 0, 0, 0, 0, 16666.66, 16666.66, 16666.66, 16666.66, 16666.66, 16666.70];
    const result = autoDistributeRemainder(targets, 100000.04, 0);
    expect(result.every((v) => v >= 0)).toBe(true);            // no month negative
    for (let i = 0; i < 5; i++) expect(result[i]).toBe(0);     // leading empties stay 0
    expect(result[5]).toBeCloseTo(0.04, 2);                    // last empty absorbs the residue
    expect(parseFloat(result.reduce((s, v) => s + v, 0).toFixed(2))).toBe(100000.04);
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

  it('toFinishApps uses explicit avgPolicyAPI when provided', () => {
    const { toFinishApps } = monthlyPace(15000, 2026, 0, 0, '2026-01-16', 15000);
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

// ── recoveryPace ──────────────────────────────────────────────────────────────

describe('recoveryPace', () => {
  it('no completed months (January) → pacePerMonth === anchor/12', () => {
    const actuals = Array(12).fill(0);
    const result = recoveryPace(1200000, actuals, 0);
    expect(result.pacePerMonth).toBe(100000); // 1200000 / 12
    expect(result.isStretch).toBe(false);
  });

  it('behind on settled months → pace > original', () => {
    // 5 months completed with 300k actual vs 500k target; need to catch up
    const actuals = [50000, 50000, 50000, 50000, 50000, 0, 0, 0, 0, 0, 0, 0];
    const anchor = 1200000;
    const result = recoveryPace(anchor, actuals, 5);
    // settled = 250k; needed = 950k; remaining = 7 months
    // pace = 950k / 7 ≈ 135714.29
    expect(result.settledToDate).toBe(250000);
    expect(result.stillNeeded).toBe(950000);
    expect(result.remainingCount).toBe(7);
    expect(result.pacePerMonth).toBeGreaterThan(100000);
    expect(result.originalPerMonth).toBe(100000);
  });

  it('ahead on settled months → pace < original', () => {
    // 3 months completed with 350k actual vs 300k target
    const actuals = [120000, 120000, 120000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const anchor = 1200000;
    const result = recoveryPace(anchor, actuals, 3);
    // settled = 360k; needed = 840k; remaining = 9 months
    // pace = 840k / 9 ≈ 93333.33
    expect(result.settledToDate).toBe(360000);
    expect(result.pacePerMonth).toBeLessThan(100000);
  });

  it('currentMonthIndex === 11 → remainingCount === 1, pace === anchor − settled', () => {
    const actuals = [50000, 50000, 50000, 50000, 50000, 50000,
                     50000, 50000, 50000, 50000, 50000, 0];
    const anchor = 600000;
    const result = recoveryPace(anchor, actuals, 11);
    expect(result.remainingCount).toBe(1);
    expect(result.settledToDate).toBe(550000);
    expect(result.pacePerMonth).toBe(50000); // 600k - 550k
  });

  it('isStretch flips correctly at 1.5× threshold', () => {
    const originalPerMonth = 100000;
    const anchor = originalPerMonth * 12; // 1.2M
    const threshold = originalPerMonth * 1.5; // 150k

    // Just below threshold — not a stretch
    const actuals1 = Array(12).fill(0);
    actuals1[0] = anchor - (threshold * 11 - 1); // Just enough that pace < 150k
    const result1 = recoveryPace(anchor, actuals1, 1);
    if (result1.pacePerMonth < threshold) {
      expect(result1.isStretch).toBe(false);
    }

    // Well above threshold — is a stretch
    const actuals2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result2 = recoveryPace(anchor, actuals2, 0); // January → all 12 months remaining
    expect(result2.pacePerMonth).toBe(100000); // even split, not a stretch
    expect(result2.isStretch).toBe(false);
  });
});

// ── absorbShortfall ───────────────────────────────────────────────────────────

describe('absorbShortfall', () => {
  it('completed months re-based to actuals', () => {
    const targets = [90000, 100000, 110000, 100000, 100000, 100000,
                     100000, 100000, 100000, 100000, 100000, 100000];
    const actuals = [85000, 95000, 105000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = absorbShortfall(targets, 1200000, actuals, 3);
    expect(result[0]).toBe(85000);  // re-based to actual
    expect(result[1]).toBe(95000);  // re-based to actual
    expect(result[2]).toBe(105000); // re-based to actual
  });

  it('remaining months set to pacePerMonth', () => {
    const targets = [90000, 100000, 110000, 100000, 100000, 100000,
                     100000, 100000, 100000, 100000, 100000, 100000];
    const actuals = [85000, 95000, 105000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = absorbShortfall(targets, 1200000, actuals, 3);
    // settled = 285k; needed = 915k; remaining = 9 months
    // pace = 915k / 9 ≈ 101666.67
    const expectedPace = 101666.67;
    for (let i = 3; i < 11; i++) {
      expect(result[i]).toBeCloseTo(expectedPace, 1);
    }
  });

  it('sum of result === anchorAPI exactly (rounding invariant)', () => {
    const targets = [90000, 100000, 110000, 100000, 100000, 100000,
                     100000, 100000, 100000, 100000, 100000, 100000];
    const actuals = [85000, 95000, 105000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const anchor = 1200000;
    const result = absorbShortfall(targets, anchor, actuals, 3);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(anchor);
  });

  it('settled month with actual 0 re-bases to 0', () => {
    const targets = Array(12).fill(100000);
    const actuals = [0, 100000, 100000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = absorbShortfall(targets, 1200000, actuals, 3);
    expect(result[0]).toBe(0);
  });

  it('screenshot scenario: 5 completed @ 0, anchor ≈ 1.2M', () => {
    // Agent has 0 in first 5 months; needs to catch up in remaining 7 months
    const targets = Array(12).fill(100000);
    const actuals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const anchor = 1185714; // Typical annual
    const result = absorbShortfall(targets, anchor, actuals, 5);

    // First 5 months re-based to 0
    for (let i = 0; i < 5; i++) {
      expect(result[i]).toBe(0);
    }

    // Remaining 7 months (5-11) spread the full anchor
    const remainingSum = result.slice(5).reduce((s, v) => s + v, 0);
    expect(parseFloat(remainingSum.toFixed(2))).toBe(anchor);

    // Total should equal anchor
    const totalSum = result.reduce((s, v) => s + v, 0);
    expect(parseFloat(totalSum.toFixed(2))).toBe(anchor);
  });
});
