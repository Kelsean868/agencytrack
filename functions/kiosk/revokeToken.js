const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');

const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

exports.revokeKioskToken = functions.https.onCall(async (data, context) => {
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

  const { tokenId } = data;
  if (!tokenId) {
    throw new functions.https.HttpsError('invalid-argument', 'tokenId is required.');
  }

  const tokenRef = admin
    .firestore()
    .collection(`tenants/${tenantId}/kioskTokens`)
    .doc(tokenId);

  const snap = await tokenRef.get();

  // Tenant isolation: stored tenantId must match the caller's tenant.
  if (!snap.exists || snap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError('not-found', 'Token not found.');
  }

  await tokenRef.update({
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
