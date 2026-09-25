'use strict';

// SEC-03 (audit 2026-09-24). Kiosk tokens are bearer credentials: whoever holds
// one gets a kiosk session for the branch the token doc names. These tests pin
// the Cloud Function side of the fix:
//   - createKioskToken: unit managers and agents may not mint; a branch_manager
//     may mint only for a branch they own; every token gets an expiresAt.
//   - validateTokenData: a token with NO expiresAt is invalid (it used to
//     never expire).
// The rules side (no client writes to kioskTokens) is in
// tests/rules/kioskTokens.rules.test.mjs.

let mockWrites = [];

jest.mock('firebase-admin', () => {
  const Timestamp = { fromDate: (d) => ({ __ts: true, toDate: () => d }) };
  const FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };
  const firestore = () => ({
    collection: (path) => ({
      doc: (id) => ({
        set: async (data) => { mockWrites.push({ path, id, data }); },
      }),
    }),
  });
  firestore.Timestamp = Timestamp;
  firestore.FieldValue = FieldValue;
  return { firestore };
});

jest.mock('firebase-functions/v1', () => {
  const HttpsError = class extends Error {
    constructor(code, message) { super(message); this.code = code; }
  };
  return {
    https: {
      HttpsError,
      onCall:    (fn) => ({ _onCall: fn }),
      onRequest: (fn) => ({ _onRequest: fn }),
    },
  };
});

const { createKioskToken, KIOSK_TOKEN_TTL_DAYS } = require('../kiosk/createToken');
const { validateTokenData } = require('../kiosk/validateToken');
const create = createKioskToken._onCall;

const DAY_MS = 24 * 60 * 60 * 1000;

function ctx(role, extra = {}) {
  return { auth: { uid: `${role}-uid`, token: { role, tenantId: 't1', ...extra } } };
}

function expectCode(promise, code) {
  return promise.then(
    () => { throw new Error(`Expected HttpsError '${code}' but resolved`); },
    (err) => { expect(err.code).toBe(code); },
  );
}

beforeEach(() => { mockWrites = []; });

describe('createKioskToken — who may mint', () => {
  it('rejects an unauthenticated caller', async () => {
    await expectCode(create({}, { auth: null }), 'unauthenticated');
  });

  it('rejects a unit_manager', async () => {
    await expectCode(create({ branchId: 'b1' }, ctx('unit_manager', { branchId: 'b1' })), 'permission-denied');
    expect(mockWrites).toHaveLength(0);
  });

  it('rejects an agent', async () => {
    await expectCode(create({}, ctx('agent', { branchId: 'b1' })), 'permission-denied');
  });

  it("rejects a branch_manager minting for another branch", async () => {
    await expectCode(
      create({ branchId: 'b2' }, ctx('branch_manager', { branchId: 'b1', ownedBranchIds: ['b1'] })),
      'permission-denied',
    );
    expect(mockWrites).toHaveLength(0);
  });

  it('rejects a branch_manager with no branch claim at all', async () => {
    await expectCode(create({}, ctx('branch_manager')), 'permission-denied');
  });

  it('lets a branch_manager mint for their own branch (claim default)', async () => {
    const res = await create({ branchId: null }, ctx('branch_manager', { branchId: 'b1', ownedBranchIds: ['b1'] }));
    expect(mockWrites).toHaveLength(1);
    expect(mockWrites[0].data.branchId).toBe('b1');
    expect(res.kioskUrl).toContain(`/kiosk/t1/${res.tokenId}`);
  });

  it('lets a branch_manager mint for a branch listed in ownedBranchIds', async () => {
    await create({ branchId: 'b1' }, ctx('branch_manager', { ownedBranchIds: ['b1'] }));
    expect(mockWrites[0].data.branchId).toBe('b1');
  });

  it('lets a sales_manager mint for any branch', async () => {
    await create({ branchId: 'b9' }, ctx('sales_manager', { ownedBranchIds: ['*'] }));
    expect(mockWrites[0].data.branchId).toBe('b9');
  });
});

describe('createKioskToken — expiry', () => {
  it(`always writes expiresAt = now + ${KIOSK_TOKEN_TTL_DAYS} days`, async () => {
    const before = Date.now();
    await create({}, ctx('tenant_admin'));
    const after = Date.now();
    const expiry = mockWrites[0].data.expiresAt.toDate().getTime();
    expect(KIOSK_TOKEN_TTL_DAYS).toBe(90);
    expect(expiry).toBeGreaterThanOrEqual(before + 90 * DAY_MS);
    expect(expiry).toBeLessThanOrEqual(after + 90 * DAY_MS);
  });
});

describe('validateTokenData (Cloud Function copy)', () => {
  const NOW = new Date('2026-09-25T12:00:00Z');
  const good = {
    tenantId: 't1',
    branchId: 'b1',
    revokedAt: null,
    expiresAt: { toDate: () => new Date('2026-12-01T00:00:00Z') },
  };

  it('accepts a live, unexpired token', () => {
    expect(validateTokenData(good, 't1', NOW)).toEqual({ valid: true, tenantId: 't1', branchId: 'b1' });
  });

  it('rejects a token with NO expiresAt (used to never expire)', () => {
    const { expiresAt: _expiresAt, ...noExpiry } = good;
    expect(validateTokenData(noExpiry, 't1', NOW)).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a token with expiresAt: null', () => {
    expect(validateTokenData({ ...good, expiresAt: null }, 't1', NOW).valid).toBe(false);
  });

  it('rejects an unparseable expiresAt', () => {
    expect(validateTokenData({ ...good, expiresAt: 'not a date' }, 't1', NOW).valid).toBe(false);
  });

  it('rejects a past expiresAt', () => {
    const past = { ...good, expiresAt: { toDate: () => new Date('2026-09-01T00:00:00Z') } };
    expect(validateTokenData(past, 't1', NOW)).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a revoked token and a cross-tenant token', () => {
    expect(validateTokenData({ ...good, revokedAt: NOW }, 't1', NOW).reason).toBe('revoked');
    expect(validateTokenData(good, 't2', NOW).reason).toBe('invalid');
  });
});
