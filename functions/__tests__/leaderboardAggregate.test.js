'use strict';

// Unit tests for the leaderboard-aggregate CF logic.
// Targets the pure helpers (groupByBranch / buildLeaderboardDoc) and the
// composed compute flow with firebase-admin mocked. The CF trigger wiring
// (scheduled + onCall context-validation) is exercised via direct handler
// invocation against the mocked admin SDK.

// ── firebase-admin mock (no real Firestore) ──────────────────────────────────

const firestoreData = {}; // path → array of docs (for collection queries)
const firestoreDocs = {}; // doc-path → data (for db.doc().get())
const queryLog = [];      // every collection query run: { path, filters }

const mockBatch = {
  ops: [],
  set(ref, data) { this.ops.push({ type: 'set', ref, data }); return this; },
  async commit() { /* no-op for tests */ return null; },
};

function makeQuery(collectionPath) {
  return {
    _path: collectionPath,
    _filters: [],
    where(field, op, value) { this._filters.push({ field, op, value }); return this; },
    async get() {
      queryLog.push({ path: this._path, filters: [...this._filters] });
      const all = firestoreData[this._path] || [];
      const filtered = all.filter((d) =>
        this._filters.every((f) => {
          const v = d[f.field];
          if (f.op === '==') return v === f.value;
          if (f.op === '>=') return v >= f.value;
          if (f.op === '<=') return v <= f.value;
          if (f.op === 'in') return f.value.includes(v);
          throw new Error(`mock: unsupported op ${f.op}`);
        })
      );
      return { docs: filtered.map((d) => ({ id: d.id, data: () => d })) };
    },
  };
}

const mockFirestore = () => ({
  collection: (path) => makeQuery(path),
  doc:        (path) => ({
    path,
    async get() { return { exists: !!firestoreDocs[path], data: () => firestoreDocs[path] }; },
    async set(data) { firestoreDocs[path] = data; },
  }),
  batch:      () => { mockBatch.ops = []; return mockBatch; },
});

jest.mock('firebase-admin', () => ({
  apps: [{}], // already-initialized so leaderboardAggregate doesn't reinitialize
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore()), {
    FieldValue: { serverTimestamp: () => '<serverTimestamp>' },
  }),
}));

// firebase-functions mock — we only need the .pubsub.schedule.onRun + https.onCall builders
jest.mock('firebase-functions/v1', () => ({
  pubsub: {
    schedule: () => ({ timeZone: () => ({ onRun: (fn) => ({ _onRun: fn }) }) }),
  },
  https: {
    onCall: (fn) => ({ _onCall: fn }),
    HttpsError: class HttpsError extends Error {
      constructor(code, message) { super(message); this.code = code; }
    },
  },
}));

// ── Load AFTER mocks ──────────────────────────────────────────────────────────

const { _internals, recomputeLeaderboardOnDemand } =
  require('../leaderboard/leaderboardAggregate');
const {
  isParticipant,
  groupByBranch,
  buildLeaderboardDoc,
  computeAndWriteLeaderboards,
  priorWeekStartingString,
} = _internals;
const { ledgerCreditsByAgent, weekPointsByAgent, weekCountsByAgent } = require('../leaderboard/boardMetrics');

