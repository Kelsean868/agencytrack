'use strict';

// P2e (audit 2026-09-24 SEC-04) — the kiosk URL as a bearer credential.
//   - token life: 90 days, renewed on use for tokens minted since P2e; a token
//     past its expiry is refused
//   - device binding: first use binds; a second device is refused
//   - CORS: only ALLOWED_ORIGINS get a CORS header
//   - rate limit per token trips at RATE_MAX_PER_WINDOW in RATE_WINDOW_MS
// The pure decision (decideKioskRequest) is tested directly; the handler is
// driven through a mocked Admin SDK with an in-memory transaction.

let mockDocs = {};
let mockCustomTokens = [];

jest.mock('firebase-admin', () => {
  const firestore = () => ({
    collection: (path) => ({
      doc: (id) => ({ path: `${path}/${id}` }),
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async (ref) => ({
          exists: mockDocs[ref.path] !== undefined,
          data: () => mockDocs[ref.path],
        }),
        update: (ref, patch) => { mockDocs[ref.path] = { ...mockDocs[ref.path], ...patch }; },
      };
      return fn(tx);
    },
  });
  firestore.FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };
  firestore.Timestamp = { fromDate: (d) => ({ toDate: () => d }) };
  return {
    firestore,
    auth: () => ({
      createCustomToken: async (uid, claims) => { mockCustomTokens.push({ uid, claims }); return `ct-${uid}`; },
    }),
  };
});

jest.mock('firebase-functions/v1', () => ({
  https: {
    HttpsError: class extends Error {},
    onCall: (fn) => ({ _onCall: fn }),
    onRequest: (fn) => ({ _onRequest: fn }),
  },
}));

const {
  validateKioskToken,
  decideKioskRequest,
  corsOriginFor,
  hashDeviceSecret,
  RATE_MAX_PER_WINDOW,
  RATE_WINDOW_MS,
} = require('../kiosk/validateToken');
const { KIOSK_TOKEN_TTL_DAYS } = require('../kiosk/tokenLife');
const { ALLOWED_ORIGINS } = require('../lib/config');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-27T12:00:00Z');
const TENANT = 't1';
const TOKEN = 'a'.repeat(64);
const PATH = `tenants/${TENANT}/kioskTokens/${TOKEN}`;

const ts = (d) => ({ toDate: () => d });
function tokenDoc(extra = {}) {
  return {
    tokenId: TOKEN, tenantId: TENANT, branchId: 'b1',
    expiresAt: ts(new Date(NOW.getTime() + 30 * DAY_MS)),
    revokedAt: null, rolling: true, deviceSecretHash: null,
    ...extra,
  };
}

function fakeRes() {
  const res = { statusCode: null, headers: {}, body: undefined };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}
function fakeReq({ origin = ALLOWED_ORIGINS[0], method = 'GET', query = {} } = {}) {
  return {
    method,
    query: { tenant: TENANT, token: TOKEN, ...query },
    get: (h) => (h.toLowerCase() === 'origin' ? origin : undefined),
  };
}
const handler = validateKioskToken._onRequest;

beforeEach(() => { mockDocs = {}; mockCustomTokens = []; });

describe('decideKioskRequest — token life', () => {
  it('a token past its expiry (older than 90 days) is refused', () => {
    const created = new Date(NOW.getTime() - 91 * DAY_MS);
    const d = decideKioskRequest(
      tokenDoc({ rolling: false, expiresAt: ts(new Date(created.getTime() + KIOSK_TOKEN_TTL_DAYS * DAY_MS)) }),
      { tenantId: TENANT, now: NOW, newSecret: 's' },
    );
    expect(d.status).toBe(401);
    expect(d.body.reason).toBe('expired');
    expect(d.update).toBeNull();
  });

  it('a rolling token is accepted and renewed to now + 90 days', () => {
    const d = decideKioskRequest(tokenDoc({ expiresAt: ts(new Date(NOW.getTime() + 1 * DAY_MS)) }),
      { tenantId: TENANT, now: NOW, newSecret: 's' });
    expect(d.status).toBe(200);
    expect(d.update.expiresAt.getTime()).toBe(NOW.getTime() + 90 * DAY_MS);
  });

  it('a renewed token is accepted after its ORIGINAL expiry has passed', () => {
    // Day 0: renewed. Day 60: the original 30-day expiry is long gone.
    const first = decideKioskRequest(tokenDoc(), { tenantId: TENANT, now: NOW, newSecret: 'dev-1' });
    const stored = { ...tokenDoc(), ...first.update, expiresAt: ts(first.update.expiresAt) };
    const later = new Date(NOW.getTime() + 60 * DAY_MS);
    const second = decideKioskRequest(stored, { tenantId: TENANT, deviceSecret: 'dev-1', now: later, newSecret: 'x' });
    expect(second.status).toBe(200);
  });

  it('a legacy token (no rolling flag) is accepted but NOT renewed', () => {
    const d = decideKioskRequest(tokenDoc({ rolling: undefined }), { tenantId: TENANT, now: NOW, newSecret: 's' });
    expect(d.status).toBe(200);
    expect(d.update.expiresAt).toBeUndefined();
  });

  it('revoked, cross-tenant and missing tokens are refused', () => {
    expect(decideKioskRequest(tokenDoc({ revokedAt: ts(NOW) }), { tenantId: TENANT, now: NOW }).body.reason).toBe('revoked');
    expect(decideKioskRequest(tokenDoc(), { tenantId: 'other', now: NOW }).status).toBe(401);
    expect(decideKioskRequest(null, { tenantId: TENANT, now: NOW }).status).toBe(401);
  });
});

