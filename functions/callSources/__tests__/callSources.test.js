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
// creditUid is deliberately ABSENT — it is now server-set, and passing it is
// itself a rejection trigger (see the cross-credit block below).
const validData = (over = {}) => ({
  sourceApp: 'kqm-calls',
  sourceUserId: 'kqm-user-77',
  label: 'Tracy-ann Nurse (assistant)',
  ...over,
});

beforeEach(() => {
  docData = {};
  writes = [];
  updates = [];
  autoId = 0;
  seedUser('caller1', { role: 'agent' });
  seedUser('agentA', { role: 'agent' });
});

// ── Cross-credit rejection — the load-bearing test in this slice ─────────────
//
// This replaces slice A's unit_manager denial. Under self-service there is no
// role to deny, so the thing that must never work is crediting SOMEONE ELSE.
// If this test can be made to pass while creditUid comes off the payload, the
// whole security argument for this slice is void.

describe('createCallSource — cross-credit is impossible', () => {
  it('REJECTS a payload carrying creditUid for another user', async () => {
    await expectCode(
      createHandler(validData({ creditUid: 'agentA' }), ctx('agent', 'caller1')),
      'invalid-argument'
    );
    expect(writes).toHaveLength(0);
  });

  it('REJECTS a payload carrying creditUid even when it names the caller', async () => {
    // Rejected on presence, not on value. Accepting a "harmless" self-naming
    // creditUid would keep the field alive in callers' mental models and in
    // their code, which is exactly how the next author reintroduces the other case.
    await expectCode(
      createHandler(validData({ creditUid: 'caller1' }), ctx('agent', 'caller1')),
      'invalid-argument'
    );
    expect(writes).toHaveLength(0);
  });

  it('REJECTS a null creditUid — presence is the trigger, not truthiness', async () => {
    await expectCode(
      createHandler(validData({ creditUid: null }), ctx('agent', 'caller1')),
      'invalid-argument'
    );
    expect(writes).toHaveLength(0);
  });

  it('always stores creditUid === the caller uid, from the token', async () => {
    await createHandler(validData(), ctx('agent', 'caller1'));
    expect(writes[0].data.creditUid).toBe('caller1');
    expect(writes[0].data.createdBy).toBe('caller1');
  });
});

// ── No role gate: every signed-in tenant member may link their own KPIs ──────
//
// The unit_manager case INVERTS from slice A. It denied a UM because a UM was
// writing someone else's KPIs; here a UM writing their OWN is ordinary use.

describe('createCallSource — self-service, no role gate', () => {
  it.each(['agent', 'unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'])(
    'ALLOWS %s to create their own link',
    async (role) => {
      seedUser('self1', { role });
      const res = await createHandler(validData(), ctx(role, 'self1'));
      expect(res.sourceId).toBeTruthy();
      expect(writes).toHaveLength(1);
      expect(writes[0].data.creditUid).toBe('self1');
    }
  );

  it('REJECTS an unauthenticated caller', async () => {
    await expectCode(createHandler(validData(), {}), 'unauthenticated');
    expect(writes).toHaveLength(0);
  });

  it('REJECTS a signed-in caller with no user doc in this tenant', async () => {
    await expectCode(createHandler(validData(), ctx('agent', 'ghost')), 'not-found');
    expect(writes).toHaveLength(0);
  });
});

describe('revokeCallSource — owner-only', () => {
  beforeEach(() => {
    docData[`tenants/${TENANT}/callSources/src1`] = {
      sourceId: 'src1', tenantId: TENANT, creditUid: 'caller1',
    };
  });

  it('ALLOWS the owner, whatever their role', async () => {
    const res = await revokeHandler({ sourceId: 'src1' }, ctx('agent', 'caller1'));
    expect(res).toEqual({ success: true });
    expect(updates).toHaveLength(1);
  });

  it('REJECTS another agent', async () => {
    await expectCode(revokeHandler({ sourceId: 'src1' }, ctx('agent', 'other')), 'not-found');
    expect(updates).toHaveLength(0);
  });

  it('REJECTS a branch_manager who does not own it', async () => {
    // Decision 4: a manager has no more claim on an agent's link than a stranger.
    await expectCode(revokeHandler({ sourceId: 'src1' }, ctx('branch_manager', 'bm1')), 'not-found');
    expect(updates).toHaveLength(0);
  });

  it('reports not-found rather than permission-denied, so the id is not confirmed', async () => {
    // A "forbidden" here would be a probe oracle: it tells a caller the id is real.
    const real = revokeHandler({ sourceId: 'src1' }, ctx('agent', 'other'));
    const fake = revokeHandler({ sourceId: 'nope' }, ctx('agent', 'other'));
    await expectCode(real, 'not-found');
    await expectCode(fake, 'not-found');
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
    await createHandler(validData(), ctx('agent', 'caller1'));
    const d = writes[0].data;

    expect(d).toMatchObject({
      tenantId: TENANT,
      sourceApp: 'kqm-calls',
      sourceUserId: 'kqm-user-77',
      creditUid: 'caller1',
      label: 'Tracy-ann Nurse (assistant)',
      active: true,
      createdBy: 'caller1',
      revokedAt: null,
      lastUsedAt: null,
    });

    const days = (new Date(d.expiresAt.__ts) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(365);
  });

  it.each([
    ['sourceApp', { sourceApp: '' }],
    ['sourceUserId', { sourceUserId: '' }],
    ['label', { label: '' }],
  ])('rejects a missing %s', async (_field, over) => {
    await expectCode(createHandler(validData(over), ctx('agent', 'caller1')), 'invalid-argument');
    expect(writes).toHaveLength(0);
  });

  // The caller can no longer name anyone, so the only way to reach this is to be
  // a signed-in principal with no user doc in the tenant.
  it('rejects a caller with no user doc in this tenant', async () => {
    await expectCode(createHandler(validData(), ctx('agent', 'ghost')), 'not-found');
    expect(writes).toHaveLength(0);
  });

  // Without this, a deactivated agent could re-link themselves and walk straight
  // back through the door deactivateUser just closed.
  it('rejects a caller whose own account is deactivated', async () => {
    seedUser('agentGone', { role: 'agent', active: false });
    await expectCode(
      createHandler(validData(), ctx('agent', 'agentGone')),
      'failed-precondition'
    );
    expect(writes).toHaveLength(0);
  });

  it('allows a caller with no explicit active field (legacy docs)', async () => {
    seedUser('agentLegacy', { role: 'agent' });
    const res = await createHandler(validData(), ctx('agent', 'agentLegacy'));
    expect(res.sourceId).toBeTruthy();
  });
});

describe('revokeCallSource — lifecycle', () => {
  it('sets active:false and revokedAt rather than deleting', async () => {
    docData[`tenants/${TENANT}/callSources/src1`] = {
      sourceId: 'src1', tenantId: TENANT, creditUid: 'caller1',
    };
    await revokeHandler({ sourceId: 'src1' }, ctx('agent', 'caller1'));
    expect(updates[0].data).toEqual({ active: false, revokedAt: '<ts>' });
  });

  it('refuses a source belonging to another tenant', async () => {
    docData[`tenants/${TENANT}/callSources/src1`] = {
      sourceId: 'src1', tenantId: 'other_tenant', creditUid: 'caller1',
    };
    await expectCode(revokeHandler({ sourceId: 'src1' }, ctx('agent', 'caller1')), 'not-found');
    expect(updates).toHaveLength(0);
  });

  it('requires a sourceId', async () => {
    await expectCode(revokeHandler({}, ctx('agent', 'caller1')), 'invalid-argument');
  });
});
