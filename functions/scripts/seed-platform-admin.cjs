/**
 * seed-platform-admin.cjs — Provision Kyron's cross-tenant owner (platform_admin) account.
 *
 * Creates a Firebase Auth user with role: 'platform_admin', tenantId: null.
 * No Firestore user doc is created — platform_admin lives outside any tenant.
 * Writes an entry to auditAdminCreations for traceability.
 *
 * BEFORE RUNNING:
 *   Edit PLATFORM_ADMIN_EMAIL below to the real email address.
 *   The current value is a placeholder — do not use it as-is.
 *
 * Idempotent: refuses to re-run if a platform_admin already exists with
 * the target email.
 *
 * Modes:
 *   --dry-run               Preview what would be created; no writes.
 *   --confirm-production    Required when running against production.
 *
 * Invocations:
 *   # Dry-run:
 *   node functions/scripts/seed-platform-admin.cjs --dry-run
 *
 *   # Apply to emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node functions/scripts/seed-platform-admin.cjs
 *
 *   # Apply to production:
 *   node functions/scripts/seed-platform-admin.cjs --confirm-production
 *
 * Service account:
 *   Reads functions/service-account-key.json (gitignored).
 *
 * Safety:
 *   This script must NEVER run against production without explicit operator
 *   authorization. Code merge ≠ seed run ≠ functions deploy. All three are
 *   gated separately.
 */

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const admin  = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// EDIT BEFORE RUNNING — placeholder email; replace with the real address.
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_ADMIN_EMAIL = 'kyronmarchan+platform@gmail.com';

const PLATFORM_ADMIN_ROLE  = 'platform_admin';

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const isDryRun      = args.includes('--dry-run');
const isConfirmProd = args.includes('--confirm-production');

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init
// ─────────────────────────────────────────────────────────────────────────────
function initAdmin() {
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
                        || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (usingEmulator) {
    console.log('[init] Emulator detected — --confirm-production not required.');
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'agencytrack-2a610' });
    return;
  }

  if (!isDryRun && !isConfirmProd) {
    console.error(
      'Error: running against production requires --confirm-production.\n' +
      '  Run with --dry-run first to preview, then add --confirm-production to apply.'
    );
    process.exit(1);
  }

  const keyPath = path.join(__dirname, '..', 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error(`Error: service-account-key.json not found at ${keyPath}`);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  console.log('[init] Using production credentials');
}

initAdmin();

const db   = admin.firestore();
const auth = admin.auth();

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const mode = isDryRun ? 'DRY-RUN' : 'APPLY';
  console.log(`\n=== seed-platform-admin [${mode}] ===`);
  console.log(`  email: ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`  role:  ${PLATFORM_ADMIN_ROLE}  (tenantId: null — cross-tenant)`);
  console.log('');

  // ── Idempotency check ─────────────────────────────────────────────────────
  try {
    const existing = await auth.getUserByEmail(PLATFORM_ADMIN_EMAIL);
    const existingClaims = existing.customClaims ?? {};

    if (existingClaims.role === PLATFORM_ADMIN_ROLE) {
      console.log(
        `✓ platform_admin already exists: email=${PLATFORM_ADMIN_EMAIL}  uid=${existing.uid}  tenantId=${existingClaims.tenantId}`
      );
      console.log('  Nothing to do — idempotency check passed.');
    } else {
      console.error(
        `✗ Email ${PLATFORM_ADMIN_EMAIL} already exists but role is '${existingClaims.role}', ` +
        `not '${PLATFORM_ADMIN_ROLE}'. Aborting to prevent accidental overwrite.`
      );
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    // Expected path — email not yet registered, proceed.
  }

  // Generate a temporary password — printed once to stdout, never stored.
  const tempPassword = crypto.randomBytes(24).toString('base64url').slice(0, 32);

  if (isDryRun) {
    console.log(`[dry-run] Would create Auth user: ${PLATFORM_ADMIN_EMAIL}`);
    console.log(`[dry-run] Would set claims: { role: '${PLATFORM_ADMIN_ROLE}', tenantId: null }`);
    console.log('[dry-run] Would write auditAdminCreations entry.');
    console.log('[dry-run] No Firestore user doc created (platform_admin lives outside tenants).');
    console.log('\n[DRY-RUN] No writes performed. Re-run with --confirm-production to apply.');
    process.exit(0);
  }

  // ── Create Auth user ───────────────────────────────────────────────────────
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email:         PLATFORM_ADMIN_EMAIL,
      emailVerified: false,
      password:      tempPassword,
    });
  } catch (err) {
    console.error('✗ createUser failed:', err.message);
    process.exit(1);
  }
  const newUid = userRecord.uid;

  // Print temp password ONCE immediately after account creation.
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  TEMPORARY PASSWORD — copy now, it will not be shown again  │');
  console.log(`│  ${tempPassword.padEnd(61)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('  Send a password-reset email to the platform_admin account to set a real password.');
  console.log('');

  // ── Set custom claims ──────────────────────────────────────────────────────
  try {
    await auth.setCustomUserClaims(newUid, { role: PLATFORM_ADMIN_ROLE, tenantId: null });
    console.log(`✓ Claims set: { role: '${PLATFORM_ADMIN_ROLE}', tenantId: null }`);
  } catch (err) {
    console.error('✗ setCustomUserClaims failed — rolling back auth user:', err.message);
    await auth.deleteUser(newUid).catch((e) => console.error('  Rollback also failed:', e.message));
    process.exit(1);
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await db.collection('auditAdminCreations').add({
      targetRole:   PLATFORM_ADMIN_ROLE,
      tenantId:     null,
      createdUid:   newUid,
      createdEmail: PLATFORM_ADMIN_EMAIL,
      createdBy:    'seed-platform-admin.cjs',
      timestamp:    admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ auditAdminCreations entry written.');
  } catch (err) {
    // Non-fatal — account is provisioned; audit failure only logged.
    console.warn('⚠ auditAdminCreations write failed (non-fatal):', err.message);
  }

  // ── Password reset link (best-effort) ─────────────────────────────────────
  await auth.generatePasswordResetLink(PLATFORM_ADMIN_EMAIL, {
    url: 'https://agencytrack.vercel.app',
  }).catch((err) => console.warn('⚠ Password reset link generation failed:', err.message));

  // ── Verification ───────────────────────────────────────────────────────────
  const verifyRecord = await auth.getUser(newUid);
  const finalClaims  = verifyRecord.customClaims ?? {};
  console.log('\n─── Verification ───');
  console.log(`  uid:      ${newUid}`);
  console.log(`  email:    ${verifyRecord.email}`);
  console.log(`  role:     ${finalClaims.role}   (expected: ${PLATFORM_ADMIN_ROLE})`);
  console.log(`  tenantId: ${finalClaims.tenantId}  (expected: null)`);

  const allOk = finalClaims.role === PLATFORM_ADMIN_ROLE && finalClaims.tenantId === null;
  console.log(`\n${allOk ? '✓ All checks pass.' : '✗ One or more checks failed — review above.'}`);
  if (!allOk) process.exit(1);

  console.log('\n[done]');
  process.exit(0);
})().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
