'use strict';

// Unit tests for the leaderboard-aggregate CF logic.
// Targets the pure helpers (groupByBranch / buildLeaderboardDoc) and the
// composed compute flow with firebase-admin mocked. The CF trigger wiring
// (scheduled + onCall context-validation) is exercised via direct handler
// invocation against the mocked admin SDK.

// ── firebase-admin mock (no real Firestore) ──────────────────────────────────

const firestoreData = {}; // path → array of docs (for collection queries)
const firestoreDocs = {}; // doc-path → data (for db.doc().get())

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
      const all = firestoreData[this._path] || [];
      const filtered = all.filter((d) =>
        this._filters.every((f) => {
          const v = d[f.field];
          if (f.op === '==') return v === f.value;
          if (f.op === '>=') return v >= f.value;
          if (f.op === '<=') return v <= f.value;
          return true;
        })
      );
      return { docs: filtered.map((d) => ({ id: d.id, data: () => d })) };
    },
  };
}

const mockFirestore = () => ({
  collection: (path) => makeQuery(path),
  doc:        (path) => ({
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
jest.mock('firebase-functions', () => ({
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
const { groupByBranch, buildLeaderboardDoc, computeAndWriteLeaderboards } = _internals;

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

// REF inside current calendar year — use a Sunday in the current quarter.
// Use a fixed REF for determinism.
const REF = new Date('2026-05-15T10:00:00Z');
const WK_SUN = '2026-05-10';

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

describe('buildLeaderboardDoc', () => {
  test('returns { week, mtd, qtd, ytd, computedAt }', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    expect(Object.keys(doc).sort()).toEqual(['computedAt', 'mtd', 'qtd', 'week', 'ytd']);
    expect(doc.computedAt).toBe('<serverTimestamp>');
  });

  test('each period entry has the consumer shape (P5-prep adds unitId + previousRank)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    expect(doc.week[0]).toEqual({
      agentId:        'a1',
      name:           'Alpha',
      unitId:         'u1',                // P5-prep: passthrough
      unitName:       'Unit u1',
      periodApi:      100,
      apps:           1,
      rank:           1,
      rankWithinUnit: 1,
      previousRank:   null,                // P5-prep: week-only; null when no prior-rank map supplied
    });
  });

  test('agents with no production in period still appear (rank N, periodApi=0)', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
    ];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 500)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    const a2 = doc.week.find((e) => e.agentId === 'a2');
    expect(a2.periodApi).toBe(0);
    expect(a2.rank).toBe(2);
  });

  test('unitName falls back to null when agent has no unitId', () => {
    const users = [mkAgent('a1', 'Solo', 'south', null)];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    expect(doc.week[0].unitName).toBeNull();
  });

  test('UM is NOT ranked, but agent unitName still resolves from the UM doc', () => {
    // branchUsers contains both agents and the UM. The UM is in the array
    // for unit-name resolution only — rankForLeaderboard filters to agents.
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM South', 'south'),
    ];
    // Even if a "submission" attributed to the UM existed, it must not be ranked.
    const subs = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a2', WK_SUN, 200),
      mkSub('sUM', 'u1', WK_SUN, 9999), // bait: huge value attributed to UM uid
    ];
    const doc = buildLeaderboardDoc(subs, users, REF);

    // Assertion 1: UM is absent from every period's ranking
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      const ids = doc[periodKey].map((e) => e.agentId);
      expect(ids).not.toContain('u1');                       // UM NOT ranked
      expect(ids.sort()).toEqual(['a1', 'a2']);              // ONLY agents
    }

    // Assertion 2: Agent unitName still resolves to the UM's display name
    expect(doc.week.find((e) => e.agentId === 'a1').unitName).toBe('Unit u1');
    expect(doc.week.find((e) => e.agentId === 'a2').unitName).toBe('Unit u1');

    // Assertion 3: The UM-baited submission's API value did NOT contaminate
    // any agent's ranking (a1 has 100, a2 has 200 — the 9999 is dropped)
    expect(doc.week.find((e) => e.agentId === 'a2').periodApi).toBe(200);
    expect(doc.week.find((e) => e.agentId === 'a1').periodApi).toBe(100);
  });
});

