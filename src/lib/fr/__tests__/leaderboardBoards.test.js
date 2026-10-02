import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_BOARDS, BOARD_ORDER, DEFAULT_BOARD, boardConfig, rankBoard, boardByPeriod, scopeBoard,
} from '../leaderboardBoards';
import { boardView, toPass } from '../leaderboardModel';

// FR Leaderboard L-2 — the board config (D10–D12) and the per-board ranking.

const entry = (agentId, unitId, periodApi, apps, points, previousRanks = null) => ({
  agentId, name: `Agent ${agentId}`, unitId, unitName: unitId, periodApi, apps, points,
  rank: 99, rankWithinUnit: 99, previousRank: 7, previousRanks,
});

describe('LEADERBOARD_BOARDS (D12 — one config drives every board)', () => {
  it('order is Activity · API · Apps and the screen opens on Activity (D10)', () => {
    expect([...BOARD_ORDER]).toEqual(['activity', 'api', 'apps']);
    expect(DEFAULT_BOARD).toBe('activity');
  });

  it('every board carries the same complete shape', () => {
    const keys = Object.keys(LEADERBOARD_BOARDS.activity).sort();
    for (const id of BOARD_ORDER) {
      expect(Object.keys(LEADERBOARD_BOARDS[id]).sort(), id).toEqual(keys);
      expect(LEADERBOARD_BOARDS[id].id).toBe(id);
    }
  });

  it('copy is the D11 table, verbatim', () => {
    const { activity, api, apps } = LEADERBOARD_BOARDS;
    expect([activity.label, activity.column, activity.secondColumn]).toEqual(['Activity', 'Points', 'Apps']);
    expect([api.label, api.column, api.secondColumn]).toEqual(['API', 'Settled API', 'Apps']);
    expect([apps.label, apps.column, apps.secondColumn]).toEqual(['Apps', 'Applications', 'Settled API']);
    expect(activity.title('this week')).toBe("Who's putting in the work this week.");
    expect(api.title('this month')).toBe("Who's leading on API this month.");
    expect(apps.title('this year')).toBe("Who's writing the most this year.");
    expect(activity.footer).toBe('Activity: ranked by points from everything you log in your branch — calls, appointments, fact finds, closing interviews and sales.');
    expect(api.footer).toBe('API: ranked by settled API from the policy ledger in your branch.');
    expect(apps.footer).toBe('Apps: ranked by applications from the policy ledger in your branch.');
    expect(activity.footerTail).toBe('Test accounts are left out.');
    expect(api.footerTail).toBe('Own and family policies are left out. Test accounts are left out.');
    expect(apps.footerTail).toBe(api.footerTail);
    expect(activity.emptyTitle('this quarter')).toBe('No activity logged this quarter yet');
    expect(api.emptyTitle('this quarter')).toBe('No settled business this quarter yet');
    expect(apps.emptyTitle('this quarter')).toBe('No applications this quarter yet');
    expect(activity.emptyLine).toBe('The board fills in as agents log their calls and meetings.');
    expect(api.emptyLine).toBe('The board fills in as policies settle in the ledger.');
    expect(apps.emptyLine).toBe('The board fills in as applications reach the ledger.');
    expect([activity.noun, api.noun, apps.noun]).toEqual(['points', 'settled API', 'applications']);
  });

  it('formats each board’s own figure', () => {
    const { activity, api, apps } = LEADERBOARD_BOARDS;
    expect(activity.format(1312)).toBe('1,312 pts');
    expect(api.format(22450.5)).toBe('TTD 22,450.5');
    expect(apps.format(1)).toBe('1 app');
    expect(apps.format(4)).toBe('4 apps');
    expect(activity.second({ apps: 2, periodApi: 9 })).toBe('2 apps');
    expect(apps.second({ apps: 2, periodApi: 9000 })).toBe('TTD 9,000');
  });

  it('an unknown board id throws instead of rendering a plausible default', () => {
    expect(() => boardConfig('rest-assured')).toThrow(/unknown board "rest-assured"/);
    expect(() => rankBoard([], 'nope')).toThrow();
  });
});

describe('rankBoard / boardByPeriod / scopeBoard', () => {
  const rows = [
    entry('a', 'u1', 900, 1, 10, { activity: 3, api: 1, apps: 2 }),
    entry('b', 'u2', 500, 3, 40, { activity: 1, api: 2, apps: 1 }),
    entry('c', 'u1', 100, 2, 30, { activity: 2, api: 3, apps: 3 }),
  ];

  it('ranks by the board, numbers units within the board, and maps previousRank to the board', () => {
    const activity = rankBoard(rows, 'activity');
    expect(activity.map((e) => [e.agentId, e.rank, e.rankWithinUnit, e.previousRank])).toEqual([
      ['b', 1, 1, 1], ['c', 2, 1, 2], ['a', 3, 2, 3],
    ]);
    const api = rankBoard(rows, 'api');
    expect(api.map((e) => [e.agentId, e.rank, e.previousRank])).toEqual([['a', 1, 1], ['b', 2, 2], ['c', 3, 3]]);
  });

  it('entries without previousRanks (MTD/QTD/YTD) carry previousRank null on every board', () => {
    expect(rankBoard([entry('a', 'u1', 1, 1, 1)], 'api')[0].previousRank).toBeNull();
  });

  it('keeps every other field and never changes its input', () => {
    const before = JSON.stringify(rows);
    const ranked = rankBoard(rows, 'apps');
    expect(JSON.stringify(rows)).toBe(before);
    expect(ranked[0]).toMatchObject({ agentId: 'b', unitName: 'u2', periodApi: 500, apps: 3, points: 40 });
  });

  it('boardByPeriod ranks every period; missing periods become empty', () => {
    const out = boardByPeriod({ week: rows, ytd: rows }, 'apps');
    expect(out.week.map((e) => e.agentId)).toEqual(['b', 'c', 'a']);
    expect(out.mtd).toEqual([]);
    expect(out.qtd).toEqual([]);
  });

  it('scopeBoard: unit scope keeps the unit and ranks it by rankWithinUnit; leader is the top value', () => {
    const ranked = rankBoard(rows, 'activity');
    expect(scopeBoard(ranked, 'branch', null, 'points')).toMatchObject({ leader: 40, count: 3 });
    const unit = scopeBoard(ranked, 'unit', 'u1', 'points');
    expect(unit.displayed.map((e) => [e.agentId, e.rank])).toEqual([['c', 1], ['a', 2]]);
    expect(unit.leader).toBe(30);
    expect(scopeBoard(ranked, 'unit', null, 'points')).toMatchObject({ displayed: [], leader: 0, count: 0 });
  });
});

