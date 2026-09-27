const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('../lib/config');
const { KIOSK_TOKEN_TTL_MS } = require('./tokenLife');

// P2e (audit 2026-09-24 SEC-04) — the kiosk URL is a bearer credential. It is
// now bound to ONE device, renewed on use, rate limited per token, and only
// callable from the app's own origins.
//
// Per-token rate limit — same pattern as ingestCallActivity (RATE_WINDOW_MS /
// RATE_MAX_PER_WINDOW, counter advanced inside the same transaction). A kiosk
// validates once per page load, so 20 a minute is generous for a real TV.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_WINDOW = 20;

// Mirrors validateTokenData in src/lib/kiosk/utils.js — kept inline because
// Cloud Functions run CJS and cannot import from the frontend src/ tree.
function validateTokenData(data, tenantId, now) {
  if (!data) return { valid: false, reason: 'invalid' };
  // Cross-tenant safety: stored tenantId must match the URL parameter.
  if (data.tenantId !== tenantId) return { valid: false, reason: 'invalid' };
  if (data.revokedAt) return { valid: false, reason: 'revoked' };
  // SEC-03: a token with no (or an unreadable) expiresAt is invalid — it used
  // to be valid forever. createKioskToken always writes one.
  if (!data.expiresAt) return { valid: false, reason: 'expired' };
  const expiry =
    typeof data.expiresAt.toDate === 'function'
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry < now) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, tenantId: data.tenantId, branchId: data.branchId };
}

/** SHA-256 hex of a device secret. Only the hash is ever stored. */
function hashDeviceSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

/** Constant-time "does this secret match the stored hash". */
function deviceSecretMatches(secret, storedHash) {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  const a = Buffer.from(hashDeviceSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The origin to echo in Access-Control-Allow-Origin, or null when the request
 * comes from anywhere not on ALLOWED_ORIGINS (then no CORS header is sent and
 * a browser on that origin cannot read the response).
 */
function corsOriginFor(origin, allowed = ALLOWED_ORIGINS) {
  return typeof origin === 'string' && allowed.includes(origin) ? origin : null;
}

/**
 * decideKioskRequest — the whole decision for one validation, pure.
 *
 * @param {object|null} data    the kioskTokens doc (null when absent)
 * @param {object} p
 * @param {string} p.tenantId   from the URL
 * @param {string} [p.deviceSecret] what the kiosk presented (absent on first use)
 * @param {Date}   p.now
 * @param {string} p.newSecret  a fresh secret to bind with, if this is first use
 * @returns {{ status: number, body: object, update: object|null }}
 *   `update` is the patch to write to the token doc in the same transaction
 *   (rate-limit window, lastUsedAt, binding, renewal) — null when nothing is written.
 */
function decideKioskRequest(data, { tenantId, deviceSecret, now, newSecret }) {
  const base = validateTokenData(data, tenantId, now);
  if (!base.valid) return { status: 401, body: base, update: null };

  // Rate limit first: a refused call still counts, so hammering a stolen URL
  // for device secrets trips it.
  const windowStart = Number(data.validateWindowStart) || 0;
  const inWindow = now.getTime() - windowStart < RATE_WINDOW_MS;
  const windowCount = inWindow ? Number(data.validateWindowCount) || 0 : 0;
  if (inWindow && windowCount >= RATE_MAX_PER_WINDOW) {
    return { status: 429, body: { valid: false, reason: 'rate_limited' }, update: null };
  }
  const update = {
    validateWindowStart: inWindow ? windowStart : now.getTime(),
    validateWindowCount: windowCount + 1,
  };

  let issuedSecret = null;
  if (data.deviceSecretHash) {
    if (!deviceSecretMatches(deviceSecret, data.deviceSecretHash)) {
      return { status: 401, body: { valid: false, reason: 'device' }, update };
    }
  } else {
    // First use since P2e: bind this device. Existing links bind to whichever
    // device uses them first after deploy — the TV already showing them.
    issuedSecret = newSecret;
    update.deviceSecretHash = hashDeviceSecret(newSecret);
    update.deviceBoundAt = now;
  }

  update.lastUsedAt = now;
  // Rolling renewal — tokens created since P2e only. A legacy token keeps its
  // current expiry and needs a new link after it (brief § PR 2 Part 1.1).
  if (data.rolling === true) {
    update.expiresAt = new Date(now.getTime() + KIOSK_TOKEN_TTL_MS);
  }

  const body = { ...base };
  if (issuedSecret) body.deviceSecret = issuedSecret;
  return { status: 200, body, update };
}

exports.validateKioskToken = functions.https.onRequest(async (req, res) => {
  const allowOrigin = corsOriginFor(req.get ? req.get('origin') : req.headers?.origin);
  if (allowOrigin) {
    res.set('Access-Control-Allow-Origin', allowOrigin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { tenant: tenantId, token: tokenId, device: deviceSecret } = req.query;
  if (!tenantId || !tokenId) {
    res.status(400).json({ valid: false, reason: 'invalid' });
    return;
  }

  try {
    const ref = admin
      .firestore()
      .collection(`tenants/${tenantId}/kioskTokens`)
      .doc(tokenId);

    const decision = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = decideKioskRequest(snap.exists ? snap.data() : null, {
        tenantId,
        deviceSecret: typeof deviceSecret === 'string' ? deviceSecret : undefined,
        now: new Date(),
        newSecret: crypto.randomBytes(32).toString('hex'),
      });
      if (d.update) tx.update(ref, d.update);
      return d;
    });

    if (decision.status !== 200) {
      res.status(decision.status).json(decision.body);
      return;
    }

    // Generate a Firebase custom token so the kiosk client can sign into
    // Firebase Auth and read Firestore with role='kiosk' claims.
    // UID is stable for the token so repeated calls get the same Auth identity
    // (and revokeKioskToken can revoke its refresh tokens).
    const customToken = await admin.auth().createCustomToken(kioskUidFor(tokenId), {
      role: 'kiosk',
      tenantId: decision.body.tenantId,
      branchId: decision.body.branchId,
    });

    res.status(200).json({ ...decision.body, customToken });
  } catch (err) {
    console.error('validateKioskToken error:', err);
    res.status(500).json({ valid: false, reason: 'invalid' });
  }
});

/** The Firebase Auth uid a kiosk token signs in as. */
function kioskUidFor(tokenId) {
  return `kiosk_${String(tokenId).slice(0, 28)}`;
}

exports.validateTokenData = validateTokenData;
exports.decideKioskRequest = decideKioskRequest;
exports.corsOriginFor = corsOriginFor;
exports.hashDeviceSecret = hashDeviceSecret;
exports.kioskUidFor = kioskUidFor;
exports.RATE_MAX_PER_WINDOW = RATE_MAX_PER_WINDOW;
exports.RATE_WINDOW_MS = RATE_WINDOW_MS;
