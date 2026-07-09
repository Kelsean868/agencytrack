import { describe, it, expect } from 'vitest';
import { deriveKioskCelebrations, currentWeekSundayYMD } from '../kioskCelebrations';

// Fixed reference: Wednesday 2026-01-07. Week Sunday = 2026-01-04; window
// covers 01-04 .. 01-10.
const REF = new Date(2026, 0, 7);

describe('currentWeekSundayYMD', () => {
  it('returns the Sunday that starts the current week', () => {
    expect(currentWeekSundayYMD(REF)).toBe('2026-01-04');
  });

  it('returns the same day when the ref is already Sunday', () => {
    expect(currentWeekSundayYMD(new Date(2026, 0, 4))).toBe('2026-01-04');
  });
});

describe('deriveKioskCelebrations (3.6)', () => {
  it('includes an anniversary whose month/day lands in the week window', () => {
    const users = [
      { id: 'a1', name: 'Alice', contractStartDate: '2021-01-06' }, // Tue in window → 5 yrs
    ];
    const out = deriveKioskCelebrations(users, REF);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a1', name: 'Alice', years: 5, dateLabel: '01-06' });
  });

  it('excludes anniversaries outside the current week window', () => {
    const users = [{ id: 'a2', name: 'Bob', contractStartDate: '2020-06-15' }];
    expect(deriveKioskCelebrations(users, REF)).toEqual([]);
  });

  it('excludes a contract that started this same year (0 years)', () => {
    const users = [{ id: 'a3', name: 'Cara', contractStartDate: '2026-01-05' }];
    expect(deriveKioskCelebrations(users, REF)).toEqual([]);
  });

  it('ignores users with a missing/malformed contractStartDate', () => {
    const users = [
      { id: 'x', name: 'NoDate' },
      { id: 'y', name: 'BadDate', contractStartDate: 'nope' },
    ];
    expect(deriveKioskCelebrations(users, REF)).toEqual([]);
  });

  it('sorts by years descending', () => {
    const users = [
      { id: 'a', name: 'A', contractStartDate: '2024-01-05' }, // 2 yrs
      { id: 'b', name: 'B', contractStartDate: '2019-01-07' }, // 7 yrs
    ];
    const out = deriveKioskCelebrations(users, REF);
    expect(out.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('returns [] for empty input', () => {
    expect(deriveKioskCelebrations([], REF)).toEqual([]);
    expect(deriveKioskCelebrations(undefined, REF)).toEqual([]);
  });
});