// ── computeAndWriteLeaderboards (end-to-end with mocked Firestore) ───────────

describe('computeAndWriteLeaderboards', () => {
  let warnSpy;

  beforeEach(() => {
    for (const k of Object.keys(firestoreData)) delete firestoreData[k];
    for (const k of Object.keys(firestoreDocs)) delete firestoreDocs[k];
    mockBatch.ops = [];
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // Helper: filter to leaderboards ops (have a `week` array) vs the
  // weeklyChampions op (added in P5-prep — has `weekStarting` at top-level).
  const leaderboardOps = () => mockBatch.ops.filter((op) => Array.isArray(op.data.week));
  const championsOp    = () => mockBatch.ops.find((op) => op.data.weekStarting !== undefined);

  test('writes one leaderboards/{branchId} doc per branch (+ 1 weeklyChampions doc, P5-prep)', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'a1', WK_SUN, 100),
      mkSub('s2', 'a2', WK_SUN, 200),
      mkSub('s3', 'a3', WK_SUN, 300),
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      mkUM('u1', 'UM South', 'south'),
      mkUM('u2', 'UM North', 'north'),
    ];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(2);
    expect(leaderboardOps()).toHaveLength(2);     // 2 branches
    expect(championsOp()).toBeDefined();          // + 1 champions
    expect(mockBatch.ops).toHaveLength(3);        // 2 leaderboards + 1 champions
  });

  test('per-branch doc has correct rankings for that branch only', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'a1', WK_SUN, 100),  // south
      mkSub('s2', 'a2', WK_SUN, 200),  // south
      mkSub('s3', 'a3', WK_SUN, 300),  // north
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      mkUM('u1', 'UM South', 'south'),
      mkUM('u2', 'UM North', 'north'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    const southOp = mockBatch.ops.find((op) => op.data.week.some((e) => e.agentId === 'a1'));
    expect(southOp.data.week).toHaveLength(2);
    // Within south: a2 (200) > a1 (100)
    expect(southOp.data.week[0].agentId).toBe('a2');
    expect(southOp.data.week[1].agentId).toBe('a1');

    const northOp = mockBatch.ops.find((op) => op.data.week.some((e) => e.agentId === 'a3'));
    expect(northOp.data.week).toHaveLength(1);
    expect(northOp.data.week[0].agentId).toBe('a3');
  });

  test('empty inputs → 0 leaderboards docs, but champions doc still written (P5-prep: honest empty payload)', async () => {
    firestoreData['tenants/T/submissions'] = [];
    firestoreData['tenants/T/users'] = [];
    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(0);
    expect(leaderboardOps()).toHaveLength(0);
    // The champions doc is ALWAYS written — "no champions this week" is an
    // honest signal, not a missing doc. Banner reads doc-exists.
    expect(championsOp()).toBeDefined();
    expect(championsOp().data.topAPI).toBeNull();
    expect(championsOp().data.topApps).toBeNull();
    expect(championsOp().data.topActivity).toBeNull();
  });

  test('only submissions in the calendar YTD window are read (status filter applied)', async () => {
    firestoreData['tenants/T/submissions'] = [
      { ...mkSub('s1', 'a1', WK_SUN, 100), status: 'submitted' },
      { ...mkSub('s2', 'a1', WK_SUN, 999), status: 'draft' }, // excluded by status filter
    ];
    firestoreData['tenants/T/users'] = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];

    await computeAndWriteLeaderboards('T', REF);
    const op = mockBatch.ops[0];
    expect(op.data.week[0].periodApi).toBe(100); // draft excluded
  });

  test('writes skippedNoBranch={count:0, agentIds:[]} onto each branch doc when no skips', async () => {
    firestoreData['tenants/T/submissions'] = [mkSub('s1', 'a1', WK_SUN, 100)];
    firestoreData['tenants/T/users']       = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.skippedNoBranch).toEqual({ count: 0, agentIds: [] });
    const op = mockBatch.ops[0];
    expect(op.data.skippedNoBranch).toEqual({ count: 0, agentIds: [] });
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
    expect(result.branchCount).toBe(1); // only south
    expect(result.skippedNoBranch).toEqual({ count: 1, agentIds: ['a2'] });

    // CF logs the count + agentIds via console.warn so the drift surfaces in logs
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/skippedNoBranch=1/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/"a2"/);

    // Every per-branch doc carries the tenant-wide skippedNoBranch metadata
    const southOp = mockBatch.ops.find((op) => op.data.week.some((e) => e.agentId === 'a1'));
    expect(southOp.data.skippedNoBranch).toEqual({ count: 1, agentIds: ['a2'] });
  });

  test('skip metadata written to ALL per-branch docs (tenant-wide visibility)', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'a1', WK_SUN, 100),  // south
      mkSub('s2', 'a3', WK_SUN, 300),  // north
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
    expect(leaderboardOps()).toHaveLength(2); // south + north
    for (const op of leaderboardOps()) {
      expect(op.data.skippedNoBranch).toEqual({ count: 1, agentIds: ['a9'] });
    }
  });
});

