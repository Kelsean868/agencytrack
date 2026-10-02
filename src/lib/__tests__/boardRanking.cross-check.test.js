import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM twin under test — the FR Leaderboard's client ranker (L-2, brief D7).
import { sortByMetric, TIE_ORDER, LEADERBOARD_BOARDS, BOARD_ORDER, rankBoard } from '../fr/leaderboardBoards';

// CJS source of truth — the aggregate's ranker (L-1, functions/leaderboard/boardMetrics.js).
const require = createRequire(import.meta.url);
const server = require('../../../functions/leaderboard/boardMetrics');

const ids = (rows) => rows.map((r) => r.agentId);

// Ties on every level: metric, each tie-break metric, name, then agentId.
const ROWS = [
  { agentId: 'z', name: 'Zed', unitId: 'u1', periodApi: 0, apps: 0, points: 50 },
  { agentId: 'b', name: 'Bea', unitId: 'u1', periodApi: 100, apps: 1, points: 10 },
  { agentId: 'a', name: 'Ann', unitId: 'u2', periodApi: 100, apps: 1, points: 10 },
  { agentId: 'c', name: 'Cal', unitId: null, periodApi: 100, apps: 2, points: 0 },
  { agentId: 'd', name: 'Dot', unitId: 'u2', periodApi: 0, apps: 3, points: 50 },
  { agentId: 'e2', name: 'Eve', unitId: 'u1', periodApi: 0, apps: 0, points: 0 },
  { agentId: 'e1', name: 'Eve', unitId: 'u1', periodApi: 0, apps: 0, points: 0 },
  { agentId: 'f', name: 'Fay', unitId: 'u2', periodApi: '100.00', apps: '1', points: undefined },
  { agentId: 'g', name: 'Gus', unitId: 'u1', periodApi: 33.33, apps: 0, points: 12 },
  { agentId: 'h', name: 'hal', unitId: 'u2', periodApi: 33.33, apps: 0, points: 12 },
];

// A broad deterministic set: small value ranges force many ties.
function rows(seed, n) {
  let a = seed >>> 0;
  const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const names = ['Ann', 'Bea', 'Cal', 'Dot', 'Eve', 'ann', 'Zoë', 'Ola'];
  return Array.from({ length: n }, (_, i) => ({
    agentId: `id${i}`,
    name: names[Math.floor(r() * names.length)],
    unitId: r() < 0.2 ? null : `u${Math.floor(r() * 3)}`,
    periodApi: Math.floor(r() * 4) * 1000,
    apps: Math.floor(r() * 3),
    points: Math.floor(r() * 4) * 25,
  }));
}

describe('ESM ≡ CJS — leaderboard board ranker (FR Leaderboard L-2, D7)', () => {
  it('tie order and board → metric map are identical', () => {
    expect([...TIE_ORDER]).toEqual([...server.TIE_ORDER]);
    for (const id of BOARD_ORDER) {
      expect(LEADERBOARD_BOARDS[id].metric, id).toBe(server.BOARD_METRIC[id]);
    }
    expect(Object.keys(server.BOARD_METRIC).sort()).toEqual([...BOARD_ORDER].sort());
  });

  for (const metric of ['points', 'periodApi', 'apps']) {
    it(`same order on the tie fixtures — ${metric}`, () => {
      expect(ids(sortByMetric(ROWS, metric))).toEqual(ids(server.sortByMetric(ROWS, metric)));
    });

    it(`same order on 200 generated branches — ${metric}`, () => {
      for (let s = 1; s <= 200; s++) {
        const set = rows(s, 3 + (s % 15));
        expect(ids(sortByMetric(set, metric)), `seed ${s}`).toEqual(ids(server.sortByMetric(set, metric)));
      }
    });
  }

  it('rankBoard(api) gives the rank and rankWithinUnit the aggregate writes', () => {
    // The aggregate's stored rank / rankWithinUnit are API-board order (L-1 periodEntries).
    const sorted = server.sortByMetric(ROWS, 'periodApi');
    const within = new Map();
    const expected = sorted.map((r, i) => {
      const k = r.unitId == null ? 'none' : r.unitId;
      within.set(k, (within.get(k) || 0) + 1);
      return [r.agentId, i + 1, within.get(k)];
    });
    expect(rankBoard(ROWS, 'api').map((e) => [e.agentId, e.rank, e.rankWithinUnit])).toEqual(expected);
  });
});
