'use strict';

// Module-scope mutable state — must be prefixed 'mock' for jest.mock() hoisting.
let mockDocs = {};
let mockMailAdds = [];
let mockAuditAdds = [];
let mockAuthUsers = {};

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };

  function makeDocRef(path) {
    return {
      get: async () => {
        const data = mockDocs[path];
        return { exists: !!data, data: () => data ?? null };
      },
    };
  }

  function makeCollRef(name) {
    return {
      add: async (doc) => {
        if (name === 'mail') mockMailAdds.push(doc);
        else if (name === 'auditInviteResends') mockAuditAdds.push(doc);
        return { id: 'fake-id' };
      },
    };
  }

  const firestore = () => ({
    doc:        (path) => makeDocRef(path),
    collection: (name) => makeCollRef(name),
  });
  firestore.FieldValue = FieldValue;

  const auth = () => ({
    getUser: async (uid) => {
      const u = mockAuthUsers[uid];
      if (!u) {
        const err = new Error('user-not-found');
        err.code = 'auth/user-not-found';
        throw err;
      }
      return u;
    },
    generatePasswordResetLink: async () =>
      'https://agencytrack.vercel.app/__/auth/action?oobCode=FAKETOKEN',
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
  // Stub for all trigger builder chains: .schedule/.topic/.document etc.
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
      onCall:    (fn) => ({ _onCall: fn }),
      onRequest: () => ({}),
    },
    pubsub: {
      schedule: () => noopChain,
      topic:    () => noopChain,
    },
    firestore: {
      document: () => noopChain,
    },
    analytics: {
      event: () => noopChain,
    },
    auth: {
      user: () => noopChain,
    },
  };
  // runWith({...}) returns a functions-like object with the same shape
  fnsMock.runWith = () => fnsMock;
  return fnsMock;
});

jest.mock('../utils/email', () => ({
  buildMailDoc: (_to, _subj, _txt, _html, vars) => ({
    __isMail: true, to: _to, subject: _subj, vars,
  }),
}));

const { resendInviteEmail } = require('../index');
const handler = resendInviteEmail._onCall;

// ── helpers ──────────────────────────────────────────────────────────────────

function ctx(role, uid, tenantId = 't1') {
  return {
    auth: { uid, token: { role, tenantId, email: `${uid}@test.com` } },
    rawRequest: { ip: '1.2.3.4', headers: { 'user-agent': 'jest-test' } },
  };
}

function expectCode(promise, code) {
  return promise.then(
    () => { throw new Error(`Expected HttpsError '${code}' but resolved`); },
    (err) => { expect(err.code).toBe(code); }
  );
}

function seedTarget(uid, { tenantId = 't1', role = 'agent', unitId = 'unit-1', active = true, email = `${uid}@test.com`, name = uid } = {}) {
  mockAuthUsers[uid] = {
    uid, email, displayName: name, customClaims: { tenantId, role },
  };
  mockDocs[`tenants/${tenantId}/users/${uid}`] = {
    uid, email, name, role, unitId, active, tenantId,
  };
}

function seedActor(uid, { tenantId = 't1', role = 'branch_manager', unitId = 'unit-1', email = `${uid}@test.com` } = {}) {
  mockDocs[`tenants/${tenantId}/users/${uid}`] = {
    uid, email, role, unitId, tenantId,
  };
}

beforeEach(() => {
  mockDocs       = {};
  mockMailAdds   = [];
  mockAuditAdds  = [];
  mockAuthUsers  = {};
});

// ── Actor gate ────────────────────────────────────────────────────────────────

