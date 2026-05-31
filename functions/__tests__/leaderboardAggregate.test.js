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
    const byBranch = groupByBranch(subs, users);
    expect([...byBranch.keys()].sort()).toEqual(['north', 'south']);
    expect(byBranch.get('south').subs).toHaveLength(2);
    expect(byBranch.get('north').subs).toHaveLength(1);
    expect(byBranch.get('south').users.map((u) => u.id).sort()).toEqual(['a1', 'a2', 'u1']);
    expect(byBranch.get('north').users.map((u) => u.id).sort()).toEqual(['a3', 'u2']);
  });

  test('excludes provisioning agents from grouping', () => {
    const users = [
      mkAgent('a1', 'Real', 'south'),
      mkAgent('a2', 'Stub', 'south', null, true),
    ];
    const subs = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 999)];
    const byBranch = groupByBranch(subs, users);
    expect(byBranch.get('south').users.map((u) => u.id)).toEqual(['a1']);
    // Submission from provisioning agent dropped (no branchId join)
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['a1']);
  });

  test('drops submissions from agents without branchId (migration gap)', () => {
    const users = [
      mkAgent('a1', 'WithBranch', 'south'),
      { id: 'a2', role: 'agent', name: 'NoBranch', provisioning: false }, // no branchId
    ];
    const subs = [mkSub('s1', 'a1', WK_SUN, 100), mkSub('s2', 'a2', WK_SUN, 200)];
    const byBranch = groupByBranch(subs, users);
    expect(byBranch.size).toBe(1);
    expect(byBranch.get('south').subs.map((s) => s.agentId)).toEqual(['a1']);
  });

  test('empty inputs produce empty map', () => {
    expect(groupByBranch([], []).size).toBe(0);
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
    const byBranch = groupByBranch(subs, users);
    expect(byBranch.get('south').subs).toHaveLength(1);
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

  test('each period entry has the consumer shape', () => {
    const users = [mkAgent('a1', 'Alpha', 'south', 'u1'), mkUM('u1', 'UM', 'south')];
    const subs  = [mkSub('s1', 'a1', WK_SUN, 100)];
    const doc = buildLeaderboardDoc(subs, users, REF);
    expect(doc.week[0]).toEqual({
      agentId:        'a1',
      name:           'Alpha',
      unitName:       'Unit u1',
      periodApi:      100,
      apps:           1,
      rank:           1,
      rankWithinUnit: 1,
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
});

// ── computeAndWriteLeaderboards (end-to-end with mocked Firestore) ───────────

describe('computeAndWriteLeaderboards', () => {
  beforeEach(() => {
    for (const k of Object.keys(firestoreData)) delete firestoreData[k];
    for (const k of Object.keys(firestoreDocs)) delete firestoreDocs[k];
    mockBatch.ops = [];
  });

  test('writes one leaderboards/{branchId} doc per branch', async () => {
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
    expect(mockBatch.ops).toHaveLength(2);
    const paths = mockBatch.ops.map((op) => op.ref).filter(Boolean).length;
    expect(paths).toBe(2); // refs were captured
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

  test('empty inputs result in zero writes', async () => {
    firestoreData['tenants/T/submissions'] = [];
    firestoreData['tenants/T/users'] = [];
    const result = await computeAndWriteLeaderboards('T', REF);
    expect(result.branchCount).toBe(0);
    expect(mockBatch.ops).toHaveLength(0);
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
