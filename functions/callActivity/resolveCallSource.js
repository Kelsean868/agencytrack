'use strict';

/**
 * resolveCallSource — bearer token in, the callSources doc that owns it out.
 *
 * Slice B. This is the ONLY place a presented token becomes an identity, and the
 * identity it produces is the ONLY thing that decides whose KPIs move.
 *
 * ── HASH, THEN LOOK UP. NEVER COMPARE PLAINTEXT ─────────────────────────────
 * createCallSource stores `tokenHash` = SHA-256 of the raw token and returns the
 * raw token exactly once; the raw token is NEVER stored and cannot be recovered.
 * Resolution is therefore hash-the-presented-token and look the hash up. A
 * plaintext compare is not merely slower here — there is no plaintext to compare
 * against, so any code that reaches for one is already wrong.
 *
 * `hashToken` is imported from createCallSource rather than restated. One hash
 * function, one definition: a second `createHash('sha256')` in this file would
 * be a twin, and the day someone changes one of them every existing token stops
 * resolving with no error anywhere.
 *
 * ── THE VALIDATE SHAPE COMES FROM kiosk/validateToken.js ────────────────────
 * Deliberately the same shape as validateTokenData() there: a PURE classifier
 * over the doc data plus a clock, with the I/O outside it. Slice A reused that
 * module's create/revoke shape; B reuses its validate shape. A second
 * hand-rolled auth path is exactly how the two drift apart.
 *
 * ── ONE DIFFERENCE FROM THE KIOSK VALIDATOR, AND IT IS DELIBERATE ───────────
 * The kiosk validator returns a DISTINGUISHABLE reason to its caller
 * ('revoked' vs 'expired' vs 'invalid') because its caller is the operator's own
 * display, and telling them why their screen went blank is the point.
 *
 * This endpoint is a PUBLIC surface anyone can POST to. A caller who can tell
 * "expired" from "unknown" has an oracle: they can probe tokens and learn which
 * ones exist. So the reason here is for the LOG ONLY, and the endpoint collapses
 * every failure to one identical response. The distinction is kept internally —
 * an operator debugging a silent integration needs it — and never crosses the
 * wire.
 *
 * ── FAIL CLOSED, ALWAYS ─────────────────────────────────────────────────────
 * Expired, revoked, deactivated, absent, or a hash that matches nothing: reject.
 * There is no "fail open and count it anyway" branch, because a call counted
 * under an unresolved token is a number written into a named agent's report on
 * no authority at all.
 */

// Imported, NOT restated. createCallSource.js owns the hash; a second
// createHash('sha256') here would be a twin, and the day the two disagree every
// existing token stops resolving with no error raised anywhere.
const { hashToken } = require('../callSources/createCallSource');

/** Internal failure reasons. FOR LOGS ONLY — never returned to the caller. */
const REJECT_REASONS = Object.freeze({
  UNKNOWN: 'unknown_token',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  DEACTIVATED: 'source_inactive',
  MALFORMED: 'malformed_token',
});

/**
 * classifyCallSource — PURE. Doc data plus a clock in, verdict out.
 *
 * Mirrors validateTokenData() in functions/kiosk/validateToken.js. No Firestore,
 * no network: every rejection branch is testable without a database.
 *
 * Order matters only for which reason is LOGGED, never for whether the call is
 * rejected — every branch below fails closed.
 *
 * @param {object|null} data  the callSources doc data, or null when absent
 * @param {Date} now
 * @returns {{valid: boolean, reason?: string, source?: object}}
 */
function classifyCallSource(data, now) {
  if (!data) return { valid: false, reason: REJECT_REASONS.UNKNOWN };

  // revokeCallSource / revokeInboundLinks set these. `active === false` is the
  // deactivated-user path; `revokedAt` is the explicit per-link revocation.
  if (data.revokedAt) return { valid: false, reason: REJECT_REASONS.REVOKED };
  if (data.active === false) return { valid: false, reason: REJECT_REASONS.DEACTIVATED };

  if (data.expiresAt) {
    const expiry =
      typeof data.expiresAt.toDate === 'function'
        ? data.expiresAt.toDate()
        : new Date(data.expiresAt);
    if (expiry < now) return { valid: false, reason: REJECT_REASONS.EXPIRED };
  }

  // creditUid is the whole point of resolving: it is whose KPIs move. A source
  // doc without one cannot credit anybody, and guessing is not an option.
  if (!data.creditUid) return { valid: false, reason: REJECT_REASONS.UNKNOWN };

  return { valid: true, source: data };
}

/**
 * resolveCallSource — the I/O half. Hash the presented token, find its doc,
 * classify it.
 *
 * ── WHY THIS IS A TENANT-SCOPED QUERY AND NOT A COLLECTION GROUP ────────────
 * The request carries a token and no tenant, so the obvious shape is
 * collectionGroup('callSources').where('tokenHash', '==', h). That needs a
 * COLLECTION_GROUP-scoped single-field index, which Firestore does NOT create
 * automatically — firestore.indexes.json currently has `fieldOverrides: []` —
 * and adding one is a separate, explicitly-deployed surface.
 *
 * The deployment is single-tenant: functions/index.js:57 and
 * aggregators/sundayDailyToWeekly.js both hardcode TENANT_ID with the same
 * SEC-9c note. Following that established convention keeps this slice's diff
 * inside its file inventory and needs no index deploy. Generalising to
 * multi-tenant belongs with SEC-9c's own ticket, and until then a query that
 * pretends to be tenant-agnostic while the rest of the tree is not would be
 * misleading rather than future-proof.
 *
 * @param {object} db          admin.firestore()
 * @param {string} tenantId
 * @param {string} rawToken    the bearer token exactly as presented
 * @param {Date} now
 * @returns {Promise<{valid: boolean, reason?: string, sourceId?: string, source?: object, ref?: object}>}
 */
async function resolveCallSource(db, tenantId, rawToken, now) {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    return { valid: false, reason: REJECT_REASONS.MALFORMED };
  }

  const snap = await db
    .collection('tenants/' + tenantId + '/callSources')
    .where('tokenHash', '==', hashToken(rawToken))
    .limit(1)
    .get();

  if (snap.empty) return { valid: false, reason: REJECT_REASONS.UNKNOWN };

  const doc = snap.docs[0];
  const verdict = classifyCallSource(doc.data(), now);
  if (!verdict.valid) return verdict;

  return { valid: true, sourceId: doc.id, source: verdict.source, ref: doc.ref };
}

module.exports = {
  REJECT_REASONS,
  classifyCallSource,
  resolveCallSource,
};
