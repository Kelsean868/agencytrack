const admin = require('firebase-admin');
const functions = require('firebase-functions');
const crypto = require('crypto');

const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const { APP_URL: BASE_URL } = require('../lib/config');

exports.createKioskToken = functions.https.onCall(async (data, context) => {
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

  const branchId = data.branchId ?? context.auth.token.branchId ?? 'default';
  const tokenId = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await admin
    .firestore()
    .collection(`tenants/${tenantId}/kioskTokens`)
    .doc(tokenId)
    .set({
      tokenId,
      tenantId,
      branchId,
      createdBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      revokedAt: null,
      lastUsedAt: null,
    });

  return { tokenId, kioskUrl: `${BASE_URL}/kiosk/${tenantId}/${tokenId}` };
});
