'use strict';

const {
  getTriniSundayString,
  resolveWeekToAggregate,
  draftDocPath,
} = require('../aggregators/sundayDailyToWeekly');

describe('getTriniSundayString', () => {
  test('returns the Sunday of the current TT week for a mid-week UTC date', () => {
    // Wednesday 2026-05-20 at 12:00 UTC → TT is UTC-4 → 08:00 Wed
    // The preceding Sunday in TT was 2026-05-17
    const date = new Date('2026-05-20T12:00:00Z');
    expect(getTriniSundayString(date)).toBe('2026-05-17');
  });

  test('returns the same Sunday when the input is exactly that Sunday at midnight TT', () => {
    // 2026-05-17 04:00 UTC = 2026-05-17 00:00 TT (Sunday midnight) → stays on 2026-05-17
    const date = new Date('2026-05-17T04:00:00Z');
    expect(getTriniSundayString(date)).toBe('2026-05-17');
  });
});

describe('resolveWeekToAggregate', () => {
  test('returns the Sunday 7 days before the current TT Sunday', () => {
    // Cron fires Monday 2026-05-18 03:00 UTC = Sunday 2026-05-17 23:00 TT
    // TT Sunday is 2026-05-17; 7 days before = 2026-05-10
    const now = new Date('2026-05-18T03:00:00Z');
    expect(resolveWeekToAggregate(now)).toBe('2026-05-10');
  });
});

describe('draftDocPath', () => {
  test('builds the expected Firestore path for a weekly draft', () => {
    expect(draftDocPath('tatillife_south', 'agent123', '2026-05-10'))
      .toBe('tenants/tatillife_south/submissions/agent123_2026-05-10');
  });
});