const ctxOf = ({ policies = [], submissions = [], dailies = new Map() } = {}) => ({
  creditsByAgent: ledgerCreditsByAgent(policies),
  weekPointsByAgent: weekPointsByAgent(submissions, dailies),
  weekCountsByAgent: weekCountsByAgent(submissions, dailies),
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkSub(id, agentId, weekStarting, api, apps = 1) {
  return {
    id,
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

function mkAgent(id, name, branchId, unitId = null, provisioning = false) {
  return { id, role: 'agent', name, branchId, unitId, provisioning };
}

function mkUM(id, name, branchId) {
  return { id, role: 'unit_manager', name, branchId, unitId: id, unitName: `Unit ${id}` };
}

function mkTestAgent(id, name, branchId, unitId = null) {
  return { id, role: 'agent', name, branchId, unitId, provisioning: false, isTestAccount: true };
}

// L-1: API + Apps come from settled ledger policies (D2/D3).
function mkPolicy(id, agentId, dateIssued, api, extra = {}) {
  return {
    id, agentId, dateIssued,
    status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: api,
    ...extra,
  };
}

// L-1: a daily entry (points for weeks with no submitted report, D5 ruling).
function mkDay(date, weekStarting, fields = {}) {
  return { date, weekStarting, ...fields };
}

function resetStore() {
  for (const k of Object.keys(firestoreData)) delete firestoreData[k];
  for (const k of Object.keys(firestoreDocs)) delete firestoreDocs[k];
  queryLog.length = 0;
  mockBatch.ops = [];
}

// REF inside current calendar year — use a Sunday in the current quarter.
// Use a fixed REF for determinism.
const REF = new Date('2026-05-15T10:00:00Z');
const WK_SUN = '2026-05-10';
const PREV_WK_SUN = '2026-05-03';

// ── groupByBranch ────────────────────────────────────────────────────────────

describe('groupByBranch', () => {
  test('buckets each agent + each submission by branchId', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      mkUM('u1', 'UM South', 'south'),
      mkUM('u2', 'UM North', 'north'),
    ];
    const subs = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a2', WK_SUN, 200),
      mkSub('s3', 'a3', WK_SUN, 300),
    ];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect([...byBranch.keys()].sort()).toEqual(['north', 'south']);
    expect(byBranch.get('south').subs).toHaveLength(2);
    expect(byBranch.get('north').subs).toHaveLength(1);
    expect(byBranch.get('south').users.map((u) => u.id).sort()).toEqual(['a1', 'a2', 'u1']);
    expect(byBranch.get('north').users.map((u) => u.id).sort()).toEqual(['a3', 'u2']);
    expect(skippedNoBranch).toEqual({ count: 0, agentIds: [] });
  });

  test('excludes provisioning agents from grouping', () => {
    const users = [
      mkAgent('a1', 'Real', 'south'),
      mkAgent('a2', 'Stub', 'south', null, true),
    ];
    const subs = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 999)];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').users.map((u) => u.id)).toEqual(['a1']);
    // Submission from provisioning agent dropped (no branchId join) — and
    // counted as skipped because the provisioning stub isn't in branchByAgent
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['a1']);
    expect(skippedNoBranch.count).toBe(1);
    expect(skippedNoBranch.agentIds).toEqual(['a2']);
  });

  test('drops submissions from agents without branchId (migration gap) and counts them', () => {
    const users = [
      mkAgent('a1', 'WithBranch', 'south'),
      { id: 'a2', role: 'agent', name: 'NoBranch', provisioning: false }, // no branchId
    ];
    const subs = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 200)];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.size).toBe(1);
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['a1']);
    // The migration-gap agent's submission is dropped + observably counted
    expect(skippedNoBranch.count).toBe(1);
    expect(skippedNoBranch.agentIds).toEqual(['a2']);
  });

  test('skippedNoBranch dedupes agentIds across multiple submissions from the same agent', () => {
    const users = [
      mkAgent('a1', 'WithBranch', 'south'),
      { id: 'a2', role: 'agent', name: 'NoBranch', provisioning: false },
    ];
    // a2 has THREE submissions — all dropped, but agentIds collapses to one entry
    const subs = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a2', WK_SUN, 200),
      mkSub('s3', 'a2', '2026-05-03', 150),
      mkSub('s4', 'a2', '2026-04-26', 75),
    ];
    const { skippedNoBranch } = groupByBranch(subs, users);
    expect(skippedNoBranch.count).toBe(3);            // 3 dropped subs
    expect(skippedNoBranch.agentIds).toEqual(['a2']); // 1 distinct agent
  });

  test('submission with neither agentId nor userId counts as skipped (count=1, no agentId)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south')];
    const subs = [
      mkSub('s1', 'a1', WK_SUN, 100),
      // Orphan submission — no owning agent reference at all
      {
        id: 's2', weekStarting: WK_SUN, status: 'submitted', version: 2,
        newBusiness: { api: 999, apps: 1 },
        pppIncreases: { apiIncrease: 0, apps: 0 },
        lumpsums: { apiCredit: 0, commission: 0 },
        totalProductionCredit: 999,
      },
    ];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').subs).toHaveLength(1);
    expect(skippedNoBranch.count).toBe(1);
    expect(skippedNoBranch.agentIds).toEqual([]); // no agentId to record
  });

  test('D8: a deactivated user (active === false) is not a participant; active absent/true is', () => {
    const users = [
      mkAgent('on', 'On', 'south'),
      { ...mkAgent('off', 'Off', 'south'), active: false },
      { ...mkAgent('yes', 'Yes', 'south'), active: true },
    ];
    const subs = [mkSub('s1', 'on', WK_SUN, 1), mkSub('s2', 'off', WK_SUN, 1)];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').users.map((u) => u.id).sort()).toEqual(['on', 'yes']);
    expect(skippedNoBranch.agentIds).toEqual(['off']);
    expect(isParticipant({ ...mkAgent('x', 'X', 'south'), active: false })).toBe(false);
  });

  test('empty inputs produce empty map + zero skip', () => {
    const { byBranch, skippedNoBranch } = groupByBranch([], []);
    expect(byBranch.size).toBe(0);
    expect(skippedNoBranch).toEqual({ count: 0, agentIds: [] });
  });

  test('s.userId is honoured as a fallback when s.agentId is absent', () => {
    const users = [mkAgent('a1', 'Alpha', 'south')];
    const subs = [{
      id: 's1', userId: 'a1', weekStarting: WK_SUN, status: 'submitted',
      version: 2,
      newBusiness: { api: 100, apps: 1 },
      pppIncreases: { apiIncrease: 0, apps: 0 },
      lumpsums: { apiCredit: 0, commission: 0 },
      totalProductionCredit: 100,
    }];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').subs).toHaveLength(1);
    expect(skippedNoBranch.count).toBe(0);
  });
});

