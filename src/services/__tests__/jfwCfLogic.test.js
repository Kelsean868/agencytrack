/**
 * Unit tests for the pure logic functions in functions/war/jfwCountLogic.js.
 * These run in Vitest (no CF harness, no Firebase emulator).
 * The CF trigger itself is tested via production smoke after CF deploy (post-merge).
 */
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { computeWeekEnd, computeJfwCount, shouldWriteBack } =
  require('../../../functions/war/jfwCountLogic');

// ── computeWeekEnd ────────────────────────────────────────────────────────────

describe('computeWeekEnd', () => {
  it('adds exactly 7 days to a standard Sunday', () => {
    expect(computeWeekEnd('2026-05-17')).toBe('2026-05-24');
  });

  it('handles month boundary correctly (2026-05-31 → 2026-06-07)', () => {
    expect(computeWeekEnd('2026-05-31')).toBe('2026-06-07');
  });

  it('handles year boundary correctly (2025-12-28 → 2026-01-04)', () => {
    expect(computeWeekEnd('2025-12-28')).toBe('2026-01-04');
  });
});

// ── computeJfwCount ───────────────────────────────────────────────────────────

function makeDoc(appointmentKept) {
  return { data: () => ({ appointmentKept }) };
}

describe('computeJfwCount', () => {
  it('counts only docs with appointmentKept === true', () => {
    expect(computeJfwCount([
      makeDoc(true),
      makeDoc(true),
      makeDoc(false),
    ])).toBe(2);
  });

  it('returns 0 for empty docs array', () => {
    expect(computeJfwCount([])).toBe(0);
  });

  it('returns 0 when all docs have appointmentKept: false', () => {
    expect(computeJfwCount([makeDoc(false), makeDoc(false)])).toBe(0);
  });

  it('uses strict === true (truthy non-boolean values excluded)', () => {
    expect(computeJfwCount([makeDoc(1), makeDoc('yes'), makeDoc(null)])).toBe(0);
  });

  it('returns count of all docs when all are kept', () => {
    expect(computeJfwCount([makeDoc(true), makeDoc(true), makeDoc(true)])).toBe(3);
  });
});

// ── shouldWriteBack ───────────────────────────────────────────────────────────

describe('shouldWriteBack', () => {
  it('returns false when stored equals computed (loop-guard)', () => {
    expect(shouldWriteBack(0, 0)).toBe(false);
    expect(shouldWriteBack(3, 3)).toBe(false);
  });

  it('returns true when computed differs from stored', () => {
    expect(shouldWriteBack(0, 2)).toBe(true);
    expect(shouldWriteBack(3, 1)).toBe(true);
  });
});
