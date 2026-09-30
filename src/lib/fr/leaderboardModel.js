import { formatCurrency } from '../../utils/formatters';
import { weekNumber } from '../../utils/dateHelpers';
import { ARENA_PERIODS } from './competeModel';

/**
 * leaderboardModel — pure shapers for the FR Leaderboard (R2-11, canvas
 * D3-Leaderboard / M3-Leaderboard). Everything is derived at read time from
 * data the leaderboard already loads (the branch aggregate, the displayed
 * scope ranking, `arenaStanding`, last week's champions doc). No reads, no
 * writes, no new ranking: ranks come from the aggregate as written.
 */

const SHORT = Object.freeze({ week: 'WK', mtd: 'MTD', qtd: 'QTD', ytd: 'YTD' });

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "Your rank in each period": one column per period from `arenaStanding`
 * (the ONLY per-period rank source). A missing rank → rank null.
 *
 * @param {object|null} standing  arenaStanding(byPeriod, uid)
 * @param {'week'|'mtd'|'qtd'|'ytd'} activeField
 */
export function rankColumns(standing, activeField) {
  return ARENA_PERIODS.map(({ id }) => {
    const s = standing?.[id] ?? null;
    return {
      id,
      label: SHORT[id],
      rank: s?.rank ?? null,
      of: s?.of ?? 0,
      active: id === activeField,
    };
  });
}

/**
 * "To pass the next agent" for the selected period, from `arenaStanding`
 * (branch-wide). The name of the agent above is looked up in the same
 * period's branch ranking by rank.
 *
 * @returns {null | { lead: true } | { lead: false, gap: number, aboveName: string|null,
 *           aboveRank: number, pct: number }}
 */
export function toPass(standing, activeField, branchRanking) {
  const s = standing?.[activeField];
  if (!s || s.rank == null) return null;
  if (s.rank === 1) return { lead: true };
  if (s.aboveRank == null) return null;
  const above = (branchRanking ?? []).find((e) => e.rank === s.aboveRank) ?? null;
  const aboveApi = num(s.aboveApi);
  return {
    lead: false,
    gap: num(s.gapUp),
    aboveName: above?.name ?? null,
    aboveRank: s.aboveRank,
    pct: aboveApi > 0 ? Math.min(100, Math.max(0, (num(s.api) / aboveApi) * 100)) : 0,
  };
}

/**
 * Your share of the DISPLAYED ranking (the chosen scope): mine ÷ the sum of
 * `periodApi` over that ranking. Sum 0 → null (the donut is hidden).
 */
export function shareOfScope(ranking, viewerUid, scope) {
  const rows = Array.isArray(ranking) ? ranking : [];
  const total = rows.reduce((sum, e) => sum + num(e.periodApi), 0);
  if (!(total > 0)) return null;
  const mine = num(rows.find((e) => e.agentId === viewerUid)?.periodApi);
  const pct = (mine / total) * 100;
  return {
    pct,
    pctLabel: `${Math.round(pct)}%`,
    mine,
    total,
    of: scope === 'unit' ? 'of the unit' : 'of the branch',
  };
}

const CHAMPION_CATEGORIES = Object.freeze([
  { key: 'topAPI', kind: 'aotm-api', title: 'Top API', format: (v) => formatCurrency(Math.round(num(v))) },
  { key: 'topApps', kind: 'aotm-apps', title: 'Top apps', format: (v) => `${num(v)} ${num(v) === 1 ? 'app' : 'apps'}` },
  { key: 'topActivity', kind: 'big-week', title: 'Top activity', format: (v) => `${num(v)} ${num(v) === 1 ? 'activity' : 'activities'}` },
]);

/**
 * Last week's champions (tenant-wide `weeklyChampions/{prevWeekStarting}`).
 * `topActivity.value` is a COUNT (FFI + CI + apps), never points.
 */
export function championsModel(champions) {
  const week = champions?.weekStarting ? weekNumber(champions.weekStarting) : null;
  return {
    heading: week ? `Week ${week} champions` : "Last week's champions",
    cards: CHAMPION_CATEGORIES.map((c) => {
      const winner = champions?.[c.key] ?? null;
      return {
        key: c.key,
        kind: c.kind,
        title: c.title,
        name: winner ? (winner.agentName ?? null) : null,
        value: winner ? c.format(winner.value) : null,
      };
    }),
  };
}

/** Shares of the leader for ranks 4–8 (and around-me rows), capped 0–100. */
export function pctOfLeader(entry, leaderApi) {
  return leaderApi > 0 ? Math.min(100, Math.max(0, (num(entry?.periodApi) / leaderApi) * 100)) : 0;
}

/** "Up N since last update" under your rank — same wording as the Arena header. */
export function movedNote(s) {
  if (!s || s.rank == null || s.moved == null) return null;
  if (s.moved === 0) return 'Same place as last update';
  return s.moved > 0 ? `Up ${s.moved} since last update` : `Down ${-s.moved} since last update`;
}

/**
 * The "Everyone else" rows: ranks 4–8 (phone 4–7) with % of the leader, then
 * the around-me cluster when you sit below them ("+N agents" gap row first),
 * or a single "not on the board" row when you are not in the ranking.
 */
export function boardRows({ tail, aroundMe, leaderApi, viewerUid, phone }) {
  const shown = phone ? tail.slice(0, 4) : tail.slice(0, 5);
  const rows = shown.map((entry) => ({ type: 'row', entry, pct: pctOfLeader(entry, leaderApi), isYou: entry.agentId === viewerUid }));
  if (phone || !aroundMe) return rows;
  if (aroundMe.state === 'CLUSTER_3' || aroundMe.state === 'CLUSTER_2_LAST') {
    if (aroundMe.missingCount > 0) {
      rows.push({ type: 'gap', text: `+${aroundMe.missingCount} ${aroundMe.missingCount === 1 ? 'agent' : 'agents'}` });
    }
    aroundMe.rows.forEach((entry) => rows.push({ type: 'row', entry, pct: pctOfLeader(entry, leaderApi), isYou: entry.agentId === viewerUid }));
  } else if (aroundMe.state === 'CLUSTER_UNRANKED' && aroundMe.totalCount > 0) {
    rows.push({ type: 'unranked' });
  }
  return rows;
}