// ── isTestAccount filter ──────────────────────────────────────────────────────
//
// isTestAccount:true agents must be excluded from:
//   1. groupByBranch() — not in branchByAgent, subs dropped, not in byBranch.users
//   2. computeAndWriteLeaderboards() — absent from ranked output (even at $0)
//   3. computeWeeklyChampions() — not a champion candidate

describe('isTestAccount filter', () => {
  let warnSpy;
  beforeEach(() => {
    for (const k of Object.keys(firestoreData)) delete firestoreData[k];
    for (const k of Object.keys(firestoreDocs)) delete firestoreDocs[k];
    mockBatch.ops = [];
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
    // Test account absent from byBranch.users
    expect(byBranch.get('south').users.map((u) => u.id)).toEqual(['real']);
    // Test account's submission dropped (not in branchByAgent → no branchId lookup)
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['real']);
    // Counted as skipped
    expect(skippedNoBranch.count).toBe(1);
    expect(skippedNoBranch.agentIds).toEqual(['test']);
  });

  test('computeAndWriteLeaderboards: test-account agent absent from ranked output in all periods', async () => {
    firestoreData['tenants/T/submissions'] = [
      mkSub('s1', 'real', WK_SUN, 500),
      mkSub('s2', 'test', WK_SUN, 9999), // bait
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('real',   'Real Agent',   'south', 'u1'),
      mkTestAgent('test', 'Test Account', 'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    const leaderboardOp = mockBatch.ops.find((op) => Array.isArray(op.data.week));
    expect(leaderboardOp).toBeDefined();
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      const ids = leaderboardOp.data[periodKey].map((e) => e.agentId);
      expect(ids).not.toContain('test'); // test account absent from all periods
      expect(ids).toContain('real');     // real agent present
    }
  });

  test('computeAndWriteLeaderboards: test-account agent with NO submission absent (not ranked at $0)', async () => {
    firestoreData['tenants/T/submissions'] = [mkSub('s1', 'real', WK_SUN, 100)];
    firestoreData['tenants/T/users'] = [
      mkAgent('real',   'Real Agent',   'south', 'u1'),
      mkTestAgent('test', 'Test Account', 'south', 'u1'), // no sub — would appear at $0 if not filtered
      mkUM('u1', 'UM', 'south'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    const leaderboardOp = mockBatch.ops.find((op) => Array.isArray(op.data.week));
    expect(leaderboardOp.data.week).toHaveLength(1);
    expect(leaderboardOp.data.week[0].agentId).toBe('real');
  });

  test('computeWeeklyChampions: test-account agent NOT a champion candidate', () => {
    const users = [
      mkAgent('real',   'Real Agent',   'south', 'u1'),
      mkTestAgent('test', 'Test Account', 'south', 'u1'),
    ];
    const subs = [
      mkSubActivity('s1', 'real', PREV_WK_SUN, { api: 100, apps: 1, ffi: 1, ci: 1 }),
      mkSubActivity('s2', 'test', PREV_WK_SUN, { api: 9999, apps: 99, ffi: 99, ci: 99 }), // bait
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI.agentId).toBe('real');
    expect(out.topApps.agentId).toBe('real');
    expect(out.topActivity.agentId).toBe('real');
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
    for (const k of Object.keys(firestoreData)) delete firestoreData[k];
    mockBatch.ops = [];
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
    firestoreData['tenants/T2/submissions'] = [];
    firestoreData['tenants/T2/users']       = [];
    const result = await handler(
      {},
      { auth: { token: { role: 'tenant_admin', tenantId: 'T2' } } }
    );
    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe('T2');
  });

  test('platform_admin may target any tenant via data.tenantId', async () => {
    firestoreData['tenants/T3/submissions'] = [];
    firestoreData['tenants/T3/users']       = [];
    const result = await handler(
      { tenantId: 'T3' },
      { auth: { token: { role: 'platform_admin', tenantId: null } } }
    );
    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe('T3');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5-PREP — unitId passthrough + previousRank + weeklyChampions
// ─────────────────────────────────────────────────────────────────────────────

const {
  computeWeeklyChampions,
  computePriorRankByAgent,
  priorWeekStartingString,
  extractApplicationsSold,
  extractFFIConducted,
  extractCIConducted,
  extractActivity,
} = _internals;

// Reuse WK_SUN/REF from above (WK_SUN = '2026-05-10', REF = mid-Friday 2026-05-15).
const PREV_WK_SUN = '2026-05-03';

// Activity-bearing submission helpers (mkSub above only carries newBusiness.api/apps;
// for the Activity metric we need ffi/ci/applicationsSold counts).
function mkSubActivity(id, agentId, weekStarting, { api = 0, apps = 0, ffi = 0, ci = 0 } = {}) {
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
    // Flat fields used by the champions Activity formula
    ffiConducted: ffi,
    ciConducted:  ci,
    applicationsSold: apps,
  };
}

// ── Field extractors ─────────────────────────────────────────────────────────

describe('extract helpers (P5-prep champions)', () => {
  test('extractApplicationsSold — v2 reads newBusiness.apps (NOT ppp.apps)', () => {
    const s = {
      version: 2,
      newBusiness:  { apps: 3 },
      pppIncreases: { apps: 5 },
    };
    expect(extractApplicationsSold(s)).toBe(3);
  });

  test('extractApplicationsSold — v1 reads applicationsSold / appsSold', () => {
    expect(extractApplicationsSold({ applicationsSold: 7 })).toBe(7);
    expect(extractApplicationsSold({ appsSold: 4 })).toBe(4);
  });

  test('extractApplicationsSold — nested schema reads step4.applicationsSold', () => {
    expect(extractApplicationsSold({ step1: {}, step4: { applicationsSold: 9 } })).toBe(9);
  });

  test('extractFFIConducted — flat path reads s.ffiConducted', () => {
    expect(extractFFIConducted({ ffiConducted: 5 })).toBe(5);
  });

  test('extractCIConducted — flat path reads s.ciConducted', () => {
    expect(extractCIConducted({ ciConducted: 8 })).toBe(8);
  });

  test('extractActivity = ffi + ci + applicationsSold', () => {
    const s = { ffiConducted: 3, ciConducted: 4, applicationsSold: 2, version: 2,
                newBusiness: { apps: 2 } };
    expect(extractActivity(s)).toBe(3 + 4 + 2);
  });

  test('extractApplicationsSold/FFI/CI — empty/null → 0', () => {
    expect(extractApplicationsSold(null)).toBe(0);
    expect(extractApplicationsSold({})).toBe(0);
    expect(extractFFIConducted(null)).toBe(0);
    expect(extractCIConducted(null)).toBe(0);
    expect(extractActivity({})).toBe(0);
  });
});

// ── computeWeeklyChampions ───────────────────────────────────────────────────

describe('computeWeeklyChampions', () => {
  test('empty prior-week subs → all-null champions doc (matches retired banner)', () => {
    const out = computeWeeklyChampions([], [], PREV_WK_SUN);
    expect(out).toEqual({
      topAPI: null, topApps: null, topActivity: null, weekStarting: PREV_WK_SUN,
    });
  });

  test('top-1 by API picks highest periodApi agent', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
    ];
    const subs = [
      mkSubActivity('s1', 'a1', PREV_WK_SUN, { api: 100, apps: 2, ffi: 1, ci: 1 }),
      mkSubActivity('s2', 'a2', PREV_WK_SUN, { api: 500, apps: 1, ffi: 0, ci: 0 }),
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI).toEqual({ agentId: 'a2', agentName: 'Beta', value: 500 });
  });

  test('top-1 by Apps + by Activity can be different agents', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'south', 'u1'),
    ];
    const subs = [
      mkSubActivity('s1', 'a1', PREV_WK_SUN, { api: 100, apps: 5, ffi: 0, ci: 0 }),   // top Apps
      mkSubActivity('s2', 'a2', PREV_WK_SUN, { api: 500, apps: 1, ffi: 0, ci: 0 }),   // top API
      mkSubActivity('s3', 'a3', PREV_WK_SUN, { api: 100, apps: 2, ffi: 5, ci: 4 }),   // top Activity
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI.agentId).toBe('a2');
    expect(out.topApps.agentId).toBe('a1');
    expect(out.topActivity.agentId).toBe('a3');
    // Activity = ffi + ci + applicationsSold = 5 + 4 + 2
    expect(out.topActivity.value).toBe(11);
  });

  test('ties broken alphabetically by agentName', () => {
    const users = [
      mkAgent('a1', 'Zara',  'south', 'u1'),
      mkAgent('a2', 'Alice', 'south', 'u1'),
    ];
    const subs = [
      mkSubActivity('s1', 'a1', PREV_WK_SUN, { api: 100, apps: 1 }),
      mkSubActivity('s2', 'a2', PREV_WK_SUN, { api: 100, apps: 1 }),
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    // Alice < Zara alphabetically → Alice wins all three ties
    expect(out.topAPI.agentName).toBe('Alice');
    expect(out.topApps.agentName).toBe('Alice');
  });

  test('null when no agent has a positive value in that category', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1')];
    const subs = [
      mkSubActivity('s1', 'a1', PREV_WK_SUN, { api: 100, apps: 0, ffi: 0, ci: 0 }),
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI).not.toBeNull();
    expect(out.topApps).toBeNull();      // 0 apps → no winner
    expect(out.topActivity).toBeNull();  // 0 activity → no winner
  });

  test('non-agent (UM) submissions excluded from champions', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM Bait', 'south'),
    ];
    const subs = [
      mkSubActivity('s1', 'a1',  PREV_WK_SUN, { api: 100, apps: 1, ffi: 1, ci: 1 }),
      mkSubActivity('sU', 'u1',  PREV_WK_SUN, { api: 9999, apps: 99, ffi: 99, ci: 99 }), // bait
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI.agentId).toBe('a1');
    expect(out.topApps.agentId).toBe('a1');
    expect(out.topActivity.agentId).toBe('a1');
  });

  test('provisioning agents excluded from champions', () => {
    const users = [
      mkAgent('a1', 'Real', 'south', 'u1'),
      mkAgent('a2', 'Stub', 'south', 'u1', true), // provisioning
    ];
    const subs = [
      mkSubActivity('s1', 'a1', PREV_WK_SUN, { api: 100, apps: 1 }),
      mkSubActivity('s2', 'a2', PREV_WK_SUN, { api: 9999, apps: 99 }),
    ];
    const out = computeWeeklyChampions(subs, users, PREV_WK_SUN);
    expect(out.topAPI.agentId).toBe('a1');
  });
});

