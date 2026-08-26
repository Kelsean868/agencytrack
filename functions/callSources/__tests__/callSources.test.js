'use strict';

// Unit tests for the slice-A call-source callables.
//
// The load-bearing test in this file is the F4 trap: a unit_manager must be
// REJECTED. firestore.rules' canManage()/isManager() include unit_manager, so
// reaching for either helper here would compile, pass every other test, and
// silently hand a UM the power to mint a token that writes another agent's KPIs.
// If that test ever goes green while the gate is canManage(), it is the test
// that was wrong.

let docData = {};        // path → data (undefined = absent)
let writes = [];         // { path, data }
let updates = [];        // { path, data }
let autoId = 0;

function makeDocRef(path) {
  return {
    path,
    id: path.split('/').pop(),
    async get() {
      return { exists: docData[path] !== undefined, data: () => docData[path] };
    },
    async set(data) { writes.push({ path, data }); docData[path] = data; return null; },
    async update(data) { updates.push({ path, data }); return null; },
  };
}

function makeCollRef(path) {
  return {
    path,
    doc(id) {
      if (id) return makeDocRef(`${path}/${id}`);
      autoId += 1;
      return makeDocRef(`${path}/auto${autoId}`);
    },
  };
}

const mockFirestore = () => ({
  doc: (path) => makeDocRef(path),
  collection: (path) => makeCollRef(path),
});

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore()), {
    FieldValue: { serverTimestamp: () => '<ts>' },
    Timestamp: { fromDate: (d) => ({ __ts: d.toISOString() }) },
  }),
}));

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return { https: { onCall: (fn) => ({ _onCall: fn }), HttpsError } };
});

const { createCallSource, hashToken } = require('../createCallSource');
const { revokeCallSource } = require('../revokeCallSource');

const createHandler = createCallSource._onCall;
const revokeHandler = revokeCallSource._onCall;

const TENANT = 'tatillife_south';

function ctx(role, uid = 'caller1', tenantId = TENANT) {
  return { auth: { uid, token: { role, tenantId } } };
}
function seedUser(uid, fields = {}) {
  docData[`tenants/${TENANT}/users/${uid}`] = { uid, tenantId: TENANT, ...fields };
}
async function expectCode(promise, code) {
  await expect(promise).rejects.toMatchObject({ code });
}
const validData = (over = {}) => ({
  sourceApp: 'kqm-calls',
  sourceUserId: 'kqm-user-77',
  creditUid: 'agentA',
  label: 'Tracy-ann Nurse (assistant)',
  ...over,
});

beforeEach(() => {
  docData = {};
  writes = [];
  updates = [];
  autoId = 0;
  seedUser('agentA', { role: 'agent' });
});

// ── The F4 trap ──────────────────────────────────────────────────────────────

describe('createCallSource — role gate (F4 trap)', () => {
  it('REJECTS a unit_manager', async () => {
    await expectCode(createHandler(validData(), ctx('unit_manager')), 'permission-denied');
    expect(writes).toHaveLength(0);
  });

  it('REJECTS an agent', async () => {
    await expectCode(createHandler(validData(), ctx('agent')), 'permission-denied');
    expect(writes).toHaveLength(0);
  });

  it('REJECTS an unauthenticated caller', async () => {
    await expectCode(createHandler(validData(), {}), 'unauthenticated');
    expect(writes).toHaveLength(0);
  });

  it.each(['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'])(
    'ALLOWS %s',
    async (role) => {
      const res = await createHandler(validData(), ctx(role));
      expect(res.sourceId).toBeTruthy();
      expect(writes).toHaveLength(1);
    }
  );
});

describe('revokeCallSource — role gate (F4 trap)', () => {
  beforeEach(() => {
    docData[`tenants/${TENANT}/callSources/src1`] = { sourceId: 'src1', tenantId: TENANT };
  });

  it('REJECTS a unit_manager', async () => {
    await expectCode(revokeHandler({ sourceId: 'src1' }, ctx('unit_manager')), 'permission-denied');
    expect(updates).toHaveLength(0);
  });

  it('ALLOWS a branch_manager', async () => {
    const res = await revokeHandler({ sourceId: 'src1' }, ctx('branch_manager'));
    expect(res).toEqual({ success: true });
    expect(updates).toHaveLength(1);
  });
});

