// Track K · K7 — termination-risk monitor engine tests.
//
// Exhaustive matrix for the load-bearing money/legal logic: the confirmed-basis
// miss verdict, the consecutive counter (miss / meet-resets / pending-HOLDS /
// amber-at-2 / critical-at-3), and the clause-5.3 >10% notify predicate
// (confirmed-vs-null, the 10% boundary, polarity). Pure module — no mocks.

import { describe, it, expect } from 'vitest';
import {
  computeMonthlyMiss,
  computeConsecutiveMisses,
  severityForCount,
  isAdjustmentNotifyFlag,
  findAdjustmentFlags,
  CONFIRMED_BASES,
  ADJUSTMENT_NOTIFY_THRESHOLD,
  MISS_AMBER_AT,
  MISS_CRITICAL_AT,
  MISS,
  MEET,
  PENDING,
} from '../financingMissEngine';

// Row factory — a confirmed-basis ledger month by default.
const row = (month, { actualAPI, validatingAPI, basisSource = 'settled-confirmed', adjustmentPct } = {}) => ({
  month,
  actualAPI,
  validatingAPI,
  basisSource,
  ...(adjustmentPct !== undefined ? { adjustmentPct } : {}),
});

const miss = (month, basisSource = 'settled-confirmed') =>
  row(month, { actualAPI: 20000, validatingAPI: 30000, basisSource });
const meet = (month, basisSource = 'settled-confirmed') =>
  row(month, { actualAPI: 31000, validatingAPI: 30000, basisSource });
const provisional = (month) =>
  row(month, { actualAPI: 1000, validatingAPI: 30000, basisSource: 'submitted-provisional' });

describe('constants', () => {
  it('confirmed bases are submitted-final + settled-confirmed only (never provisional)', () => {
    expect(CONFIRMED_BASES).toEqual(['submitted-final', 'settled-confirmed']);
    expect(CONFIRMED_BASES).not.toContain('submitted-provisional');
  });
  it('threshold + severity boundaries match the locked spec', () => {
    expect(ADJUSTMENT_NOTIFY_THRESHOLD).toBe(0.10);
    expect(MISS_AMBER_AT).toBe(2);
    expect(MISS_CRITICAL_AT).toBe(3);
  });
});

describe('computeMonthlyMiss — confirmed-basis verdict', () => {
  it('submitted-final, actual < validating → miss', () => {
    expect(computeMonthlyMiss(row('2026_01', { actualAPI: 20000, validatingAPI: 30000, basisSource: 'submitted-final' }))).toBe(MISS);
  });
  it('settled-confirmed, actual < validating → miss', () => {
    expect(computeMonthlyMiss(row('2026_05', { actualAPI: 29999, validatingAPI: 30000, basisSource: 'settled-confirmed' }))).toBe(MISS);
  });
  it('actual === validating → meet (boundary, not a miss)', () => {
    expect(computeMonthlyMiss(row('2026_05', { actualAPI: 30000, validatingAPI: 30000 }))).toBe(MEET);
  });
  it('actual > validating → meet', () => {
    expect(computeMonthlyMiss(row('2026_05', { actualAPI: 45000, validatingAPI: 30000 }))).toBe(MEET);
  });
  it('validatingAPI 0 with actual 0 → meet (a zero target cannot be missed)', () => {
    expect(computeMonthlyMiss(row('2026_05', { actualAPI: 0, validatingAPI: 0 }))).toBe(MEET);
  });
  it('submitted-provisional → pending even when actual < validating', () => {
    expect(computeMonthlyMiss(provisional('2026_07'))).toBe(PENDING);
  });
  it('missing basisSource (statement-only row) → pending', () => {
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: 10, validatingAPI: 30000 })).toBe(PENDING);
  });
  it('unknown basisSource → pending', () => {
    expect(computeMonthlyMiss(row('2026_07', { actualAPI: 10, validatingAPI: 30000, basisSource: 'bogus' }))).toBe(PENDING);
  });
  it('confirmed basis but non-finite actualAPI → pending', () => {
    expect(computeMonthlyMiss({ month: '2026_07', validatingAPI: 30000, basisSource: 'settled-confirmed' })).toBe(PENDING);
  });
  it('null / undefined row → pending', () => {
    expect(computeMonthlyMiss(null)).toBe(PENDING);
    expect(computeMonthlyMiss(undefined)).toBe(PENDING);
  });
  // Strict-parse guards (the parser must reject malformed numerics as PENDING).
  it('null actualAPI on a confirmed row STAYS pending (NOT a 0-miss)', () => {
    // The exact regression a bare Number() parse would introduce: Number(null) === 0,
    // which would read as actualAPI 0 < validating 30000 → a false MISS. parseFloat/
    // strict-parse both yield NaN → PENDING. Lock it.
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: null, validatingAPI: 30000, basisSource: 'settled-confirmed' })).toBe(PENDING);
  });
  it('empty-string actualAPI on a confirmed row → pending (not coerced to 0)', () => {
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: '', validatingAPI: 30000, basisSource: 'settled-confirmed' })).toBe(PENDING);
  });
  it('trailing-garbage numeric string → pending (parseFloat would have accepted it)', () => {
    // parseFloat("20000usd") === 20000 (a false MISS vs 30000); strict-parse → NaN.
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: '20000usd', validatingAPI: 30000, basisSource: 'settled-confirmed' })).toBe(PENDING);
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: 20000, validatingAPI: '30000abc', basisSource: 'settled-confirmed' })).toBe(PENDING);
  });
  it('clean numeric strings still parse (valid data unaffected)', () => {
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: '20000', validatingAPI: '30000', basisSource: 'settled-confirmed' })).toBe(MISS);
    expect(computeMonthlyMiss({ month: '2026_07', actualAPI: '31000', validatingAPI: '30000', basisSource: 'settled-confirmed' })).toBe(MEET);
  });
});

