const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Same narrow set as createCallSource — see the note there on why this is not
// firestore.rules' canManage()/isManager().
const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

exports.revokeCallSource = functions.https.onCall(async (data, context) => {
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

  const { sourceId } = data ?? {};
  if (!sourceId) {
    throw new functions.https.HttpsError('invalid-argument', 'sourceId is required.');
  }

  const sourceRef = admin
    .firestore()
    .collection(`tenants/${tenantId}/callSources`)
    .doc(sourceId);

  const snap = await sourceRef.get();

  // Tenant isolation: stored tenantId must match the caller's tenant.
  if (!snap.exists || snap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError('not-found', 'Call source not found.');
  }

  await sourceRef.update({
    active: false,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