// ── buildLeaderboardDoc ──────────────────────────────────────────────────────
//
// L-1: API + Apps from the ledger, points from activity. The decision-level
// math is covered in boardMetrics.test.js; these pin the doc shape.

describe('buildLeaderboardDoc', () => {
  test('returns { computedAt, sources, week, mtd, qtd, ytd }', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const doc = buildLeaderboardDoc(users, REF, ctxOf());
    expect(Object.keys(doc).sort()).toEqual(['computedAt', 'mtd', 'qtd', 'sources', 'week', 'ytd']);
    expect(doc.computedAt).toBe('<serverTimestamp>');
    expect(doc.sources).toEqual({ api: 'ledger', apps: 'ledger', points: 'activity' });
  });

  test('each period entry has the consumer shape (L-1 adds points + previousRanks; L-1b adds activity)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const ctx = ctxOf({
      policies: [mkPolicy('p1', 'a1', '2026-05-11', 100)],
      dailies: new Map([['a1', [mkDay('2026-05-11', WK_SUN, { ciConducted: 1 })]]]),
    });
    const doc = buildLeaderboardDoc(users, REF, ctx);
    expect(doc.week[0]).toEqual({
      agentId:        'a1',
      name:           'Alpha',
      unitId:         'u1',
      unitName:       'Unit u1',
      periodApi:      100,
      apps:           1,
      points:         10,
      activity:       { names: 0, calls: 0, ffi: 0, ci: 1 },
      rank:           1,
      rankWithinUnit: 1,
      previousRank:   1,
      previousRanks:  { activity: 1, api: 1, apps: 1 }, // prior week all 0: name decides (Alpha < UM)
    });
    expect(doc.ytd[0]).toMatchObject({ previousRank: null, previousRanks: null });
  });

  test('participants with no production in period still appear (rank N, periodApi=0)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkAgent('a2', 'Beta', 'south', 'u1')];
    const doc = buildLeaderboardDoc(users, REF, ctxOf({ policies: [mkPolicy('p1', 'a1', '2026-05-11', 500)] }));
    const a2 = doc.week.find((e) => e.agentId === 'a2');
    expect(a2).toMatchObject({ periodApi: 0, apps: 0, points: 0, rank: 2 });
  });

  test('unitName falls back to null when agent has no unitId', () => {
    const doc = buildLeaderboardDoc([mkAgent('a1', 'Solo', 'south', null)], REF, ctxOf());
    expect(doc.week[0].unitName).toBeNull();
    expect(doc.week[0].unitId).toBeNull();
  });

  test('UM is always ranked; its own policies count for the UM only; unitName resolves', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM South', 'south'),
    ];
    const ctx = ctxOf({
      policies: [
        mkPolicy('p1', 'a1', '2026-05-11', 100),
        mkPolicy('p2', 'a2', '2026-05-11', 200),
        mkPolicy('pUM', 'u1', '2026-05-11', 9999),
      ],
    });
    const doc = buildLeaderboardDoc(users, REF, ctx);
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      expect(doc[periodKey].map((e) => e.agentId).sort()).toEqual(['a1', 'a2', 'u1']);
    }
    expect(doc.week.find((e) => e.agentId === 'u1').periodApi).toBe(9999);
    expect(doc.week.find((e) => e.agentId === 'a1').unitName).toBe('Unit u1');
    expect(doc.week.find((e) => e.agentId === 'a2').periodApi).toBe(200);
    expect(doc.week.find((e) => e.agentId === 'a1').periodApi).toBe(100);
  });
});

