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

  it('branch_manager with branchId: applies where("branchId","==",claim) filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-001' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent', branchId: 'branch-001' }),
      makeDoc('agent-b', { name: 'Agent B', role: 'agent', branchId: 'branch-001' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branch-001');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('__col__', '__where__');
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__query__');
    expect(users).toHaveLength(2);
  });

  it('branch_manager without branchId claim: falls through to unscoped', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent' }),
    ));

    await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__col__');
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
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-001' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('doc-xyz', { name: 'Test User' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users[0].id).toBe('doc-xyz');
    expect(users[0].name).toBe('Test User');
  });
});

describe('managerService.getTenantUsers — active: false filtering', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');

    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
  });

  it('default call excludes active: false users', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-active',   { name: 'Active Agent',   role: 'agent', active: true }),
      makeDoc('agent-inactive', { name: 'Inactive Agent', role: 'agent', active: false }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('agent-active');
  });

  it('{ includeInactive: true } returns active: false users', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-active',   { name: 'Active Agent',   role: 'agent', active: true }),
      makeDoc('agent-inactive', { name: 'Inactive Agent', role: 'agent', active: false }),
    ));

    const users = await getTenantUsers('tenant1', { includeInactive: true });

    expect(users).toHaveLength(2);
  });

  it('absent active field treated as active (truthy)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-no-field', { name: 'Legacy Agent', role: 'agent' }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('agent-no-field');
  });

  it('provisioning + active: false both filtered in default call', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-ok',       { name: 'OK',           active: true }),
      makeDoc('agent-inactive', { name: 'Inactive',     active: false }),
      makeDoc('agent-prov',     { name: 'Provisioning', provisioning: true }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('agent-ok');
  });

  it('SHAKEDOWN-002 unit scoping unaffected: unit_manager still applies unitId where filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent', unitId: 'um-uid-001', active: true }),
    ));

    const users = await getTenantUsers('tenant1');

    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(users).toHaveLength(1);
  });
});

describe('managerService.getWeeklySubmissions — branch and unit scoping', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');
  });

  it('unit_manager: single getDocs using where("unitId","==",callerUid)', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', unitId: 'um-uid-001', weekStarting: '2026-01-05', status: 'submitted' }),
      makeDoc('sub-2', { agentId: 'agent-b', unitId: 'um-uid-001', weekStarting: '2026-01-05', status: 'submitted' }),
    ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    // Single getDocs — no agent pre-fetch
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('weekStarting', '==', '2026-01-05');
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
    expect(subs).toHaveLength(2);
  });

  it('unit_manager: returns [] when no submissions match the unit', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap());

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(subs).toEqual([]);
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('branch_manager with branchId: prefetches branch agents then filters submissions', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-001' } }),
    };
    // First getDocs: getBranchAgentIds — 2 agents in branch
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('agent-a', { role: 'agent', branchId: 'branch-001' }),
      makeDoc('agent-b', { role: 'agent', branchId: 'branch-001' }),
    ));
    // Second getDocs: weekly submissions — one from a different branch
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05', status: 'submitted' }),
      makeDoc('sub-2', { agentId: 'agent-b', weekStarting: '2026-01-05', status: 'submitted' }),
      makeDoc('sub-3', { agentId: 'agent-x', weekStarting: '2026-01-05', status: 'submitted' }),
    ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(2);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branch-001');
    // Other-branch agent filtered out
    expect(subs).toHaveLength(2);
    expect(subs.map((s) => s.id)).not.toContain('sub-3');
  });

  it('branch_manager: returns [] immediately when branch has no agents', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-empty' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap()); // no agents

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(subs).toEqual([]);
    // Early return — no second getDocs for submissions
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('branch_manager without branchId claim: falls through to full tenant query', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-01-05' }),
    ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('branchId', '==', expect.anything());
    expect(subs).toHaveLength(1);
  });

  it('tenant_admin: single getDocs, no unitId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('unitId', '==', expect.anything());
  });

  it('maps doc.id to the id field on returned objects (BM path)', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-001' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('agent-a', { role: 'agent', branchId: 'branch-001' }),
    ));
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-xyz', { agentId: 'agent-a', weekStarting: '2026-01-05' }),
    ));

    const subs = await getWeeklySubmissions('tenant1', '2026-01-05');

    expect(subs[0].id).toBe('sub-xyz');
    expect(subs[0].agentId).toBe('agent-a');
  });
});

describe('managerService.getAllYTDSubmissions — branch and unit scoping', () => {
  beforeEach(() => {
    hoisted.mockGetDocs.mockReset();
    hoisted.mockWhere.mockReset();
    hoisted.mockQuery.mockReset();
    hoisted.mockCollection.mockReset();

    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockCollection.mockReturnValue('__col__');
    hoisted.mockWhere.mockReturnValue('__where__');
    hoisted.mockQuery.mockReturnValue('__query__');
  });

  it('unit_manager: single getDocs using where("unitId","==",callerUid) + YTD date range', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', unitId: 'um-uid-001', weekStarting: '2026-03-02', status: 'submitted' }),
    ));

    const subs = await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', 'in', expect.anything());
    expect(subs).toHaveLength(1);
  });

  it('unit_manager: draft submissions are filtered out client-side', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    // Firestore returns both submitted and draft (status not filtered server-side for UM path)
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-submitted', { agentId: 'agent-a', unitId: 'um-uid-001', weekStarting: '2026-03-02', status: 'submitted' }),
      makeDoc('sub-draft',     { agentId: 'agent-a', unitId: 'um-uid-001', weekStarting: '2026-03-09', status: 'draft' }),
    ));

    const subs = await getAllYTDSubmissions('tenant1');

    // Only the submitted one should survive the client-side filter
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe('sub-submitted');
  });

  it('unit_manager: returns [] when no submissions match the unit', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap());

    const subs = await getAllYTDSubmissions('tenant1');

    expect(subs).toEqual([]);
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('branch_manager with branchId: prefetches branch agents then filters YTD submissions', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-001' } }),
    };
    // First getDocs: getBranchAgentIds
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('agent-a', { role: 'agent', branchId: 'branch-001' }),
    ));
    // Second getDocs: YTD submissions — includes one from another branch
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-03-02', status: 'submitted' }),
      makeDoc('sub-2', { agentId: 'agent-x', weekStarting: '2026-03-02', status: 'submitted' }),
    ));

    const subs = await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(2);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branch-001');
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe('sub-1');
  });

  it('branch_manager: returns [] immediately when branch has no agents', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager', branchId: 'branch-empty' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap()); // no agents

    const subs = await getAllYTDSubmissions('tenant1');

    expect(subs).toEqual([]);
    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('branch_manager without branchId claim: falls through to full tenant query', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValueOnce(makeSnap(
      makeDoc('sub-1', { agentId: 'agent-a', weekStarting: '2026-03-02', status: 'submitted' }),
    ));

    const subs = await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('branchId', '==', expect.anything());
    expect(subs).toHaveLength(1);
  });

  it('tenant_admin: single getDocs, no unitId filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getAllYTDSubmissions('tenant1');

    expect(hoisted.mockGetDocs).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('unitId', '==', expect.anything());
  });
});
