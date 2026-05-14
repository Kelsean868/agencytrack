import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must run before any module-level imports.
const hoisted = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockWhere: vi.fn(),
  mockQuery: vi.fn(),
  mockCollection: vi.fn(),
  mockCurrentUser: null,
}));

vi.mock('../../firebase', () => ({
  db: {},
  auth: {
    get currentUser() { return hoisted.mockCurrentUser; },
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => hoisted.mockCollection(...args),
  query: (...args) => hoisted.mockQuery(...args),
  where: (...args) => hoisted.mockWhere(...args),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
}));

import {
  getTenantUsers,
  getWeeklySubmissions,
  getAllYTDSubmissions,
  clearAgentUidCache,
} from '../managerService';

// Helpers to build a fake Firestore snapshot.
function makeDoc(id, data) {
  return { id, data: () => data };
}
function makeSnap(...docs) {
  return { docs };
}

describe('managerService.getTenantUsers — SHAKEDOWN-002 unit scoping', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    // Default: getDocs returns an empty snapshot.
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    // collection / query / where return stable sentinel values for assertion.
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');
  });

  it('unit_manager: applies where("unitId","==",callerUid) filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent', unitId: 'um-uid-001' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('__col__', '__where__');
    // getDocs received the scoped query, not the bare collection.
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__query__');
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('agent-a');
  });

  it('branch_manager: no where filter — getDocs receives bare collection', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent', unitId: 'um-uid-001' }),
      makeDoc('agent-b', { name: 'Agent B', role: 'agent', unitId: 'um-uid-002' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    expect(hoisted.mockQuery).not.toHaveBeenCalled();
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__col__');
    expect(users).toHaveLength(2);
  });

  it('tenant_admin: no where filter — getDocs receives bare collection', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__col__');
  });

  it('platform_admin: no where filter — getDocs receives bare collection', async () => {
    hoisted.mockCurrentUser = {
      uid: 'pa-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'platform_admin' } }),
    };

    await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__col__');
  });

  it('provisioning docs are filtered out regardless of caller role', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', unitId: 'um-uid-001' }),
      makeDoc('prov-1',  { name: 'Prov 1',  unitId: 'um-uid-001', provisioning: true }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('agent-a');
  });

  it('maps doc.id to the id field on returned objects', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('doc-xyz', { name: 'Test User' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users[0].id).toBe('doc-xyz');
    expect(users[0].name).toBe('Test User');
  });
});

describe('managerService.getWeeklySubmissions — SHAKEDOWN-002B unit scoping', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');

    clearAgentUidCache();
  });

  it('unit_manager: pre-fetches agent UIDs then filters submissions by agentId', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      // First call: agents in UM's unit
      .mockResolvedValueOnce(makeSnap(
        makeDoc('agent-a', { unitId: 'um-uid-001' }),
        makeDoc('agent-b', { unitId: 'um-uid-001' }),
      ))
      // Second call: submissions for those agents
      .mockResolvedValueOnce(makeSnap(
        makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05', status: 'submitted' }),
        makeDoc('sub-2', { agentId: 'agent-b', weekStarting: '2026-01-05', status: 'submitted' }),
      ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    // Agent pre-fetch: where('unitId','==', callerUid)
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    // Submissions filter: where('agentId','in', resolvedUids)
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', 'in', ['agent-a', 'agent-b']);
    // Two getDocs calls: one for agents, one for submissions
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(2);
    expect(subs).toHaveLength(2);
  });

  it('unit_manager: provisioning agents are excluded from the agentId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(
        makeDoc('agent-a', { unitId: 'um-uid-001' }),
        makeDoc('agent-prov', { unitId: 'um-uid-001', provisioning: true }),
      ))
      .mockResolvedValueOnce(makeSnap(
        makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05', status: 'submitted' }),
      ));

    await getWeeklySubmissions('tenant1', '2026-01-05');

    // Provisioning agent must not appear in the in-filter
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', 'in', ['agent-a']);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.arrayContaining(['agent-prov']));
  });

  it('unit_manager: returns [] immediately when unit has no agents', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    // First getDocs: empty agents snapshot
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap());

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(subs).toEqual([]);
    // Only one getDocs call — no submissions query issued
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
  });

  it('branch_manager: single getDocs, no agentId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05', status: 'submitted' }),
      makeDoc('sub-2', { agentId: 'agent-c', weekStarting: '2026-01-05', status: 'submitted' }),
    ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
    expect(subs).toHaveLength(2);
  });

  it('tenant_admin: single getDocs, no agentId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
  });
});