// ── computeAndWriteLeaderboards (end-to-end with mocked Firestore) ───────────

describe('computeAndWriteLeaderboards', () => {
  let warnSpy;

  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const leaderboardOps = () => mockBatch.ops.filter((op) => Array.isArray(op.data.week));
  const championsOp    = () => mockBatch.ops.find((op) => op.data.weekStarting !== undefined);
  const dailyQueries   = (uid) => queryLog.filter((q) => q.path === `tenants/T/users/${uid}/dailyActivity`);

  function southNorth() {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      mkUM('u1', 'UM South', 'south'),
      mkUM('u2', 'UM North', 'north'),
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'a1', '2026-05-11', 100),
      mkPolicy('p2', 'a2', '2026-05-11', 200),
      mkPolicy('p3', 'a3', '2026-05-11', 300),
    ];
  }

  test('writes one leaderboards/{branchId} doc per branch + 1 weeklyChampions doc', async () => {
    southNorth();
    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(2);
    expect(result.totalPolicies).toBe(3);
    expect(leaderboardOps()).toHaveLength(2);
    expect(championsOp()).toBeDefined();
    expect(mockBatch.ops).toHaveLength(3);
    expect(mockBatch.ops.map((op) => op.ref.path).sort()).toEqual([
      'tenants/T/leaderboards/north',
      'tenants/T/leaderboards/south',
      'tenants/T/weeklyChampions/2026-05-03',
    ]);
  });

  test('per-branch doc ranks that branch only, by ledger API', async () => {
    southNorth();
    await computeAndWriteLeaderboards('T', REF);
    const southOp = leaderboardOps().find((op) => op.data.week.some((e) => e.agentId === 'a1'));
    expect(southOp.data.week.map((e) => e.agentId)).toEqual(['a2', 'a1', 'u1']);
    const northOp = leaderboardOps().find((op) => op.data.week.some((e) => e.agentId === 'a3'));
    expect(northOp.data.week.map((e) => e.agentId)).toEqual(['a3', 'u2']);
    expect(southOp.data.sources).toEqual({ api: 'ledger', apps: 'ledger', points: 'activity' });
  });

  test('weekly-report API no longer ranks the board (D2)', async () => {
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    firestoreData['tenants/T/submissions'] = [mkSub('s1', 'a1', WK_SUN, 9999, 9)];
    await computeAndWriteLeaderboards('T', REF);
    expect(leaderboardOps()[0].data.week.find((e) => e.agentId === 'a1')).toMatchObject({ periodApi: 0, apps: 0 });
  });

  test('empty inputs → 0 leaderboards docs, but champions doc still written (honest empty payload)', async () => {
    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(0);
    expect(leaderboardOps()).toHaveLength(0);
    expect(championsOp().data).toMatchObject({ topAPI: null, topApps: null, topActivity: null });
  });

  test('D5: only SUBMITTED reports are read; a draft never counts and its week reads the days', async () => {
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    firestoreData['tenants/T/submissions'] = [
      { ...mkSub('s2', 'a1', WK_SUN, 0), status: 'draft', ciConducted: 50 }, // never read
    ];
    firestoreData['tenants/T/users/a1/dailyActivity'] = [
      mkDay('2026-05-11', WK_SUN, { ciConducted: 1 }),
      mkDay('2026-05-12', WK_SUN, { ffiConducted: 1 }),
    ];
    await computeAndWriteLeaderboards('T', REF);
    const subsQuery = queryLog.find((q) => q.path === 'tenants/T/submissions');
    expect(subsQuery.filters).toContainEqual({ field: 'status', op: '==', value: 'submitted' });
    expect(leaderboardOps()[0].data.week.find((e) => e.agentId === 'a1').points).toBe(15);
  });

  test('D5: dailies are read ONLY for weeks without a submitted report, in `in` chunks of ≤ 30', async () => {
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    firestoreData['tenants/T/submissions'] = [
      { ...mkSub('s1', 'a1', WK_SUN, 0, 0), ciConducted: 2 },      // reported week: 20 points
      { ...mkSub('s0', 'a1', PREV_WK_SUN, 0, 0), ciConducted: 1 }, // reported week: 10 points
    ];
    firestoreData['tenants/T/users/a1/dailyActivity'] = [
      mkDay('2026-05-11', WK_SUN, { ciConducted: 9 }), // bait — its week has a report
      mkDay('2026-04-27', '2026-04-26', { ffiConducted: 1 }),
    ];
    await computeAndWriteLeaderboards('T', REF);

    const qs = dailyQueries('a1');
    const weeksRead = qs.flatMap((q) => q.filters.find((f) => f.op === 'in').value);
    expect(qs.every((q) => q.filters.length === 1 && q.filters[0].field === 'weekStarting')).toBe(true);
    expect(qs.every((q) => q.filters[0].value.length <= 30)).toBe(true);
    expect(weeksRead).not.toContain(WK_SUN);
    expect(weeksRead).not.toContain(PREV_WK_SUN);
    expect(weeksRead).toContain('2026-04-26');
    // 2025-12-21 (first Sunday on/after the 14-day cushion) … 2026-05-10 = 21 Sundays, minus 2 reported
    expect(weeksRead).toHaveLength(19);
    expect(weeksRead[0]).toBe('2025-12-21');

    const week = leaderboardOps()[0].data.week.find((e) => e.agentId === 'a1');
    const ytd = leaderboardOps()[0].data.ytd.find((e) => e.agentId === 'a1');
    expect(week.points).toBe(20);
    expect(ytd.points).toBe(35);
  });

  test('dailies are read for participants and champion candidates only', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
      { id: 'nb', role: 'agent', name: 'NoBranch' },                         // champion candidate
      mkTestAgent('t', 'Test', 'south'),
      { id: 'sm', role: 'sales_manager', name: 'SM', branchId: 'south' },
      { id: 'bm', role: 'branch_manager', name: 'BM', branchId: 'south' },  // not opted in
      { ...mkAgent('off', 'Off', 'south'), active: false },
    ];
    await computeAndWriteLeaderboards('T', REF);
    const readers = [...new Set(queryLog.map((q) => q.path).filter((p) => p.endsWith('/dailyActivity')))].sort();
    expect(readers).toEqual([
      'tenants/T/users/a1/dailyActivity',
      'tenants/T/users/nb/dailyActivity',
      'tenants/T/users/u1/dailyActivity',
    ]);
  });

  test('D8: a deactivated agent is absent from every period and is not a champion', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      { ...mkAgent('off', 'Off', 'south', 'u1'), active: false },
      mkUM('u1', 'UM', 'south'),
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'a1', '2026-05-05', 100),
      mkPolicy('bait', 'off', '2026-05-05', 99999),
    ];
    await computeAndWriteLeaderboards('T', REF);
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      expect(leaderboardOps()[0].data[periodKey].map((e) => e.agentId)).not.toContain('off');
    }
    expect(championsOp().data.topAPI.agentId).toBe('a1');
  });

  test('writes skippedNoBranch={count:0, agentIds:[]} onto each branch doc when no skips', async () => {
    firestoreData['tenants/T/submissions'] = [mkSub('s1', 'a1', WK_SUN, 100)];
    firestoreData['tenants/T/users']       = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.skippedNoBranch).toEqual({ count: 0, agentIds: [] });
    expect(leaderboardOps()[0].data.skippedNoBranch).toEqual({ count: 0, agentIds: [] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('logs warn + writes skippedNoBranch metadata when an agent has no branchId', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a2', WK_SUN, 200), // a2 has no branchId — must be dropped + counted
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'WithBranch', 'south', 'u1'),
      { id: 'a2', role: 'agent', name: 'NoBranch', provisioning: false }, // no branchId
      mkUM('u1', 'UM', 'south'),
    ];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(1);
    expect(result.skippedNoBranch).toEqual({ count: 1, agentIds: ['a2'] });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/skippedNoBranch=1/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/"a2"/);
    expect(leaderboardOps()[0].data.skippedNoBranch).toEqual({ count: 1, agentIds: ['a2'] });
  });

  test('skip metadata written to ALL per-branch docs (tenant-wide visibility)', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a3', WK_SUN, 300),
      mkSub('s9', 'a9', WK_SUN, 999),  // no branchId — dropped
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      { id: 'a9', role: 'agent', name: 'NoBranch', provisioning: false },
      mkUM('u1', 'UM South', 'south'),
      mkUM('u2', 'UM North', 'north'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    expect(leaderboardOps()).toHaveLength(2);
    for (const op of leaderboardOps()) {
      expect(op.data.skippedNoBranch).toEqual({ count: 1, agentIds: ['a9'] });
    }
  });

  test('D9 + D7 wiring: champions from last week and previousRanks on WEEK entries', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'a1', '2026-05-05', 500),                                       // prior week: a1 API
      mkPolicy('p2', 'a2', '2026-05-06', 100, { newBusinessType: 'platinum_edge' }), // prior week: a2 app
      mkPolicy('p3', 'a2', '2026-05-07', 100, { newBusinessType: 'platinum_edge' }),
      mkPolicy('c1', 'a1', '2026-05-11', 100),                                       // this week: a2 > a1
      mkPolicy('c2', 'a2', '2026-05-11', 300),
    ];
    firestoreData['tenants/T/users/a2/dailyActivity'] = [mkDay('2026-05-04', PREV_WK_SUN, { ciConducted: 2 })];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.priorWeekStarting).toBe(PREV_WK_SUN);
    expect(championsOp().data).toMatchObject({
      weekStarting: PREV_WK_SUN,
      topAPI: { agentId: 'a1', value: 500 },
      topApps: { agentId: 'a2', value: 2 },
      topActivity: { agentId: 'a2', value: 20 },
    });

    const week = leaderboardOps()[0].data.week;
    const a1 = week.find((e) => e.agentId === 'a1');
    const a2 = week.find((e) => e.agentId === 'a2');
    expect(a1).toMatchObject({ rank: 2, previousRank: 1, previousRanks: { api: 1, apps: 2, activity: 2 } });
    expect(a2).toMatchObject({ rank: 1, previousRank: 2, previousRanks: { api: 2, apps: 1, activity: 1 } });
    for (const k of ['mtd', 'qtd', 'ytd']) {
      expect(leaderboardOps()[0].data[k].every((e) => e.previousRank === null && e.previousRanks === null)).toBe(true);
    }
  });

  test('entries carry unitId in every period', async () => {
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    await computeAndWriteLeaderboards('T', REF);
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      expect(leaderboardOps()[0].data[periodKey].find((e) => e.agentId === 'a1').unitId).toBe('u1');
    }
  });

  // Year-boundary: UTC Jan 1 02:00 = TT Dec 31 22:00 (still the prior TT year).
  // The 14-day cushion keeps late-December reports and days in range.
  test('year-boundary: TT Dec-31 ref (UTC Jan 1 02:00) still counts late-December business', async () => {
    const TT_YE_REF = new Date('2026-01-01T02:00:00Z');
    const DEC_28_SUN = '2025-12-28';
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM South', 'south')];
    firestoreData['tenants/T/policies'] = [mkPolicy('p1', 'a1', '2025-12-30', 500)];
    firestoreData['tenants/T/users/a1/dailyActivity'] = [mkDay('2025-12-29', DEC_28_SUN, { ciConducted: 1 })];

    const result = await computeAndWriteLeaderboards('T', TT_YE_REF);
    expect(result.branchCount).toBe(1);
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      const entry = leaderboardOps()[0].data[periodKey].find((e) => e.agentId === 'a1');
      expect(entry.periodApi).toBe(500);
      expect(entry.points).toBe(10);
    }
  });
});

