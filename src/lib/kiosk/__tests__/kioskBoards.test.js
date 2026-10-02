import { describe, it, expect } from 'vitest';
import { kioskBoardRows, kioskPanelHasBoardRows, KIOSK_BOARD_PANELS } from '../kioskBoards';
import { rankBoard } from '../../fr/leaderboardBoards';

const entry = (agentId, name, periodApi, apps, points) => ({
  agentId, name, unitId: 'u1', unitName: 'Unit', periodApi, apps, points, rank: 0, rankWithinUnit: 0,
});

const ROWS = [
  entry('a', 'Ann', 100, 1, 10),
  entry('b', 'Bea', 100, 2, 0),
  entry('c', 'Cal', 0, 0, 80),
  entry('d', 'Dot', 0, 0, 0),
];

describe('kioskBoardRows', () => {
  it('ranks the API board with the shared ranker (metric, then apps, points, name)', () => {
    const rows = kioskBoardRows({ ytd: ROWS }, 'ytd', 'api');
    expect(rows.map((r) => r.agentId)).toEqual(['b', 'a']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('is exactly rankBoard filtered to rows with a value — no third ranker', () => {
    const shared = rankBoard(ROWS, 'api').filter((e) => e.periodApi > 0 || e.apps > 0);
    expect(kioskBoardRows({ week: ROWS }, 'week', 'api')).toEqual(shared);
  });

  it('ranks the Activity board by points', () => {
    const rows = kioskBoardRows({ week: ROWS }, 'week', 'activity');
    expect(rows.map((r) => r.agentId)).toEqual(['c', 'a']);
  });

  it('maps the kiosk quarter period to the aggregate qtd array', () => {
    const agg = { qtd: [entry('q', 'Quinn', 5, 1, 0)], ytd: [entry('y', 'Yuri', 5, 1, 0)] };
    expect(kioskBoardRows(agg, 'quarter', 'api').map((r) => r.agentId)).toEqual(['q']);
  });

  it('returns [] for a missing aggregate, a missing array or an unknown period', () => {
    expect(kioskBoardRows(null, 'ytd', 'api')).toEqual([]);
    expect(kioskBoardRows(undefined, 'ytd', 'api')).toEqual([]);
    expect(kioskBoardRows({}, 'ytd', 'api')).toEqual([]);
    expect(kioskBoardRows({ ytd: ROWS }, 'decade', 'api')).toEqual([]);
  });

  it('does not change the stored aggregate', () => {
    const agg = { week: ROWS.map((r) => ({ ...r })) };
    const before = JSON.stringify(agg);
    kioskBoardRows(agg, 'week', 'api');
    expect(JSON.stringify(agg)).toBe(before);
  });
});

describe('kioskPanelHasBoardRows', () => {
  it('covers exactly the four ranked panels and the weekly activity panel', () => {
    expect(Object.keys(KIOSK_BOARD_PANELS).sort()).toEqual(
      ['mtdLeaderboards', 'qtdLeaderboards', 'weekLeaderboards', 'weeklyActivity', 'ytdLeaderboards'],
    );
  });

  it('is true when the panel\'s own period has a row with a value', () => {
    expect(kioskPanelHasBoardRows({ week: ROWS }, 'weekLeaderboards')).toBe(true);
    expect(kioskPanelHasBoardRows({ week: ROWS }, 'weeklyActivity')).toBe(true);
  });

  it('is false for a missing aggregate or a period with no rows', () => {
    expect(kioskPanelHasBoardRows(null, 'ytdLeaderboards')).toBe(false);
    expect(kioskPanelHasBoardRows({ week: ROWS }, 'ytdLeaderboards')).toBe(false);
    expect(kioskPanelHasBoardRows({ week: [entry('z', 'Zed', 0, 0, 0)] }, 'weekLeaderboards')).toBe(false);
  });

  it('is false for a panel key that is not a board panel', () => {
    expect(kioskPanelHasBoardRows({ week: ROWS }, 'branchOverview')).toBe(false);
  });
});