describe('boardView', () => {
  const byPeriod = { week: [], mtd: [], qtd: [], ytd: [
    entry('a', 'u1', 900, 1, 10), entry('b', 'u2', 500, 3, 40), entry('me', 'u1', 100, 2, 30),
  ] };
  const view = (board) => boardView({ byPeriod, activeField: 'ytd', board, scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: false });

  it('the standing, to-pass and share follow the chosen board', () => {
    expect(view('activity').you).toMatchObject({ rank: 2, value: 30 });
    expect(view('activity').toPass).toMatchObject({ lead: false, gap: 10, aboveName: 'Agent b', aboveRank: 1 });
    expect(view('api').you).toMatchObject({ rank: 3, value: 100 });
    expect(view('api').toPass).toMatchObject({ gap: 400, aboveName: 'Agent b' });
    expect(view('apps').share).toMatchObject({ mine: 2, total: 6 });
    expect(view('apps').podium.map((e) => e.agentId)).toEqual(['b', 'me', 'a']);
  });

  it('isEmpty is per board', () => {
    const zeroPts = { week: [], mtd: [], qtd: [], ytd: [entry('me', 'u1', 100, 1, 0)] };
    const v = (board) => boardView({ byPeriod: zeroPts, activeField: 'ytd', board, scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: false });
    expect(v('activity').isEmpty).toBe(true);
    expect(v('api').isEmpty).toBe(false);
  });

  it('you at rank 9: the agent above you (rank 8) is listed once, not twice', () => {
    const ytd = Array.from({ length: 10 }, (_, i) => entry(i === 8 ? 'me' : `x${i}`, 'u1', 1000 - i * 10, 0, 0));
    const v = boardView({ byPeriod: { week: [], mtd: [], qtd: [], ytd }, activeField: 'ytd', board: 'api', scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: false });
    const ranks = v.rows.filter((r) => r.type === 'row').map((r) => r.entry.rank);
    expect(ranks).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(v.rows.some((r) => r.type === 'gap')).toBe(false);
  });

  it('the phone you-bar gap is measured in the board’s metric', () => {
    // 10 agents so the viewer (last on points) sits below the phone's visible set.
    const many = Array.from({ length: 9 }, (_, i) => entry(`x${i}`, 'u1', 0, 0, 100 - i));
    const ytd = [...many, entry('me', 'u1', 5000, 0, 50)];
    const v = boardView({ byPeriod: { week: [], mtd: [], qtd: [], ytd }, activeField: 'ytd', board: 'activity', scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: true });
    expect(v.aroundMeMobile.state).toBe('CLUSTER_2_LAST');
    expect(v.aroundMeMobile.gapToNext).toBe(42); // x8 has 92 points, you have 50
  });
});

// Amendment A2 — "to pass" on a tie. The ranker (D7) still ranks you below the
// agent you are tied with, so the gap is 0; `tied` lets the view word it.
describe('toPass on a tie (A2)', () => {
  // 'a' and 'me' are level on every metric; the name breaks the tie, so 'me' is #2 on all three boards.
  const tiedYtd = [
    entry('a', 'u1', 500, 5, 50), entry('me', 'u1', 500, 5, 50), entry('c', 'u1', 100, 1, 10),
  ];
  const view = (board, ytd = tiedYtd) => boardView({ byPeriod: { week: [], mtd: [], qtd: [], ytd }, activeField: 'ytd', board, scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: false });

  it.each(['activity', 'api', 'apps'])('%s: level with the agent above is tied, with a gap of 0', (board) => {
    expect(view(board).you.rank).toBe(2);
    expect(view(board).toPass).toEqual({ lead: false, tied: true, gap: 0, aboveName: 'Agent a', aboveRank: 1, aboveValue: expect.any(Number), pct: 100 });
  });

  it.each(['activity', 'api', 'apps'])('%s: behind the agent above is not tied (unchanged)', (board) => {
    const behind = [entry('a', 'u1', 900, 9, 90), entry('me', 'u1', 500, 5, 50), entry('c', 'u1', 100, 1, 10)];
    const t = view(board, behind).toPass;
    expect(t).toMatchObject({ lead: false, tied: false, aboveName: 'Agent a', aboveRank: 1 });
    expect(t.gap).toBeGreaterThan(0);
  });

  it('leading is still just { lead: true }', () => {
    const lead = [entry('me', 'u1', 900, 9, 90), entry('a', 'u1', 500, 5, 50)];
    expect(view('api', lead).toPass).toEqual({ lead: true });
  });

  it('a tie with no name for the agent above still reads as tied', () => {
    const standing = { ytd: { rank: 2, value: 40, aboveRank: 1, aboveValue: 40, gapUp: 0 } };
    expect(toPass(standing, 'ytd', [])).toMatchObject({ lead: false, tied: true, gap: 0, aboveName: null, aboveRank: 1 });
  });
});
