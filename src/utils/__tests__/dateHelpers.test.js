import { describe, it, expect, vi } from 'vitest';
import { weekNumber } from '../dateHelpers';

describe('weekNumber — floored, Sunday-anchored week-of-year (BUG-102)', () => {
  it('pins known 2026 mid-year boundaries (string input)', () => {
    // Sat 2026-07-04 falls in week 27; the following Sunday opens week 28.
    expect(weekNumber('2026-07-04')).toBe(27);
    expect(weekNumber('2026-07-05')).toBe(28);
  });

  it('handles year boundaries', () => {
    expect(weekNumber('2026-01-01')).toBe(1);
    // Last day of 2026 lands in the final partial week.
    expect(weekNumber('2026-12-31')).toBe(53);
  });

  it('does not drift for a local evening Date in Trinidad (UTC-4)', () => {
    // 8pm local on Sat 2026-07-04. Naive getUTC* on this Date would roll to
    // 2026-07-05 UTC and report week 28; the local-day normalization keeps it 27.
    expect(weekNumber(new Date(2026, 6, 4, 20, 0))).toBe(27);
  });

  it('produces the same week for a Date and its YYYY-MM-DD string (parity)', () => {
    // Same calendar day via both input paths must agree — this is the whole
    // point of the unification (topbar Date vs Daily-Capture string).
    expect(weekNumber(new Date(2026, 6, 4, 20, 0))).toBe(weekNumber('2026-07-04'));
    expect(weekNumber(new Date(2026, 6, 5, 1, 0))).toBe(weekNumber('2026-07-05'));
    expect(weekNumber(new Date(2026, 0, 1, 23, 30))).toBe(weekNumber('2026-01-01'));
  });

  it('defaults to now when called with no argument', () => {
    // Freeze the clock so the no-arg default is deterministic — a live
    // new Date() here + another inside weekNumber() could straddle a midnight
    // tick and flake (Gemini). Sat 2026-07-04 15:00 local → week 27.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4, 15, 0));
    try {
      expect(weekNumber()).toBe(27);
      expect(weekNumber()).toBe(weekNumber('2026-07-04'));
    } finally {
      vi.useRealTimers();
    }
  });
});
