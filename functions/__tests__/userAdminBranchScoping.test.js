'use strict';

// SEC-05 (audit 2026-09-24, P2b) — deactivateUser and updateUser were
// tenant-scoped only: a branch_manager could disable, promote or demote a user
// in another branch, and a unit_manager could act outside their unit. These
// tests pin the fix: BM own branch, UM own unit, SM/TA any branch.

// Module-scope mutable state — must be prefixed 'mock' for jest.mock() hoisting.
let mockDocs = {};
let mockUpdates = [];
let mockClaims = [];
let mockRevoked = [];

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    delete: () => '__DELETE__',
  };
  function makeDocRef(path) {
    return {
      get: async () => {
        const data = mockDocs[path];
        return { exists: !!data, data: () => data ?? null };
      },
      update: async (patch) => {
        mockUpdates.push({ path, patch });
        mockDocs[path] = { ...(mockDocs[path] ?? {}), ...patch };
      },
    };
  }
  const firestore = () => ({
    doc: (path) => makeDocRef(path),
    collection: () => ({ add: async () => ({ id: 'fake' }) }),
  });
  firestore.FieldValue = FieldValue;
  const auth = () => ({
    setCustomUserClaims: async (uid, claims) => { mockClaims.push({ uid, claims }); },
    revokeRefreshTokens: async (uid) => { mockRevoked.push(uid); },
  });
  return {
    default: { initializeApp: () => {}, auth, firestore },
    initializeApp: () => {},
    auth,
    firestore,
  };
});

jest.mock('firebase-functions/v1', () => {
  const HttpsError = class extends Error {
    constructor(code, message) { super(message); this.code = code; }
  };
  const noopChain = {
    timeZone: () => noopChain,
    onRun: () => ({}),
    onPublish: () => ({}),
    onWrite: () => ({}),
    onCreate: () => ({}),
    onUpdate: () => ({}),
    onDelete: () => ({}),
  };
  const fnsMock = {
    https: {
      HttpsError,
      onCall: (fn) => ({ _onCall: fn }),
      onRequest: () => ({}),
    },
    pubsub: { schedule: () => noopChain, topic: () => noopChain },
    firestore: { document: () => noopChain },
    analytics: { event: () => noopChain },
    auth: { user: () => noopChain },
  };
  fnsMock.runWith = () => fnsMock;
  return fnsMock;
});

jest.mock('../utils/email', () => ({ buildMailDoc: () => ({}) }));
jest.mock('../callSources/revokeInboundLinks', () => ({
  revokeInboundLinks: async () => 0,
}));

const { deactivateUser, updateUser } = require('../index');
const deactivate = deactivateUser._onCall;
const update = updateUser._onCall;

const T = 't1';

function ctx(role, uid) {
  return {
    auth: { uid, token: { role, tenantId: T } },
    rawRequest: { ip: '1.2.3.4', headers: { 'user-agent': 'jest' } },
  };
}

function seedUser(uid, fields) {
  mockDocs[`tenants/${T}/users/${uid}`] = { uid, tenantId: T, ...fields };
}

function expectCode(promise, code) {
  return promise.then(
    () => { throw new Error(`Expected HttpsError '${code}' but resolved`); },
    (err) => { expect(err.code).toBe(code); },
  );
}

beforeEach(() => {
  mockDocs = {};
  mockUpdates = [];
  mockClaims = [];
  mockRevoked = [];

  // Callers
  seedUser('bmA', { role: 'branch_manager', branchId: 'branchA' });
  seedUser('umA1', { role: 'unit_manager', branchId: 'branchA', unitId: 'umA1' });
  seedUser('sm', { role: 'sales_manager', branchId: 'branchA' });
  seedUser('ta', { role: 'tenant_admin', branchId: 'branchA' });
  seedUser('bmNoBranch', { role: 'branch_manager' });

  // Targets
  seedUser('agentA1', { role: 'agent', branchId: 'branchA', unitId: 'umA1', active: true });
  seedUser('agentA2', { role: 'agent', branchId: 'branchA', unitId: 'umA2', active: true });
  seedUser('agentB1', { role: 'agent', branchId: 'branchB', unitId: 'umB1', active: true });
  seedUser('agentNoBranch', { role: 'agent', unitId: 'umA1', active: true });
});

