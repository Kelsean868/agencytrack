'use strict';

// Jest unit tests for the CJS ranking-logic twin
// (functions/leaderboard/rankingLogic.js). Direct exercise of each exported
// function + the rankForLeaderboard composition. ESM↔CJS cross-check parity
// lives separately in src/lib/productionReport/__tests__/cross-check-cjs.test.js
// (run under vitest, which interops both ESM + CJS).

const {
  getPeriodBoundaries,
  filterSubmissionsByPeriod,
  extractTotalProductionCredit,
  computeAgentTotals,
  rankAgentsByApi,
  rankForLeaderboard,
} = require('../leaderboard/rankingLogic');

// Reference: Fri 2026-05-15 10:00 UTC = Fri 06:00 TT. Most-recent TT Sunday = 2026-05-10.
const REF = new Date('2026-05-15T10:00:00Z');

function mkSub(agentId, weekStarting, api, apps = 1) {
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness:  { api, apps },
    pppIncreases: { apiIncrease: 0, apps: 0 },
    lumpsums:     { apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
  };
}

function mkAgent(id, name, unitId = null, provisioning = false) {
  return { id, name, role: 'agent', unitId, provisioning };
}

// ── getPeriodBoundaries ──────────────────────────────────────────────────────

describe('getPeriodBoundaries', () => {
  test('week → Sunday 00:00 TT → Saturday 23:59:59.999 TT', () => {
    const { start, end } = getPeriodBoundaries('week', REF);
    // Sunday 2026-05-10 00:00 TT = 04:00 UTC
    expect(start.toISOString()).toBe('2026-05-10T04:00:00.000Z');
    // Saturday 2026-05-16 23:59:59.999 TT = 2026-05-17 03:59:59.999 UTC
    expect(end.toISOString()).toBe('2026-05-17T03:59:59.999Z');
  });

  test('mtd → May 1 00:00 TT → end of today TT', () => {
    const { start } = getPeriodBoundaries('mtd', REF);
    expect(start.toISOString()).toBe('2026-05-01T04:00:00.000Z');
  });

  test('quarter → Apr 1 00:00 TT (Q2 includes May)', () => {
    const { start } = getPeriodBoundaries('quarter', REF);
    expect(start.toISOString()).toBe('2026-04-01T04:00:00.000Z');
  });

  test('ytd → Jan 1 00:00 TT', () => {
    const { start } = getPeriodBoundaries('ytd', REF);
    expect(start.toISOString()).toBe('2026-01-01T04:00:00.000Z');
  });

  test('throws on unknown period', () => {
    expect(() => getPeriodBoundaries('decade', REF)).toThrow('Unknown period');
  });
});

// ── filterSubmissionsByPeriod ────────────────────────────────────────────────

describe('filterSubmissionsByPeriod', () => {
  test('week: includes 2026-05-10 (Sun), excludes 2026-05-03 (prior Sun)', () => {
    const subs = [
      mkSub('a1', '2026-05-10', 100),
      mkSub('a1', '2026-05-03', 200),
    ];
    const result = filterSubmissionsByPeriod(subs, 'week', REF);
    expect(result).toHaveLength(1);
    expect(result[0].weekStarting).toBe('2026-05-10');
  });

  test('mtd: includes 2026-05-03 + 2026-05-10, excludes 2026-04-26', () => {
    const subs = [
      mkSub('a1', '2026-05-03', 100),
      mkSub('a1', '2026-05-10', 200),
      mkSub('a1', '2026-04-26', 300),
    ];
    const result = filterSubmissionsByPeriod(subs, 'mtd', REF);
    expect(result).toHaveLength(2);
  });

  test('quarter: includes 2026-04-05 (Q2), excludes 2026-03-29 (Q1)', () => {
    const subs = [
      mkSub('a1', '2026-04-05', 100),
      mkSub('a1', '2026-03-29', 200),
    ];
    const result = filterSubmissionsByPeriod(subs, 'quarter', REF);
    expect(result).toHaveLength(1);
    expect(result[0].weekStarting).toBe('2026-04-05');
  });

  test('ytd: includes 2026-01-04, excludes 2025-12-28', () => {
    const subs = [
      mkSub('a1', '2026-01-04', 100),
      mkSub('a1', '2025-12-28', 200),
    ];
    const result = filterSubmissionsByPeriod(subs, 'ytd', REF);
    expect(result).toHaveLength(1);
    expect(result[0].weekStarting).toBe('2026-01-04');
  });

  test('null/missing weekStarting filtered out', () => {
    const subs = [
      { agentId: 'a1', weekStarting: null, totalProductionCredit: 100 },
      { agentId: 'a1', totalProductionCredit: 100 },
      mkSub('a1', '2026-05-10', 100),
    ];
    const result = filterSubmissionsByPeriod(subs, 'week', REF);
    expect(result).toHaveLength(1);
  });

  test('null submissions input → empty array (no crash)', () => {
    expect(filterSubmissionsByPeriod(null, 'week', REF)).toEqual([]);
    expect(filterSubmissionsByPeriod(undefined, 'week', REF)).toEqual([]);
  });
});

