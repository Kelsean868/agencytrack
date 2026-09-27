'use strict';

// P2e (SEC-04 item 5) — revoking a kiosk link also ends an OPEN kiosk's
// Firebase session (its refresh tokens), not just future validations.

let mockUpdates = [];
let mockRevoked = [];
let mockRevokeError = null;
let mockTokenDoc = null;

jest.mock('firebase-admin', () => {
  const firestore = () => ({
    collection: (path) => ({
      doc: (id) => ({
        get: async () => ({ exists: mockTokenDoc !== null, data: () => mockTokenDoc }),
        update: async (patch) => { mockUpdates.push({ path, id, patch }); },
      }),
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };
  return {
    firestore,
    auth: () => ({
      revokeRefreshTokens: async (uid) => {
        if (mockRevokeError) throw mockRevokeError;
        mockRevoked.push(uid);
      },
    }),
  };
});

jest.mock('firebase-functions/v1', () => ({
  https: {
    HttpsError: class extends Error { constructor(code, msg) { super(msg); this.code = code; } },
    onCall: (fn) => ({ _onCall: fn }),
    onRequest: (fn) => ({ _onRequest: fn }),
  },
}));

const { revokeKioskToken } = require('../kiosk/revokeToken');
const { kioskUidFor } = require('../kiosk/validateToken');
const revoke = revokeKioskToken._onCall;

const TOKEN = 'b'.repeat(64);
const ctx = (role = 'branch_manager') => ({ auth: { uid: 'bm-1', token: { role, tenantId: 't1' } } });

beforeEach(() => {
  mockUpdates = []; mockRevoked = []; mockRevokeError = null;
  mockTokenDoc = { tenantId: 't1', branchId: 'b1' };
});

it('sets revokedAt AND revokes the kiosk session\'s refresh tokens', async () => {
  await expect(revoke({ tokenId: TOKEN }, ctx())).resolves.toEqual({ success: true });
  expect(mockUpdates[0].patch).toEqual({ revokedAt: '__SERVER_TIMESTAMP__' });
  expect(mockRevoked).toEqual([kioskUidFor(TOKEN)]);
});

it('a link never opened (no auth user) still revokes cleanly', async () => {
  mockRevokeError = Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
  await expect(revoke({ tokenId: TOKEN }, ctx())).resolves.toEqual({ success: true });
  expect(mockUpdates).toHaveLength(1);
});

it('agents and unit managers cannot revoke', async () => {
  for (const role of ['agent', 'unit_manager']) {
    await expect(revoke({ tokenId: TOKEN }, ctx(role))).rejects.toMatchObject({ code: 'permission-denied' });
  }
  expect(mockUpdates).toHaveLength(0);
});