// ── isTestAccount filter ──────────────────────────────────────────────────────

describe('isTestAccount filter', () => {
  let warnSpy;
  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  test('groupByBranch: test-account agent NOT in branchByAgent — subs dropped + skipped, not in users list', () => {
    const users = [
      mkAgent('real', 'Real Agent',   'south', 'u1'),
      mkTestAgent('test', 'Test Account', 'south', 'u1'),
    ];
    const subs = [
      mkSub('s1', 'real', WK_SUN, 100),
      mkSub('s2', 'test', WK_SUN, 9999), // bait — must be dropped
    ];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').users.map((u) => u.id)).toEqual(['real']);
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['real']);
    expect(skippedNoBranch.count).toBe(1);
    expect(skippedNoBranch.agentIds).toEqual(['test']);
  });

  test('test-account agent absent from every period, with or without business, and never a champion', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('real',   'Real Agent',   'south', 'u1'),
      mkTestAgent('test', 'Test Account', 'south', 'u1'),
      mkTestAgent('quiet', 'Quiet Test', 'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'real', '2026-05-05', 500),
      mkPolicy('bait', 'test', '2026-05-05', 99999),
    ];
    await computeAndWriteLeaderboards('T', REF);
    const lb = mockBatch.ops.find((op) => Array.isArray(op.data.week));
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      const ids = lb.data[periodKey].map((e) => e.agentId);
      expect(ids).toContain('real');
      expect(ids).not.toContain('test');
      expect(ids).not.toContain('quiet');
    }
    const champions = mockBatch.ops.find((op) => op.data.weekStarting !== undefined);
    expect(champions.data.topAPI.agentId).toBe('real');
  });

  test('normal agent unaffected when isTestAccount is absent or false', () => {
    const users = [
      mkAgent('a1', 'Normal', 'south', 'u1'),
      { id: 'a2', role: 'agent', name: 'ExplicitFalse', branchId: 'south', unitId: 'u1',
        provisioning: false, isTestAccount: false },
    ];
    const subs = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 200)];
    const { byBranch, skippedNoBranch } = groupByBranch(subs, users);
    expect(byBranch.get('south').users.map((u) => u.id).sort()).toEqual(['a1', 'a2']);
    expect(byBranch.get('south').subs).toHaveLength(2);
    expect(skippedNoBranch.count).toBe(0);
  });
});

