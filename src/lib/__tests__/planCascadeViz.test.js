import { describe, it, expect } from 'vitest';
import {
  allocationSegments, miniMonthBuckets, commitChecklist, commitReady,
} from '../planCascadeViz';

describe('planCascadeViz — allocationSegments', () => {
  const lines = {
    life:    { targetAPI: 60000, enabled: true },
    ah:      { targetAPI: 20000, enabled: true },
    general: { targetAPI: 20000, enabled: true },
  };

  it('splits the 3 lines and sums targetAPI to the total', () => {
    const { segments, total } = allocationSegments(lines);
    expect(total).toBe(100000);
    expect(segments.map((s) => s.key)).toEqual(['life', 'ah', 'general']);
    expect(segments.reduce((s, e) => s + e.targetAPI, 0)).toBe(total);
  });

  it('pct across segments sums to 100 (within epsilon)', () => {
    const { segments } = allocationSegments(lines);
    const sumPct = segments.reduce((s, e) => s + e.pct, 0);
    expect(sumPct).toBeCloseTo(100, 6);
    expect(segments.find((s) => s.key === 'life').pct).toBeCloseTo(60, 6);
  });

  it('drops disabled and zero-API lines (no zero-width segments)', () => {
    const { segments, total } = allocationSegments({
      life:    { targetAPI: 50000, enabled: true },
      ah:      { targetAPI: 0, enabled: true },
      general: { targetAPI: 30000, enabled: false },
    });
    expect(segments.map((s) => s.key)).toEqual(['life']);
    expect(total).toBe(50000);
  });

  it('returns empty when nothing is funded', () => {
    const { segments, total } = allocationSegments(null);
    expect(segments).toEqual([]);
    expect(total).toBe(0);
  });
});

describe('planCascadeViz — miniMonthBuckets', () => {
  it('always returns exactly 12 buckets', () => {
    expect(miniMonthBuckets([], [], 0)).toHaveLength(12);
    expect(miniMonthBuckets([1, 2, 3], [4], 5)).toHaveLength(12);
  });

  it('classifies past / current / future by currentMonthIndex', () => {
    const b = miniMonthBuckets(Array(12).fill(1000), Array(12).fill(500), 3);
    expect(b[0].kind).toBe('past');
    expect(b[2].kind).toBe('past');
    expect(b[3].kind).toBe('current');
    expect(b[4].kind).toBe('future');
  });

  it('past/current render actual, future renders target', () => {
    const targets = Array(12).fill(1000);
    const actuals = Array(12).fill(400);
    const b = miniMonthBuckets(targets, actuals, 5);
    expect(b[2].value).toBe(400); // past → actual
    expect(b[5].value).toBe(400); // current → actual
    expect(b[8].value).toBe(1000); // future → target
  });

  it('heightPct stays within [6, 100]', () => {
    const b = miniMonthBuckets([0, 100, 200], [0, 0, 0], 2);
    b.forEach((x) => {
      expect(x.heightPct).toBeGreaterThanOrEqual(6);
      expect(x.heightPct).toBeLessThanOrEqual(100);
    });
  });
});

describe('planCascadeViz — commitChecklist / commitReady', () => {
  it('derives three items from the step flags', () => {
    const items = commitChecklist({ moneyNeedsFilled: true, yearPlanFilled: false, monthlyPlanFilled: false });
    expect(items.map((i) => i.key)).toEqual(['moneyNeeds', 'yearPlan', 'monthly']);
    expect(items[0].done).toBe(true);
    expect(items[1].done).toBe(false);
  });

  it('commitReady is true only when every step is filled', () => {
    expect(commitReady({ moneyNeedsFilled: true, yearPlanFilled: true, monthlyPlanFilled: true })).toBe(true);
    expect(commitReady({ moneyNeedsFilled: true, yearPlanFilled: true, monthlyPlanFilled: false })).toBe(false);
    expect(commitReady({})).toBe(false);
  });
});
