const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
const { withAppCheckMonitor } = require('../lib/appCheckMonitor');

// Owner-only, matching createCallSource's self-service model and the rules'
// owner-scoped read arm. No role gate: a manager has no more claim on an
// agent's link than a stranger does. Offboarding is NOT affected — that runs
// through revokeInboundLinks under the Admin SDK, which bypasses rules and
// needs no manager read path.

exports.revokeCallSource = functions.https.onCall(withAppCheckMonitor('revokeCallSource', async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { tenantId } = context.auth.token;

  const { sourceId } = data ?? {};
  if (!sourceId) {
    throw new functions.https.HttpsError('invalid-argument', 'sourceId is required.');
  }

  const sourceRef = admin
    .firestore()
    .collection(`tenants/${tenantId}/callSources`)
    .doc(sourceId);

  const snap = await sourceRef.get();

  // Tenant isolation AND ownership in one arm, both answered with not-found.
  // A caller who does not own the link learns nothing about whether it exists —
  // "forbidden" would confirm the id, which is a probe oracle for a credential.
  if (!snap.exists
      || snap.data().tenantId !== tenantId
      || snap.data().creditUid !== context.auth.uid) {
    throw new functions.https.HttpsError('not-found', 'Call source not found.');
  }

  await sourceRef.update({
    active: false,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
}));
