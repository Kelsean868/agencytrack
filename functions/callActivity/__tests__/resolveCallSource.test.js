'use strict';

/**
 * resolveCallSource tests — the pure classifier and the hash-then-lookup.
 *
 * The endpoint tests already exercise every rejection end-to-end. These cover
 * the classifier on its own, because it is the security boundary and a pure
 * function is where a boundary should be provable without a database.
 */

const { FakeFirestore, Timestamp } = require('./fakeFirestore');

let mockDb = null;

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockDb), {
    FieldValue: require('./fakeFirestore').FieldValue,
    Timestamp: require('./fakeFirestore').Timestamp,
  }),
}));

jest.mock('firebase-functions/v1', () => ({
  https: { onCall: (fn) => ({ _onCall: fn }), onRequest: (fn) => ({ _onRequest: fn }), HttpsError: class extends Error {} },
}));

const { hashToken } = require('../../callSources/createCallSource');
const { classifyCallSource, resolveCallSource, REJECT_REASONS } = require('../resolveCallSource');

const NOW = new Date('2026-08-26T18:00:00Z');
const FUTURE = Timestamp.fromDate(new Date('2027-01-01T00:00:00Z'));
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const TENANT = 'tatillife_south';
const RAW = 'a'.repeat(64);

const validDoc = (over = {}) => ({
  tenantId: TENANT,
  creditUid: 'agent_marlon',
  tokenHash: hashToken(RAW),
  active: true,
  revokedAt: null,
  expiresAt: FUTURE,
  ...over,
});

beforeEach(() => {
  mockDb = new FakeFirestore();
});

describe('classifyCallSource — PURE, and every branch fails closed', () => {
  it('accepts a live source', () => {
    expect(classifyCallSource(validDoc(), NOW).valid).toBe(true);
  });

  it('rejects an absent doc', () => {
    expect(classifyCallSource(null, NOW)).toEqual({ valid: false, reason: REJECT_REASONS.UNKNOWN });
  });

  it('rejects a revoked source', () => {
    expect(classifyCallSource(validDoc({ revokedAt: 'whenever' }), NOW).valid).toBe(false);
  });

  it('rejects a deactivated source', () => {
    expect(classifyCallSource(validDoc({ active: false }), NOW).valid).toBe(false);
  });

  it('rejects an expired source', () => {
    expect(classifyCallSource(validDoc({ expiresAt: PAST }), NOW).valid).toBe(false);
  });

  it('accepts a plain ISO string expiresAt as well as a Timestamp', () => {
    expect(classifyCallSource(validDoc({ expiresAt: '2027-01-01T00:00:00Z' }), NOW).valid).toBe(true);
    expect(classifyCallSource(validDoc({ expiresAt: '2020-01-01T00:00:00Z' }), NOW).valid).toBe(false);
  });

  it('rejects a source with no creditUid — there is nobody to credit', () => {
    for (const bad of [null, undefined, '']) {
      expect(classifyCallSource(validDoc({ creditUid: bad }), NOW).valid).toBe(false);
    }
  });

  it('expiry is evaluated against the clock it is GIVEN, not the wall clock', () => {
    const doc = validDoc({ expiresAt: Timestamp.fromDate(new Date('2026-08-26T12:00:00Z')) });
    expect(classifyCallSource(doc, new Date('2026-08-26T11:00:00Z')).valid).toBe(true);
    expect(classifyCallSource(doc, new Date('2026-08-26T13:00:00Z')).valid).toBe(false);
  });
});

describe('resolveCallSource — hash, then look up', () => {
  it('resolves a token to its source doc', async () => {
    mockDb.seed('tenants/' + TENANT + '/callSources/s1', validDoc());
    const r = await resolveCallSource(mockDb, TENANT, RAW, NOW);
    expect(r.valid).toBe(true);
    expect(r.sourceId).toBe('s1');
    expect(r.source.creditUid).toBe('agent_marlon');
  });

  it('NEVER matches on the raw token — only the hash is stored and queried', async () => {
    // A doc whose tokenHash was (wrongly) stored as plaintext must not resolve.
    mockDb.seed('tenants/' + TENANT + '/callSources/s1', validDoc({ tokenHash: RAW }));
    const r = await resolveCallSource(mockDb, TENANT, RAW, NOW);
    expect(r.valid).toBe(false);
  });

  it('rejects an unknown token', async () => {
    mockDb.seed('tenants/' + TENANT + '/callSources/s1', validDoc());
    const r = await resolveCallSource(mockDb, TENANT, 'b'.repeat(64), NOW);
    expect(r).toEqual({ valid: false, reason: REJECT_REASONS.UNKNOWN });
  });

  it('rejects a missing or non-string token without querying', async () => {
    for (const bad of [null, undefined, '', 42]) {
      const r = await resolveCallSource(mockDb, TENANT, bad, NOW);
      expect(r).toEqual({ valid: false, reason: REJECT_REASONS.MALFORMED });
    }
  });

  it('does not resolve a token belonging to a different tenant path', async () => {
    mockDb.seed('tenants/other_tenant/callSources/s1', validDoc({ tenantId: 'other_tenant' }));
    const r = await resolveCallSource(mockDb, TENANT, RAW, NOW);
    expect(r.valid).toBe(false);
  });

  it('surfaces the reason INTERNALLY so an operator can debug a silent integration', async () => {
    mockDb.seed('tenants/' + TENANT + '/callSources/s1', validDoc({ revokedAt: 'x' }));
    const r = await resolveCallSource(mockDb, TENANT, RAW, NOW);
    expect(r.reason).toBe(REJECT_REASONS.REVOKED);
    // The endpoint is what collapses these to one response — see
    // ingestCallActivity.test.js, "INDISTINGUISHABLE to the caller".
  });
});
