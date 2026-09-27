const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
const { kioskUidFor } = require('./validateToken');
const { withAppCheckMonitor } = require('../lib/appCheckMonitor');

const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

exports.revokeKioskToken = functions.https.onCall(withAppCheckMonitor('revokeKioskToken', async (data, context) => {
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

  // P2e (SEC-04): a kiosk that is already open stays signed in on its Firebase
  // session after the link is revoked. Revoking the session's refresh tokens
  // ends it at the next ID-token refresh (within the hour). A link that was
  // never opened has no auth user — nothing to end, not an error.
  try {
    await admin.auth().revokeRefreshTokens(kioskUidFor(tokenId));
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') {
      console.error('revokeKioskToken: could not end the kiosk session', err);
    }
  }

  return { success: true };
}));
