const admin = require('firebase-admin');
const functions = require('firebase-functions');
const crypto = require('crypto');

// Deliberately NOT firestore.rules' canManage()/isManager(), which include
// unit_manager. A unit manager cannot even see agentNumber in EditUserDrawer;
// minting a token that writes another agent's KPIs is strictly more power.
const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — matches kioskTokens

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

exports.hashToken = hashToken;

exports.createCallSource = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { role, tenantId } = context.auth.token;
  if (!MANAGER_ROLES.has(role)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Requires branch_manager or above.',
    );
  }

  const { sourceApp, sourceUserId, creditUid, label } = data ?? {};
  if (!sourceApp || !sourceUserId || !creditUid || !label) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'sourceApp, sourceUserId, creditUid and label are required.',
    );
  }

  // creditUid must be a real user in the caller's tenant. Without this, a typo
  // mints a link that credits nobody and fails closed only at ingest time.
  const creditRef = admin.firestore().doc(`tenants/${tenantId}/users/${creditUid}`);
  const creditSnap = await creditRef.get();
  if (!creditSnap.exists || creditSnap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError('not-found', 'Credit user not found in this tenant.');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  const sourceRef = admin.firestore().collection(`tenants/${tenantId}/callSources`).doc();

  await sourceRef.set({
    sourceId: sourceRef.id,
    tenantId,
    sourceApp,
    sourceUserId,
    creditUid,
    label,
    tokenHash: hashToken(rawToken),
    active: true,
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    revokedAt: null,
    lastUsedAt: null,
  });

  // The only time the raw token exists outside the caller's hands. It is never
  // stored and cannot be recovered — a lost token is re-minted, not looked up.
  return { sourceId: sourceRef.id, token: rawToken, expiresAt: expiresAt.toISOString() };
});