// ── computePriorRankByAgent ──────────────────────────────────────────────────

describe('computePriorRankByAgent', () => {
  test('returns prior-week branch ranks for agents with positive prior-week API', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkAgent('a3', 'Gamma', 'north', 'u2'),
      mkUM('u1', 'UM S', 'south'),
      mkUM('u2', 'UM N', 'north'),
    ];
    const subs = [
      // Prior week — 2026-05-03
      mkSub('p1', 'a1', PREV_WK_SUN, 500),  // south, rank 1
      mkSub('p2', 'a2', PREV_WK_SUN, 200),  // south, rank 2
      mkSub('p3', 'a3', PREV_WK_SUN, 999),  // north, rank 1 (only agent in north)
      // Current week — 2026-05-10
      mkSub('c1', 'a1', WK_SUN, 100),
      mkSub('c2', 'a2', WK_SUN, 300),
      mkSub('c3', 'a3', WK_SUN, 50),
    ];
    const { priorRankByAgent, priorWeekSubs } = computePriorRankByAgent(
      subs, users, REF, groupByBranch
    );
    expect(priorWeekSubs.map((s) => s.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(priorRankByAgent.get('a1')).toBe(1); // south
    expect(priorRankByAgent.get('a2')).toBe(2); // south
    expect(priorRankByAgent.get('a3')).toBe(1); // north
  });

  test('ranked-$0 agent (in branch, no prior-week sub) carries their prior-week rank (NOT null)', () => {
    // a1 has prior-week production; a2 is in the branch but had no prior sub.
    // rankForLeaderboard ranks ALL active branch agents in the prior week:
    // a1 at rank 1 with 500 API; a2 at rank 2 tied at $0. previousRank must
    // carry that rank — symmetric with current-week behavior, where $0 agents
    // appear in the leaderboard entries at the bottom.
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM S', 'south'),
    ];
    const subs = [
      mkSub('p1', 'a1', PREV_WK_SUN, 500),
      mkSub('c1', 'a1', WK_SUN, 100),
      mkSub('c2', 'a2', WK_SUN, 300),
    ];
    const { priorRankByAgent } = computePriorRankByAgent(subs, users, REF, groupByBranch);
    expect(priorRankByAgent.get('a1')).toBe(1);
    expect(priorRankByAgent.get('a2')).toBe(2); // ← ranked-$0, NOT undefined
  });

  test('agent truly absent from groupByBranch (e.g., missing branchId) → not in priorRankByAgent (→ previousRank null safety-net)', () => {
    // Defensive coverage: an agent without a branchId is excluded by
    // groupByBranch in BOTH prior- and current-week passes, so they never
    // appear in the leaderboard doc's entries. The previousRank `?? null`
    // fallback only fires defensively in this case; if reached, it must
    // honestly produce null.
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      // a-orphan has NO branchId — excluded by groupByBranch
      { id: 'a-orphan', role: 'agent', name: 'Orphan', provisioning: false },
      mkUM('u1', 'UM S', 'south'),
    ];
    const subs = [
      mkSub('p1', 'a1',       PREV_WK_SUN, 500),
      mkSub('p2', 'a-orphan', PREV_WK_SUN, 999), // would be discarded by groupByBranch
    ];
    const { priorRankByAgent } = computePriorRankByAgent(subs, users, REF, groupByBranch);
    expect(priorRankByAgent.get('a1')).toBe(1);
    expect(priorRankByAgent.get('a-orphan')).toBeUndefined(); // ← truly absent
  });

  test('empty prior week → all branch agents still ranked at $0 (carry previousRank into the doc)', () => {
    // No prior-week submissions, but agents still exist in the branch.
    // rankForLeaderboard ranks ALL active branch agents in the prior week —
    // everyone ties at $0. previousRank carries that rank rather than null.
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    const subs = [mkSub('c1', 'a1', WK_SUN, 100)]; // only current week
    const { priorRankByAgent, priorWeekSubs } = computePriorRankByAgent(
      subs, users, REF, groupByBranch
    );
    expect(priorWeekSubs).toHaveLength(0);
    // Both agents in the map at $0 — tie-break by name (Alpha < Beta).
    expect(priorRankByAgent.get('a1')).toBe(1);
    expect(priorRankByAgent.get('a2')).toBe(2);
  });

  test('no users at all → empty map (defensive)', () => {
    const { priorRankByAgent } = computePriorRankByAgent([], [], REF, groupByBranch);
    expect(priorRankByAgent.size).toBe(0);
  });

  test('prior-week ranks are branch-scoped — a south agent\'s rank does not bleed into north', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'north', 'u2'),
      mkUM('u1', 'UM S', 'south'),
      mkUM('u2', 'UM N', 'north'),
    ];
    const subs = [
      mkSub('p1', 'a1', PREV_WK_SUN, 100),  // south — rank 1 of 1
      mkSub('p2', 'a2', PREV_WK_SUN, 200),  // north — rank 1 of 1
    ];
    const { priorRankByAgent } = computePriorRankByAgent(subs, users, REF, groupByBranch);
    // Both agents are rank 1 within THEIR OWN branch, even though a2 has more API
    expect(priorRankByAgent.get('a1')).toBe(1);
    expect(priorRankByAgent.get('a2')).toBe(1);
  });
});

