import { describe, it, expect } from 'vitest';
import { trophyRoom, arenaStanding, arenaTiles, meTiles, BADGE_TROPHY_KIND } from '../competeModel';
import { BADGE_DEFINITIONS, LEVEL_THRESHOLDS } from '../../gamificationConfig';
import { TROPHY_KINDS } from '../../../components/fr/trophies/trophyKinds';

describe('trophyRoom', () => {
  it('no engine doc yet: every badge locked, Rookie at 0 points, streak unknown', () => {
    const r = trophyRoom(null);
    expect(r.badges.every((b) => !b.earned)).toBe(true);
    expect(r.points).toBe(0);
    expect(r.level.title).toBe('Rookie');
    expect(r.streak).toBeNull();
    expect(r.earnedCount).toBe(1); // Rookie is the starting level
    expect(r.closest.every((t) => t.group === 'Level')).toBe(true);
  });

  it('lights exactly the badges the engine wrote — nothing is earned client-side', () => {
    const r = trophyRoom({ badges: ['first_submission', 'big_week'], points: 900, weeklyStreak: 3 });
    expect(r.badges.filter((b) => b.earned).map((b) => b.key)).toEqual(['first_submission', 'big_week']);
    // A streak of 3 does not light On a Roll: only the engine's write does.
    expect(r.badges.find((b) => b.key === 'streak_4').earned).toBe(false);
  });

  it('streak badges carry measured progress and "weeks to go"; others carry none', () => {
    const r = trophyRoom({ badges: ['first_submission', 'streak_4'], points: 0, weeklyStreak: 6 });
    const committed = r.badges.find((b) => b.key === 'streak_8');
    expect(committed.progress).toBe(75);
    expect(committed.left).toBe('2 more weeks in a row');
    expect(r.badges.find((b) => b.key === 'big_week').progress).toBeNull();
    expect(r.nextStreak).toBe(8);
    expect(r.closest[0].key).toBe('streak_8');
  });

  it('levels: earned up to the current one, progress toward the next', () => {
    const r = trophyRoom({ badges: [], points: 2940, weeklyStreak: 0 });
    expect(r.level.title).toBe('Pro');
    expect(r.next.title).toBe('Elite');
    expect(r.toNext).toBe(560);
    expect(r.levels.map((l) => l.earned)).toEqual([true, true, true, false, false]);
    expect(r.levels.find((l) => l.label === 'Elite').progress).toBe(72);
    const top = trophyRoom({ points: 9000 });
    expect(top.next).toBeNull();
    expect(top.toNext).toBeNull();
  });

  it('every mapped badge has engine copy and a real trophy kind (no drawn-but-uncomputed badges)', () => {
    Object.entries(BADGE_TROPHY_KIND).forEach(([key, kind]) => {
      expect(BADGE_DEFINITIONS.find((d) => d.key === key)).toBeTruthy();
      expect(TROPHY_KINDS).toContain(kind);
    });
    LEVEL_THRESHOLDS.forEach((l) => expect(TROPHY_KINDS).toContain(`level-${l.title.toLowerCase()}`));
    // Canvas badges no engine computes are NOT shown.
    ['dial_king', 'sharpshooter', 'mdrt_bound', 'untouchable', 'consistent'].forEach((k) => expect(BADGE_TROPHY_KIND[k]).toBeUndefined());
  });

  it('an earned engine badge with no trophy art is listed by name, not dropped', () => {
    const r = trophyRoom({ badges: ['first_submission', 'tenure_floor_met'], points: 10 });
    expect(r.other.map((o) => o.label)).toEqual(['Floor Cleared']);
  });

  it('monotonic: adding an engine badge or points never lowers the earned count', () => {
    const keys = Object.keys(BADGE_TROPHY_KIND);
    for (let mask = 0; mask < 1 << keys.length; mask += 37) {
      const owned = keys.filter((_, i) => mask & (1 << i));
      for (const pts of [0, 499, 500, 1500, 3499, 7000]) {
        const base = trophyRoom({ badges: owned, points: pts }).earnedCount;
        keys.forEach((k) => expect(trophyRoom({ badges: [...owned, k], points: pts }).earnedCount).toBeGreaterThanOrEqual(base));
        expect(trophyRoom({ badges: owned, points: pts + 600 }).earnedCount).toBeGreaterThanOrEqual(base);
      }
    }
  });
});

describe('arenaStanding / arenaTiles', () => {
  const board = {
    week: [],
    mtd: [{ agentId: 'x', rank: 1, periodApi: 9000 }],
    qtd: [],
    ytd: [
      { agentId: 'a', rank: 1, periodApi: 120000, apps: 6 },
      { agentId: 'b', rank: 2, periodApi: 90000, apps: 4 },
      { agentId: 'me', rank: 3, periodApi: 74500.5, apps: 3, previousRank: 5 },
      { agentId: 'd', rank: 4, periodApi: 20000, apps: 1 },
    ],
  };

  it('own rank, API and the gap to the agent above; movement since the last update', () => {
    const s = arenaStanding(board, 'me');
    expect(s.ytd).toMatchObject({ rank: 3, of: 4, api: 74500.5, apps: 3, aboveRank: 2, moved: 2 });
    expect(s.ytd.gapUp).toBeCloseTo(15499.5);
    const tiles = arenaTiles(s, 'ytd');
    expect(tiles[0]).toMatchObject({ value: '#3 of 4', note: 'Up 2 since last update' });
    expect(tiles[2]).toMatchObject({ label: 'To pass #2', note: '#2 is on TTD 90,000' });
  });

  it('not on the board: rank unknown ("—"), never #0; the leader has no gap', () => {
    const s = arenaStanding(board, 'me');
    expect(s.week.rank).toBeNull();
    expect(arenaTiles(s, 'week')[0].value).toBeNull();
    const lead = arenaStanding(board, 'a');
    expect(arenaTiles(lead, 'ytd')[2]).toMatchObject({ value: null, note: 'You lead the branch' });
  });
});

describe('meTiles', () => {
  it('level, points, streak and trophies from the engine doc', () => {
    const tiles = meTiles(trophyRoom({ badges: ['first_submission'], points: 520, weeklyStreak: 1 }));
    expect(tiles.map((t) => t.value)).toEqual(['Associate', 520, 1, '3 of 14']);
    expect(tiles[0].note).toBe('980 points to Pro');
    expect(tiles[2].note).toBe('week in a row');
  });
});