// ── extractTotalProductionCredit ─────────────────────────────────────────────

describe('extractTotalProductionCredit', () => {
  test('reads stored totalProductionCredit when present', () => {
    expect(extractTotalProductionCredit({ totalProductionCredit: 12345 })).toBe(12345);
  });

  test('V2 sums nb.api + ppp.apiIncrease + lmps.apiCredit', () => {
    const sub = {
      newBusiness:  { api: 100 },
      pppIncreases: { apiIncrease: 30 },
      lumpsums:     { apiCredit: 20 },
    };
    expect(extractTotalProductionCredit(sub)).toBe(150);
  });

  test('V1 falls back to apiSold', () => {
    expect(extractTotalProductionCredit({ apiSold: 500 })).toBe(500);
  });

  test('null / empty → 0', () => {
    expect(extractTotalProductionCredit(null)).toBe(0);
    expect(extractTotalProductionCredit({})).toBe(0);
  });
});

// ── computeAgentTotals ───────────────────────────────────────────────────────

describe('computeAgentTotals', () => {
  test('V2 aggregates nb / ppp / lmps + totalApi + totalApps', () => {
    const subs = [
      {
        version: 2,
        newBusiness:  { api: 100, apps: 2 },
        pppIncreases: { apiIncrease: 10, apps: 1 },
        lumpsums:     { apiCredit: 5 },
        totalProductionCredit: 115,
      },
    ];
    const t = computeAgentTotals(subs);
    expect(t.totalApi).toBe(115);
    expect(t.nb.api).toBe(100);
    expect(t.nb.apps).toBe(2);
    expect(t.ppp.api).toBe(10);
    expect(t.ppp.apps).toBe(1);
    expect(t.lmps.api).toBe(5);
    expect(t.totalApps).toBe(3); // 2 nb + 1 ppp
  });

  test('multiple submissions sum correctly', () => {
    const subs = [
      { version: 2, newBusiness: { api: 100, apps: 1 }, pppIncreases: { apiIncrease: 0, apps: 0 }, lumpsums: { apiCredit: 0 }, totalProductionCredit: 100 },
      { version: 2, newBusiness: { api: 50,  apps: 2 }, pppIncreases: { apiIncrease: 0, apps: 0 }, lumpsums: { apiCredit: 0 }, totalProductionCredit: 50 },
    ];
    const t = computeAgentTotals(subs);
    expect(t.totalApi).toBe(150);
    expect(t.totalApps).toBe(3);
  });

  test('empty input → all-zero totals', () => {
    const t = computeAgentTotals([]);
    expect(t).toEqual({
      totalApi: 0,
      totalCommission: 0,
      totalApps: 0,
      nb: { api: 0, apps: 0 },
      ppp: { api: 0, apps: 0 },
      lmps: { api: 0 },
    });
  });

  test('null input → all-zero totals (no crash)', () => {
    expect(computeAgentTotals(null).totalApi).toBe(0);
    expect(computeAgentTotals(undefined).totalApi).toBe(0);
  });
});

// ── rankAgentsByApi ──────────────────────────────────────────────────────────