// ── priorWeekStartingString ─────────────────────────────────────────────────

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
    // Sat 03:59 TT (which is the LAST minute of 2026-01-03 in TT)
    // - Current week (TT) is 2025-12-28 → 2026-01-03 — Sat 23:59:59 TT is in this week
    // - Prior week (TT) starts at 2025-12-21 (Sun)
    const ref = new Date('2026-01-04T03:59:00Z');
    expect(priorWeekStartingString(ref)).toBe('2025-12-21');
  });
});

// ── buildLeaderboardDoc — new entry shape (unitId + previousRank) ────────────

describe('buildLeaderboardDoc — P5-prep entry shape', () => {
  test('entries carry unitId (all periods)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      expect(doc[periodKey][0].unitId).toBe('u1');
    }
  });

  test('entries carry unitId=null when agent has no unitId', () => {
    const users = [mkAgent('a1', 'Solo', 'south', null)];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    expect(doc.week[0].unitId).toBeNull();
  });

  test('WEEK entries carry previousRank from the priorRankByAgent map', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 200)];
    const priorRankByAgent = new Map([['a1', 2], ['a2', 1]]);
    const doc = buildLeaderboardDoc(subs, users, REF, priorRankByAgent);
    // Current week: a2 (200) is rank 1, a1 (100) is rank 2
    const wA1 = doc.week.find((e) => e.agentId === 'a1');
    const wA2 = doc.week.find((e) => e.agentId === 'a2');
    expect(wA1.previousRank).toBe(2);
    expect(wA2.previousRank).toBe(1);
  });

  test('MTD/QTD/YTD entries carry previousRank: null (week-only)', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const priorRankByAgent = new Map([['a1', 1]]); // would set 1 on week, null on rest
    const doc = buildLeaderboardDoc(subs, users, REF, priorRankByAgent);
    expect(doc.week[0].previousRank).toBe(1);
    expect(doc.mtd[0].previousRank).toBeNull();
    expect(doc.qtd[0].previousRank).toBeNull();
    expect(doc.ytd[0].previousRank).toBeNull();
  });

  test('agent absent from priorRankByAgent → previousRank: null on WEEK', () => {
    const users = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 200)];
    // Only a1 was in the prior week; a2 is new this week
    const priorRankByAgent = new Map([['a1', 1]]);
    const doc = buildLeaderboardDoc(subs, users, REF, priorRankByAgent);
    expect(doc.week.find((e) => e.agentId === 'a1').previousRank).toBe(1);
    expect(doc.week.find((e) => e.agentId === 'a2').previousRank).toBeNull();
  });

  test('priorRankByAgent omitted → all previousRank: null', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF); // no priorRankByAgent
    expect(doc.week[0].previousRank).toBeNull();
  });
});

