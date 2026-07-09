import { describe, it, expect } from 'vitest';
import {
  DAILY_STREAK_MILESTONES,
  GOALS_WEEKLY_STREAK_MILESTONES,
  resolveStreakCelebration,
  currentAwardStreak,
  resolveGoalsCelebration,
} from '../celebrations';

// Award-week submission factory: submitted week clearing `api`.
const wk = (weekStarting, api, status = 'submitted') => ({
  weekStarting,
  status,
  apiSold: api,
});

describe('resolveStreakCelebration', () => {
  it('exports the daily milestone set', () => {
    expect(DAILY_STREAK_MILESTONES).toEqual([5, 10, 20]);
  });

  it('fires when the streak crosses the first milestone (5)', () => {
    const r = resolveStreakCelebration({ streak: 5, celebratedMax: 0 });
    expect(r.milestone).toBe(5);
    expect(r.nextCelebratedMax).toBe(5);
  });

  it('does NOT fire below the first milestone', () => {
    expect(resolveStreakCelebration({ streak: 4, celebratedMax: 0 }).milestone).toBeNull();
  });

  it('does NOT re-fire at 6 once 5 is celebrated', () => {
    const r = resolveStreakCelebration({ streak: 6, celebratedMax: 5 });
    expect(r.milestone).toBeNull();
    expect(r.nextCelebratedMax).toBe(5);
  });

  it('respects a persisted marker (5 already celebrated → no fire at 5)', () => {
    expect(resolveStreakCelebration({ streak: 5, celebratedMax: 5 }).milestone).toBeNull();
  });

  it('fires the higher milestone when the streak jumps past it', () => {
    const r = resolveStreakCelebration({ streak: 10, celebratedMax: 5 });
    expect(r.milestone).toBe(10);
    expect(r.nextCelebratedMax).toBe(10);
  });

  it('clamps the marker down on a run reset so the next run re-fires', () => {
    // Streak reset to 0 (new week) — marker clamps to 0.
    const reset = resolveStreakCelebration({ streak: 0, celebratedMax: 5 });
    expect(reset.milestone).toBeNull();
    expect(reset.nextCelebratedMax).toBe(0);
    // New run climbs back to 5 — fires again.
    const again = resolveStreakCelebration({ streak: 5, celebratedMax: 0 });
    expect(again.milestone).toBe(5);
  });
});

describe('currentAwardStreak', () => {
  it('returns 0 with no target', () => {
    expect(currentAwardStreak([wk('2026-01-04', 9000)], 2026, 0)).toBe(0);
  });

  it('counts consecutive most-recent award weeks (7-day-adjacent)', () => {
    const subs = [
      wk('2026-01-04', 9000),
      wk('2026-01-11', 9000),
      wk('2026-01-18', 9000),
    ];
    expect(currentAwardStreak(subs, 2026, 4800)).toBe(3);
  });

  it('breaks the streak on a below-target week', () => {
    const subs = [
      wk('2026-01-04', 9000),
      wk('2026-01-11', 1000), // below target — not an award week
      wk('2026-01-18', 9000),
      wk('2026-01-25', 9000), // most recent 2 are consecutive
    ];
    expect(currentAwardStreak(subs, 2026, 4800)).toBe(2);
  });

  it('breaks on a calendar gap (missing week)', () => {
    const subs = [
      wk('2026-01-04', 9000),
      // gap — 01-11 missing entirely
      wk('2026-01-18', 9000),
      wk('2026-01-25', 9000),
    ];
    expect(currentAwardStreak(subs, 2026, 4800)).toBe(2);
  });

  it('ignores draft weeks', () => {
    const subs = [
      wk('2026-01-18', 9000, 'draft'),
      wk('2026-01-11', 9000),
      wk('2026-01-04', 9000),
    ];
    expect(currentAwardStreak(subs, 2026, 4800)).toBe(2);
  });
});

describe('resolveGoalsCelebration', () => {
  const baseSubs = [
    wk('2026-01-04', 9000),
    wk('2026-01-11', 9000),
    wk('2026-01-18', 9000),
    wk('2026-01-25', 9000),
  ];

  it('fires annual when YTD meets the personal commitment', () => {
    const r = resolveGoalsCelebration({
      hierarchy: { personal: { api: 600000 } },
      ytdTotals: { api: 612000 },
      submissions: [],
      year: 2026,
      weeklyTarget: 4800,
      celebrated: { annual: false, streakMax: 0 },
    });
    expect(r).toEqual({ type: 'annual' });
  });

  it('does NOT re-fire annual once celebrated', () => {
    const r = resolveGoalsCelebration({
      hierarchy: { personal: { api: 600000 } },
      ytdTotals: { api: 612000 },
      submissions: [],
      year: 2026,
      weeklyTarget: 4800,
      celebrated: { annual: true, streakMax: 0 },
    });
    expect(r).toBeNull();
  });

  it('fires the weekly-target streak milestone (4 weeks)', () => {
    const r = resolveGoalsCelebration({
      hierarchy: { personal: { api: 600000 } },
      ytdTotals: { api: 100000 }, // annual not hit
      submissions: baseSubs,
      year: 2026,
      weeklyTarget: 4800,
      celebrated: { annual: false, streakMax: 0 },
    });
    expect(r).toEqual({ type: 'streak', milestone: 4 });
  });

  it('prioritises annual over streak when both qualify', () => {
    const r = resolveGoalsCelebration({
      hierarchy: { personal: { api: 30000 } },
      ytdTotals: { api: 36000 }, // annual hit
      submissions: baseSubs, // also a 4-week streak
      year: 2026,
      weeklyTarget: 4800,
      celebrated: { annual: false, streakMax: 0 },
    });
    expect(r).toEqual({ type: 'annual' });
  });

  it('returns null when nothing qualifies', () => {
    const r = resolveGoalsCelebration({
      hierarchy: { personal: { api: 600000 } },
      ytdTotals: { api: 1000 },
      submissions: [wk('2026-01-04', 9000)], // only 1 award week (< 4)
      year: 2026,
      weeklyTarget: 4800,
      celebrated: { annual: false, streakMax: 0 },
    });
    expect(r).toBeNull();
  });

  it('exports the goals weekly-streak milestone set', () => {
    expect(GOALS_WEEKLY_STREAK_MILESTONES).toEqual([4, 8, 12]);
  });
});