describe('computeConsecutiveMisses — the counter (CD#4)', () => {
  it('empty ledger → 0 / none / not-met / []', () => {
    expect(computeConsecutiveMisses([])).toEqual({
      count: 0, severity: 'none', terminationConditionMet: false, verdicts: [],
    });
  });
  it('non-array → treated as empty', () => {
    expect(computeConsecutiveMisses(null).count).toBe(0);
    expect(computeConsecutiveMisses(undefined).count).toBe(0);
  });
  it('single miss → 1 / none', () => {
    const r = computeConsecutiveMisses([miss('2026_01')]);
    expect(r.count).toBe(1);
    expect(r.severity).toBe('none');
    expect(r.terminationConditionMet).toBe(false);
  });
  it('two consecutive misses → 2 / amber / not-critical', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02')]);
    expect(r.count).toBe(2);
    expect(r.severity).toBe('amber');
    expect(r.terminationConditionMet).toBe(false);
  });
  it('three consecutive misses → 3 / critical / 7.2c condition MET', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02'), miss('2026_03')]);
    expect(r.count).toBe(3);
    expect(r.severity).toBe('critical');
    expect(r.terminationConditionMet).toBe(true);
  });
  it('four consecutive misses → 4 / critical / met', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02'), miss('2026_03'), miss('2026_04')]);
    expect(r.count).toBe(4);
    expect(r.severity).toBe('critical');
    expect(r.terminationConditionMet).toBe(true);
  });
  it('a confirmed meet RESETS the streak (miss,miss,meet,miss → 1)', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02'), meet('2026_03'), miss('2026_04')]);
    expect(r.count).toBe(1);
    expect(r.severity).toBe('none');
  });
  it('meet at the tail clears to 0 (miss,miss,miss,meet → 0 / none)', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02'), miss('2026_03'), meet('2026_04')]);
    expect(r.count).toBe(0);
    expect(r.severity).toBe('none');
    expect(r.terminationConditionMet).toBe(false);
  });

  // ── pending HOLDS (provisional or no-entry: neither counts nor resets) ──────
  it('a provisional month between two misses HOLDS (miss,prov,miss → 2 amber)', () => {
    const r = computeConsecutiveMisses([miss('2026_05'), provisional('2026_06'), miss('2026_07')]);
    expect(r.count).toBe(2);
    expect(r.severity).toBe('amber');
  });
  it('a statement-only (no-basis) month between two misses HOLDS (→ 2)', () => {
    const noBasis = { month: '2026_06', actualAPI: 5, validatingAPI: 30000 };
    const r = computeConsecutiveMisses([miss('2026_05'), noBasis, miss('2026_07')]);
    expect(r.count).toBe(2);
  });
  it('a no-entry GAP is transparent (M2 absent: miss(M1),miss(M3) → 2)', () => {
    const r = computeConsecutiveMisses([miss('2026_05'), miss('2026_07')]);
    expect(r.count).toBe(2);
  });
  it('a trailing provisional HOLDS the value (miss,miss,prov → 2 amber)', () => {
    const r = computeConsecutiveMisses([miss('2026_05'), miss('2026_06'), provisional('2026_07')]);
    expect(r.count).toBe(2);
    expect(r.severity).toBe('amber');
  });
  it('meet then pending then miss → 1 (meet resets, pending no-op, miss +1)', () => {
    const r = computeConsecutiveMisses([meet('2026_05'), provisional('2026_06'), miss('2026_07')]);
    expect(r.count).toBe(1);
  });
  it('miss then pending then meet → 0 (pending no-op, meet resets)', () => {
    const r = computeConsecutiveMisses([miss('2026_05'), provisional('2026_06'), meet('2026_07')]);
    expect(r.count).toBe(0);
    expect(r.severity).toBe('none');
  });
  it('two misses straddling a meet do NOT chain to critical (miss,miss,meet,miss,miss → 2)', () => {
    const r = computeConsecutiveMisses([miss('2026_01'), miss('2026_02'), meet('2026_03'), miss('2026_04'), miss('2026_05')]);
    expect(r.count).toBe(2);
    expect(r.severity).toBe('amber');
    expect(r.terminationConditionMet).toBe(false);
  });

  it('sorts unordered input ascending before walking', () => {
    // Same three misses, scrambled — must still read as 3 consecutive.
    const r = computeConsecutiveMisses([miss('2026_03'), miss('2026_01'), miss('2026_02')]);
    expect(r.count).toBe(3);
    expect(r.terminationConditionMet).toBe(true);
  });
  it('emits per-month verdicts ascending for the panel', () => {
    const r = computeConsecutiveMisses([miss('2026_02'), provisional('2026_03'), meet('2026_01')]);
    expect(r.verdicts).toEqual([
      { month: '2026_01', verdict: MEET },
      { month: '2026_02', verdict: MISS },
      { month: '2026_03', verdict: PENDING },
    ]);
  });
});

