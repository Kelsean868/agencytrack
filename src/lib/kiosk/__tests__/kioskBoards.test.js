import { describe, it, expect } from 'vitest';
import {
  kioskBoardRows, kioskPanelHasBoardRows, kioskPeriodEntries, kioskActivityCounts, KIOSK_BOARD_PANELS,
} from '../kioskBoards';
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
  });

  it('weeklyActivity is shown when any week entry has a positive activity count', () => {
    const withActivity = (activity) => ({ week: [{ ...entry('a', 'Ann', 0, 0, 0), activity }] });
    expect(kioskPanelHasBoardRows(withActivity({ names: 0, calls: 0, ffi: 0, ci: 1 }), 'weeklyActivity')).toBe(true);
    expect(kioskPanelHasBoardRows(withActivity({ names: 2, calls: 0, ffi: 0, ci: 0 }), 'weeklyActivity')).toBe(true);
  });

  it('weeklyActivity is hidden for zero counts, a missing `activity` (pre-L-1b) or no aggregate, even with points', () => {
    const zero = { week: [{ ...entry('a', 'Ann', 100, 1, 80), activity: { names: 0, calls: 0, ffi: 0, ci: 0 } }] };
    expect(kioskPanelHasBoardRows(zero, 'weeklyActivity')).toBe(false);
    expect(kioskPanelHasBoardRows({ week: ROWS }, 'weeklyActivity')).toBe(false);
    expect(kioskPanelHasBoardRows(null, 'weeklyActivity')).toBe(false);
    expect(kioskPanelHasBoardRows({ mtd: [{ ...ROWS[0], activity: { names: 5, calls: 5, ffi: 5, ci: 5 } }] }, 'weeklyActivity')).toBe(false);
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

describe('kioskPeriodEntries', () => {
  it('returns the raw array for the mapped period, unranked and unfiltered', () => {
    expect(kioskPeriodEntries({ week: ROWS }, 'week')).toBe(ROWS);
    expect(kioskPeriodEntries({ qtd: ROWS }, 'quarter')).toBe(ROWS);
  });

  it('returns [] for a missing aggregate, array or period', () => {
    expect(kioskPeriodEntries(null, 'week')).toEqual([]);
    expect(kioskPeriodEntries({}, 'week')).toEqual([]);
    expect(kioskPeriodEntries({ week: ROWS }, 'decade')).toEqual([]);
  });
});

describe('kioskActivityCounts', () => {
  it('returns the four counts and both column totals', () => {
    expect(kioskActivityCounts({ activity: { names: 4, calls: 10, ffi: 1, ci: 2 } })).toEqual({
      names: 4, calls: 10, ffi: 1, ci: 2, prospecting: 14, conversions: 3,
    });
  });

  it('returns null — never zeros — when the entry has no activity object', () => {
    expect(kioskActivityCounts({})).toBeNull();
    expect(kioskActivityCounts(null)).toBeNull();
    expect(kioskActivityCounts({ activity: null })).toBeNull();
  });

  it('treats non-numeric counts as 0', () => {
    expect(kioskActivityCounts({ activity: { names: 'x', calls: undefined, ffi: 2, ci: null } }))
      .toMatchObject({ names: 0, calls: 0, ffi: 2, ci: 0, prospecting: 0, conversions: 2 });
  });
});
