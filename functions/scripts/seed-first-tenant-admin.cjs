/**
 * seed-first-tenant-admin.cjs — Operator tool: seed or repair a tenant_admin account.
 *
 * Sets custom Auth claims AND upserts the Firestore user doc for the target UID.
 * Use this for new-tenant provisioning — first tenant_admin has no claims yet.
 *
 * Renamed from seed-first-super-admin.cjs (PR-2) to seed-first-tenant-admin.cjs
 * (PR-3) when super_admin was split into tenant_admin + platform_admin.
 *
 * Modes:
 *   --dry-run   Preview what would change; no writes.
 *   --apply     Write claims + upsert Firestore doc. Revokes refresh tokens
 *               to force the user to pick up new claims on next login.
 *
 * Required flags:
 *   --uid <uid>       Firebase Auth UID of the target user.
 *   --email <email>   Email address — verified against the auth user record
 *                     to prevent wrong-UID mistakes.
 *   --tenant <id>     Tenant ID (e.g. 'tatillife_south').
 *
 * Optional flags:
 *   --name <name>     Display name written to the Firestore doc. Falls back to
 *                     the Auth record's displayName if omitted.
 *
 * Sample invocations:
 *   # Dry-run first — review output before writing:
 *   node functions/scripts/seed-first-tenant-admin.cjs \
 *     --uid <UID> \
 *     --email <email> \
 *     --tenant tatillife_south \
 *     --dry-run
 *
 *   # Apply:
 *   node functions/scripts/seed-first-tenant-admin.cjs \
 *     --uid <UID> \
 *     --email <email> \
 *     --tenant tatillife_south \
 *     --apply
 *
 * Service account:
 *   Reads functions/service-account-key.json (gitignored). Script is committable
 *   because no credentials are embedded — UIDs and emails are CLI args only.
 *
 * Safety:
 *   This script must NEVER run against production without explicit operator
 *   authorization separate from any code merge. Code merge ≠ seed run ≠
 *   functions deploy. All three are gated separately.
 */

const path = require('path');
const fs   = require('fs');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_BRANCH_ID  = 'tatil_south';
const TENANT_ADMIN_ROLE  = 'tenant_admin';

// ─────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply  = args.includes('--apply');