describe('managerService.getAllYTDSubmissions — SHAKEDOWN-002B unit scoping', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');

    clearAgentUidCache();
  });

  it('unit_manager: pre-fetches agent UIDs then filters YTD submissions by agentId', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(
        makeDoc('agent-a', { unitId: 'um-uid-001' }),
      ))
      .mockResolvedValueOnce(makeSnap(
        makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-03-02', status: 'submitted' }),
      ));

    const subs = await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', 'in', ['agent-a']);
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(2);
    expect(subs).toHaveLength(1);
  });

  it('unit_manager: draft submissions are filtered out client-side', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(
        makeDoc('agent-a', { unitId: 'um-uid-001' }),
      ))
      // Firestore returns both submitted and draft (status not filtered server-side for UM path)
      .mockResolvedValueOnce(makeSnap(
        makeDoc('sub-submitted', { agentId: 'agent-a', weekStarting: '2026-03-02', status: 'submitted' }),
        makeDoc('sub-draft',     { agentId: 'agent-a', weekStarting: '2026-03-09', status: 'draft' }),
      ));

    const subs = await getAllYTDSubmissions('tenant1');

    // Only the submitted one should survive the client-side filter
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe('sub-submitted');
  });

  it('unit_manager: returns [] immediately when unit has no agents', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap());

    const subs = await getAllYTDSubmissions('tenant1');

    expect(subs).toEqual([]);
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
  });

  it('branch_manager: single getDocs, no agentId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-03-02', status: 'submitted' }),
      makeDoc('sub-2', { agentId: 'agent-c', weekStarting: '2026-03-02', status: 'submitted' }),
    ));

    const subs = await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
    expect(subs).toHaveLength(2);
  });

  it('tenant_admin: single getDocs, no agentId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
  });
});

describe('managerService — agent UID cache', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');

    clearAgentUidCache();
  });

  it('cache miss: first UM call queries users + submissions (2 getDocs)', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-uid-001' })))
      .mockResolvedValueOnce(makeSnap(
        makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05', status: 'submitted' }),
      ));

    await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(2);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
  });

  it('cache hit: second UM call within session skips the users query (1 getDocs)', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      // First call: agents + submissions
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-uid-001' })))
      .mockResolvedValueOnce(makeSnap())
      // Second call: only submissions (cache hit on agents)
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');
    await getWeeklySubmissions('tenant1', '2026-01-12');

    // Three getDocs total: agents + subs (call 1), subs only (call 2).
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(3);
    // unitId filter fires exactly once across both calls.
    const unitIdCalls = hoisted.mockWhere.mock.calls
      .filter(([field]) => field === 'unitId');
    expect(unitIdCalls).toHaveLength(1);
  });

  it('clearAgentUidCache(): post-clear, next call re-queries users', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      // First call: agents + submissions
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-uid-001' })))
      .mockResolvedValueOnce(makeSnap())
      // After clear: agents + submissions again
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-uid-001' })))
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');
    clearAgentUidCache();
    await getWeeklySubmissions('tenant1', '2026-01-12');

    // Four getDocs total: agents + subs, then agents + subs again post-clear.
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(4);
    const unitIdCalls = hoisted.mockWhere.mock.calls
      .filter(([field]) => field === 'unitId');
    expect(unitIdCalls).toHaveLength(2);
  });

  it('per-user keying: UM_A cache does not leak to UM_B', async () => {
    // First UM populates cache.
    hoisted.mockCurrentUser = {
      uid: 'um-a',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-a' })))
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');

    // Switch to a different UM — should NOT hit UM_A's cache.
    hoisted.mockCurrentUser = {
      uid: 'um-b',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-b', { unitId: 'um-b' })))
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');

    // 4 getDocs total — each UM did its own agents lookup.
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(4);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-a');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-b');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', 'in', ['agent-a']);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', 'in', ['agent-b']);
  });

  it('provisioning agents are filtered out of cached UIDs', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      .mockResolvedValueOnce(makeSnap(
        makeDoc('agent-a',    { unitId: 'um-uid-001' }),
        makeDoc('agent-prov', { unitId: 'um-uid-001', provisioning: true }),
      ))
      .mockResolvedValueOnce(makeSnap())
      // Second call exercises the cached value.
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');
    await getWeeklySubmissions('tenant1', '2026-01-12');

    // Both submission queries should use the provisioning-filtered list.
    const agentIdInCalls = hoisted.mockWhere.mock.calls
      .filter(([field, op]) => field === 'agentId' && op === 'in');
    expect(agentIdInCalls).toHaveLength(2);
    expect(agentIdInCalls[0][2]).toEqual(['agent-a']);
    expect(agentIdInCalls[1][2]).toEqual(['agent-a']);
  });

  it('cross-function reuse: getAllYTDSubmissions reuses cache populated by getWeeklySubmissions', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs
      // getWeeklySubmissions: agents + subs
      .mockResolvedValueOnce(makeSnap(makeDoc('agent-a', { unitId: 'um-uid-001' })))
      .mockResolvedValueOnce(makeSnap())
      // getAllYTDSubmissions: subs only (cache hit on agents)
      .mockResolvedValueOnce(makeSnap());

    await getWeeklySubmissions('tenant1', '2026-01-05');
    await getAllYTDSubmissions('tenant1');

    // 3 getDocs total — agents lookup ran exactly once across both functions.
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(3);
    const unitIdCalls = hoisted.mockWhere.mock.calls
      .filter(([field]) => field === 'unitId');
    expect(unitIdCalls).toHaveLength(1);
  });
});
