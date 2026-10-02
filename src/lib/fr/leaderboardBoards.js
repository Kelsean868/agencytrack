import { formatCurrency } from '../../utils/formatters';

/**
 * leaderboardBoards — the FR Leaderboard's boards (FR Leaderboard L-2, brief
 * D10–D12; canvas D3-Leaderboard / M3-Leaderboard v43).
 *
 * ONE config object drives every board. Adding a board (e.g. Rest Assured) is
 * one entry here plus one field on the aggregate (L-1) — no `if (board === …)`
 * chains in views (D12). Copy is the brief's D11 table, verbatim.
 *
 * The aggregate (`leaderboards/{branchId}`, L-1) stores metrics; ranks per
 * board are derived here (D7) with the SAME order as the server's
 * `sortByMetric` (functions/leaderboard/boardMetrics.js): the board's metric
 * desc, then the remaining metrics in the fixed order periodApi → apps → points
 * desc, then name, then agentId. Guarded by
 * src/lib/__tests__/boardRanking.cross-check.test.js.
 */

const count = (n) => Math.round(Number(n) || 0).toLocaleString('en-TT');
const appsLabel = (n) => `${count(n)} ${Math.round(Number(n) || 0) === 1 ? 'app' : 'apps'}`;
const LEDGER_FOOTER_TAIL = 'Own and family policies are left out. Test accounts are left out.';

export const LEADERBOARD_BOARDS = Object.freeze({
  activity: Object.freeze({
    id: 'activity',
    label: 'Activity',
    metric: 'points',
    column: 'Points',
    secondColumn: 'Apps',
    noun: 'points',
    format: (n) => `${count(n)} pts`,
    second: (e) => appsLabel(e?.apps),
    secondShort: (e) => count(e?.apps),
    title: (period) => `Who's putting in the work ${period}.`,
    footer: 'Activity: ranked by points from everything you log in your branch — calls, appointments, fact finds, closing interviews and sales.',
    footerTail: 'Test accounts are left out.',
    emptyTitle: (period) => `No activity logged ${period} yet`,
    emptyLine: 'The board fills in as agents log their calls and meetings.',
    // The aggregate counts reports skipped for a missing branch; they only
    // affect points, so only this board says so.
    showsSkippedReports: true,
    wideSecond: false,
    // Words after your own value in the "you" block (canvas: "TTD 22,450 settled").
    youSuffix: '',
  }),
  api: Object.freeze({
    id: 'api',
    label: 'API',
    metric: 'periodApi',
    column: 'Settled API',
    secondColumn: 'Apps',
    noun: 'settled API',
    format: (n) => formatCurrency(Number(n) || 0),
    second: (e) => appsLabel(e?.apps),
    secondShort: (e) => count(e?.apps),
    title: (period) => `Who's leading on API ${period}.`,
    footer: 'API: ranked by settled API from the policy ledger in your branch.',
    footerTail: LEDGER_FOOTER_TAIL,
    emptyTitle: (period) => `No settled business ${period} yet`,
    emptyLine: 'The board fills in as policies settle in the ledger.',
    showsSkippedReports: false,
    wideSecond: false,
    // Words after your own value in the "you" block (canvas: "TTD 22,450 settled").
    youSuffix: ' settled',
  }),
  apps: Object.freeze({
    id: 'apps',
    label: 'Apps',
    metric: 'apps',
    column: 'Applications',
    secondColumn: 'Settled API',
    noun: 'applications',
    format: (n) => appsLabel(n),
    second: (e) => formatCurrency(Number(e?.periodApi) || 0),
    secondShort: (e) => formatCurrency(Number(e?.periodApi) || 0),
    title: (period) => `Who's writing the most ${period}.`,
    footer: 'Apps: ranked by applications from the policy ledger in your branch.',
    footerTail: LEDGER_FOOTER_TAIL,
    emptyTitle: (period) => `No applications ${period} yet`,
    emptyLine: 'The board fills in as applications reach the ledger.',
    showsSkippedReports: false,
    wideSecond: true,
    // Words after your own value in the "you" block (canvas: "TTD 22,450 settled").
    youSuffix: '',
  }),
});

/** Board switch order (D10): Activity · API · Apps. The screen opens on the first. */
export const BOARD_ORDER = Object.freeze(['activity', 'api', 'apps']);
export const DEFAULT_BOARD = BOARD_ORDER[0];

/** The board's config. An unknown id is a programming error — it throws. */
export function boardConfig(id) {
  const board = LEADERBOARD_BOARDS[id];
  if (!board) throw new Error(`leaderboardBoards: unknown board "${id}"`);
  return board;
}

// ── D7 ranker — client twin of functions/leaderboard/boardMetrics.js ─────────

export const TIE_ORDER = Object.freeze(['periodApi', 'apps', 'points']);

/** Rows sorted for one metric (new array; rows are not changed). */
export function sortByMetric(rows, metric) {
  const order = [metric, ...TIE_ORDER.filter((m) => m !== metric)];
  return [...rows].sort((a, b) => {
    for (const m of order) {
      const diff = (Number(b[m]) || 0) - (Number(a[m]) || 0);
      if (diff !== 0) return diff;
    }
    const byName = String(a.name).localeCompare(String(b.name));
    if (byName !== 0) return byName;
    return String(a.agentId).localeCompare(String(b.agentId));
  });
}

/**
 * One period's entries ranked for a board: `rank` and `rankWithinUnit` follow
 * the board, and `previousRank` becomes last week's rank ON THIS BOARD
 * (`previousRanks[board]`, WEEK entries only — null elsewhere, as stored).
 * Every other field is kept, so the shared helpers (around-me, standing) work
 * on the result unchanged.
 */
export function rankBoard(entries, boardId) {
  const { metric } = boardConfig(boardId);
  const withinUnit = new Map();
  return sortByMetric(Array.isArray(entries) ? entries.filter(Boolean) : [], metric).map((e, i) => {
    const unitKey = e.unitId == null ? 'none' : e.unitId;
    const rankWithinUnit = (withinUnit.get(unitKey) || 0) + 1;
    withinUnit.set(unitKey, rankWithinUnit);
    return {
      ...e,
      rank: i + 1,
      rankWithinUnit,
      previousRank: e.previousRanks ? (e.previousRanks[boardId] ?? null) : null,
    };
  });
}

/** Every period of the aggregate ranked for one board. */
export function boardByPeriod(byPeriod, boardId) {
  const out = {};
  for (const key of ['week', 'mtd', 'qtd', 'ytd']) {
    out[key] = rankBoard(byPeriod?.[key], boardId);
  }
  return out;
}

/**
 * The displayed ranking for a scope (mirrors scopeFilter.applyScope, for a
 * board): branch → as ranked; unit → that unit only, ranked by
 * `rankWithinUnit`. `leader` is the top value of the board's metric.
 */
export function scopeBoard(ranking, scope, targetUnitId, metric) {
  const safe = Array.isArray(ranking) ? ranking : [];
  let displayed = safe;
  if (scope === 'unit') {
    displayed = targetUnitId
      ? safe.filter((e) => e.unitId === targetUnitId).map((e) => ({ ...e, rank: e.rankWithinUnit }))
      : [];
  }
  return { displayed, leader: Number(displayed[0]?.[metric]) || 0, count: displayed.length };
}