describe('decideKioskRequest — device binding', () => {
  it('first use binds the device and returns the secret once; only the hash is stored', () => {
    const d = decideKioskRequest(tokenDoc(), { tenantId: TENANT, now: NOW, newSecret: 'dev-1' });
    expect(d.status).toBe(200);
    expect(d.body.deviceSecret).toBe('dev-1');
    expect(d.update.deviceSecretHash).toBe(hashDeviceSecret('dev-1'));
    expect(JSON.stringify(d.update)).not.toContain('"dev-1"');
  });

  it('the paired device is accepted and gets no new secret', () => {
    const d = decideKioskRequest(tokenDoc({ deviceSecretHash: hashDeviceSecret('dev-1') }),
      { tenantId: TENANT, deviceSecret: 'dev-1', now: NOW, newSecret: 'x' });
    expect(d.status).toBe(200);
    expect(d.body.deviceSecret).toBeUndefined();
  });

  it('a second device (no secret, or the wrong one) is refused', () => {
    const doc = tokenDoc({ deviceSecretHash: hashDeviceSecret('dev-1') });
    for (const deviceSecret of [undefined, '', 'dev-2']) {
      const d = decideKioskRequest(doc, { tenantId: TENANT, deviceSecret, now: NOW, newSecret: 'x' });
      expect(d.status).toBe(401);
      expect(d.body).toEqual({ valid: false, reason: 'device' });
      expect(d.update.deviceSecretHash).toBeUndefined(); // the binding never moves
    }
  });
});

describe('decideKioskRequest — rate limit', () => {
  it(`trips after ${RATE_MAX_PER_WINDOW} calls in the window, then resets`, () => {
    let doc = tokenDoc({ deviceSecretHash: hashDeviceSecret('dev-1') });
    for (let i = 0; i < RATE_MAX_PER_WINDOW; i++) {
      const d = decideKioskRequest(doc, { tenantId: TENANT, deviceSecret: 'dev-1', now: NOW, newSecret: 'x' });
      expect(d.status).toBe(200);
      doc = { ...doc, ...d.update, expiresAt: ts(d.update.expiresAt) };
    }
    const tripped = decideKioskRequest(doc, { tenantId: TENANT, deviceSecret: 'dev-1', now: NOW, newSecret: 'x' });
    expect(tripped.status).toBe(429);
    const later = new Date(NOW.getTime() + RATE_WINDOW_MS + 1);
    expect(decideKioskRequest(doc, { tenantId: TENANT, deviceSecret: 'dev-1', now: later, newSecret: 'x' }).status).toBe(200);
  });

  it('refused device attempts count toward the limit', () => {
    let doc = tokenDoc({ deviceSecretHash: hashDeviceSecret('dev-1') });
    for (let i = 0; i < RATE_MAX_PER_WINDOW; i++) {
      const d = decideKioskRequest(doc, { tenantId: TENANT, deviceSecret: `guess-${i}`, now: NOW });
      doc = { ...doc, ...d.update };
    }
    expect(decideKioskRequest(doc, { tenantId: TENANT, deviceSecret: 'dev-1', now: NOW }).status).toBe(429);
  });
});

describe('corsOriginFor', () => {
  it('echoes only the configured app origins', () => {
    expect(corsOriginFor('https://portal.agencytrack.app')).toBe('https://portal.agencytrack.app');
    expect(corsOriginFor('https://agencytrack.vercel.app')).toBe('https://agencytrack.vercel.app');
    expect(corsOriginFor('http://localhost:5173')).toBe('http://localhost:5173');
    expect(corsOriginFor('https://evil.example')).toBeNull();
    expect(corsOriginFor('https://portal.agencytrack.app.evil.example')).toBeNull();
    expect(corsOriginFor(undefined)).toBeNull();
  });
});

describe('validateKioskToken handler', () => {
  it('wrong origin gets NO CORS header (and never "*")', async () => {
    mockDocs[PATH] = tokenDoc();
    const res = fakeRes();
    await handler(fakeReq({ origin: 'https://evil.example' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('app origin gets its own origin echoed; preflight answers 204', async () => {
    const res = fakeRes();
    await handler(fakeReq({ method: 'OPTIONS' }), res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGINS[0]);
  });

  it('pairs on first use, then refuses a second device', async () => {
    mockDocs[PATH] = tokenDoc();
    const first = fakeRes();
    await handler(fakeReq(), first);
    expect(first.statusCode).toBe(200);
    expect(first.body.customToken).toBe(`ct-kiosk_${TOKEN.slice(0, 28)}`);
    const secret = first.body.deviceSecret;
    expect(typeof secret).toBe('string');
    expect(mockDocs[PATH].deviceSecretHash).toBe(hashDeviceSecret(secret));

    const same = fakeRes();
    await handler(fakeReq({ query: { device: secret } }), same);
    expect(same.statusCode).toBe(200);
    expect(same.body.deviceSecret).toBeUndefined();

    const other = fakeRes();
    await handler(fakeReq(), other);
    expect(other.statusCode).toBe(401);
    expect(other.body.reason).toBe('device');
    expect(mockCustomTokens).toHaveLength(2); // no session minted for the second device
  });

  it('rate limit trips through the handler with 429', async () => {
    mockDocs[PATH] = tokenDoc({ deviceSecretHash: hashDeviceSecret('dev-1'), validateWindowStart: Date.now(), validateWindowCount: RATE_MAX_PER_WINDOW });
    const res = fakeRes();
    await handler(fakeReq({ query: { device: 'dev-1' } }), res);
    expect(res.statusCode).toBe(429);
  });
});
