const admin = require('firebase-admin');
const functions = require('firebase-functions');
const crypto = require('crypto');

// There is deliberately NO role gate here. Creation is self-service and
// self-credit: the caller can only ever link their own KPIs, so there is no
// privilege to check because there is no cross-user effect. The slice-A model
// took a creditUid naming SOMEONE ELSE, and that cross-user write is precisely
// the shape that produced both of its security defects. Forcing self-credit
// deletes the class — you cannot get "who may write to whose KPIs" wrong when
// the only legal answer is "your own".
//
// Delegation is unaffected: an agent creates a link for their assistant's
// calling-software profile, crediting themselves. The assistant needs no
// AgencyTrack account.

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — matches kioskTokens

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

exports.hashToken = hashToken;

exports.createCallSource = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { tenantId } = context.auth.token;

  // Reject rather than ignore. A caller that sent creditUid believed it would
  // do something; silently overriding it would ship that wrong belief into
  // their client. Fail loud so the mistake surfaces at the call site.
  if (data && 'creditUid' in data) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'creditUid is not accepted — a call source always credits the signed-in user.',
    );
  }

  const { sourceApp, sourceUserId, label } = data ?? {};
  if (!sourceApp || !sourceUserId || !label) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'sourceApp, sourceUserId and label are required.',
    );
  }

  // Server-side, from the verified token — never from the payload.
  const creditUid = context.auth.uid;

  // The caller must have a user doc in this tenant. A signed-in principal with
  // no doc here (or a doc belonging elsewhere) has no KPIs to credit.
  const creditRef = admin.firestore().doc(`tenants/${tenantId}/users/${creditUid}`);
  const creditSnap = await creditRef.get();
  if (!creditSnap.exists || creditSnap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError('not-found', 'No user record in this tenant.');
  }

  // A deactivated user's inbound links were revoked by deactivateUser; minting a
  // fresh one here would walk straight back through that door. Re-linking stays
  // a deliberate act, and reactivating the account is that deliberate act.
  if (creditSnap.data().active === false) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your account is deactivated.',
    );
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
