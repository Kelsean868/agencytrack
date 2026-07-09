// Track K · K9 — Paydown-arc model tests (value-level).
//
// Locks the honest-math contract: balance series → geometry + straight-line
// projection endpoint; zero/negative rate → NO projection; surplus → no
// projection (already cleared); < 2 points → no rate; malformed rows dropped;
// never NaN. Falsifier (Rule 23): if a fabricated projection appears for a flat
// or surplus book, or a projection endpoint is non-zero, these fail.
import { describe, it, expect } from 'vitest';
import {
  buildBalanceSeries,
  computeAveragePaydownRate,
  projectToZero,
  computePaydownArcModel,
  addMonthsToKey,
  ARC_VIEW,
} from '../financingPaydownArc';

const row = (month, runningBalance) => ({ month, runningBalance });

describe('addMonthsToKey', () => {
  it('adds whole months across a year boundary', () => {
    expect(addMonthsToKey('2026_11', 3)).toBe('2027_02');
    expect(addMonthsToKey('2026_01', 0)).toBe('2026_01');
  });
  it('returns null on a malformed key', () => {
    expect(addMonthsToKey('nope', 1)).toBeNull();
  });
});

describe('buildBalanceSeries', () => {
  it('drops malformed rows, coerces numeric strings, and sorts ascending', () => {
    const series = buildBalanceSeries([
      row('2026_02', 1000),
      row('bad', 500),
      { month: '2026_01', runningBalance: '2000' }, // string → coerced
      { month: '2026_03', runningBalance: null },    // non-finite → dropped
    ]);
    expect(series).toEqual([
      { month: '2026_01', balance: 2000 },
      { month: '2026_02', balance: 1000 },
    ]);
  });
});

describe('computeAveragePaydownRate', () => {
  it('is the average monthly decline over the calendar span', () => {
    const series = buildBalanceSeries([row('2026_01', 6000), row('2026_02', 4000), row('2026_03', 2000)]);
    expect(computeAveragePaydownRate(series)).toBe(2000);
  });
  it('is null with fewer than 2 points', () => {
    expect(computeAveragePaydownRate(buildBalanceSeries([row('2026_01', 4000)]))).toBeNull();
  });
});

describe('projectToZero', () => {
  it('projects to an endpoint of exactly zero at the current rate', () => {
    const series = buildBalanceSeries([row('2026_01', 6000), row('2026_03', 2000)]);
    const rate = computeAveragePaydownRate(series); // (6000-2000)/2 = 2000
    const proj = projectToZero(series, rate);
    expect(proj.clearMonths).toBe(1);
    expect(proj.clearMonthKey).toBe('2026_04');
    expect(proj.projected[proj.projected.length - 1].balance).toBe(0);
  });
  it('returns null for a flat/growing balance (rate <= 0)', () => {
    const flat = buildBalanceSeries([row('2026_01', 5000), row('2026_02', 5000)]);
    expect(projectToZero(flat, computeAveragePaydownRate(flat))).toBeNull();
    const grow = buildBalanceSeries([row('2026_01', 3000), row('2026_02', 5000)]);
    expect(projectToZero(grow, computeAveragePaydownRate(grow))).toBeNull();
  });
  it('returns null when the balance is already cleared / in surplus', () => {
    const surplus = buildBalanceSeries([row('2026_01', 1000), row('2026_02', -500)]);
    expect(projectToZero(surplus, computeAveragePaydownRate(surplus))).toBeNull();
  });
});

describe('computePaydownArcModel', () => {
  it('maps a paydown series to geometry with a now-dot and a clear-dot on the baseline', () => {
    const model = computePaydownArcModel({
      ledger: [row('2026_01', 6000), row('2026_02', 4000), row('2026_03', 2000)],
    });
    expect(model.hasData).toBe(true);
    expect(model.rate).toBe(2000);
    expect(model.hasProjection).toBe(true);
    expect(model.projectedClearMonths).toBe(1);
    expect(model.projectedClearMonthKey).toBe('2026_04');
    expect(model.points.actual).toHaveLength(3);
    // first point at max balance → top; now-dot at the last actual point.
    expect(model.points.actual[0]).toEqual({ x: ARC_VIEW.xLeft, y: ARC_VIEW.yTop });
    expect(model.points.now).toEqual({ x: 367.33, y: 92 });
    // clear-dot sits at the far right on the zero baseline.
    expect(model.points.clear).toEqual({ x: ARC_VIEW.xRight, y: ARC_VIEW.yBase });
  });

  it('renders the arc WITHOUT a projection for a flat balance (zero rate) — never NaN', () => {
    const model = computePaydownArcModel({ ledger: [row('2026_01', 5000), row('2026_02', 5000)] });
    expect(model.hasData).toBe(true);
    expect(model.hasProjection).toBe(false);
    expect(model.projectedClearMonths).toBeNull();
    expect(model.points.projected).toEqual([]);
    expect(model.points.clear).toBeNull();
    // no NaN anywhere in the actual geometry
    model.points.actual.forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });

  it('flags surplus (latest balance < 0) with no projection', () => {
    const model = computePaydownArcModel({ ledger: [row('2026_01', 1000), row('2026_02', -500)] });
    expect(model.isSurplus).toBe(true);
    expect(model.nowBalance).toBe(-500);
    expect(model.hasProjection).toBe(false);
  });

  it('handles a single ledger point (no line, no projection, now-dot present)', () => {
    const model = computePaydownArcModel({ ledger: [row('2026_01', 4000)] });
    expect(model.hasData).toBe(true);
    expect(model.points.actual).toHaveLength(1);
    expect(model.hasProjection).toBe(false);
    expect(model.points.now).toEqual({ x: ARC_VIEW.xLeft, y: expect.any(Number) });
  });

  it('returns the empty model for no data', () => {
    const model = computePaydownArcModel({ ledger: [] });
    expect(model.hasData).toBe(false);
    expect(model.points.actual).toEqual([]);
    expect(model.nowBalance).toBeNull();
  });
});
