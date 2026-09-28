/**
 * persistencyRounding — the one rounding rule for an agent-facing persistency
 * percent (Kyron ruling, 28-09-2026): 2 decimals, half up, float-safe.
 */
import { describe, it, expect } from 'vitest';
import { roundPersistencyPct, formatPersistencyPct } from '../persistencyRounding';

describe('roundPersistencyPct / formatPersistencyPct', () => {
  it.each([
    [89.996, 90, '90.00%'],
    [89.994, 89.99, '89.99%'],
    [89.995, 90, '90.00%'],
    [1.005, 1.01, '1.01%'], // 1.005 × 100 = 100.49999…: needs the float guard
    [90, 90, '90.00%'],
    [86.645, 86.65, '86.65%'],
    [0, 0, '0.00%'],
    [100, 100, '100.00%'],
  ])('%f → %f → %s', (pct, rounded, shown) => {
    expect(roundPersistencyPct(pct)).toBe(rounded);
    expect(formatPersistencyPct(pct)).toBe(shown);
  });

  // Today's figure arrives as fraction × 100, which carries binary noise:
  // 0.89965 × 100 = 89.96499999999999. Without the guard these round DOWN.
  it.each([
    [0.89995, 90],
    [0.89965, 89.97],
    [0.89245, 89.25],
  ])('fraction %f × 100 → %f (float guard)', (fraction, rounded) => {
    expect(roundPersistencyPct(fraction * 100)).toBe(rounded);
  });

  it('unknown is unknown: null, NaN, strings → null / "—"', () => {
    for (const v of [null, undefined, NaN, Infinity, '89.99']) {
      expect(roundPersistencyPct(v)).toBeNull();
      expect(formatPersistencyPct(v)).toBe('—');
    }
  });
});