describe('resendInviteEmail — actor gate', () => {
  it('allows platform_admin', async () => {
    seedTarget('target-1', { tenantId: 't1' });
    const result = await handler({ uid: 'target-1' }, ctx('platform_admin', 'pa-1', null));
    expect(result.success).toBe(true);
  });

  it('allows tenant_admin', async () => {
    seedTarget('target-1');
    seedActor('ta-1', { role: 'tenant_admin' });
    const result = await handler({ uid: 'target-1' }, ctx('tenant_admin', 'ta-1'));
    expect(result.success).toBe(true);
  });

  it('allows sales_manager', async () => {
    seedTarget('target-1');
    seedActor('sm-1', { role: 'sales_manager' });
    const result = await handler({ uid: 'target-1' }, ctx('sales_manager', 'sm-1'));
    expect(result.success).toBe(true);
  });

  it('allows branch_manager', async () => {
    seedTarget('target-1');
    seedActor('bm-1');
    const result = await handler({ uid: 'target-1' }, ctx('branch_manager', 'bm-1'));
    expect(result.success).toBe(true);
  });

  it('allows unit_manager for own-unit agent', async () => {
    seedTarget('target-1', { role: 'agent', unitId: 'unit-1' });
    seedActor('um-1', { role: 'unit_manager', unitId: 'unit-1' });
    const result = await handler({ uid: 'target-1' }, ctx('unit_manager', 'um-1'));
    expect(result.success).toBe(true);
  });

  it('denies agent role', async () => {
    await expectCode(handler({ uid: 'target-1' }, ctx('agent', 'ag-1')), 'permission-denied');
  });

  it('denies unauthenticated', async () => {
    await expectCode(handler({ uid: 'target-1' }, { auth: null }), 'unauthenticated');
  });
});

// ── Unit-manager scope guard ──────────────────────────────────────────────────

describe('resendInviteEmail — unit_manager scope guard', () => {
  it('denies UM acting on agent in a different unit', async () => {
    seedTarget('target-1', { role: 'agent', unitId: 'unit-2' });
    seedActor('um-1', { role: 'unit_manager', unitId: 'unit-1' });
    await expectCode(handler({ uid: 'target-1' }, ctx('unit_manager', 'um-1')), 'permission-denied');
  });

  it('denies UM acting on a non-agent (unit_manager target)', async () => {
    seedTarget('target-um', { role: 'unit_manager', unitId: 'unit-1' });
    seedActor('um-1', { role: 'unit_manager', unitId: 'unit-1' });
    await expectCode(handler({ uid: 'target-um' }, ctx('unit_manager', 'um-1')), 'permission-denied');
  });

  it('denies UM when actor has no unitId', async () => {
    seedTarget('target-1', { role: 'agent', unitId: 'unit-1' });
    mockDocs['tenants/t1/users/um-no-unit'] = { uid: 'um-no-unit', role: 'unit_manager', tenantId: 't1' };
    await expectCode(handler({ uid: 'target-1' }, ctx('unit_manager', 'um-no-unit')), 'permission-denied');
  });
});

// ── channel validation ────────────────────────────────────────────────────────

describe('resendInviteEmail — channel validation', () => {
  beforeEach(() => {
    seedTarget('target-1');
    seedActor('bm-1');
  });

  it("defaults channel to 'email' when absent", async () => {
    const result = await handler({ uid: 'target-1' }, ctx('branch_manager', 'bm-1'));
    expect(result.emailQueued).toBe(true);
    expect('link' in result).toBe(false);
    expect(mockMailAdds).toHaveLength(1);
  });

  it("accepts channel 'email' explicitly", async () => {
    const result = await handler({ uid: 'target-1', channel: 'email' }, ctx('branch_manager', 'bm-1'));
    expect(result.emailQueued).toBe(true);
    expect(mockMailAdds).toHaveLength(1);
  });

  it("accepts channel 'link' and returns the link without queuing mail", async () => {
    const result = await handler({ uid: 'target-1', channel: 'link' }, ctx('branch_manager', 'bm-1'));
    expect(result.success).toBe(true);
    expect(result.link).toBe('https://agencytrack.vercel.app/__/auth/action?oobCode=FAKETOKEN');
    expect(result.emailQueued).toBe(false);
    expect(mockMailAdds).toHaveLength(0);
  });

  it("rejects unknown channel value with invalid-argument", async () => {
    await expectCode(
      handler({ uid: 'target-1', channel: 'sms' }, ctx('branch_manager', 'bm-1')),
      'invalid-argument'
    );
  });
});

