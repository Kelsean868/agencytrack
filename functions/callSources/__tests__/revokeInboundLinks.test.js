'use strict';

// F5 / decision 2: deactivating a user revokes every call source that credits
// them, and reactivation deliberately does NOT restore them.
//
// The revoke is exercised through `revokeInboundLinks` — the helper
// `deactivateUser` calls from its `active === false` branch — because
// deactivateUser itself lives in functions/index.js behind a large module
// surface (Auth, CREATION_MATRIX, mail transport) that would have to be mocked
// wholesale to reach one batch write. The one-way property is asserted at the
// call-site level: the reactivate branch has no revoke call to make.

let mockDocs = {};       // path → data
let mockCommitted = [];  // arrays of { path, data }

const mockFirestore = () => ({
  collection: (path) => makeCollRef(path),
  batch: () => makeBatch(),
});

// Chainable where() that accumulates predicates, mirroring the real API.
function makeQuery(path, predicates) {
  return {
    where: (field, op, value) => makeQuery(path, [...predicates, { field, op, value }]),
    async get() {
      const matches = Object.entries(mockDocs)
        .filter(([p]) => p.startsWith(`${path}/`))
        .filter(([, d]) =>
          predicates.every(({ field, value }) =>
            value === null ? (d[field] ?? null) === null : d[field] === value
          )
        );
      return buildSnap(matches);
    },
  };
}

function makeCollRef(path) {
  return { path, where: (f, o, v) => makeQuery(path, [{ field: f, op: o, value: v }]) };
}

function buildSnap(entries) {
  const docs = entries.map(([p, d]) => ({
    ref: { path: p },
    data: () => d,
  }));
  return { empty: docs.length === 0, docs };
}

function makeBatch() {
  const ops = [];
  return {
    update(ref, data) { ops.push({ path: ref.path, data }); return this; },
    async commit() { mockCommitted.push(ops); return null; },
  };
}

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore()), {
    FieldValue: { serverTimestamp: () => '<ts>' },
  }),
}));

const { revokeInboundLinks, CHUNK_SIZE } = require('../revokeInboundLinks');

const TENANT = 'tatillife_south';
const seed = (id, fields) => {
  mockDocs[`tenants/${TENANT}/callSources/${id}`] = { sourceId: id, tenantId: TENANT, ...fields };
};

beforeEach(() => {
  mockDocs = {};
  mockCommitted = [];
});

describe('revokeInboundLinks (F5 — deactivation hook)', () => {
  it('revokes BOTH inbound links when a user with two is deactivated', async () => {
    seed('s1', { creditUid: 'agentA', revokedAt: null, active: true });
    seed('s2', { creditUid: 'agentA', revokedAt: null, active: true });

    const count = await revokeInboundLinks(TENANT, 'agentA');

    expect(count).toBe(2);
    const ops = mockCommitted[0];
    expect(ops).toHaveLength(2);
    ops.forEach((op) => {
      expect(op.data).toEqual({ active: false, revokedAt: '<ts>' });
    });
    expect(ops.map((o) => o.path).sort()).toEqual([
      `tenants/${TENANT}/callSources/s1`,
      `tenants/${TENANT}/callSources/s2`,
    ]);
  });

  it('leaves another agent\'s links alone', async () => {
    seed('s1', { creditUid: 'agentA', revokedAt: null, active: true });
    seed('s2', { creditUid: 'agentB', revokedAt: null, active: true });

    const count = await revokeInboundLinks(TENANT, 'agentA');

    expect(count).toBe(1);
    expect(mockCommitted[0][0].path).toBe(`tenants/${TENANT}/callSources/s1`);
  });

  it('skips already-revoked links and commits nothing when there is no work', async () => {
    seed('s1', { creditUid: 'agentA', revokedAt: '<earlier>', active: false });

    const count = await revokeInboundLinks(TENANT, 'agentA');

    expect(count).toBe(0);
    expect(mockCommitted).toHaveLength(0);
  });

  // A serverTimestamp is a field TRANSFORM costing a second operation against
  // Firestore's 500-per-batch cap, so CHUNK_SIZE + 1 links in ONE batch would
  // reject the commit and leave an offboarded user's links live.
  it(`commits in chunks so ${CHUNK_SIZE + 1} links cannot exceed the batch cap`, async () => {
    const total = CHUNK_SIZE + 1;
    for (let i = 0; i < total; i += 1) {
      seed(`s${i}`, { creditUid: 'agentA', revokedAt: null, active: true });
    }

    const count = await revokeInboundLinks(TENANT, 'agentA');

    expect(count).toBe(total);
    expect(mockCommitted).toHaveLength(2);
    expect(mockCommitted[0]).toHaveLength(CHUNK_SIZE);
    expect(mockCommitted[1]).toHaveLength(1);
    mockCommitted.forEach((batch) => {
      expect(batch.length).toBeLessThanOrEqual(CHUNK_SIZE);
    });
  });

  it('is one-way: a second call after reactivation does not clear revokedAt', async () => {
    seed('s1', { creditUid: 'agentA', revokedAt: null, active: true });
    await revokeInboundLinks(TENANT, 'agentA');

    // Simulate the post-revoke stored state, then reactivate the user. Nothing
    // in the reactivate path calls this helper, and calling it again is a no-op
    // rather than a restore — revokedAt is never written back to null.
    mockDocs[`tenants/${TENANT}/callSources/s1`].revokedAt = '<ts>';
    mockDocs[`tenants/${TENANT}/callSources/s1`].active = false;
    mockCommitted = [];

    const count = await revokeInboundLinks(TENANT, 'agentA');
    expect(count).toBe(0);
    expect(mockCommitted).toHaveLength(0);
    expect(mockDocs[`tenants/${TENANT}/callSources/s1`].revokedAt).toBe('<ts>');
  });
});
