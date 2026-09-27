import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseDateOnlyTT,
  getTodayTT,
  ymdTT,
  ymdUTC,
  isAfterTodayTT,
  ttDateParts,
  monthKeyFromDate,
  monthsBetweenKeys,
  enumerateMonthKeys,
} from '../dateInputs';

describe('parseDateOnlyTT', () => {
  it('returns a Date at 04:00 UTC for a standard date', () => {
    const d = parseDateOnlyTT('2025-06-15');
    expect(d.toISOString()).toBe('2025-06-15T04:00:00.000Z');
  });

  it('Dec 31 — last day of year parses to 04:00 UTC Dec 31', () => {
    const d = parseDateOnlyTT('2024-12-31');
    expect(d.toISOString()).toBe('2024-12-31T04:00:00.000Z');
    // Period key via toISOString().substring(0,7) must be December
    expect(d.toISOString().substring(0, 7)).toBe('2024-12');
  });

  it('Jan 1 — first day of year parses to 04:00 UTC Jan 1 (no prior-month skew)', () => {
    const d = parseDateOnlyTT('2025-01-01');
    expect(d.toISOString()).toBe('2025-01-01T04:00:00.000Z');
    // Critical: UTC-midnight would be 2024-12; TT-midnight is 2025-01
    expect(d.toISOString().substring(0, 7)).toBe('2025-01');
  });

  it('Mar 31 — Q1/Q2 boundary stays in March', () => {
    const d = parseDateOnlyTT('2024-03-31');
    expect(d.toISOString()).toBe('2024-03-31T04:00:00.000Z');
    expect(d.toISOString().substring(0, 7)).toBe('2024-03');
  });

  it('Feb 29 leap year parses correctly', () => {
    const d = parseDateOnlyTT('2024-02-29');
    expect(d.toISOString()).toBe('2024-02-29T04:00:00.000Z');
    expect(d.toISOString().substring(0, 7)).toBe('2024-02');
  });

  it('throws on missing input', () => {
    expect(() => parseDateOnlyTT(null)).toThrow('parseDateOnlyTT');
    expect(() => parseDateOnlyTT(undefined)).toThrow('parseDateOnlyTT');
    expect(() => parseDateOnlyTT('')).toThrow('parseDateOnlyTT');
  });

  it('throws on invalid date string', () => {
    expect(() => parseDateOnlyTT('not-a-date')).toThrow('parseDateOnlyTT');
  });

  it('throws if input is a number instead of string', () => {
    expect(() => parseDateOnlyTT(20250101)).toThrow('parseDateOnlyTT');
  });
});

describe('getTodayTT', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a YYYY-MM-DD string', () => {
    const result = getTodayTT();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('at UTC 03:59:59 it is still Dec 31 in TT (the previous day)', () => {
    // 2025-01-01T03:59:59Z = Dec 31 23:59:59 TT (UTC-4)
    vi.useFakeTimers({ now: new Date('2025-01-01T03:59:59Z') });
    expect(getTodayTT()).toBe('2024-12-31');
  });

  it('at UTC 04:00:00 the TT day rolls over to Jan 1', () => {
    // 2025-01-01T04:00:00Z = Jan 1 00:00:00 TT (UTC-4)
    vi.useFakeTimers({ now: new Date('2025-01-01T04:00:00Z') });
    expect(getTodayTT()).toBe('2025-01-01');
  });

  it('mid-month control — UTC 2025-06-15T12:00:00Z is June 15 TT', () => {
    vi.useFakeTimers({ now: new Date('2025-06-15T12:00:00Z') });
    expect(getTodayTT()).toBe('2025-06-15');
  });
});

// ── P2d · BUG-02 — one "today" for Trinidad ────────────────────────────────
describe('P2d — todayTT (getTodayTT) at the 20:00–24:00 TT boundary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('at 21:00 TT (01:00 UTC next day) returns the TT date, not the UTC one', () => {
    // 2026-12-31T01:00:00Z = 30 Dec 2026 21:00 TT
    vi.useFakeTimers({ now: new Date('2026-12-31T01:00:00Z') });
    expect(getTodayTT()).toBe('2026-12-30');
    // …which is exactly the bug: the old UTC slice says tomorrow.
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('at 20:00 TT (00:00 UTC) — the first minute the UTC slice goes wrong', () => {
    vi.useFakeTimers({ now: new Date('2026-09-28T00:00:00Z') });
    expect(getTodayTT()).toBe('2026-09-27');
  });

  it('at 19:59:59 TT both agree', () => {
    vi.useFakeTimers({ now: new Date('2026-09-27T23:59:59Z') });
    expect(getTodayTT()).toBe('2026-09-27');
  });

  it('contract-start "not in the future" check refuses TOMORROW at 21:00 TT', () => {
    vi.useFakeTimers({ now: new Date('2026-12-31T01:00:00Z') }); // 30 Dec, 21:00 TT
    expect(isAfterTodayTT('2026-12-31')).toBe(true);  // tomorrow → refused
    expect(isAfterTodayTT('2026-12-30')).toBe(false); // today → allowed
    expect(isAfterTodayTT('2026-01-15')).toBe(false); // past → allowed
  });

  it('isAfterTodayTT is false for a missing value (the required-field check owns that)', () => {
    expect(isAfterTodayTT(undefined, '2026-09-27')).toBe(false);
    expect(isAfterTodayTT('', '2026-09-27')).toBe(false);
  });
});

