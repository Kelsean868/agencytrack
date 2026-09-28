import { BADGE_DEFINITIONS, LEVEL_THRESHOLDS, resolveLevel } from '../gamificationConfig';

/**
 * FR Compete / You model (FR-5). Pure — no React, no Firebase.
 *
 * Trophy room = what the EXISTING points engine has recorded on the agent's
 * own `leaderboard/{uid}` doc (functions/index.js onSubmissionWrite): its
 * `badges` array, `points` and `weeklyStreak`. Nothing is earned here — a
 * trophy is lit only when the engine wrote the key (FR-D10 honest numbers).
 *
 * Why the server doc and not BadgeGrid's `computeEarnedBadges`: the client
 * helper still uses the old MDRT thresholds (500,000 / 250,000) and reads
 * only v1 `apiSold`, so it disagrees with the engine (688,800 / 344,400,
 * canonical production reader). Badge names and "how you earn it" copy come
 * from BADGE_DEFINITIONS, the same config the engine uses.
 *
 * Badges the canvas draws that NO engine computes today (dial_king,
 * sharpshooter, mdrt_bound, untouchable, consistent) are not shown: a
 * trophy that can never light would be a fake.
 */

/** Engine badge key → trophy kind (src/components/fr/trophies/trophyKinds.js). */
export const BADGE_TROPHY_KIND = Object.freeze({
  first_submission: 'first-steps',
  streak_4: 'on-a-roll',
  streak_8: 'committed',
  streak_13: 'quarter-strong',
  top_apps_week: 'closer',
  big_week: 'big-week',
  century_dials: 'century',
  mdrt_pace: 'mdrt-pace',
  mdrt_qualified: 'mdrt-qualified',
});

/** Streak badges and the weeks each needs — progress rings come from `weeklyStreak`. */
export const STREAK_BADGES = Object.freeze({ streak_4: 4, streak_8: 8, streak_13: 13 });

const LEVEL_KIND = (title) => `level-${String(title).toLowerCase()}`;

function definition(key) {
  const d = BADGE_DEFINITIONS.find((b) => b.key === key);
  if (!d && import.meta.env.DEV) {
    // v3 rule 11: a missing definition must not render as a plausible badge.
    throw new Error(`[competeModel] badge "${key}" has no BADGE_DEFINITIONS entry`);
  }
  return d ?? null;
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object|null} entry  the agent's `leaderboard/{uid}` doc data, or null
 *   when the doc does not exist yet (no report submitted — everything locked).
 * @returns {{
 *   badges: object[], levels: object[], other: object[],
 *   earnedCount: number, total: number,
 *   points: number, level: object, next: object|null, toNext: number|null, levelPct: number,
 *   streak: number|null, nextStreak: number|null, closest: object[],
 * }}
 */
export function trophyRoom(entry) {
  const owned = new Set(Array.isArray(entry?.badges) ? entry.badges : []);
  const points = Math.max(0, num(entry?.points) ?? 0);
  const streak = entry ? Math.max(0, Math.floor(num(entry.weeklyStreak) ?? 0)) : null;

  const badges = Object.entries(BADGE_TROPHY_KIND).map(([key, kind]) => {
    const d = definition(key);
    const earned = owned.has(key);
    const needWeeks = STREAK_BADGES[key];
    const progress = !earned && needWeeks && streak != null ? Math.min(99, Math.floor((streak / needWeeks) * 100)) : null;
    return {
      key,
      kind,
      group: 'Badge',
      label: d?.label ?? key,
      how: d?.trigger ?? '',
      detail: d?.description ?? '',
      earned,
      progress,
      left: !earned && needWeeks && streak != null && streak < needWeeks ? `${needWeeks - streak} more ${needWeeks - streak === 1 ? 'week' : 'weeks'} in a row` : null,
    };
  });

  // Engine badges with no trophy art (e.g. tenure_floor_met): listed by name when earned.
  const other = [...owned]
    .filter((k) => !BADGE_TROPHY_KIND[k])
    .map((k) => {
      const d = BADGE_DEFINITIONS.find((b) => b.key === k);
      if (!d && import.meta.env.DEV) console.warn(`[competeModel] earned badge "${k}" has no BADGE_DEFINITIONS entry`);
      return { key: k, label: d?.label ?? k, how: d?.trigger ?? '' };
    });

  const level = resolveLevel(points);
  const next = LEVEL_THRESHOLDS.find((l) => l.threshold > points) ?? null;
  const toNext = next ? next.threshold - points : null;
  const span = next ? next.threshold - level.threshold : 0;
  const levelPct = next ? Math.max(0, Math.min(100, ((points - level.threshold) / span) * 100)) : 100;

  const levels = LEVEL_THRESHOLDS.map((l) => {
    const earned = points >= l.threshold;
    const isNext = next?.level === l.level;
    return {
      key: `level_${l.level}`,
      kind: LEVEL_KIND(l.title),
      group: 'Level',
      label: l.title,
      how: l.threshold === 0 ? 'Your starting level' : `Reach ${l.threshold.toLocaleString('en-TT')} points`,
      detail: `${l.threshold.toLocaleString('en-TT')} points`,
      earned,
      progress: isNext ? Math.min(99, Math.floor(levelPct)) : null,
      left: isNext ? `${toNext.toLocaleString('en-TT')} points to go` : null,
    };
  });

  const nextStreak = streak == null ? null : (Object.values(STREAK_BADGES).find((w) => w > streak) ?? null);

  // "Closest to unlocking": locked items with measured progress, nearest first.
  const closest = [...badges, ...levels]
    .filter((t) => !t.earned && t.progress != null)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  const earnedCount = badges.filter((b) => b.earned).length + levels.filter((l) => l.earned).length;
  return {
    badges,
    levels,
    other,
    earnedCount,
    total: badges.length + levels.length,
    points,
    level,
    next,
    toNext,
    levelPct,
    streak,
    nextStreak,
    closest,
  };
}