describe('severityForCount', () => {
  it('0 and 1 → none', () => {
    expect(severityForCount(0)).toBe('none');
    expect(severityForCount(1)).toBe('none');
  });
  it('2 → amber', () => expect(severityForCount(2)).toBe('amber'));
  it('3 and above → critical', () => {
    expect(severityForCount(3)).toBe('critical');
    expect(severityForCount(9)).toBe('critical');
  });
  it('non-finite → none', () => {
    expect(severityForCount(NaN)).toBe('none');
    expect(severityForCount(undefined)).toBe('none');
  });
});

describe('isAdjustmentNotifyFlag — clause-5.3 >10% predicate', () => {
  it('null / undefined / "" (unconfirmed) → false', () => {
    expect(isAdjustmentNotifyFlag(null)).toBe(false);
    expect(isAdjustmentNotifyFlag(undefined)).toBe(false);
    expect(isAdjustmentNotifyFlag('')).toBe(false);
  });
  it('exactly 0.10 → false (not PAST the threshold, CD#5 ">10%")', () => {
    expect(isAdjustmentNotifyFlag(0.10)).toBe(false);
  });
  it('just past the threshold → true', () => {
    expect(isAdjustmentNotifyFlag(0.1001)).toBe(true);
  });
  it('a 14% confirmed cut → true', () => {
    expect(isAdjustmentNotifyFlag(0.14)).toBe(true);
  });
  it('a small cut (<=10%) → false (routine proration does not spam the duty)', () => {
    expect(isAdjustmentNotifyFlag(0.05)).toBe(false);
  });
  it('polarity: a non-positive adjustmentPct (an increase) → false', () => {
    expect(isAdjustmentNotifyFlag(0)).toBe(false);
    expect(isAdjustmentNotifyFlag(-0.20)).toBe(false);
  });
  it('parses a numeric string', () => {
    expect(isAdjustmentNotifyFlag('0.14')).toBe(true);
    expect(isAdjustmentNotifyFlag('0.05')).toBe(false);
  });
  it('non-numeric → false', () => {
    expect(isAdjustmentNotifyFlag('abc')).toBe(false);
    expect(isAdjustmentNotifyFlag(NaN)).toBe(false);
  });
  it('trailing-garbage string → false (parseFloat would have read "0.14%" as 0.14 → a false flag)', () => {
    expect(isAdjustmentNotifyFlag('0.14%')).toBe(false);
    expect(isAdjustmentNotifyFlag('0.2 cut')).toBe(false);
  });
});

describe('findAdjustmentFlags', () => {
  it('returns only flagged rows, ascending by month', () => {
    const rows = [
      row('2026_03', { actualAPI: 1, validatingAPI: 1, adjustmentPct: 0.14 }),
      row('2026_01', { actualAPI: 1, validatingAPI: 1, adjustmentPct: 0.05 }),   // below threshold
      row('2026_02', { actualAPI: 1, validatingAPI: 1, adjustmentPct: 0.20 }),
      row('2026_04', { actualAPI: 1, validatingAPI: 1 }),                         // no adjustmentPct
    ];
    const flagged = findAdjustmentFlags(rows);
    expect(flagged.map((r) => r.month)).toEqual(['2026_02', '2026_03']);
  });
  it('empty / non-array → []', () => {
    expect(findAdjustmentFlags([])).toEqual([]);
    expect(findAdjustmentFlags(null)).toEqual([]);
  });
});
