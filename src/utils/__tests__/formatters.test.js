// formatAdjustmentPct — signed financing-adjustment label (Track K roster + drawer).
//
// FIX 1 (FU financing-display-polish, from PR #769 Rule-21 backstop): a non-zero
// fraction whose magnitude ROUNDS to zero (|frac| < 0.005) must render the unsigned
// "0%", never a signed "−0%" / "+0%". The sign branches are keyed on the raw
// fraction, so without the rounded-zero guard a tiny positive frac renders "−0%".
import { describe, it, expect } from 'vitest';
import { formatAdjustmentPct, formatPaceWeeks, formatPaceRate } from '../formatters';

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

  it('never renders NaN for a non-numeric string; numeric strings coerce (parseFloat idiom)', () => {
    expect(formatAdjustmentPct('abc')).toBe('—');
    expect(formatAdjustmentPct('')).toBe('—');
    expect(formatAdjustmentPct('0.14')).toBe('−14%');
    expect(formatAdjustmentPct('-0.14')).toBe('+14%');
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

// formatPaceWeeks / formatPaceRate — Awards pace narrative (§2.7).
describe('formatPaceWeeks', () => {
  it('formats a plural week count with the ~ prefix', () => {
    expect(formatPaceWeeks(2)).toBe('~2 wks');
    expect(formatPaceWeeks(5)).toBe('~5 wks');
  });

  it('formats singular "1" as "~1 wk" (no plural s)', () => {
    expect(formatPaceWeeks(1)).toBe('~1 wk');
  });

  it('caps display at "20+ wks" for anything past the cap', () => {
    expect(formatPaceWeeks(21)).toBe('20+ wks');
    expect(formatPaceWeeks(200)).toBe('20+ wks');
  });

  it('exactly at the cap (20) still renders the real number, not the cap label', () => {
    expect(formatPaceWeeks(20)).toBe('~20 wks');
  });

  it('returns null for null/zero/negative/non-finite — never NaN or Infinity text', () => {
    expect(formatPaceWeeks(null)).toBeNull();
    expect(formatPaceWeeks(undefined)).toBeNull();
    expect(formatPaceWeeks(0)).toBeNull();
    expect(formatPaceWeeks(-3)).toBeNull();
    expect(formatPaceWeeks(NaN)).toBeNull();
    expect(formatPaceWeeks(Infinity)).toBeNull();
  });
});

describe('formatPaceRate', () => {
  it('formats a TTD rate via formatCurrency + "/wk" suffix', () => {
    expect(formatPaceRate(22000, 'TTD')).toBe('TTD 22,000/wk');
  });

  it('formats a non-TTD cumulative unit as a rounded count + unit + "/wk"', () => {
    expect(formatPaceRate(2.4, 'apps')).toBe('2 apps/wk');
  });

  it('formats an empty/undefined unit as a bare rounded rate', () => {
    expect(formatPaceRate(5, '')).toBe('5/wk');
    expect(formatPaceRate(5, undefined)).toBe('5/wk');
  });

  it('returns null for zero/negative/non-finite — never NaN or Infinity text', () => {
    expect(formatPaceRate(0, 'TTD')).toBeNull();
    expect(formatPaceRate(-5, 'TTD')).toBeNull();
    expect(formatPaceRate(NaN, 'TTD')).toBeNull();
    expect(formatPaceRate(Infinity, 'TTD')).toBeNull();
  });
});
