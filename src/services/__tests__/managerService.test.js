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

import { getTenantUsers } from '../managerService';

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