export const ARENA_PERIODS = Object.freeze([
  { id: 'week', label: 'This week' },
  { id: 'mtd', label: 'This month' },
  { id: 'qtd', label: 'This quarter' },
  { id: 'ytd', label: 'This year' },
]);

/**
 * The agent's own standing in each period of the branch leaderboard aggregate
 * (`leaderboards/{branchId}`, the same doc the Leaderboard screen reads).
 * Not on the board (nothing settled yet, or a test account) → rank null.
 */
export function arenaStanding(byPeriod, uid) {
  const out = {};
  ARENA_PERIODS.forEach(({ id }) => {
    const rows = Array.isArray(byPeriod?.[id]) ? [...byPeriod[id]] : [];
    rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    const mine = uid ? rows.find((r) => r.agentId === uid) : null;
    if (!mine || !Number.isFinite(mine.rank)) {
      out[id] = { rank: null, of: rows.length, api: null, apps: null, gapUp: null, moved: null };
      return;
    }
    const above = rows.filter((r) => Number.isFinite(r.rank) && r.rank < mine.rank).pop() ?? null;
    const api = num(mine.periodApi) ?? 0;
    out[id] = {
      rank: mine.rank,
      of: rows.length,
      api,
      apps: num(mine.apps),
      gapUp: above ? Math.max(0, (num(above.periodApi) ?? 0) - api) : null,
      aboveRank: above?.rank ?? null,
      aboveApi: above ? (num(above.periodApi) ?? 0) : null,
      moved: Number.isFinite(mine.previousRank) ? mine.previousRank - mine.rank : null,
    };
  });
  return out;
}

const whole = (n) => Math.round(n).toLocaleString('en-TT');

/** Arena header tiles for one period. */
export function arenaTiles(standing, periodId = 'ytd') {
  const s = standing?.[periodId];
  const label = ARENA_PERIODS.find((p) => p.id === periodId)?.label ?? periodId;
  if (!s) return [];
  const movedNote = s.moved == null || s.moved === 0
    ? (s.moved === 0 ? 'Same place as last update' : null)
    : s.moved > 0 ? `Up ${s.moved} since last update` : `Down ${-s.moved} since last update`;
  return [
    { id: 'rank', label: `Your rank · ${label.toLowerCase()}`, value: s.rank == null ? null : `#${s.rank} of ${s.of}`, unit: 'text', note: s.rank == null ? 'Not on the board yet — settled API puts you there' : movedNote },
    { id: 'api', label: `Your API · ${label.toLowerCase()}`, value: s.api, unit: 'ttd', note: s.apps == null ? null : `${s.apps} ${s.apps === 1 ? 'app' : 'apps'}` },
    {
      id: 'gap',
      label: s.aboveRank ? `To pass #${s.aboveRank}` : 'To pass the next agent',
      value: s.rank == null ? null : s.gapUp,
      unit: 'ttd',
      note: s.rank === 1 ? 'You lead the branch' : s.aboveApi != null ? `#${s.aboveRank} is on TTD ${whole(s.aboveApi)}` : null,
    },
  ];
}

/** Me header tiles — level, points, report streak, trophies (all from the engine doc). */
export function meTiles(room) {
  if (!room) return [];
  return [
    { id: 'level', label: 'Your level', value: room.level.title, unit: 'text', note: room.next ? `${room.toNext.toLocaleString('en-TT')} points to ${room.next.title}` : 'Top level' },
    { id: 'points', label: 'Points', value: room.points, unit: 'count', note: 'From your weekly reports' },
    { id: 'streak', label: 'Report streak', value: room.streak, unit: 'count', note: room.streak == null ? 'No report yet' : `${room.streak === 1 ? 'week' : 'weeks'} in a row` },
    { id: 'trophies', label: 'Trophies', value: `${room.earnedCount} of ${room.total}`, unit: 'text', note: 'Badges and levels earned' },
  ];
}
