/**
 * identity.js — who is importing, and may they.
 *
 * RULING 2 (17 Sep 2026): IDENTITY FROM AUTH ONLY. The agent is taken from the
 * caller's auth token. Any body field carrying `uid`, `agentId`, `tenantId` or
 * `agentNumber` is REJECTED — not ignored.
 *
 * WHY REJECT RATHER THAN IGNORE:
 * silently ignoring a `uid` in the body means a caller that sends one gets a
 * successful-looking import of their OWN book while believing they imported
 * somebody else's. The next person to read that code cannot tell whether the field
 * is honoured. A 400 makes the contract unambiguous in both directions, and it
 * makes a probe for that hole visible in the logs instead of silent.
 */

const functions = require('firebase-functions');

/**
 * Body fields that would, if honoured, let a caller act as another agent or in
 * another tenant. Rejected on sight.
 */
const FORBIDDEN_BODY_FIELDS = Object.freeze(['uid', 'agentId', 'tenantId', 'agentNumber']);

/**
 * Roles allowed to import a portfolio (ruling 6): an agent, and the producing
 * managers who still write their own business. A `branch_manager` imports THEIR
 * OWN book only — the servicing-number filter is what enforces that, not the role.
 *
 * `sales_manager`, `tenant_admin` and `platform_admin` are deliberately absent:
 * they do not write business, so an import under one of those identities would be
 * somebody else's policies filed under the wrong agent.
 */
const IMPORT_ROLES = Object.freeze(['agent', 'unit_manager', 'branch_manager']);

/**
 * Validates the caller and resolves the agent entirely from the auth token plus
 * that agent's own user doc.
 *
 * @param {Object} data     the callable payload
 * @param {Object} context  the callable context
 * @param {Object} db       admin.firestore()
 * @returns {Promise<{uid, tenantId, agentNumber, unitId, branchId, role, name, email}>}
 */
async function resolveCaller(data, context, db) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to import a portfolio.');
  }

  const body = data && typeof data === 'object' ? data : {};
  const offending = FORBIDDEN_BODY_FIELDS.filter((k) => Object.hasOwn(body, k));
  if (offending.length > 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Identity comes from your sign-in, not the request. Remove: ${offending.join(', ')}.`,
    );
  }

  const { uid } = context.auth;
  const { role, tenantId } = context.auth.token || {};

  if (!tenantId) {
    throw new functions.https.HttpsError('failed-precondition', 'Your account has no tenant.');
  }
  if (!IMPORT_ROLES.includes(role)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only an agent or a producing manager can import a portfolio.',
    );
  }

  const snap = await db.doc(`tenants/${tenantId}/users/${uid}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Your user record was not found.');
  }
  const u = snap.data();

  // Without an agent number there is no way to tell this agent's policies from
  // anyone else's in the file. Refusing is the only safe answer — the alternative
  // is importing a whole file as if every policy were the caller's.
  if (!u.agentNumber) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your profile has no agent number, so your policies cannot be identified in the file. Ask your manager to add it.',
    );
  }

  return {
    uid,
    tenantId,
    role,
    agentNumber: String(u.agentNumber).trim(),
    unitId: u.unitId ?? null,
    branchId: u.branchId ?? null,
    name: u.name ?? u.displayName ?? null,
    email: u.email ?? null,
  };
}

/**
 * Splits parsed docs into this agent's and everyone else's (ruling 2).
 *
 * An agent may import ONLY the policies whose Servicing Agent Number equals their
 * own. The rest are counted and named as "not yours" and never written.
 *
 * This runs on the SERVER, over the parsed result, because the file is supplied by
 * the caller: nothing about the upload is trusted, including which agent it is
 * for. `isWritingAgent` is a different question (who SOLD it) and is not a
 * permission — an agent legitimately services policies they did not write.
 */
function partitionByServicingAgent(docs, agentNumber) {
  const mine = [];
  const notMine = [];
  for (const doc of Array.isArray(docs) ? docs : []) {
    if (doc && doc.servicingAgentNumber === agentNumber) mine.push(doc);
    else notMine.push(doc);
  }
  return {
    mine,
    skippedNotYours: notMine.length,
    // Policy numbers only — never the names attached to another agent's clients.
    skippedNotYoursNumbers: notMine.map((d) => d?.policyNumber ?? null).filter(Boolean),
  };
}

module.exports = {
  resolveCaller,
  partitionByServicingAgent,
  FORBIDDEN_BODY_FIELDS,
  IMPORT_ROLES,
};
