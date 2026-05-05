/**
 * restore-super-admin-claim.cjs — Emergency rollback for the PR-3 migration.
 *
 * Run this ONLY if the migrate-super-admin-to-tenant-admin.cjs migration
 * leaves the user locked out and you need to restore the original claim.
 *
 * Before running, also roll back firestore.rules via:
 *   Firebase Console → Firestore → Rules → version history → Revert
 * (or re-deploy the pre-PR-3 rules with: firebase deploy --only firestore:rules)
 *
 * Write order: DOC FIRST, then claim.
 * Reason: after rules are rolled back the old isManager() check is active.
 * Setting the doc to super_admin first keeps claim+doc consistent under
 * the rolled-back rules; if only the doc write succeeds the user still
 * has the tenant_admin claim which the old rules won't recognise — but
 * re-running this script will complete the claim step.
 *
 * Target: Kyron Marchan, UID 4GeeZbhZBwdtGOLoJoggf4MQo142
 *
 * Usage:
 *   # Preview (dry-run, default):
 *   node functions/scripts/restore-super-admin-claim.cjs
 *
 *   # Apply:
 *   node functions/scripts/restore-super-admin-claim.cjs --confirm
 *
 * Service account:
 *   Reads functions/service-account-key.json (gitignored).
 */

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Config — hardcoded; this script has one job.
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_UID  = '4GeeZbhZBwdtGOLoJoggf4MQo142';
const TENANT_ID   = 'tatillife_south';
const RESTORE_CLAIMS = {
  role:           'super_admin',
  tenantId:       'tatillife_south',
  branchId:       'tatil_south',
  ownedBranchIds: ['*'],
};
const RESTORE_DOC_ROLE = 'super_admin';

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const isDryRun = !process.argv.includes('--confirm');

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init
// ─────────────────────────────────────────────────────────────────────────────
const keyPath = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error(`Error: service-account-key.json not found at ${keyPath}`);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db   = admin.firestore();
const auth = admin.auth();

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const mode = isDryRun ? 'DRY-RUN' : 'APPLY';
  console.log(`\n=== restore-super-admin-claim [${mode}] ===`);
  console.log(`  target UID: ${TARGET_UID}`);
  console.log(`  tenant:     ${TENANT_ID}`);
  console.log('');

  if (isDryRun) {
    console.log('[dry-run] Would perform these two writes (DOC FIRST, then CLAIM):');
    console.log('');
    console.log(`  Step 1 — Firestore doc update:`);
    console.log(`    tenants/${TENANT_ID}/users/${TARGET_UID}`);
    console.log(`    { role: '${RESTORE_DOC_ROLE}' }`);
    console.log('');
    console.log(`  Step 2 — Auth custom claims:`);
    console.log(`    uid=${TARGET_UID}`);
    console.log(`    ${JSON.stringify(RESTORE_CLAIMS)}`);
    console.log('');
    console.log(`  Step 3 — Revoke refresh tokens for uid=${TARGET_UID}`);
    console.log('');
    console.log('[DRY-RUN] No writes performed. Re-run with --confirm to apply.');
    process.exit(0);
  }

  // ── Step 1: verify Auth user exists ───────────────────────────────────────
  let userRecord;
  try {
    userRecord = await auth.getUser(TARGET_UID);
  } catch (err) {
    console.error(`✗ Auth user not found for UID ${TARGET_UID}: ${err.message}`);
    process.exit(1);
  }
  console.log(`✓ Auth user found: ${userRecord.email}`);
  console.log(`  Current claims: ${JSON.stringify(userRecord.customClaims ?? {})}`);

  // ── Step 2 (DOC FIRST): restore Firestore role field ─────────────────────
  const docRef = db.doc(`tenants/${TENANT_ID}/users/${TARGET_UID}`);
  try {
    await docRef.update({ role: RESTORE_DOC_ROLE });
    console.log(`✓ Firestore doc updated: role → '${RESTORE_DOC_ROLE}'`);
  } catch (err) {
    console.error(`✗ Firestore update failed: ${err.message}`);
    console.warn('  Claim NOT changed yet. Re-run to retry both steps.');
    process.exit(1);
  }

  // ── Step 3: restore Auth custom claims ────────────────────────────────────
  try {
    await auth.setCustomUserClaims(TARGET_UID, RESTORE_CLAIMS);
    console.log(`✓ Custom claims restored: ${JSON.stringify(RESTORE_CLAIMS)}`);
  } catch (err) {
    console.error(`✗ setCustomUserClaims failed: ${err.message}`);
    console.warn('  Doc is already restored. Re-run to retry the claim step.');
    process.exit(1);
  }

  // ── Step 4: revoke refresh tokens ─────────────────────────────────────────
  try {
    await auth.revokeRefreshTokens(TARGET_UID);
    console.log(`✓ Refresh tokens revoked — user must re-login to pick up restored claims`);
  } catch (err) {
    console.warn(`⚠ revokeRefreshTokens failed (non-fatal): ${err.message}`);
  }

  // ── Verification ───────────────────────────────────────────────────────────
  const verifyRecord = await auth.getUser(TARGET_UID);
  const finalClaims  = verifyRecord.customClaims ?? {};
  const finalDoc     = (await docRef.get()).data() ?? {};

  console.log('\n─── Verification ───');
  console.log(`  claim.role:           ${finalClaims.role}            (expected: ${RESTORE_CLAIMS.role})`);
  console.log(`  claim.tenantId:       ${finalClaims.tenantId}        (expected: ${RESTORE_CLAIMS.tenantId})`);
  console.log(`  claim.branchId:       ${finalClaims.branchId}        (expected: ${RESTORE_CLAIMS.branchId})`);
  console.log(`  claim.ownedBranchIds: ${JSON.stringify(finalClaims.ownedBranchIds)} (expected: ${JSON.stringify(RESTORE_CLAIMS.ownedBranchIds)})`);
  console.log(`  doc.role:             ${finalDoc.role}               (expected: ${RESTORE_DOC_ROLE})`);

  const allOk = (
    finalClaims.role           === RESTORE_CLAIMS.role           &&
    finalClaims.tenantId       === RESTORE_CLAIMS.tenantId       &&
    finalClaims.branchId       === RESTORE_CLAIMS.branchId       &&
    JSON.stringify(finalClaims.ownedBranchIds) === JSON.stringify(RESTORE_CLAIMS.ownedBranchIds) &&
    finalDoc.role              === RESTORE_DOC_ROLE
  );

  console.log(`\n${allOk ? '✓ All checks pass — rollback complete.' : '✗ One or more checks failed — review above.'}`);
  if (!allOk) process.exit(1);

  console.log('\n[done]');
  process.exit(0);
})().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
