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
 */

// The kiosk's period names (productionReport keys) → the aggregate's array keys.
const AGGREGATE_PERIOD_KEY = Object.freeze({ week: 'week', mtd: 'mtd', quarter: 'qtd', ytd: 'ytd' });

/** Rotation panel key → the kiosk period + board it shows. */
export const KIOSK_BOARD_PANELS = Object.freeze({
  ytdLeaderboards: Object.freeze({ period: 'ytd', board: 'api' }),
  qtdLeaderboards: Object.freeze({ period: 'quarter', board: 'api' }),
  mtdLeaderboards: Object.freeze({ period: 'mtd', board: 'api' }),
  weekLeaderboards: Object.freeze({ period: 'week', board: 'api' }),
  weeklyActivity: Object.freeze({ period: 'week', board: 'activity' }),
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
 * The ranked rows a kiosk panel shows. `aggregate` is the doc data (or null /
 * undefined when the doc is missing — never fake data: that returns []).
 * Rows keep every aggregate field and gain `rank` for the board.
 */
export function kioskBoardRows(aggregate, period, board) {
  const key = AGGREGATE_PERIOD_KEY[period];
  const entries = key && aggregate ? aggregate[key] : null;
  if (!Array.isArray(entries)) return [];
  return rankBoard(entries, board).filter((e) => hasValue(e, board));
}

/** True when the rotation panel has at least one row to show. */
export function kioskPanelHasBoardRows(aggregate, panelKey) {
  const panel = KIOSK_BOARD_PANELS[panelKey];
  return !!panel && kioskBoardRows(aggregate, panel.period, panel.board).length > 0;
}
