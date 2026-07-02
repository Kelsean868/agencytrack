// formatAdjustmentPct — signed financing-adjustment label (Track K roster + drawer).
//
// FIX 1 (FU financing-display-polish, from PR #769 Rule-21 backstop): a non-zero
// fraction whose magnitude ROUNDS to zero (|frac| < 0.005) must render the unsigned
// "0%", never a signed "−0%" / "+0%". The sign branches are keyed on the raw
// fraction, so without the rounded-zero guard a tiny positive frac renders "−0%".
import { describe, it, expect } from 'vitest';
import { formatAdjustmentPct } from '../formatters';

describe('formatAdjustmentPct', () => {
  it('renders a positive fraction (a cut) as −X%', () => {
    expect(formatAdjustmentPct(0.13)).toBe('−13%');
    expect(formatAdjustmentPct(0.14)).toBe('−14%');
  });

  it('renders a negative fraction (above the amount in effect) as +X%', () => {
    expect(formatAdjustmentPct(-0.13)).toBe('+13%');
  });

  it('renders exact zero as the unsigned 0%', () => {
    expect(formatAdjustmentPct(0)).toBe('0%');
  });

  it('renders — for null / undefined / NaN', () => {
    expect(formatAdjustmentPct(null)).toBe('—');
    expect(formatAdjustmentPct(undefined)).toBe('—');
    expect(formatAdjustmentPct(NaN)).toBe('—');
  });

  // THE -0% EDGE (reproduced first, per the kickoff brief Phase 0.1): an
  // adjustment that ROUNDS to zero must never display a signed zero.
  it('never renders a signed zero — a fraction that rounds to 0 displays "0%"', () => {
    expect(formatAdjustmentPct(0.004)).toBe('0%');   // was "−0%"
    expect(formatAdjustmentPct(-0.004)).toBe('0%');  // was "+0%"
    expect(formatAdjustmentPct(0.0049)).toBe('0%');
    expect(formatAdjustmentPct(-0)).toBe('0%');      // negative zero itself
  });

  it('still signs the smallest non-rounding magnitudes (0.005 rounds to 1%)', () => {
    expect(formatAdjustmentPct(0.005)).toBe('−1%');
    expect(formatAdjustmentPct(-0.005)).toBe('+1%');
  });
});
