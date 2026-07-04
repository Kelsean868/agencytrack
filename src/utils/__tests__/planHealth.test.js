// PR-B2 — plan-health pure-function tests. Rule 23: the fixture set MUST
// include a FAILING floor case — a checklist that cannot show a red check is
// decoration.
import { describe, it, expect } from 'vitest';
import {
  planTotalAPI, planTotalCommission,
  checkAboveFloor, checkLineMix, checkNotOverCommitted,
} from '../planHealth';

// Fixture A — above-floor, multi-line, covers budget (all green).
const LINES_ABOVE = {
  life:    { targetAPI: 180000, pct: 60, derivedCommission: 63000, enabled: true },
  ah:      { targetAPI: 60000,  pct: 20, derivedCommission: 15000, enabled: true },
  general: { targetAPI: 60000,  pct: 20, derivedCommission: 6000,  enabled: true },
};

// Fixture B — BELOW-floor, single-line (Rule 23 red checks).
const LINES_BELOW = {
  life:    { targetAPI: 90000, pct: 100, derivedCommission: 31500, enabled: true },
  ah:      { targetAPI: 0,     pct: 0,   derivedCommission: 0,     enabled: true },
  general: { targetAPI: 0,     pct: 0,   derivedCommission: 0,     enabled: false },
};

describe('planHealth — totals', () => {
  it('planTotalAPI sums the three known lines', () => {
    expect(planTotalAPI(LINES_ABOVE)).toBe(300000);
  });

  it('planTotalCommission sums derivedCommission', () => {
    expect(planTotalCommission(LINES_ABOVE)).toBe(84000);
  });

  it('missing lines and non-numeric fields count 0 (parseFloat-guarded)', () => {
    expect(planTotalAPI({ life: { targetAPI: 'abc' } })).toBe(0);
    expect(planTotalAPI(null)).toBe(0);
    expect(planTotalCommission(undefined)).toBe(0);
  });
});

describe('planHealth — check 1: above company floor', () => {
  it('passes when plan API meets the tenure floor', () => {
    const r = checkAboveFloor(LINES_ABOVE, 200000);
    expect(r).toEqual({ ok: true, planAPI: 300000, floor: 200000 });
  });

  it('FAILS when plan API is below the floor (Rule 23 red check)', () => {
    const r = checkAboveFloor(LINES_BELOW, 150000);
    expect(r.ok).toBe(false);
    expect(r.planAPI).toBe(90000);
    expect(r.floor).toBe(150000);
  });

  it('a zero-target plan never passes, even against a zero floor', () => {
    expect(checkAboveFloor({}, 0).ok).toBe(false);
  });
});

describe('planHealth — check 2: line mix', () => {
  it('passes with 2+ active lines carrying API', () => {
    const r = checkLineMix(LINES_ABOVE);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(300000);
    expect(r.mix).toHaveLength(3);
  });

  it('flags single-line concentration', () => {
    const r = checkLineMix(LINES_BELOW);
    expect(r.ok).toBe(false);
    expect(r.note).toBe('single line');
  });

  it('flags a plan with no targets at all', () => {
    const r = checkLineMix({});
    expect(r.ok).toBe(false);
    expect(r.note).toBe('no targets');
  });
});

describe('planHealth — check 3: not over-committed (commission-to-commission)', () => {
  it('passes when plan-derived commission covers the budget requirement', () => {
    const r = checkNotOverCommitted(LINES_ABOVE, 80000);
    expect(r).toEqual({ ok: true, planCommission: 84000, required: 80000 });
  });

  it('FAILS when the budget requires more commission than the plan produces', () => {
    const r = checkNotOverCommitted(LINES_BELOW, 60000);
    expect(r.ok).toBe(false);
    expect(r.planCommission).toBe(31500);
    expect(r.required).toBe(60000);
  });

  it('compares commission-to-commission, never API-vs-income: a plan with big API but no derivedCommission fails a real requirement', () => {
    const apiOnly = { life: { targetAPI: 500000, derivedCommission: 0, enabled: true } };
    expect(checkNotOverCommitted(apiOnly, 1).ok).toBe(false);
  });
});