describe('P2d — ymdTT / ymdUTC / ttDateParts', () => {
  it('ymdTT dates an instant in Trinidad', () => {
    expect(ymdTT(new Date('2026-12-31T01:00:00Z'))).toBe('2026-12-30');
    expect(ymdTT(Date.parse('2026-12-31T04:00:00Z'))).toBe('2026-12-31');
  });

  it('ymdTT returns null for an unreadable value (never a plausible wrong date)', () => {
    expect(ymdTT(new Date('nope'))).toBeNull();
  });

  it('ymdUTC is the raw UTC slice (for date arithmetic on anchored Dates only)', () => {
    expect(ymdUTC(new Date('2026-12-31T01:00:00Z'))).toBe('2026-12-31');
    expect(ymdUTC(new Date('2026-02-01T00:00:00Z'))).toBe('2026-02-01');
  });

  it('ttDateParts gives the TT calendar parts', () => {
    expect(ttDateParts(new Date('2026-01-01T02:00:00Z'))).toEqual({ year: 2025, month: 12, day: 31 });
    expect(ttDateParts(new Date('bad'))).toBeNull();
  });
});

// ── Track K · K2 — ledger month-key helpers ─────────────────────────────────
describe('monthKeyFromDate', () => {
  it('maps a YYYY-MM-DD date to its YYYY_MM month key (verbatim calendar month)', () => {
    expect(monthKeyFromDate('2026-01-15')).toBe('2026_01');
    expect(monthKeyFromDate('2026-12-31')).toBe('2026_12');
  });

  it('takes the month verbatim — no timezone skew on a month boundary', () => {
    // Jan 1 stays January (unlike a naive UTC parse that would skew to Dec).
    expect(monthKeyFromDate('2026-01-01')).toBe('2026_01');
  });

  it('throws on a non-YYYY-MM-DD input', () => {
    expect(() => monthKeyFromDate('2026-01')).toThrow('monthKeyFromDate');
    expect(() => monthKeyFromDate('2026_01_15')).toThrow('monthKeyFromDate');
    expect(() => monthKeyFromDate(null)).toThrow('monthKeyFromDate');
  });
});

describe('monthsBetweenKeys', () => {
  it('returns 0 for the same month', () => {
    expect(monthsBetweenKeys('2026_03', '2026_03')).toBe(0);
  });

  it('counts forward months within a year', () => {
    expect(monthsBetweenKeys('2026_01', '2026_04')).toBe(3);
  });

  it('counts across a year boundary', () => {
    expect(monthsBetweenKeys('2025_11', '2026_02')).toBe(3);
  });

  it('is negative when the target precedes the start', () => {
    expect(monthsBetweenKeys('2026_04', '2026_01')).toBe(-3);
  });

  it('throws on a malformed key', () => {
    expect(() => monthsBetweenKeys('2026-01', '2026_02')).toThrow('monthsBetweenKeys');
    expect(() => monthsBetweenKeys('2026_01', 'bad')).toThrow('monthsBetweenKeys');
  });
});

describe('enumerateMonthKeys', () => {
  it('lists an inclusive single-year span', () => {
    expect(enumerateMonthKeys('2026_01', '2026_04')).toEqual(['2026_01', '2026_02', '2026_03', '2026_04']);
  });

  it('returns a single element when from == to', () => {
    expect(enumerateMonthKeys('2026_06', '2026_06')).toEqual(['2026_06']);
  });

  it('crosses a year boundary correctly', () => {
    expect(enumerateMonthKeys('2025_11', '2026_02')).toEqual(['2025_11', '2025_12', '2026_01', '2026_02']);
  });

  it('returns [] when the target precedes the start', () => {
    expect(enumerateMonthKeys('2026_04', '2026_01')).toEqual([]);
  });
});
