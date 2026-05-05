/**
 * migrate-user-mgmt-pr1.cjs — PR-1 schema migration (User Management Hierarchy)
 *
 * Adds three new fields to every user doc in tenants/tatillife_south/users:
 *   - branchId: string         — defaulted to 'tatil_south' for all current users
 *   - ownedBranchIds: string[] — manager-only; '*' wildcard for super/sales admins
 *   - active: boolean          — soft-delete flag (missing treated as truthy)
 *
 * Mirrors branchId + ownedBranchIds to Firebase Auth custom claims for cheap rule reads.
 * Also seeds /tenants/tatillife_south/meta/branches with the enumerated branchIds list.
 *
 * Modes:
 *   --dry-run   Preview changes only, no writes.
 *   --apply     Forward migration: backfill all three fields + claims + meta doc.
 *   --undo      Reverse: strip new fields + claims + meta doc.
 *
 * Idempotency:
 *   --apply skips docs already containing branchId.
 *   --undo  skips docs missing branchId.
 *   Both paths re-read claims fresh per user before editing — no race risk against
 *   a user signing in mid-migration.
 *
 * Sample invocations:
 *   node functions/scripts/migrate-user-mgmt-pr1.cjs --dry-run
 *   node functions/scripts/migrate-user-mgmt-pr1.cjs --apply
 *   node functions/scripts/migrate-user-mgmt-pr1.cjs --undo
 *
 * Pre-flight UID verification (Flag B from kickoff):
 *   Before running --apply against production, run --dry-run and visually verify
 *   the manager UID list below matches expectations. The pre-flight log
 *   (printed by every mode) lists every user with role IN
 *   [branch_manager, unit_manager, sales_manager] in the target tenant.
 *
 *   Verified at <FILL IN ISO TIMESTAMP> by <FILL IN OPERATOR HANDLE>:
 *     branch_manager:  <UID>  [name redacted]
 *     unit_manager:    <UID>  [name redacted]
 *     sales_manager:   <UID>  [name redacted]   (or "NONE FOUND — surprise-stop")
 *
 *   If sales_manager returns NONE FOUND at production time, that's the expected
 *   state per CLAUDE.md (Phase 9 deferred); no action required.
 *   If sales_manager returns ANY UID, surprise-stop and surface — the matrix
 *   needs to know who already holds the role.
 *
 * Service account:
 *   Reads functions/service-account-key.json (gitignored).
 *
 * Safety:
 *   This script must NEVER run against production without explicit operator
 *   authorization separate from any code merge. Code merge ≠ migration run.
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_ID         = 'tatillife_south';
const DEFAULT_BRANCH_ID = 'tatil_south';
const MANAGER_ROLES     = ['unit_manager', 'branch_manager', 'sales_manager', 'super_admin'];
const META_BRANCHES_ID  = 'branches';

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply  = args.includes('--apply');
const isUndo   = args.includes('--undo');

// Valid combinations:
//   --dry-run            → preview forward
//   --dry-run --undo     → preview reverse
//   --dry-run --apply    → preview forward (explicit)
//   --apply              → write forward
//   --undo               → write reverse
// Invalid: --apply --undo together, no flag at all.
if (!isDryRun && !isApply && !isUndo) {
  console.error('Error: pass at least one of --dry-run, --apply, --undo.');
  console.error('Usage: node migrate-user-mgmt-pr1.cjs --dry-run [--apply|--undo] | --apply | --undo');
  process.exit(1);
}
if (isApply && isUndo && !isDryRun) {
  console.error('Error: --apply and --undo are mutually exclusive (without --dry-run).');
  process.exit(1);
}

const direction = isUndo && !isApply ? 'undo' : 'apply';
const MODE = isDryRun ? `dry-run-${direction}` : direction;
const isWriteMode = !isDryRun;

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init
// ─────────────────────────────────────────────────────────────────────────────
function initAdmin() {
  // Emulator path — driven by env vars set by `firebase emulators:start`.
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
                        || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (usingEmulator) {
    console.log('[init] Using emulator (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set)');
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'agencytrack-2a610' });
    return;
  }

  // Production path — service account key required.
  const keyPath = path.join(__dirname, '..', 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error(`Error: service-account-key.json not found at ${keyPath}`);
    console.error('Place the key at functions/service-account-key.json or run against the emulator.');
    process.exit(1);
  }
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('[init] Using production credentials');
}

initAdmin();

const db   = admin.firestore();
const auth = admin.auth();

// ─────────────────────────────────────────────────────────────────────────────
// Field derivation
// ─────────────────────────────────────────────────────────────────────────────
function deriveOwnedBranchIds(role) {
  switch (role) {
    case 'super_admin':
    case 'sales_manager':
      return ['*'];
    case 'branch_manager':
    case 'unit_manager':
      return [DEFAULT_BRANCH_ID];
    default:
      return null; // agents have no ownedBranchIds field
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight: list all manager UIDs (Flag B verification)
// ─────────────────────────────────────────────────────────────────────────────
async function logManagerInventory() {
  const snap = await db.collection(`tenants/${TENANT_ID}/users`)
    .where('role', 'in', MANAGER_ROLES.filter((r) => r !== 'super_admin'))
    .get();

  console.log('');
  console.log('─── Pre-flight: Manager inventory in tenant', TENANT_ID, '───');
  if (snap.empty) {
    console.log('  (no branch/unit/sales managers found)');
  } else {
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`  role=${data.role.padEnd(15)} uid=${d.id}`);
    });
  }

  // Super admin separately (different list — for full picture)
  const saSnap = await db.collection(`tenants/${TENANT_ID}/users`)
    .where('role', '==', 'super_admin')
    .get();
  saSnap.docs.forEach((d) => {
    console.log(`  role=super_admin     uid=${d.id}`);
  });
  console.log('───────────────────────────────────────────────');
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply (forward)
// ─────────────────────────────────────────────────────────────────────────────
async function runApply() {
  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid  = userDoc.id;
    const role = data.role || 'agent';

    if (data.branchId) {
      console.log(`[apply] skip (already migrated): uid=${uid} role=${role}`);
      skipped++;
      continue;
    }

    const ownedBranchIds = deriveOwnedBranchIds(role);
    const docPatch = {
      branchId: DEFAULT_BRANCH_ID,
      active:   true,
    };
    if (ownedBranchIds !== null) {
      docPatch.ownedBranchIds = ownedBranchIds;
    }

    if (isDryRun) {
      console.log(`[dry-run] would update doc: uid=${uid} role=${role}`, docPatch);
    } else {
      try {
        await userDoc.ref.update(docPatch);
      } catch (err) {
        console.error(`[apply] doc update failed for uid=${uid}:`, err.message);
        errors.push({ uid, phase: 'doc', err: err.message });
        continue;
      }
    }

    // Auth custom claims — preserve existing role/tenantId, layer on branchId + ownedBranchIds.
    let existingClaims = {};
    try {
      const userRecord = await auth.getUser(uid);
      existingClaims = userRecord.customClaims || {};
    } catch (err) {
      // User exists in Firestore but not in Auth — possible for seeded test fixtures.
      // Skip claim update; doc is still migrated.
      console.warn(`[apply] auth user not found for uid=${uid}, skipping claim update:`, err.message);
      updated++;
      continue;
    }

    const newClaims = { ...existingClaims, branchId: DEFAULT_BRANCH_ID };
    if (ownedBranchIds !== null) {
      newClaims.ownedBranchIds = ownedBranchIds;
    }

    if (isDryRun) {
      console.log(`[dry-run] would set claims: uid=${uid}`, newClaims);
    } else {
      try {
        await auth.setCustomUserClaims(uid, newClaims);
      } catch (err) {
        console.error(`[apply] claim update failed for uid=${uid}:`, err.message);
        errors.push({ uid, phase: 'claim', err: err.message });
        continue;
      }
    }

    updated++;
  }

  // Meta/branches doc
  const metaRef = db.doc(`tenants/${TENANT_ID}/meta/${META_BRANCHES_ID}`);
  if (isDryRun) {
    console.log(`[dry-run] would write: tenants/${TENANT_ID}/meta/${META_BRANCHES_ID}`,
      { branchIds: [DEFAULT_BRANCH_ID] });
  } else {
    await metaRef.set({ branchIds: [DEFAULT_BRANCH_ID] }, { merge: true });
  }

  // Summary
  console.log('');
  console.log('─── Summary ───');
  console.log(`  mode:            ${MODE}`);
  console.log(`  total users:     ${usersSnap.size}`);
  console.log(`  to update:       ${isDryRun ? (usersSnap.size - skipped) : updated}`);
  console.log(`  skipped:         ${skipped}`);
  console.log(`  errors:          ${errors.length}`);
  if (errors.length) {
    console.log('  error detail:');
    errors.forEach((e) => console.log(`    - uid=${e.uid} phase=${e.phase}: ${e.err}`));
  }
  console.log('───────────────');
}

// ─────────────────────────────────────────────────────────────────────────────
// Undo (reverse)
// ─────────────────────────────────────────────────────────────────────────────
async function runUndo() {
  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid  = userDoc.id;
    const role = data.role || 'agent';

    if (!data.branchId) {
      console.log(`[undo] skip (already reversed): uid=${uid} role=${role}`);
      skipped++;
      continue;
    }

    const docPatch = {
      branchId:       admin.firestore.FieldValue.delete(),
      ownedBranchIds: admin.firestore.FieldValue.delete(),
      active:         admin.firestore.FieldValue.delete(),
    };

    if (isDryRun) {
      console.log(`[dry-run] would strip fields from doc: uid=${uid} role=${role}`);
    } else {
      try {
        await userDoc.ref.update(docPatch);
      } catch (err) {
        console.error(`[undo] doc update failed for uid=${uid}:`, err.message);
        errors.push({ uid, phase: 'doc', err: err.message });
        continue;
      }
    }

    // Auth claims — strip branchId + ownedBranchIds, preserve role + tenantId.
    let existingClaims = {};
    try {
      const userRecord = await auth.getUser(uid);
      existingClaims = userRecord.customClaims || {};
    } catch (err) {
      console.warn(`[undo] auth user not found for uid=${uid}, skipping claim revert:`, err.message);
      updated++;
      continue;
    }

    const newClaims = { ...existingClaims };
    delete newClaims.branchId;
    delete newClaims.ownedBranchIds;

    if (isDryRun) {
      console.log(`[dry-run] would set claims: uid=${uid}`, newClaims);
    } else {
      try {
        await auth.setCustomUserClaims(uid, newClaims);
      } catch (err) {
        console.error(`[undo] claim update failed for uid=${uid}:`, err.message);
        errors.push({ uid, phase: 'claim', err: err.message });
        continue;
      }
    }

    updated++;
  }

  // Meta/branches doc
  const metaRef = db.doc(`tenants/${TENANT_ID}/meta/${META_BRANCHES_ID}`);
  if (isDryRun) {
    console.log(`[dry-run] would delete: tenants/${TENANT_ID}/meta/${META_BRANCHES_ID}`);
  } else {
    await metaRef.delete().catch((err) => {
      console.warn('[undo] meta/branches delete failed (may not exist):', err.message);
    });
  }

  // Summary
  console.log('');
  console.log('─── Summary ───');
  console.log(`  mode:            ${MODE}`);
  console.log(`  total users:     ${usersSnap.size}`);
  console.log(`  to revert:       ${isDryRun ? (usersSnap.size - skipped) : updated}`);
  console.log(`  skipped:         ${skipped}`);
  console.log(`  errors:          ${errors.length}`);
  if (errors.length) {
    console.log('  error detail:');
    errors.forEach((e) => console.log(`    - uid=${e.uid} phase=${e.phase}: ${e.err}`));
  }
  console.log('───────────────');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`[start] migrate-user-mgmt-pr1.cjs mode=${MODE} tenant=${TENANT_ID}`);
  if (isWriteMode && !isDryRun) {
    console.log('[start] WRITE MODE — Firestore + Auth claims will be modified.');
  }

  await logManagerInventory();

  if (direction === 'apply') {
    await runApply();
  } else {
    await runUndo();
  }

  console.log('[done]');
  process.exit(0);
})().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
