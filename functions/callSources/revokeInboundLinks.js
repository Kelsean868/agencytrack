const admin = require('firebase-admin');

/**
 * Revoke every non-revoked call source that credits `creditUid`.
 *
 * One-way by design (decision 2): reactivating the user does NOT clear
 * revokedAt. A manager re-links deliberately, because a token that silently
 * comes back to life after an offboarding is worse than two clicks.
 *
 * Returns the number of links revoked.
 */
async function revokeInboundLinks(tenantId, creditUid) {
  const db = admin.firestore();
  const snap = await db
    .collection(`tenants/${tenantId}/callSources`)
    .where('creditUid', '==', creditUid)
    .where('revokedAt', '==', null)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      active: false,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  return snap.docs.length;
}

module.exports = { revokeInboundLinks };
