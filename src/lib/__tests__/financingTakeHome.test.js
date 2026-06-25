import { describe, it, expect } from 'vitest';
import { computeTakeHome } from '../financingTakeHome';
import { DEFAULT_FINANCING_RULESET_2026 } from '../../config/financingRuleset/2026';

const RS = DEFAULT_FINANCING_RULESET_2026;

// ── Status-branch coverage ───────────────────────────────────────────────────

describe('computeTakeHome — status branch: on_financing (owing)', () => {
  it('$10,000 → tax 2,500 → net 7,500 → financing 3,750 → take-home 3,750', () => {
    const r = computeTakeHome(10000, 'on_financing');
    expect(r.gross).toBe(10000);
    expect(r.tax).toBeCloseTo(2500);
    expect(r.net).toBeCloseTo(7500);
    expect(r.financingPortion).toBeCloseTo(3750);
    expect(r.takeHome).toBeCloseTo(3750);
    expect(r.isOwing).toBe(true);
  });
});

describe('computeTakeHome — status branch: post_financing_repayment (owing)', () => {
  it('same deduction as on_financing — 6.2 garnish continues until cleared', () => {
    const r = computeTakeHome(10000, 'post_financing_repayment');
    expect(r.isOwing).toBe(true);
    expect(r.takeHome).toBeCloseTo(3750);
    expect(r.financingPortion).toBeCloseTo(3750);
  });
});

describe('computeTakeHome — status branch: not_on_financing (not owing)', () => {
  it('$10,000 → tax 2,500 → net 7,500 → financing 0 → take-home 7,500', () => {
    const r = computeTakeHome(10000, 'not_on_financing');
    expect(r.gross).toBe(10000);
    expect(r.tax).toBeCloseTo(2500);
    expect(r.net).toBeCloseTo(7500);
    expect(r.financingPortion).toBe(0);
    expect(r.takeHome).toBeCloseTo(7500);
    expect(r.isOwing).toBe(false);
  });
});

describe('computeTakeHome — status branch: cleared (not owing)', () => {
  it('no financing deduction; same as not_on_financing', () => {
    const r = computeTakeHome(10000, 'cleared');
    expect(r.isOwing).toBe(false);
    expect(r.financingPortion).toBe(0);
    expect(r.takeHome).toBeCloseTo(7500);
  });
});

// ── Tax-first sequence (the locked order §2.1 / A.1) ────────────────────────

describe('computeTakeHome — tax-first sequence', () => {
  it('50% applies to AFTER-TAX net, not gross', () => {
    const r = computeTakeHome(10000, 'on_financing');
    // tax-first: net = 7500; 50% of net = 3750 → take-home 3750
    // (NOT gross-first: 50% of gross = 5000 → after-tax 5000 → take-home 3750 would differ at other rates)
    expect(r.net).toBeCloseTo(7500);
    expect(r.financingPortion).toBeCloseTo(r.net * RS.financingPortionRate);
  });

  it('one-step equivalence: takeHome = gross × (1 - taxRate) × (1 - financingPortionRate)', () => {
    const r = computeTakeHome(10000, 'on_financing');
    const expected = 10000 * (1 - RS.taxRate) * (1 - RS.financingPortionRate);
    expect(r.takeHome).toBeCloseTo(expected);
    expect(r.takeHome).toBeCloseTo(3750); // 37.5% of gross
  });
});

// ── Boundary / zero ──────────────────────────────────────────────────────────

describe('computeTakeHome — boundary cases', () => {
  it('zero gross → all zeros', () => {
    const r = computeTakeHome(0, 'on_financing');
    expect(r.gross).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.net).toBe(0);
    expect(r.financingPortion).toBe(0);
    expect(r.takeHome).toBe(0);
  });

  it('negative gross floored to 0 (K3 already floors, belt-and-suspenders)', () => {
    const r = computeTakeHome(-500, 'on_financing');
    expect(r.gross).toBe(0);
    expect(r.takeHome).toBe(0);
  });

  it('undefined / NaN gross treated as 0', () => {
    expect(computeTakeHome(undefined, 'on_financing').gross).toBe(0);
    expect(computeTakeHome(NaN, 'on_financing').gross).toBe(0);
  });

  it('unknown financingStatus treated as not-owing', () => {
    const r = computeTakeHome(10000, 'reconciling');
    expect(r.isOwing).toBe(false);
    expect(r.financingPortion).toBe(0);
  });
});

// ── Custom ruleset ───────────────────────────────────────────────────────────

describe('computeTakeHome — custom ruleset', () => {
  it('custom taxRate + financingPortionRate flow through', () => {
    const customRS = { ...RS, taxRate: 0.30, financingPortionRate: 0.40 };
    const r = computeTakeHome(10000, 'on_financing', customRS);
    expect(r.tax).toBeCloseTo(3000);           // 30%
    expect(r.net).toBeCloseTo(7000);           // 10000 - 3000
    expect(r.financingPortion).toBeCloseTo(2800);  // 40% of 7000
    expect(r.takeHome).toBeCloseTo(4200);      // 7000 - 2800
  });

  it('explicit null ruleset falls back to default', () => {
    const r = computeTakeHome(10000, 'on_financing', null);
    expect(r.tax).toBeCloseTo(2500);
    expect(r.takeHome).toBeCloseTo(3750);
  });
});

// ── Percentage-of-gross assertions (mockup §4 table) ────────────────────────

describe('computeTakeHome — % of gross (mockup §4 table)', () => {
  it('owing path: take-home = 37.5% of gross', () => {
    const r = computeTakeHome(10000, 'on_financing');
    expect(r.takeHome / r.gross).toBeCloseTo(0.375);
  });

  it('cleared path: take-home = 75% of gross', () => {
    const r = computeTakeHome(10000, 'cleared');
    expect(r.takeHome / r.gross).toBeCloseTo(0.75);
  });
});
