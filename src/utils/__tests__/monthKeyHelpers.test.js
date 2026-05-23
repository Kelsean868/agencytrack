import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatMonthKey,
  parseMonthKey,
  currentMonthKey,
  recentMonthKeys,
} from '../monthKeyHelpers';

// ── formatMonthKey ────────────────────────────────────────────────────────────

describe('formatMonthKey', () => {
  it('converts YYYY-MM → MM-YYYY', () => {
    expect(formatMonthKey('2026-05')).toBe('05-2026');
    expect(formatMonthKey('2026-12')).toBe('12-2026');
    expect(formatMonthKey('2026-01')).toBe('01-2026');
  });

  it('returns input unchanged for non-matching strings', () => {
    expect(formatMonthKey('not-a-date')).toBe('not-a-date');
    expect(formatMonthKey('2026-5')).toBe('2026-5');   // single digit month
    expect(formatMonthKey('05-2026')).toBe('05-2026'); // already display format
    expect(formatMonthKey('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    expect(formatMonthKey(null)).toBe('');
    expect(formatMonthKey(undefined)).toBe('');
    expect(formatMonthKey(202605)).toBe('');
  });
});

// ── parseMonthKey ─────────────────────────────────────────────────────────────

describe('parseMonthKey', () => {
  it('converts MM-YYYY → YYYY-MM', () => {
    expect(parseMonthKey('05-2026')).toBe('2026-05');
    expect(parseMonthKey('12-2026')).toBe('2026-12');
    expect(parseMonthKey('01-2026')).toBe('2026-01');
  });

  it('returns input unchanged for non-matching strings', () => {
    expect(parseMonthKey('2026-05')).toBe('2026-05'); // already store format
    expect(parseMonthKey('not-a-date')).toBe('not-a-date');
    expect(parseMonthKey('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    expect(parseMonthKey(null)).toBe('');
    expect(parseMonthKey(undefined)).toBe('');
  });

  it('is the inverse of formatMonthKey for well-formed keys', () => {
    const key = '2026-05';
    expect(parseMonthKey(formatMonthKey(key))).toBe(key);
  });
});

// ── currentMonthKey ───────────────────────────────────────────────────────────

describe('currentMonthKey', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns a string matching YYYY-MM format', () => {
    const result = currentMonthKey();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns the current month (mocked)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(currentMonthKey()).toBe('2026-05');
  });
});

// ── recentMonthKeys ───────────────────────────────────────────────────────────

describe('recentMonthKeys', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns count items', () => {
    expect(recentMonthKeys(6)).toHaveLength(6);
    expect(recentMonthKeys(12)).toHaveLength(12);
    expect(recentMonthKeys(1)).toHaveLength(1);
  });

  it('defaults to 12 keys when count is omitted', () => {
    expect(recentMonthKeys()).toHaveLength(12);
  });

  it('returns YYYY-MM format strings', () => {
    const keys = recentMonthKeys(3);
    for (const k of keys) {
      expect(k).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('returns newest month first', () => {
    const [first, second] = recentMonthKeys(2);
    expect(first > second).toBe(true); // lexicographic sort equals chronological for YYYY-MM
  });

  it('returns consecutive months with correct wraparound (Jan - 1 = Dec prior year)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const keys = recentMonthKeys(3);
    expect(keys[0]).toBe('2026-01');
    expect(keys[1]).toBe('2025-12');
    expect(keys[2]).toBe('2025-11');
  });
});