// ── deactivateUser ─────────────────────────────────────────────────────────────

describe('deactivateUser — SEC-05 branch/unit scope', () => {
  it('BM deactivates an agent in own branch → OK', async () => {
    const res = await deactivate({ targetUid: 'agentA1', active: false }, ctx('branch_manager', 'bmA'));
    expect(res.success).toBe(true);
    expect(mockRevoked).toContain('agentA1');
  });

  it('BM deactivates an agent in another branch → permission-denied, nothing written (audit exploit)', async () => {
    await expectCode(
      deactivate({ targetUid: 'agentB1', active: false }, ctx('branch_manager', 'bmA')),
      'permission-denied',
    );
    expect(mockUpdates).toHaveLength(0);
    expect(mockRevoked).toHaveLength(0);
  });

  it('BM with no branchId on their own doc → permission-denied even for a branchless target', async () => {
    await expectCode(
      deactivate({ targetUid: 'agentNoBranch', active: false }, ctx('branch_manager', 'bmNoBranch')),
      'permission-denied',
    );
  });

  it('UM deactivates an agent in own unit → OK', async () => {
    const res = await deactivate({ targetUid: 'agentA1', active: false }, ctx('unit_manager', 'umA1'));
    expect(res.success).toBe(true);
  });

  it('UM deactivates an agent in another unit (same branch) → permission-denied', async () => {
    await expectCode(
      deactivate({ targetUid: 'agentA2', active: false }, ctx('unit_manager', 'umA1')),
      'permission-denied',
    );
    expect(mockUpdates).toHaveLength(0);
  });

  it('SM deactivates an agent in any branch → OK', async () => {
    const res = await deactivate({ targetUid: 'agentB1', active: false }, ctx('sales_manager', 'sm'));
    expect(res.success).toBe(true);
  });

  it('TA deactivates an agent in any branch → OK', async () => {
    const res = await deactivate({ targetUid: 'agentB1', active: true }, ctx('tenant_admin', 'ta'));
    expect(res.success).toBe(true);
  });
});

// ── updateUser ─────────────────────────────────────────────────────────────────

describe('updateUser — SEC-05 branch/unit scope', () => {
  it('BM promotes an agent in own branch to unit_manager → OK', async () => {
    const res = await update({ uid: 'agentA1', updates: { role: 'unit_manager' } }, ctx('branch_manager', 'bmA'));
    expect(res.success).toBe(true);
    expect(mockClaims[0]).toMatchObject({ uid: 'agentA1', claims: { role: 'unit_manager' } });
  });

  it('BM promotes an agent in another branch → permission-denied, no claim written (audit exploit)', async () => {
    await expectCode(
      update({ uid: 'agentB1', updates: { role: 'unit_manager' } }, ctx('branch_manager', 'bmA')),
      'permission-denied',
    );
    expect(mockClaims).toHaveLength(0);
    expect(mockUpdates).toHaveLength(0);
  });

  // Note: CREATION_MATRIX already stops a UM assigning any role but `agent`, so
  // this case was denied before SEC-05 too. The scope check now fires first —
  // defense in depth, not the exploit.
  it('UM edits a user in another unit → permission-denied', async () => {
    await expectCode(
      update({ uid: 'agentA2', updates: { role: 'unit_manager' } }, ctx('unit_manager', 'umA1')),
      'permission-denied',
    );
    expect(mockClaims).toHaveLength(0);
  });

  it('SM promotes an agent in any branch → OK', async () => {
    const res = await update({ uid: 'agentB1', updates: { role: 'unit_manager' } }, ctx('sales_manager', 'sm'));
    expect(res.success).toBe(true);
  });

  it('TA promotes an agent in any branch → OK', async () => {
    const res = await update({ uid: 'agentB1', updates: { role: 'unit_manager' } }, ctx('tenant_admin', 'ta'));
    expect(res.success).toBe(true);
  });
});
