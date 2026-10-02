import { rankBoard } from '../fr/leaderboardBoards';

/**
 * kioskBoards — the kiosk's view of the leaderboard aggregate
 * (`tenants/{tid}/leaderboards/{branchId}`, FR Leaderboard L-3, brief D13).
 *
 * The aggregate stores metrics per agent per period (ledger settled API, ledger
 * apps, activity points). The kiosk ranks them here with the SHARED ranker
 * (`rankBoard` in src/lib/fr/leaderboardBoards.js) — the same order the server
 * and the FR Leaderboard use: the board's metric desc, then API, apps, points
 * desc, then name, then agentId. There is no third copy of the ranker.
 *
 * The Weekly Activity slide is the exception (amendment A1): it shows the four
 * activity counts per agent, which the shared ranker does not rank, so the panel
 * sorts them locally from `kioskPeriodEntries` / `kioskActivityCounts`.
 */

// The kiosk's period names (productionReport keys) → the aggregate's array keys.
const AGGREGATE_PERIOD_KEY = Object.freeze({ week: 'week', mtd: 'mtd', quarter: 'qtd', ytd: 'ytd' });

/** Rotation panel key → the kiosk period + board it shows. */
export const KIOSK_BOARD_PANELS = Object.freeze({
  ytdLeaderboards: Object.freeze({ period: 'ytd', board: 'api' }),
  qtdLeaderboards: Object.freeze({ period: 'quarter', board: 'api' }),
  mtdLeaderboards: Object.freeze({ period: 'mtd', board: 'api' }),
  weekLeaderboards: Object.freeze({ period: 'week', board: 'api' }),
  // The two-column Weekly Activity slide shows the four activity counts, not a
  // ranked board (amendment A1): its rows come from `activity`, not `points`.
  weeklyActivity: Object.freeze({ period: 'week', board: 'activityCounts' }),
});

const num = (v) => Number(v) || 0;

// The aggregate lists every branch participant, zeros included. A board shows
// only agents who have something on it: points for Activity; settled API or apps
// for the production boards.
function hasValue(entry, board) {
  return board === 'activity'
    ? num(entry.points) > 0
    : num(entry.periodApi) > 0 || num(entry.apps) > 0;
}

/**
 * The raw period entries of the aggregate, unranked and unfiltered. `[]` when the
 * aggregate (or the period's array) is missing.
 */
export function kioskPeriodEntries(aggregate, period) {
  const key = AGGREGATE_PERIOD_KEY[period];
  const entries = key && aggregate ? aggregate[key] : null;
  return Array.isArray(entries) ? entries : [];
}

/**
 * The Weekly Activity counts of one aggregate entry (amendment A1): names, calls,
 * FFIs, CIs, plus the two column totals. Returns null when the entry has no
 * `activity` object (an aggregate written before the L-1b deploy) — such an
 * entry contributes nothing; zeros are never invented for it.
 */
export function kioskActivityCounts(entry) {
  const a = entry && entry.activity;
  if (!a || typeof a !== 'object') return null;
  const names = num(a.names);
  const calls = num(a.calls);
  const ffi = num(a.ffi);
  const ci = num(a.ci);
  return { names, calls, ffi, ci, prospecting: names + calls, conversions: ffi + ci };
}

/**
 * The ranked rows a kiosk panel shows. `aggregate` is the doc data (or null /
 * undefined when the doc is missing — never fake data: that returns []).
 * Rows keep every aggregate field and gain `rank` for the board.
 */
export function kioskBoardRows(aggregate, period, board) {
  const entries = kioskPeriodEntries(aggregate, period);
  if (entries.length === 0) return [];
  return rankBoard(entries, board).filter((e) => hasValue(e, board));
}

/** True when the rotation panel has at least one row to show. */
export function kioskPanelHasBoardRows(aggregate, panelKey) {
  const panel = KIOSK_BOARD_PANELS[panelKey];
  if (!panel) return false;
  if (panel.board === 'activityCounts') {
    // Shown when any entry has a positive activity count in either column.
    return kioskPeriodEntries(aggregate, panel.period).some((e) => {
      const c = kioskActivityCounts(e);
      return !!c && (c.prospecting > 0 || c.conversions > 0);
    });
  }
  return kioskBoardRows(aggregate, panel.period, panel.board).length > 0;
}
