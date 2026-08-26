const admin = require('firebase-admin');

// 250, not 500: each update carries a serverTimestamp field transform, which
// counts as a second operation against Firestore's 500-per-batch limit.
const CHUNK_SIZE = 250;

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

  // Firestore caps a batch at 500 operations, and a serverTimestamp is a field
  // TRANSFORM that costs a second operation on top of the write — so 251 links
  // would blow the cap, reject the commit, and leave an offboarded user's links
  // live while the caller sees an error. Chunk so that can't happen.
  for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + CHUNK_SIZE).forEach((doc) => {
      batch.update(doc.ref, {
        active: false,
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return snap.docs.length;
}

module.exports = { revokeInboundLinks, CHUNK_SIZE };