// ── computeAndWriteLeaderboards — wires it all together + writes champions ──

describe('computeAndWriteLeaderboards — P5-prep wiring', () => {
  beforeEach(() => {
    for (const k of Object.keys(firestoreData)) delete firestoreData[k];
    for (const k of Object.keys(firestoreDocs)) delete firestoreDocs[k];
    mockBatch.ops = [];
  });

  test('writes one weeklyChampions/{weekStarting} doc alongside the per-branch leaderboard docs', async () => {
    firestoreData['tenants/T/submissions'] = [
      // Prior week
      mkSubActivity('p1', 'a1', PREV_WK_SUN, { api: 500, apps: 2, ffi: 1, ci: 1 }),
      mkSubActivity('p2', 'a2', PREV_WK_SUN, { api: 100, apps: 5, ffi: 0, ci: 0 }),
      // Current week
      mkSubActivity('c1', 'a1', WK_SUN,      { api: 100, apps: 1, ffi: 0, ci: 0 }),
      mkSubActivity('c2', 'a2', WK_SUN,      { api: 200, apps: 1, ffi: 0, ci: 0 }),
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];

    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(1);
    expect(result.priorWeekStarting).toBe(PREV_WK_SUN);

    // batch contains 1 leaderboards doc + 1 weeklyChampions doc = 2 ops
    expect(mockBatch.ops).toHaveLength(2);
    const championsOp = mockBatch.ops.find(
      (op) => op.data.topAPI !== undefined || op.data.weekStarting !== undefined
    );
    expect(championsOp).toBeDefined();
    expect(championsOp.data.weekStarting).toBe(PREV_WK_SUN);
    expect(championsOp.data.topAPI.agentId).toBe('a1');      // 500 > 100
    expect(championsOp.data.topApps.agentId).toBe('a2');     // 5 > 2
    // a1 activity = ffi 1 + ci 1 + apps 2 = 4
    // a2 activity = ffi 0 + ci 0 + apps 5 = 5 → a2 wins
    expect(championsOp.data.topActivity.agentId).toBe('a2');
  });

  test('WEEK entries on the leaderboards doc carry previousRank from the prior week', async () => {
    firestoreData['tenants/T/submissions'] = [
      // Prior week — a1 (500) > a2 (200) within south
      mkSub('p1', 'a1', PREV_WK_SUN, 500),
      mkSub('p2', 'a2', PREV_WK_SUN, 200),
      // Current week — a2 (300) > a1 (100) within south  (swap)
      mkSub('c1', 'a1', WK_SUN, 100),
      mkSub('c2', 'a2', WK_SUN, 300),
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkAgent('a2', 'Beta',  'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    const leaderboardOp = mockBatch.ops.find(
      (op) => Array.isArray(op.data.week)
    );
    // Current-week ranking: a2 rank 1, a1 rank 2
    const a1Week = leaderboardOp.data.week.find((e) => e.agentId === 'a1');
    const a2Week = leaderboardOp.data.week.find((e) => e.agentId === 'a2');
    expect(a1Week.rank).toBe(2);
    expect(a1Week.previousRank).toBe(1);  // prior week a1 was rank 1
    expect(a2Week.rank).toBe(1);
    expect(a2Week.previousRank).toBe(2);  // prior week a2 was rank 2

    // MTD/QTD/YTD entries have previousRank: null
    expect(leaderboardOp.data.mtd.every((e) => e.previousRank === null)).toBe(true);
    expect(leaderboardOp.data.qtd.every((e) => e.previousRank === null)).toBe(true);
    expect(leaderboardOp.data.ytd.every((e) => e.previousRank === null)).toBe(true);
  });

  test('entries carry unitId in every period', async () => {
    firestoreData['tenants/T/submissions'] = [mkSub('s1', 'a1', WK_SUN, 100)];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];
    await computeAndWriteLeaderboards('T', REF);
    const leaderboardOp = mockBatch.ops.find((op) => Array.isArray(op.data.week));
    for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
      expect(leaderboardOp.data[periodKey][0].unitId).toBe('u1');
    }
  });

  test('weeklyChampions doc is also written when prior week is EMPTY (all-null payload)', async () => {
    firestoreData['tenants/T/submissions'] = [
      // ONLY current-week submissions
      mkSub('c1', 'a1', WK_SUN, 100),
    ];
    firestoreData['tenants/T/users'] = [
      mkAgent('a1', 'Alpha', 'south', 'u1'),
      mkUM('u1', 'UM', 'south'),
    ];

    await computeAndWriteLeaderboards('T', REF);
    const championsOp = mockBatch.ops.find((op) => op.data.weekStarting !== undefined);
    expect(championsOp).toBeDefined();
    expect(championsOp.data.topAPI).toBeNull();
    expect(championsOp.data.topApps).toBeNull();
    expect(championsOp.data.topActivity).toBeNull();
    expect(championsOp.data.weekStarting).toBe(PREV_WK_SUN);
  });
});
