import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM originals under test.
import { computeAdjustmentPct as esmComputeAdjustmentPct } from '../financingProration.js';
import {
  isAdjustmentNotifyFlag as esmIsAdjustmentNotifyFlag,
  CONFIRMED_BASES as esmConfirmedBases,
  ADJUSTMENT_NOTIFY_THRESHOLD as esmThreshold,
} from '../financingMissEngine.js';

// CJS twin under test — loaded via createRequire so vitest interops the CJS module.
// The notifyFinancingAdjustment CF requires this twin to recompute the clause-5.3
// condition server-side; this test makes any drift from the ESM originals a failure.
const require = createRequire(import.meta.url);
const twin = require('../../../functions/lib/financingMissPredicates');

// ── computeAdjustmentPct: [currentMonthlyFinancing, managerFinancing] ──────────
const PCT_FIXTURES = [
  [5000, 4300],      // 0.14 — a real >10% cut
  [5000, 4500],      // 0.10 exact (boundary)
  [5000, 4499.5],    // 0.1001 — just past
  [5000, 6000],      // -0.2 — manager above current (an increase, not a cut)
  [5000, 5000],      // 0 — flat confirm
  [5000, null],      // unconfirmed → null
  [5000, undefined], // unconfirmed → null
  [5000, ''],        // unconfirmed → null
  [0, 4300],         // current <= 0 → null
  [null, 4300],      // current non-finite → null
  ['5000', '4300'],  // clean string numerics → 0.14
  ['5000abc', 4300], // trailing-garbage current → null (parseFloat would read 5000)
  [5000, '4300xyz'], // trailing-garbage manager → null
  ['  5000  ', 4300],// whitespace-padded numeric → 0.14 (trimmed)
  ['abc', 4300],     // non-numeric current → null
  [5000, -100],      // negative manager (impossible) → null (would be a >100% "cut")
];

// ── isAdjustmentNotifyFlag: raw adjustmentPct inputs ──────────────────────────
const FLAG_FIXTURES = [
  0.14, 0.10, 0.1001, -0.2, 0, null, undefined, '', '0.14', '0.14%', 'abc', NaN,
];

describe('ESM ≡ CJS — financing miss/adjustment predicates cross-check', () => {
  PCT_FIXTURES.forEach(([current, manager], i) => {
    it(`computeAdjustmentPct fixture[${i}] (${current}, ${manager}): ESM ≡ twin`, () => {
      expect(twin.computeAdjustmentPct(current, manager)).toBe(esmComputeAdjustmentPct(current, manager));
    });
  });

  FLAG_FIXTURES.forEach((pct, i) => {
    it(`isAdjustmentNotifyFlag fixture[${i}] (${String(pct)}): ESM ≡ twin`, () => {
      expect(twin.isAdjustmentNotifyFlag(pct)).toBe(esmIsAdjustmentNotifyFlag(pct));
    });
  });

  it('CONFIRMED_BASES and ADJUSTMENT_NOTIFY_THRESHOLD match the ESM originals', () => {
    expect(twin.CONFIRMED_BASES).toEqual(esmConfirmedBases);
    expect(twin.ADJUSTMENT_NOTIFY_THRESHOLD).toBe(esmThreshold);
  });
});

// ── Known expected values (lock the twin's verdicts directly) ─────────────────
describe('financingMissPredicates twin — known expected values', () => {
  it('a 14% cut on a confirmed basis flags; exactly 10% does not', () => {
    expect(twin.isAdjustmentNotifyFlag(twin.computeAdjustmentPct(5000, 4300))).toBe(true);
    expect(twin.isAdjustmentNotifyFlag(twin.computeAdjustmentPct(5000, 4500))).toBe(false);
  });
  it('unconfirmed managerFinancing → null → no flag', () => {
    expect(twin.computeAdjustmentPct(5000, null)).toBeNull();
    expect(twin.isAdjustmentNotifyFlag(twin.computeAdjustmentPct(5000, null))).toBe(false);
  });
  it('a malformed "0.14%" string is rejected (not read as 0.14)', () => {
    expect(twin.isAdjustmentNotifyFlag('0.14%')).toBe(false);
  });
  it('trailing-garbage current/manager → null (parseFloat would partially parse)', () => {
    expect(twin.computeAdjustmentPct('5000abc', 4300)).toBeNull();
    expect(twin.computeAdjustmentPct(5000, '4300xyz')).toBeNull();
    expect(esmComputeAdjustmentPct('5000abc', 4300)).toBeNull();
    expect(esmComputeAdjustmentPct(5000, '4300xyz')).toBeNull();
  });
  it('negative managerFinancing → null (impossible domain, never a >100% cut)', () => {
    expect(twin.computeAdjustmentPct(5000, -100)).toBeNull();
    expect(esmComputeAdjustmentPct(5000, -100)).toBeNull();
  });
  it('confirmed bases are submitted-final + settled-confirmed only', () => {
    expect(twin.CONFIRMED_BASES).toContain('submitted-final');
    expect(twin.CONFIRMED_BASES).toContain('settled-confirmed');
    expect(twin.CONFIRMED_BASES).not.toContain('submitted-provisional');
  });
});