describe('rankAgentsByApi', () => {
  function totals(api, apps) {
    return { totalApi: api, totalApps: apps, totalCommission: 0, nb: { api, apps }, ppp: { api: 0, apps: 0 }, lmps: { api: 0 } };
  }

  test('ranks descending by totalApi', () => {
    const ranked = rankAgentsByApi([
      { agentId: 'a1', agentName: 'Alpha', unitId: 'u1', totals: totals(100, 2) },
      { agentId: 'a2', agentName: 'Beta',  unitId: 'u1', totals: totals(300, 5) },
      { agentId: 'a3', agentName: 'Gamma', unitId: 'u2', totals: totals(200, 3) },
    ]);
    expect(ranked.map((r) => r.agentId)).toEqual(['a2', 'a3', 'a1']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test('tie in totalApi → higher totalApps wins', () => {
    const ranked = rankAgentsByApi([
      { agentId: 'a1', agentName: 'Alpha', unitId: 'u1', totals: totals(100, 2) },
      { agentId: 'a2', agentName: 'Beta',  unitId: 'u1', totals: totals(100, 5) },
    ]);
    expect(ranked[0].agentId).toBe('a2');
  });

  test('tie in api + apps → alphabetical name asc', () => {
    const ranked = rankAgentsByApi([
      { agentId: 'a1', agentName: 'Zara',  unitId: 'u1', totals: totals(100, 3) },
      { agentId: 'a2', agentName: 'Alice', unitId: 'u1', totals: totals(100, 3) },
    ]);
    expect(ranked[0].agentName).toBe('Alice');
  });

  test('rankWithinUnit is per-unit', () => {
    const ranked = rankAgentsByApi([
      { agentId: 'a1', agentName: 'A1', unitId: 'u1', totals: totals(300, 3) },
      { agentId: 'a2', agentName: 'A2', unitId: 'u1', totals: totals(100, 1) },
      { agentId: 'a3', agentName: 'A3', unitId: 'u2', totals: totals(200, 2) },
    ]);
    const byId = Object.fromEntries(ranked.map((r) => [r.agentId, r]));
    expect(byId['a1'].rankWithinUnit).toBe(1);
    expect(byId['a2'].rankWithinUnit).toBe(2);
    expect(byId['a3'].rankWithinUnit).toBe(1);
  });

  test('empty input → empty array', () => {
    expect(rankAgentsByApi([])).toEqual([]);
    expect(rankAgentsByApi(null)).toEqual([]);
  });
});

// ── rankForLeaderboard — composition ─────────────────────────────────────────

describe('rankForLeaderboard', () => {
  test('ranks active agents only, excludes managers + provisioning stubs', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'u1'),
      mkAgent('a2', 'Beta',  'u1'),
      { id: 'm1', role: 'unit_manager', name: 'UM' },
      { id: 'a9', role: 'agent', name: 'Stub', unitId: 'u1', provisioning: true },
    ];
    const subs = [
      mkSub('a1', '2026-05-10', 200),
      mkSub('a2', '2026-05-10', 100),
      mkSub('m1', '2026-05-10', 500), // ignored — not an agent
      mkSub('a9', '2026-05-10', 900), // ignored — provisioning stub
    ];
    const result = rankForLeaderboard(subs, users, 'week', REF);
    expect(result.map((r) => r.agentId)).toEqual(['a1', 'a2']);
    expect(result[0].periodApi).toBe(200);
    expect(result[1].periodApi).toBe(100);
  });

  test('zero-API agents are ranked (not excluded)', () => {
    const users = [mkAgent('a1', 'Alpha', 'u1'), mkAgent('a2', 'Beta', 'u1')];
    const subs  = [mkSub('a1', '2026-05-10', 200)];
    const result = rankForLeaderboard(subs, users, 'week', REF);
    expect(result).toHaveLength(2);
    expect(result[1].agentId).toBe('a2');
    expect(result[1].periodApi).toBe(0);
    expect(result[1].rank).toBe(2);
  });

  test('tie handling matches rankAgentsByApi', () => {
    const users = [mkAgent('a1', 'Zara', 'u1'), mkAgent('a2', 'Alice', 'u1')];
    const subs  = [
      mkSub('a1', '2026-05-10', 100, 3),
      mkSub('a2', '2026-05-10', 100, 3),
    ];
    const result = rankForLeaderboard(subs, users, 'week', REF);
    expect(result[0].name).toBe('Alice'); // alphabetical tie-break
  });

  test('empty input → empty array (no crash)', () => {
    expect(rankForLeaderboard([], [], 'week', REF)).toEqual([]);
    expect(rankForLeaderboard(null, null, 'ytd', REF)).toEqual([]);
  });

  test('return shape includes all leaderboard fields', () => {
    const users = [mkAgent('a1', 'Test Agent', 'u1')];
    const subs  = [mkSub('a1', '2026-05-10', 5000, 2)];
    const [entry] = rankForLeaderboard(subs, users, 'week', REF);
    expect(entry).toEqual({
      agentId:        'a1',
      name:           'Test Agent',
      unitId:         'u1',
      periodApi:      5000,
      apps:           2,
      rank:           1,
      rankWithinUnit: 1,
    });
  });

  test('agent.unitId null is preserved as null (not "none")', () => {
    const users = [mkAgent('a1', 'Unassigned', null)];
    const subs  = [mkSub('a1', '2026-05-10', 100)];
    const [entry] = rankForLeaderboard(subs, users, 'week', REF);
    expect(entry.unitId).toBeNull();
  });

  test('falls back name → email → id', () => {
    const users = [
      { id: 'a1', role: 'agent', name: '',  email: 'first@x.com', unitId: null },
      { id: 'a2', role: 'agent', name: null, email: '',          unitId: null },
    ];
    const subs = [mkSub('a1', '2026-05-10', 200), mkSub('a2', '2026-05-10', 100)];
    const result = rankForLeaderboard(subs, users, 'week', REF);
    expect(result[0].name).toBe('first@x.com');
    expect(result[1].name).toBe('a2');
  });
});
