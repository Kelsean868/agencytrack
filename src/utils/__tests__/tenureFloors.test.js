import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TENURE_API_FLOORS,
  FLAT_ANNUAL_API_FALLBACK,
  FLAT_WEEKLY_API_FALLBACK,
  monthsOfService,
  resolveAnnualAPIFloor,
  resolveWeeklyAPIFloor,
} from '../tenureFloors';

// Anchor "now" so the tests are deterministic regardless of when run.
const NOW = new Date('2026-05-20T12:00:00Z');

describe('monthsOfService', () => {
  it('returns null for missing input', () => {
    expect(monthsOfService(undefined, NOW)).toBeNull();
    expect(monthsOfService(null, NOW)).toBeNull();
    expect(monthsOfService('', NOW)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(monthsOfService('not-a-date', NOW)).toBeNull();
    expect(monthsOfService('2026/05/20', NOW)).toBeNull();
    expect(monthsOfService('26-05-20', NOW)).toBeNull();
  });

  it('counts whole months, decrementing if day-of-month hasn\'t arrived', () => {
    expect(monthsOfService('2025-05-20', NOW)).toBe(12);  // exact anniversary
    expect(monthsOfService('2025-05-21', NOW)).toBe(11);  // one day shy
    expect(monthsOfService('2025-04-20', NOW)).toBe(13);
  });

  it('clamps negative diffs to 0', () => {
    expect(monthsOfService('2027-01-01', NOW)).toBe(0);
  });

  it('returns 0 same-month same-year', () => {
    expect(monthsOfService('2026-05-20', NOW)).toBe(0);
  });
});

describe('resolveAnnualAPIFloor — band boundaries', () => {
  // Reusable: build a contractStartDate that lands an agent at exactly `months`.
  // We construct by subtracting `months` from NOW's anchor and biasing day by 0
  // so the resulting (start, NOW) pair yields `months` exactly from the helper.
  const startForMonths = (m) => {
    let year = 2026;
    let month = 5 - m;
    while (month <= 0) { month += 12; year -= 1; }
    return `${year}-${String(month).padStart(2, '0')}-20`;
  };

  it('band 0–11 → 150,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(0),  now: NOW })).toBe(150000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(6),  now: NOW })).toBe(150000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(11), now: NOW })).toBe(150000);
  });

  it('boundary: 12 months exact → 200,000 (not 150k)', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(12), now: NOW })).toBe(200000);
  });

  it('band 12–24 → 200,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(18), now: NOW })).toBe(200000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(24), now: NOW })).toBe(200000);
  });

  it('boundary: 25 months → 250,000 (not 200k)', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(25), now: NOW })).toBe(250000);
  });

  it('band 25–36 → 250,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(30), now: NOW })).toBe(250000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(36), now: NOW })).toBe(250000);
  });

  it('boundary: 37 months → 300,000 (not 250k)', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(37), now: NOW })).toBe(300000);
  });

  it('band 37–48 → 300,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(42), now: NOW })).toBe(300000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(48), now: NOW })).toBe(300000);
  });

  it('boundary: 49 months → 400,000 (not 300k)', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(49), now: NOW })).toBe(400000);
  });

  it('band 49–60 → 400,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(54), now: NOW })).toBe(400000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(60), now: NOW })).toBe(400000);
  });

  it('boundary: 61 months → 500,000 (not 400k)', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(61), now: NOW })).toBe(500000);
  });

  it('band > 60 → 500,000', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(72), now: NOW })).toBe(500000);
    expect(resolveAnnualAPIFloor({ contractStartDate: startForMonths(120), now: NOW })).toBe(500000);
  });

  it('missing contractStartDate → flat 200,000 fallback', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: undefined, now: NOW })).toBe(FLAT_ANNUAL_API_FALLBACK);
    expect(resolveAnnualAPIFloor({ contractStartDate: '',        now: NOW })).toBe(FLAT_ANNUAL_API_FALLBACK);
    expect(resolveAnnualAPIFloor({ contractStartDate: 'garbage', now: NOW })).toBe(FLAT_ANNUAL_API_FALLBACK);
  });

  it('honors a custom fallback when provided', () => {
    expect(resolveAnnualAPIFloor({ contractStartDate: undefined, fallback: 999, now: NOW })).toBe(999);
  });

  it('honors a partial tenureApiFloors override (shallow-merged with defaults)', () => {
    const t = { band0_lt12: 175000 };
    expect(resolveAnnualAPIFloor({ contractStartDate: '2026-01-01', tenureApiFloors: t, now: NOW })).toBe(175000);
    // Unrelated bands keep their defaults.
    expect(resolveAnnualAPIFloor({ contractStartDate: '2020-01-01', tenureApiFloors: t, now: NOW })).toBe(500000);
  });
});

describe('resolveWeeklyAPIFloor — annual ÷ 10 ÷ 4', () => {
  it('< 12-month agent: 150,000 / 10 / 4 = 3,750', () => {
    expect(resolveWeeklyAPIFloor({ contractStartDate: '2026-01-01', now: NOW })).toBe(3750);
  });

  it('exactly-12-month agent: 200,000 / 10 / 4 = 5,000', () => {
    expect(resolveWeeklyAPIFloor({ contractStartDate: '2025-05-20', now: NOW })).toBe(5000);
  });

  it('> 60-month agent: 500,000 / 10 / 4 = 12,500', () => {
    expect(resolveWeeklyAPIFloor({ contractStartDate: '2020-01-01', now: NOW })).toBe(12500);
  });

  it('missing contractStartDate → flat 4,800 fallback', () => {
    expect(resolveWeeklyAPIFloor({ contractStartDate: undefined, now: NOW })).toBe(FLAT_WEEKLY_API_FALLBACK);
  });
});

describe('DEFAULT_TENURE_API_FLOORS shape', () => {
  it('matches the brief seed table', () => {
    expect(DEFAULT_TENURE_API_FLOORS).toEqual({
      band0_lt12:    150000,
      band12_to_24:  200000,
      band25_to_36:  250000,
      band37_to_48:  300000,
      band49_to_60:  400000,
      band_gt60:     500000,
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_TENURE_API_FLOORS)).toBe(true);
  });
});