// ── recomputeLeaderboardOnDemand auth gate ───────────────────────────────────

describe('recomputeLeaderboardOnDemand', () => {
  const handler = recomputeLeaderboardOnDemand._onCall;

  beforeEach(() => {
    resetStore();
  });

  test('rejects unauthenticated', async () => {
    await expect(handler({}, {})).rejects.toThrow(/Sign-in required/);
  });

  test('rejects agent caller (permission-denied)', async () => {
    await expect(
      handler({}, { auth: { token: { role: 'agent', tenantId: 'T' }, uid: 'a1' } })
    ).rejects.toThrow(/Only platform_admin or tenant_admin/);
  });

  test('rejects branch_manager / unit_manager', async () => {
    await expect(
      handler({}, { auth: { token: { role: 'branch_manager', tenantId: 'T' } } })
    ).rejects.toThrow(/Only platform_admin or tenant_admin/);
    await expect(
      handler({}, { auth: { token: { role: 'unit_manager', tenantId: 'T' } } })
    ).rejects.toThrow(/Only platform_admin or tenant_admin/);
  });

  test('tenant_admin invokes for own tenant', async () => {
    const result = await handler(
      {},
      { auth: { token: { role: 'tenant_admin', tenantId: 'T2' } } }
    );
    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe('T2');
    expect(queryLog.every((q) => q.path.startsWith('tenants/T2/'))).toBe(true);
  });

  test('platform_admin may target any tenant via data.tenantId', async () => {
    const result = await handler(
      { tenantId: 'T3' },
      { auth: { token: { role: 'platform_admin', tenantId: null } } }
    );
    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe('T3');
  });
});

