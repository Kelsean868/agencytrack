import { describe, it, expect } from 'vitest';
import { productBalance, PRODUCT_BALANCE_EPSILON } from '../moneyNeedsAllocation';

const P = (...vals) => vals.map((commission) => ({ commission }));

describe('moneyNeedsAllocation — productBalance', () => {
  it('reads BALANCED when Σ products equals the line target', () => {
    const b = productBalance(P(20000, 15000), 35000);
    expect(b.sum).toBe(35000);
    expect(b.delta).toBe(0);
    expect(b.state).toBe('balanced');
  });

  it('stays BALANCED just inside the epsilon boundary', () => {
    const under = productBalance(P(35000 - (PRODUCT_BALANCE_EPSILON - 1)), 35000);
    expect(under.state).toBe('balanced');
    const over = productBalance(P(35000 + (PRODUCT_BALANCE_EPSILON - 1)), 35000);
    expect(over.state).toBe('balanced');
  });

  it('flips to UNDER at exactly the epsilon boundary', () => {
    const b = productBalance(P(35000 - PRODUCT_BALANCE_EPSILON), 35000);
    expect(b.delta).toBe(-PRODUCT_BALANCE_EPSILON);
    expect(b.state).toBe('under');
  });

  it('flips to OVER at exactly the epsilon boundary', () => {
    const b = productBalance(P(35000 + PRODUCT_BALANCE_EPSILON), 35000);
    expect(b.delta).toBe(PRODUCT_BALANCE_EPSILON);
    expect(b.state).toBe('over');
  });

  it('emits one width segment per product against the max denominator', () => {
    const b = productBalance(P(30000, 10000), 40000);
    expect(b.segments).toHaveLength(2);
    // denom = max(target 40000, sum 40000, 1) = 40000
    expect(b.segments[0].pct).toBeCloseTo(75);
    expect(b.segments[1].pct).toBeCloseTo(25);
  });

  it('handles an empty product list safely', () => {
    const b = productBalance([], 0);
    expect(b.sum).toBe(0);
    expect(b.state).toBe('balanced');
    expect(b.segments).toEqual([]);
  });
});
