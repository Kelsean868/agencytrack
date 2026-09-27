const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
const crypto = require('crypto');

// Roles that may mint a kiosk token for ANY branch in their tenant.
const CROSS_BRANCH_ROLES = new Set([
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

// SEC-03 (audit 2026-09-24): every token expires — the validators reject a
// token with no expiresAt. P2e (SEC-04): the lifetime lives in tokenLife.js so
// the validator renews by the same constant.
const { KIOSK_TOKEN_TTL_DAYS, KIOSK_TOKEN_TTL_MS: TOKEN_TTL_MS } = require('./tokenLife');
const { APP_URL: BASE_URL } = require('../lib/config');
const { withAppCheckMonitor } = require('../lib/appCheckMonitor');

// A branch_manager owns their claim branchId and any branch in ownedBranchIds
// (createUser sets ownedBranchIds = [branchId] for BMs).
function branchManagerOwns(token, branchId) {
  if (!branchId) return false;
  if (token.branchId === branchId) return true;
  return Array.isArray(token.ownedBranchIds) && token.ownedBranchIds.includes(branchId);
}

exports.createKioskToken = functions.https.onCall(withAppCheckMonitor('createKioskToken', async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { token } = context.auth;
  const { role, tenantId } = token;
  const isCrossBranch = CROSS_BRANCH_ROLES.has(role);
  if (!isCrossBranch && role !== 'branch_manager') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Requires branch_manager or above.',
    );
  }

  // SEC-03: the branchId arrives from the caller, so a branch_manager may only
  // mint for a branch they own. Unit managers never reach here (rejected above).
  const requested = data?.branchId ?? token.branchId;
  if (!isCrossBranch && !branchManagerOwns(token, requested)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'A branch manager can only create a kiosk link for their own branch.',
    );
  }
  const branchId = requested ?? 'default';
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
      // P2e (SEC-04): renewed to now + 90 days on every successful use. Tokens
      // minted before P2e lack this flag and keep their original expiry.
      rolling: true,
      // Bound to the first device that opens the link (validateKioskToken).
      deviceSecretHash: null,
      deviceBoundAt: null,
    });

  return { tokenId, kioskUrl: `${BASE_URL}/kiosk/${tenantId}/${tokenId}` };
}));

exports.KIOSK_TOKEN_TTL_DAYS = KIOSK_TOKEN_TTL_DAYS;