function getFlag(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const targetUid    = getFlag('--uid');
const targetEmail  = getFlag('--email');
const targetTenant = getFlag('--tenant');
const targetName   = getFlag('--name');

if (!isDryRun && !isApply) {
  console.error('Error: must pass --dry-run or --apply');
  process.exit(1);
}
if (isDryRun && isApply) {
  console.error('Error: --dry-run and --apply are mutually exclusive');
  process.exit(1);
}
if (!targetUid || !targetEmail || !targetTenant) {
  console.error('Error: --uid, --email, and --tenant are all required');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init
// ─────────────────────────────────────────────────────────────────────────────
const keyPath = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing service-account-key.json at', keyPath);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db   = admin.firestore();
const auth = admin.auth();

// Emulator support
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('[seed] Firestore emulator detected:', process.env.FIRESTORE_EMULATOR_HOST);
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('[seed] Auth emulator detected:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const mode = isDryRun ? 'DRY-RUN' : 'APPLY';
  console.log(`\n=== seed-first-tenant-admin [${mode}] ===`);
  console.log(`  UID:    ${targetUid}`);
  console.log(`  email:  (verified against auth record)`);
  console.log(`  tenant: ${targetTenant}`);
  console.log('');

  // ── Step 1: verify auth user exists and email matches ──────────────────────
  let userRecord;
  try {
    userRecord = await auth.getUser(targetUid);
  } catch (e) {
    console.error(`✗ Auth user not found for UID ${targetUid}. Check the UID and try again.`);
    process.exit(1);
  }

  if (userRecord.email !== targetEmail) {
    console.error(
      `✗ Email mismatch — auth record has "${userRecord.email}", --email arg is "${targetEmail}". ` +
      'Aborting to prevent wrong-UID mistake.'
    );
    process.exit(1);
  }
  console.log(`✓ Auth user verified: ${userRecord.email}`);

  // ── Step 2: show current claims ───────────────────────────────────────────
  const currentClaims = userRecord.customClaims ?? {};
  console.log('\nCurrent claims:', JSON.stringify(currentClaims));

  const newClaims = {
    role:           TENANT_ADMIN_ROLE,
    tenantId:       targetTenant,
    branchId:       DEFAULT_BRANCH_ID,
    ownedBranchIds: ['*'],
  };
  console.log('Target claims: ', JSON.stringify(newClaims));

  // ── Step 3: show current Firestore doc ────────────────────────────────────
  const docRef  = db.doc(`tenants/${targetTenant}/users/${targetUid}`);
  const docSnap = await docRef.get();
  const currentDoc = docSnap.exists ? docSnap.data() : null;
  console.log('\nCurrent Firestore doc:', currentDoc ? JSON.stringify(currentDoc) : '(does not exist)');

  const resolvedName = targetName ?? userRecord.displayName ?? null;

  // Refuse --apply when no usable name resolves (neither --name nor the Auth
  // displayName). Writing name:null leaves the tenant-admin doc with a blank
  // name in every manager/leaderboard surface that reads it; force the operator
  // to supply one explicitly rather than silently persisting a null.
  if (isApply && (!resolvedName || !resolvedName.trim())) {
    console.error(
      '\nError: could not resolve a display name for the tenant-admin doc.\n' +
      '  No --name flag was passed and the Auth user has no displayName.\n' +
      '  Re-run with --name "<Full Name>" to set the name explicitly.'
    );
    process.exit(1);
  }

  const upsertPayload = {
    uid:            targetUid,
    email:          targetEmail,
    name:           resolvedName,
    role:           TENANT_ADMIN_ROLE,
    tenantId:       targetTenant,
    branchId:       DEFAULT_BRANCH_ID,
    ownedBranchIds: ['*'],
    active:         true,
    updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
  };
  console.log('Upsert payload:  ', JSON.stringify({ ...upsertPayload, updatedAt: '<serverTimestamp>' }));
  console.log('  (set with merge:true — existing fields like "createdAt" are preserved)');

  if (isDryRun) {
    console.log('\n[DRY-RUN] No writes performed. Re-run with --apply to proceed.');
    process.exit(0);
  }

  // ── Step 4: set custom claims ─────────────────────────────────────────────
  await auth.setCustomUserClaims(targetUid, newClaims);
  console.log('\n✓ Custom claims set');

  // ── Step 5: upsert Firestore doc ──────────────────────────────────────────
  await docRef.set(upsertPayload, { merge: true });
  console.log('✓ Firestore doc upserted (merge:true)');

  // ── Step 6: revoke refresh tokens ─────────────────────────────────────────
  // Forces the user's next login to pick up the new claims immediately.
  await auth.revokeRefreshTokens(targetUid);
  console.log('✓ Refresh tokens revoked — user must re-login to pick up new claims');

  // ── Verification summary ──────────────────────────────────────────────────
  const verifyUser = await auth.getUser(targetUid);
  const finalClaims = verifyUser.customClaims ?? {};
  const finalDoc    = (await docRef.get()).data() ?? {};

  console.log('\n─── Verification ───');
  console.log(`  name:           doc=${finalDoc.name}`);
  console.log(`  role:           claim=${finalClaims.role} | doc=${finalDoc.role}`);
  console.log(`  tenantId:       claim=${finalClaims.tenantId} | doc=${finalDoc.tenantId}`);
  console.log(`  branchId:       claim=${finalClaims.branchId} | doc=${finalDoc.branchId}`);
  console.log(`  ownedBranchIds: claim=${JSON.stringify(finalClaims.ownedBranchIds)} | doc=${JSON.stringify(finalDoc.ownedBranchIds)}`);
  console.log(`  active:         doc=${finalDoc.active}`);

  const allOk = (
    finalClaims.role           === TENANT_ADMIN_ROLE &&
    finalClaims.tenantId       === targetTenant &&
    finalClaims.branchId       === DEFAULT_BRANCH_ID &&
    JSON.stringify(finalClaims.ownedBranchIds) === JSON.stringify(['*']) &&
    finalDoc.role              === TENANT_ADMIN_ROLE &&
    finalDoc.branchId          === DEFAULT_BRANCH_ID &&
    finalDoc.active            === true
  );

  console.log(`\n${allOk ? '✓ All checks pass.' : '✗ One or more checks failed — review above.'}`);
  if (!allOk) process.exit(1);
  process.exit(0);
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
