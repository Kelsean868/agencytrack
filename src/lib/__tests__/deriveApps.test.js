import { describe, it, expect } from 'vitest';
import { deriveAnnualApps } from '../deriveApps';

describe('deriveAnnualApps', () => {
  it('divides annualAPI by avgPolicyAPI', () => {
    expect(deriveAnnualApps(120000, 12000)).toBeCloseTo(10, 4);
  });

  it('defaults to 12000 when avgPolicyAPI is not provided', () => {
    expect(deriveAnnualApps(12000)).toBeCloseTo(1, 4);
  });

  it('defaults to 12000 when avgPolicyAPI is undefined', () => {
    expect(deriveAnnualApps(24000, undefined)).toBeCloseTo(2, 4);
  });

  it('returns a non-rounded float (callers round as needed)', () => {
    expect(deriveAnnualApps(250000, 12000)).toBeCloseTo(20.8333, 3);
  });

  it('returns 0 for zero annualAPI', () => {
    expect(deriveAnnualApps(0, 12000)).toBe(0);
  });

  it('returns 0 when avgPolicyAPI is zero (divide-by-zero guard)', () => {
    expect(deriveAnnualApps(120000, 0)).toBe(0);
  });

  it('returns 0 when avgPolicyAPI is negative', () => {
    expect(deriveAnnualApps(120000, -1000)).toBe(0);
  });

  it('handles non-numeric annualAPI gracefully', () => {
    expect(deriveAnnualApps('bad', 12000)).toBe(0);
  });
});
