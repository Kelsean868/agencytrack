import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must run before module imports.
const hoisted = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockHttpsCallable: vi.fn(),
  // SHAKEDOWN-002: for getAllUsers scoping tests.
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

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({ __fns: true }),
  httpsCallable: (...args) => hoisted.mockHttpsCallable(...args),
}));

import { createUser, getAllUsers } from '../agentManagementService';

const SAMPLE_USER = { role: 'agent', name: 'Test Agent', email: 'test@example.com' };

describe('agentManagementService.createUser', () => {
  beforeEach(() => {
    hoisted.mockCallable.mockReset();
    hoisted.mockHttpsCallable.mockReset();
    hoisted.mockHttpsCallable.mockReturnValue(hoisted.mockCallable);
  });

  // HIGH#1 regression guard: wrapper must not swallow or reshape CF response fields.

  it('returns CF response data unchanged on success (happy path)', async () => {
    hoisted.mockCallable.mockResolvedValue({ data: { uid: 'test-uid', emailQueued: true } });
    const result = await createUser(SAMPLE_USER);
    expect(result).toEqual({ uid: 'test-uid', emailQueued: true });
  });

  it('returns CF response data unchanged when email dispatch fails (PR #136 regression guard)', async () => {
    hoisted.mockCallable.mockResolvedValue({
      data: { uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' },
    });
    const result = await createUser(SAMPLE_USER);
    expect(result).toEqual({ uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' });
  });

  it('propagates callable rejection without swallowing', async () => {
    const err = Object.assign(new Error('internal'), { code: 'internal' });
    hoisted.mockCallable.mockRejectedValue(err);
    await expect(createUser(SAMPLE_USER)).rejects.toThrow('internal');
  });

  it('preserves emailQueued: true from CF success response', async () => {
    hoisted.mockCallable.mockResolvedValue({ data: { uid: 'test-uid', emailQueued: true } });
    const result = await createUser(SAMPLE_USER);
    expect(result.emailQueued).toBe(true);
  });

  it('preserves emailQueued: false and emailError string from CF email-failure response', async () => {
    hoisted.mockCallable.mockResolvedValue({
      data: { uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' },
    });
    const result = await createUser(SAMPLE_USER);
    expect(result.emailQueued).toBe(false);
    expect(typeof result.emailError).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// SHAKEDOWN-002: getAllUsers unit scoping
// ---------------------------------------------------------------------------

function makeDoc(id, data) {
  return { id, data: () => data };
}
function makeSnap(...docs) {
  return { docs };
}

describe('agentManagementService.getAllUsers — SHAKEDOWN-002 unit scoping', () => {
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

  it('unit_manager: applies where("unitId","==",callerUid) filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'um-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'unit_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', role: 'agent', unitId: 'um-uid-001' }),
    ));

    const users = await getAllUsers('tenant1');

    expect(hoisted.mockWhere).toHaveBeenCalledWith('unitId', '==', 'um-uid-001');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('__col__', '__where__');
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__query__');
    expect(users).toHaveLength(1);
  });

  it('branch_manager: no where filter — getDocs receives bare collection', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A', unitId: 'um-uid-001' }),
      makeDoc('agent-b', { name: 'Agent B', unitId: 'um-uid-002' }),
    ));

    const users = await getAllUsers('tenant1');

    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    expect(hoisted.mockGetDocs).toHaveBeenCalledWith('__col__');
    expect(users).toHaveLength(2);
  });

  it('tenant_admin: no where filter', async () => {
    hoisted.mockCurrentUser = {
      uid: 'ta-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'tenant_admin' } }),
    };

    await getAllUsers('tenant1');

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

    const users = await getAllUsers('tenant1');

    expect(users).toHaveLength(1);
    expect(users[0].uid).toBe('agent-a');
  });

  it('inactive docs excluded by default; included when includeInactive:true', async () => {
    hoisted.mockCurrentUser = {
      uid: 'bm-uid-001',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'branch_manager' } }),
    };
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A' }),
      makeDoc('agent-b', { name: 'Agent B', active: false }),
    ));

    const activeOnly = await getAllUsers('tenant1');
    expect(activeOnly).toHaveLength(1);

    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      makeDoc('agent-a', { name: 'Agent A' }),
      makeDoc('agent-b', { name: 'Agent B', active: false }),
    ));
    const withInactive = await getAllUsers('tenant1', { includeInactive: true });
    expect(withInactive).toHaveLength(2);
  });
});