// ── Token hygiene (decision 4) ───────────────────────────────────────────────

describe('createCallSource — token hygiene', () => {
  it('stores the SHA-256 hash and never the raw token', async () => {
    const res = await createHandler(validData(), ctx('branch_manager'));
    const stored = writes[0].data;

    expect(stored.tokenHash).toBe(hashToken(res.token));
    expect(stored.tokenHash).not.toBe(res.token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // No field anywhere in the doc may carry the raw token.
    expect(JSON.stringify(stored)).not.toContain(res.token);
  });

  it('returns a raw token that is not derivable from the stored doc', async () => {
    const a = await createHandler(validData(), ctx('branch_manager'));
    const b = await createHandler(validData(), ctx('branch_manager'));
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Shape + lifecycle ────────────────────────────────────────────────────────

describe('createCallSource — stored shape', () => {
  it('writes the locked field set with a 365-day expiry', async () => {
    await createHandler(validData(), ctx('branch_manager', 'bm1'));
    const d = writes[0].data;

    expect(d).toMatchObject({
      tenantId: TENANT,
      sourceApp: 'kqm-calls',
      sourceUserId: 'kqm-user-77',
      creditUid: 'agentA',
      label: 'Tracy-ann Nurse (assistant)',
      active: true,
      createdBy: 'bm1',
      revokedAt: null,
      lastUsedAt: null,
    });

    const days = (new Date(d.expiresAt.__ts) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(365);
  });

  it.each([
    ['sourceApp', { sourceApp: '' }],
    ['sourceUserId', { sourceUserId: '' }],
    ['creditUid', { creditUid: '' }],
    ['label', { label: '' }],
  ])('rejects a missing %s', async (_field, over) => {
    await expectCode(createHandler(validData(over), ctx('branch_manager')), 'invalid-argument');
    expect(writes).toHaveLength(0);
  });

  it('rejects a creditUid that is not a user in this tenant', async () => {
    await expectCode(
      createHandler(validData({ creditUid: 'ghost' }), ctx('branch_manager')),
      'not-found'
    );
    expect(writes).toHaveLength(0);
  });

  // Without this, a manager could re-link an offboarded agent and walk straight
  // back through the door deactivateUser just closed (decision 2).
  it('rejects a creditUid whose account is deactivated', async () => {
    seedUser('agentGone', { role: 'agent', active: false });
    await expectCode(
      createHandler(validData({ creditUid: 'agentGone' }), ctx('branch_manager')),
      'failed-precondition'
    );
    expect(writes).toHaveLength(0);
  });

  it('allows a creditUid with no explicit active field (legacy docs)', async () => {
    seedUser('agentLegacy', { role: 'agent' });
    const res = await createHandler(validData({ creditUid: 'agentLegacy' }), ctx('branch_manager'));
    expect(res.sourceId).toBeTruthy();
  });
});

describe('revokeCallSource — lifecycle', () => {
  it('sets active:false and revokedAt rather than deleting', async () => {
    docData[`tenants/${TENANT}/callSources/src1`] = { sourceId: 'src1', tenantId: TENANT };
    await revokeHandler({ sourceId: 'src1' }, ctx('branch_manager'));
    expect(updates[0].data).toEqual({ active: false, revokedAt: '<ts>' });
  });

  it('refuses a source belonging to another tenant', async () => {
    docData[`tenants/${TENANT}/callSources/src1`] = { sourceId: 'src1', tenantId: 'other_tenant' };
    await expectCode(revokeHandler({ sourceId: 'src1' }, ctx('branch_manager')), 'not-found');
    expect(updates).toHaveLength(0);
  });

  it('requires a sourceId', async () => {
    await expectCode(revokeHandler({}, ctx('branch_manager')), 'invalid-argument');
  });
});