// ── priorWeekStartingString ──────────────────────────────────────────────────

describe('priorWeekStartingString', () => {
  test('REF mid-week May 15 2026 → prior week Sunday is 2026-05-03', () => {
    expect(priorWeekStartingString(REF)).toBe(PREV_WK_SUN);
  });

  test('REF on Sunday TT (start of current week) → prior week Sunday is the previous Sunday', () => {
    // 2026-05-10 04:00 UTC = Sun 00:00 TT — start of the "current" week
    const ref = new Date('2026-05-10T04:00:00Z');
    expect(priorWeekStartingString(ref)).toBe('2026-05-03');
  });

  test('REF on Sat 23:59 TT 2026-01-03 → prior week is the last Sunday of 2025 (Dec 28)', () => {
    // - Current week (TT) is 2025-12-28 → 2026-01-03 — Sat 23:59:59 TT is in this week
    // - Prior week (TT) starts at 2025-12-21 (Sun)
    const ref = new Date('2026-01-04T03:59:00Z');
    expect(priorWeekStartingString(ref)).toBe('2025-12-21');
  });
});

// ── appearOnLeaderboard opt-in (BM role-gated) ───────────────────────────────
//
// Agents and UMs always appear. BMs appear only when appearOnLeaderboard===true
// (self opt-in). SM/TA/PA are never included regardless of flag value.
describe('leaderboardAggregate — appearOnLeaderboard opt-in (BM role-gated)', () => {
  beforeEach(() => {
    resetStore();
  });

  const weekEntry = (id) => mockBatch.ops.find((op) => Array.isArray(op.data.week)).data.week.find((e) => e.agentId === id);

  test('BM with appearOnLeaderboard:true is included alongside agents and UM', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM South', 'south'),
      { id: 'bm1', role: 'branch_manager', name: 'BM', branchId: 'south', appearOnLeaderboard: true },
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'a1', '2026-05-11', 300),
      mkPolicy('pbm', 'bm1', '2026-05-11', 500),
    ];
    await computeAndWriteLeaderboards('T', REF);
    expect(weekEntry('bm1').periodApi).toBe(500);
    expect(weekEntry('a1').periodApi).toBe(300);
  });

  test('BM without appearOnLeaderboard is excluded by default', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM South', 'south'),
      { id: 'bm1', role: 'branch_manager', name: 'BM', branchId: 'south' },
    ];
    firestoreData['tenants/T/policies'] = [
      mkPolicy('p1', 'a1', '2026-05-11', 300),
      mkPolicy('pbm', 'bm1', '2026-05-11', 9999),
    ];
    await computeAndWriteLeaderboards('T', REF);
    expect(weekEntry('bm1')).toBeUndefined();
    expect(weekEntry('a1').periodApi).toBe(300);
  });

  test('SM with appearOnLeaderboard:true is still excluded (flag is BM-only)', async () => {
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM South', 'south'),
      { id: 'sm1', role: 'sales_manager', name: 'SM', branchId: 'south', appearOnLeaderboard: true },
    ];
    firestoreData['tenants/T/policies'] = [mkPolicy('psm', 'sm1', '2026-05-11', 9999)];
    await computeAndWriteLeaderboards('T', REF);
    expect(weekEntry('sm1')).toBeUndefined();
  });
});
