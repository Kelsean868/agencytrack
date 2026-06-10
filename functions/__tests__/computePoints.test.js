'use strict';

const { computePoints } = require('../lib/computePoints');

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// REGRESSION_FIXTURE covers every activity that scored points before this PR:
//   dials (4 types) + ffi + ci + apps + api.
//
// Expected breakdown:
//   dials = 3+2+1+1 = 7 → Math.floor(7) * 1 = 7
//   ffi   = 2             → Math.floor(2) * 5 = 10
//   ci    = 1             → Math.floor(1) * 10 = 10
//   apps  = 2             → Math.floor(2) * 25 = 50
//   api   = 5000          → Math.floor(5000/1000) * 1 = 5
//   TOTAL = 82

const REGRESSION_FIXTURE = {
  referralCalls:         3,
  followUpCalls:         2,
  coldCalls:             1,
  seminarTradeshowCalls: 1,
  ffiConducted:          2,
  ciConducted:           1,
  applicationsSold:      2,
  apiSold:               5000,
};

// ── Regression guard ──────────────────────────────────────────────────────────

describe('computePoints — regression guard (existing weights unchanged)', () => {
  test('all existing activities → 82 (proves extraction changed nothing)', () => {
    expect(computePoints(REGRESSION_FIXTURE)).toBe(82);
  });

  test('appsSold fallback: applicationsSold absent → reads appsSold', () => {
    const { applicationsSold: _dropped, ...rest } = REGRESSION_FIXTURE;
    expect(computePoints({ ...rest, appsSold: 2 })).toBe(82);
  });

  test('empty doc → 0 (no crash)', () => {
    expect(computePoints({})).toBe(0);
  });

  test('string-numeric fields parse correctly', () => {
    expect(computePoints({ applicationsSold: '3', apiSold: '2000' })).toBe(75 + 2);
  });

  test('fractional dials: summed before flooring (1.5+1.5 = 3, not 1+1 = 2)', () => {
    expect(computePoints({ referralCalls: 1.5, followUpCalls: 1.5 })).toBe(3);
  });
});

// ── f2fAttempts scoring ───────────────────────────────────────────────────────

describe('computePoints — f2fAttempts', () => {
  test('f2fAttempts=3 raises the regression total by exactly 3', () => {
    const base    = computePoints(REGRESSION_FIXTURE);
    const withF2f = computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 3 });
    expect(withF2f - base).toBe(3);
  });

  test('f2fAttempts=1 → regression total + 1 = 83', () => {
    expect(computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 1 })).toBe(83);
  });

  test('f2fAttempts=0 → regression total unchanged = 82', () => {
    expect(computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 0 })).toBe(82);
  });

  test('f2fAttempts alone (all others absent) → N pts', () => {
    expect(computePoints({ f2fAttempts: 5 })).toBe(5);
  });

  test('f2fAttempts is floored independently of dials', () => {
    expect(computePoints({ f2fAttempts: 2.9 })).toBe(2);
  });
});
