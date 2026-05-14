/**
 * Backfill: seed the legacy `tatil_south` branch doc.
 *
 * Phase 1 discovery (inspect-branches-bug.mjs) found that 10 user docs in
 * tenants/tatillife_south reference `branchId = "tatil_south"` but no
 * matching doc exists in tenants/tatillife_south/branches/. Result:
 *   - BranchesPanel can't surface, edit, or deactivate that branch.
 *   - BranchHealthCards rendered the slug via humanise() — which worked
 *     by coincidence for "tatil_south" but failed for any auto-ID
 *     created via C1's UI.
 *
 * This script creates a single Firestore doc at:
 *
 *   tenants/tatillife_south/branches/tatil_south
 *
 * with:
 *   { name: "Tatil South", managerId: null, isActive: true,
 *     createdAt, updatedAt, updatedBy }
 *
 * managerId is intentionally null — Kyron assigns it through the C1
 * BranchesPanel UI post-merge.
 *
 * Why setDoc with an explicit id (not addDoc): existing user docs already
 * reference `branchId = "tatil_south"`. Creating an auto-id doc and
 * reassigning 10 users is unnecessary churn — the slug-id pre-dates C1
 * and we can preserve it.
 *
 * Idempotent: if the doc already exists, the script logs and exits 0
 * without writing. Safe to re-run.
 *
 * USAGE
 *   node scripts/backfill/seed-tatil-south-branch.mjs              # dry-run
 *   node scripts/backfill/seed-tatil-south-branch.mjs --execute    # real write
 *
 * REQUIREMENTS
 *   functions/service-account-key.json (per CLAUDE.md Admin SDK pattern).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const require  = createRequire(import.meta.url);
const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_PATH = path.resolve(ROOT, 'functions/service-account-key.json');

if (!existsSync(KEY_PATH)) {
  console.error(`ERROR: service account key not found at ${KEY_PATH}`);
  process.exit(1);
}

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
}

const args     = process.argv.slice(2);
const DRY_RUN  = !args.includes('--execute');
const TENANT   = 'tatillife_south';
const BRANCH_ID = 'tatil_south';
const BRANCH_NAME = 'Tatil South';

const db = admin.firestore();

async function main() {
  console.log(`[backfill] mode=${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`[backfill] target: tenants/${TENANT}/branches/${BRANCH_ID}`);
  console.log(`[backfill] name:   ${JSON.stringify(BRANCH_NAME)}`);
  console.log(`[backfill] managerId: null (Kyron assigns via BranchesPanel post-merge)`);

  const ref = db.doc(`tenants/${TENANT}/branches/${BRANCH_ID}`);
  const snap = await ref.get();

  if (snap.exists) {
    const existing = snap.data();
    console.log(`[backfill] doc already exists — skipping write.`);
    console.log(`[backfill] existing: name=${JSON.stringify(existing.name)} isActive=${existing.isActive} managerId=${existing.managerId ?? null}`);
    process.exit(0);
  }

  console.log(`[backfill] doc does not exist — proceeding.`);

  // Count users currently on this branchId so we surface the impact.
  const usersSnap = await db
    .collection(`tenants/${TENANT}/users`)
    .where('branchId', '==', BRANCH_ID)
    .get();
  console.log(`[backfill] users currently on branchId="${BRANCH_ID}": ${usersSnap.size}`);

  if (DRY_RUN) {
    console.log(`[backfill] DRY-RUN: would write the doc with createdAt=serverTimestamp().`);
    console.log(`[backfill] Re-run with --execute to apply.`);
    process.exit(0);
  }

  // updatedBy: use a marker token so the audit trail attributes this to
  // the migration, not a real user uid. The C1 service uses caller uid;
  // for a one-off backfill we use a descriptive sentinel.
  const updatedBy = 'backfill:seed-tatil-south-branch';

  await ref.set({
    name: BRANCH_NAME,
    managerId: null,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy,
  });

  const verifySnap = await ref.get();
  const verified = verifySnap.data();
  console.log(`[backfill] wrote doc. verified:`);
  console.log(`  name      : ${JSON.stringify(verified.name)}`);
  console.log(`  isActive  : ${verified.isActive}`);
  console.log(`  managerId : ${verified.managerId}`);
  console.log(`  updatedBy : ${verified.updatedBy}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
