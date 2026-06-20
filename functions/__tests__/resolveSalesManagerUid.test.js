'use strict';

// Module-scope mutable state — must be prefixed 'mock' for jest.mock() hoisting.
// Keyed by collection path → array of user docs ({ id, role, ... }).
let mockUsersByPath = {};

jest.mock('firebase-admin', () => {
  // A minimal query builder that actually applies .where()/.limit() so the test
  // pins the query shape (role string + tenant-scoped path), not just branches.
  function makeQuery(docs) {
    const q = {
      _docs: docs,
      where(field, op, value) {
        const filtered = q._docs.filter((d) =>
          op === '==' ? d[field] === value : true
        );
        return makeQuery(filtered);
      },
      limit(n) {
        return makeQuery(q._docs.slice(0, n));
      },
      get: async () => {
        const docs = q._docs.map((d) => ({ id: d.id, data: () => d }));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
    return q;
  }

  const FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };

  const firestore = () => ({
    collection: (path) => makeQuery(mockUsersByPath[path] ?? []),
  });
  firestore.FieldValue = FieldValue;

  const auth = () => ({});

  return {
    default: { initializeApp: () => {}, auth, firestore },
    initializeApp: () => {},
    auth,
    firestore,
  };
});

jest.mock('firebase-functions', () => {
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

const { resolveSalesManagerUid } = require('../index');
const handler = resolveSalesManagerUid._onCall;

// ── helpers ──────────────────────────────────────────────────────────────────

function ctx(uid, tenantId = 't1') {
  return { auth: { uid, token: { tenantId } } };
}

function expectCode(promise, code) {
  return promise.then(
    () => { throw new Error(`Expected HttpsError '${code}' but resolved`); },
    (err) => { expect(err.code).toBe(code); }
  );
}

function seedUsers(tenantId, users) {
  mockUsersByPath[`tenants/${tenantId}/users`] = users;
}

beforeEach(() => {
  mockUsersByPath = {};
});

// ── auth + claim gates ─────────────────────────────────────────────────────────

describe('resolveSalesManagerUid — auth/claim gates', () => {
  it('throws unauthenticated when context.auth is absent', async () => {
    await expectCode(handler({}, { auth: null }), 'unauthenticated');
  });

  it('throws permission-denied when the tenantId claim is missing', async () => {
    await expectCode(handler({}, { auth: { uid: 'u1', token: {} } }), 'permission-denied');
  });
});

// ── resolution logic ───────────────────────────────────────────────────────────

describe('resolveSalesManagerUid — resolution', () => {
  it('returns { smUid: null } when the tenant has no sales_manager', async () => {
    seedUsers('t1', [
      { id: 'ag-1', role: 'agent' },
      { id: 'bm-1', role: 'branch_manager' },
    ]);
    const result = await handler({}, ctx('ag-1'));
    expect(result).toEqual({ smUid: null });
  });

  it('returns the SM uid when exactly one sales_manager exists', async () => {
    seedUsers('t1', [
      { id: 'ag-1', role: 'agent' },
      { id: 'sm-1', role: 'sales_manager' },
    ]);
    const result = await handler({}, ctx('ag-1'));
    expect(result).toEqual({ smUid: 'sm-1' });
  });

  it('ignores non-SM roles (pins the role==sales_manager filter)', async () => {
    seedUsers('t1', [
      { id: 'ag-1', role: 'agent' },
      { id: 'bm-1', role: 'branch_manager' },
      { id: 'ta-1', role: 'tenant_admin' },
      { id: 'sm-1', role: 'sales_manager' },
    ]);
    const result = await handler({}, ctx('ag-1'));
    expect(result).toEqual({ smUid: 'sm-1' });
  });

  it('returns the first SM and warns when more than one exists', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      seedUsers('t1', [
        { id: 'sm-1', role: 'sales_manager' },
        { id: 'sm-2', role: 'sales_manager' },
      ]);
      const result = await handler({}, ctx('ag-1'));
      expect(result).toEqual({ smUid: 'sm-1' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('SM docs in tenant t1');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('scopes the query to the caller tenant (SM in another tenant is not returned)', async () => {
    seedUsers('t2', [{ id: 'sm-other', role: 'sales_manager' }]);
    const result = await handler({}, ctx('ag-1', 't1'));
    expect(result).toEqual({ smUid: null });
  });

  it('resolves the SM in the caller tenant when multiple tenants are seeded', async () => {
    seedUsers('t1', [{ id: 'sm-t1', role: 'sales_manager' }]);
    seedUsers('t2', [{ id: 'sm-t2', role: 'sales_manager' }]);
    const result = await handler({}, ctx('ag-1', 't1'));
    expect(result).toEqual({ smUid: 'sm-t1' });
  });
});
