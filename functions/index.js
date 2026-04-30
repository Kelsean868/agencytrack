const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

// Set custom claims (role + tenantId) on a Firebase Auth user.
// Only callable by super_admin or the hardcoded super_admin UID.
exports.setUserClaims = functions.https.onCall(async (data, context) => {
  const callerIsSuperAdmin =
    (context.auth && context.auth.token.role === 'super_admin') ||
    (context.auth && context.auth.uid === '4GeeZbhZBwdtGOLoJoggf4MQo142');

  if (!callerIsSuperAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only super_admin can set user claims.'
    );
  }

  const { uid, role, tenantId } = data;
  if (!uid || !role || !tenantId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'uid, role, and tenantId are required.'
    );
  }

  await admin.auth().setCustomUserClaims(uid, { role, tenantId });
  return { success: true };
});

// Log new Auth users until a manager assigns them a role.
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  console.log('New user created — awaiting role assignment:', user.uid, user.email);
});
