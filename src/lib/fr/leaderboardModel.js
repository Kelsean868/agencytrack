import { formatCurrency } from '../../utils/formatters';
import { weekNumber } from '../../utils/dateHelpers';
import { ARENA_PERIODS, arenaStanding } from './competeModel';
import { boardConfig, boardByPeriod, scopeBoard } from './leaderboardBoards';
import { computeAroundMe, VISIBLE_MAX_DESKTOP, VISIBLE_MAX_MOBILE } from '../leaderboard/aroundMeLogic';

/**
 * leaderboardModel — pure shapers for the FR Leaderboard (R2-11; three boards
 * in FR Leaderboard L-2, canvas D3-Leaderboard / M3-Leaderboard v43).
 * Everything is derived at read time from data the leaderboard already loads
 * (the branch aggregate, last week's champions doc). No reads, no writes.
 *
 * Each shaper takes the board's `metric` (the aggregate entry field the board
 * ranks by: 'points' | 'periodApi' | 'apps'); the default 'periodApi' is the
 * API board. Ranks per board come from leaderboardBoards.rankBoard (D7).
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
 * @param {object|null} standing  arenaStanding(byPeriod, uid, metric)
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
 * (branch-wide), measured in the board's metric. The name of the agent above
 * is looked up in the same period's branch ranking by rank.
 *
 * `tied` (Amendment A2): true when you are not leading and the gap to the agent
 * above is 0 or less. The ranker (D7) still ranks you below that agent (tie-break
 * on the other metrics, then name), so the view words a tie as "1 more to pass".
 *
 * @returns {null | { lead: true } | { lead: false, tied: boolean, gap: number, aboveName: string|null,
 *           aboveRank: number, aboveValue: number, pct: number }}
 */
export function toPass(standing, activeField, branchRanking) {
  const s = standing?.[activeField];
  if (!s || s.rank == null) return null;
  if (s.rank === 1) return { lead: true };
  if (s.aboveRank == null) return null;
  const above = (branchRanking ?? []).find((e) => e.rank === s.aboveRank) ?? null;
  const aboveValue = num(s.aboveValue ?? s.aboveApi);
  const value = num(s.value ?? s.api);
  const gap = num(s.gapUp);
  return {
    lead: false,
    tied: gap <= 0,
    gap,
    aboveName: above?.name ?? null,
    aboveRank: s.aboveRank,
    aboveValue,
    pct: aboveValue > 0 ? Math.min(100, Math.max(0, (value / aboveValue) * 100)) : 0,
  };
}

/**
 * Your share of the DISPLAYED ranking (the chosen scope): mine ÷ the sum of
 * the board's metric over that ranking. Sum 0 → null (the donut is hidden).
 */
export function shareOfScope(ranking, viewerUid, scope, metric = 'periodApi') {
  const rows = Array.isArray(ranking) ? ranking : [];
  const total = rows.reduce((sum, e) => sum + num(e[metric]), 0);
  if (!(total > 0)) return null;
  const mine = num(rows.find((e) => e.agentId === viewerUid)?.[metric]);
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
  { key: 'topActivity', kind: 'big-week', title: 'Top activity', format: (v) => `${num(v).toLocaleString('en-TT')} ${num(v) === 1 ? 'point' : 'points'}` },
]);

/**
 * Last week's champions (tenant-wide `weeklyChampions/{prevWeekStarting}`).
 * Since L-1 (brief D9) `topActivity.value` is POINTS; `topAPI` is ledger
 * settled API and `topApps` ledger applications.
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
export function pctOfLeader(entry, leaderValue, metric = 'periodApi') {
  return leaderValue > 0 ? Math.min(100, Math.max(0, (num(entry?.[metric]) / leaderValue) * 100)) : 0;
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
 * When you sit just below the shown ranks, the cluster's first row (the agent
 * above you) is already in the list; it is not shown twice (L-2).
 */
export function boardRows({ tail, aroundMe, leaderValue, viewerUid, phone, metric = 'periodApi' }) {
  const shown = phone ? tail.slice(0, 4) : tail.slice(0, 5);
  const row = (entry) => ({ type: 'row', entry, pct: pctOfLeader(entry, leaderValue, metric), isYou: entry.agentId === viewerUid });
  const rows = shown.map(row);
  if (phone || !aroundMe) return rows;
  if (aroundMe.state === 'CLUSTER_3' || aroundMe.state === 'CLUSTER_2_LAST') {
    if (aroundMe.missingCount > 0) {
      rows.push({ type: 'gap', text: `+${aroundMe.missingCount} ${aroundMe.missingCount === 1 ? 'agent' : 'agents'}` });
    }
    const listed = new Set(shown.map((e) => e.agentId));
    aroundMe.rows.filter((entry) => !listed.has(entry.agentId)).forEach((entry) => rows.push(row(entry)));
  } else if (aroundMe.state === 'CLUSTER_UNRANKED' && aroundMe.totalCount > 0) {
    rows.push({ type: 'unranked' });
  }
  return rows;
}

/**
 * Everything the FR Leaderboard shows for one board, period and scope — the
 * container (FrLeaderboard) and the harness scene both call this, so the
 * screen and its sample cannot drift.
 *
 * @param {object} args
 * @param {object} args.byPeriod      the aggregate's { week, mtd, qtd, ytd }
 * @param {'week'|'mtd'|'qtd'|'ytd'} args.activeField
 * @param {string} args.board         a LEADERBOARD_BOARDS id
 * @param {'branch'|'unit'} args.scope
 * @param {string|null} args.targetUnitId
 * @param {string|null} args.viewerUid
 * @param {boolean} args.phone
 */
export function boardView({ byPeriod, activeField, board, scope, targetUnitId, viewerUid, phone }) {
  const config = boardConfig(board);
  const { metric } = config;
  const ranked = boardByPeriod(byPeriod, board);
  const branchRanking = ranked[activeField] ?? [];
  const { displayed, leader, count } = scopeBoard(branchRanking, scope, targetUnitId, metric);
  const standing = arenaStanding(ranked, viewerUid, metric);
  const mine = standing[activeField] ?? null;
  const aroundMeDesktop = computeAroundMe({ ranking: displayed, viewerUid, visibleMax: VISIBLE_MAX_DESKTOP });
  const aroundMeMobile = computeAroundMe({ ranking: displayed, viewerUid, visibleMax: VISIBLE_MAX_MOBILE });
  // computeAroundMe measures the chase gap in API; re-measure it in the board's metric.
  const chased = aroundMeMobile.rows[aroundMeMobile.rows.indexOf(aroundMeMobile.viewerEntry) - 1] ?? null;
  const mobileGap = chased && aroundMeMobile.viewerEntry
    ? Math.max(0, num(chased[metric]) - num(aroundMeMobile.viewerEntry[metric]))
    : null;

  return {
    config,
    metric,
    branchRanking,
    ranking: displayed,
    count,
    isEmpty: displayed.length === 0 || displayed.every((e) => num(e[metric]) === 0),
    podium: displayed.slice(0, 3),
    rows: boardRows({ tail: displayed.slice(3, 8), aroundMe: aroundMeDesktop, leaderValue: leader, viewerUid, phone, metric }),
    you: { rank: mine?.rank ?? null, of: mine?.of ?? 0, value: mine?.value ?? 0, movedNote: movedNote(mine) },
    toPass: toPass(standing, activeField, branchRanking),
    rankCols: rankColumns(standing, activeField),
    share: shareOfScope(displayed, viewerUid, scope, metric),
    aroundMeMobile: { ...aroundMeMobile, gapToNext: mobileGap },
  };
}