// ── target validation ─────────────────────────────────────────────────────────

describe('resendInviteEmail — target validation', () => {
  beforeEach(() => {
    seedActor('bm-1');
  });

  it('throws not-found for unknown uid', async () => {
    await expectCode(handler({ uid: 'ghost-uid' }, ctx('branch_manager', 'bm-1')), 'not-found');
  });

  it('throws invalid-argument when uid is missing', async () => {
    await expectCode(handler({}, ctx('branch_manager', 'bm-1')), 'invalid-argument');
  });

  it('throws failed-precondition for inactive target', async () => {
    seedTarget('inactive-1', { active: false });
    await expectCode(handler({ uid: 'inactive-1' }, ctx('branch_manager', 'bm-1')), 'failed-precondition');
  });

  it('throws failed-precondition for half-provisioned target (no Firestore doc)', async () => {
    mockAuthUsers['half-prov'] = {
      uid: 'half-prov', email: 'hp@test.com', displayName: 'HP',
      customClaims: { tenantId: 't1', role: 'agent' },
    };
    // No mockDocs entry — simulates half-provisioned state
    await expectCode(handler({ uid: 'half-prov' }, ctx('branch_manager', 'bm-1')), 'failed-precondition');
  });
});

// ── tenant isolation ──────────────────────────────────────────────────────────

describe('resendInviteEmail — tenant isolation', () => {
  it('denies non-PA actor acting across tenants', async () => {
    seedTarget('target-t2', { tenantId: 't2' });
    seedActor('bm-t1');
    await expectCode(
      handler({ uid: 'target-t2' }, ctx('branch_manager', 'bm-t1', 't1')),
      'permission-denied'
    );
  });

  it('allows platform_admin cross-tenant access', async () => {
    seedTarget('target-t2', { tenantId: 't2' });
    const result = await handler({ uid: 'target-t2' }, ctx('platform_admin', 'pa-1', null));
    expect(result.success).toBe(true);
  });
});

// ── audit doc ─────────────────────────────────────────────────────────────────

describe('resendInviteEmail — audit doc', () => {
  it("stamps method:'email' on the audit doc for email channel", async () => {
    seedTarget('target-1');
    seedActor('bm-1');
    await handler({ uid: 'target-1', channel: 'email' }, ctx('branch_manager', 'bm-1'));
    expect(mockAuditAdds).toHaveLength(1);
    expect(mockAuditAdds[0].method).toBe('email');
    expect(mockAuditAdds[0].emailQueued).toBe(true);
  });

  it("stamps method:'link' on the audit doc for link channel", async () => {
    seedTarget('target-1');
    seedActor('bm-1');
    await handler({ uid: 'target-1', channel: 'link' }, ctx('branch_manager', 'bm-1'));
    expect(mockAuditAdds).toHaveLength(1);
    expect(mockAuditAdds[0].method).toBe('link');
    expect(mockAuditAdds[0].emailQueued).toBe(false);
  });

  it('does not include the link value in the audit doc', async () => {
    seedTarget('target-1');
    seedActor('bm-1');
    await handler({ uid: 'target-1', channel: 'link' }, ctx('branch_manager', 'bm-1'));
    expect(mockAuditAdds[0].link).toBeUndefined();
    expect(mockAuditAdds[0].resetLink).toBeUndefined();
  });

  it('records actorRole, actorUid, targetUid, targetEmail on the audit doc', async () => {
    seedTarget('target-1', { email: 'target1@test.com' });
    seedActor('bm-1', { email: 'bm@test.com' });
    await handler({ uid: 'target-1' }, ctx('branch_manager', 'bm-1'));
    const audit = mockAuditAdds[0];
    expect(audit.actorRole).toBe('branch_manager');
    expect(audit.actorUid).toBe('bm-1');
    expect(audit.targetUid).toBe('target-1');
    expect(audit.targetEmail).toBe('target1@test.com');
  });
});
