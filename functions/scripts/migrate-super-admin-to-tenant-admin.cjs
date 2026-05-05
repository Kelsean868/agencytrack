/**
 * migrate-super-admin-to-tenant-admin.cjs — PR-3 role rename migration.
 *
 * Renames existing super_admin accounts to tenant_admin in both Firebase Auth
 * custom claims and Firestore user docs within tatillife_south.
 *
 * Expected to find exactly one match: Kyron, UID 4GeeZbhZBwdtGOLoJoggf4MQo142.
 * Any additional super_admin accounts will be migrated and logged.
 *
 * Modes:
 *   --dry-run               Preview what would change; no writes.
 *   --confirm-production    Required when running against production
 *                           (not emulator). Prevents accidental prod runs.
 *
 * Optional:
 *   --migrate-audit         Also copies docs from auditSuperAdminCreations
 *                           to auditAdminCreations with migratedFrom field.
 *                           Original docs are left intact (safer).
 *
 * Idempotent: users already on tenant_admin are skipped and logged.
 *
 * Sample invocations:
 *   # Dry-run first (always run this before --confirm-production):
 *   node functions/scripts/migrate-super-admin-to-tenant-admin.cjs --dry-run
 *
 *   # Apply to emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node functions/scripts/migrate-super-admin-to-tenant-admin.cjs
 *
 *   # Apply to production:
 *   node functions/scripts/migrate-super-admin-to-tenant-admin.cjs \
 *     --confirm-production
 *
 *   # Apply to production + migrate audit docs:
 *   node functions/scripts/migrate-super-admin-to-tenant-admin.cjs \
 *     --confirm-production --migrate-audit
 *
 * Run order on production (commits 1+2 must be deployed first):
 *   1. firebase deploy --only firestore:rules,functions
 *   2. node functions/scripts/migrate-super-admin-to-tenant-admin.cjs --dry-run
 *   3. node functions/scripts/migrate-super-admin-to-tenant-admin.cjs \
 *        --confirm-production [--migrate-audit]
 *
 * Safety:
 *   This script must NEVER run against production without explicit operator
 *   authorization separate from any code merge. Code merge ≠ migration run.
 *
 * Service account:
 *   Reads functions/service-account-key.json (gitignored).
 */

const path = require('path');
const fs   = require('fs');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_ID = 'tatillife_south';
const OLD_ROLE  = 'super_admin';
const NEW_ROLE  = 'tenant_admin';

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const isDryRun      = args.includes('--dry-run');
const isConfirmProd = args.includes('--confirm-production');
const isMigrateAudit = args.includes('--migrate-audit');

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

  // Production path — require explicit flag when writing.
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
  console.log(`\n=== migrate-super-admin-to-tenant-admin [${mode}] ===`);
  console.log(`  tenant: ${TENANT_ID}   ${OLD_ROLE} → ${NEW_ROLE}`);
  if (isMigrateAudit) console.log('  --migrate-audit: auditSuperAdminCreations docs will also be copied.');
  console.log('');

  // ── Step 1: find all super_admin users ─────────────────────────────────────
  const snap = await db.collection(`tenants/${TENANT_ID}/users`)
    .where('role', '==', OLD_ROLE)
    .get();

  if (snap.empty) {
    console.log(`✓ No users with role '${OLD_ROLE}' found — already migrated or never existed.`);
  } else {
    console.log(`Found ${snap.size} user(s) with role '${OLD_ROLE}':`);
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`  uid=${d.id}  email=${data.email ?? '(unknown)'}`);
    });
    console.log('');

    let updated = 0;
    const errors = [];

    for (const userDoc of snap.docs) {
      const uid = userDoc.id;

      // Firestore doc — update role field only
      if (isDryRun) {
        console.log(`[dry-run] would update Firestore doc: uid=${uid}  role: '${OLD_ROLE}' → '${NEW_ROLE}'`);
      } else {
        try {
          await userDoc.ref.update({ role: NEW_ROLE });
          console.log(`✓ Firestore doc updated: uid=${uid}`);
        } catch (err) {
          console.error(`✗ Firestore update failed for uid=${uid}:`, err.message);
          errors.push({ uid, phase: 'doc', err: err.message });
          continue;
        }
      }

      // Auth custom claims — preserve all existing claims, rename role only
      let existingClaims = {};
      try {
        const userRecord = await auth.getUser(uid);
        existingClaims = userRecord.customClaims || {};
      } catch (err) {
        console.warn(`[warn] Auth user not found for uid=${uid} — skipping claim update.`);
        updated++;
        continue;
      }

      const newClaims = { ...existingClaims, role: NEW_ROLE };
      if (isDryRun) {
        console.log(`[dry-run] would set claims: uid=${uid}  ${JSON.stringify(newClaims)}`);
      } else {
        try {
          await auth.setCustomUserClaims(uid, newClaims);
          // Revoke refresh tokens so the user picks up new claims on next login.
          await auth.revokeRefreshTokens(uid);
          console.log(`✓ Claims updated + tokens revoked: uid=${uid}`);
        } catch (err) {
          console.error(`✗ Claim update failed for uid=${uid}:`, err.message);
          errors.push({ uid, phase: 'claim', err: err.message });
          continue;
        }
      }

      updated++;
    }

    console.log('');
    console.log('─── User migration summary ───');
    console.log(`  found:   ${snap.size}`);
    console.log(`  updated: ${isDryRun ? '(dry-run, no writes)' : updated}`);
    console.log(`  errors:  ${errors.length}`);
    if (errors.length) {
      errors.forEach((e) => console.log(`    uid=${e.uid}  phase=${e.phase}: ${e.err}`));
    }
    console.log('──────────────────────────────');
  }

  // ── Step 2 (optional): migrate audit docs ──────────────────────────────────
  if (isMigrateAudit) {
    console.log('');
    console.log('── Audit doc migration (auditSuperAdminCreations → auditAdminCreations) ──');
    const auditSnap = await db.collection('auditSuperAdminCreations').get();

    if (auditSnap.empty) {
      console.log('  No docs in auditSuperAdminCreations — nothing to copy.');
    } else {
      console.log(`  Found ${auditSnap.size} audit doc(s).`);
      let auditMigrated = 0;

      for (const auditDoc of auditSnap.docs) {
        const data = {
          ...auditDoc.data(),
          targetRole:    'tenant_admin',
          migratedFrom:  'auditSuperAdminCreations',
          migratedAt:    admin.firestore.FieldValue.serverTimestamp(),
        };

        if (isDryRun) {
          console.log(`  [dry-run] would copy audit doc ${auditDoc.id} → auditAdminCreations`);
        } else {
          try {
            await db.collection('auditAdminCreations').add(data);
            auditMigrated++;
          } catch (err) {
            console.error(`  ✗ Copy failed for audit doc ${auditDoc.id}:`, err.message);
          }
        }
      }

      if (!isDryRun) {
        console.log(`  ✓ Copied ${auditMigrated} audit docs to auditAdminCreations.`);
        console.log('  Original auditSuperAdminCreations docs were left intact (safer).');
        console.log('  You can manually delete the old collection from the Firebase Console once verified.');
      }
    }
  }

  console.log('');
  console.log('[done]');
  process.exit(0);
})().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
