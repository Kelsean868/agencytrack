import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseDateOnlyTT, getTodayTT } from '../dateInputs';

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
