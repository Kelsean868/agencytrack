/**
 * One-time test-data fix: assign unitId to 4 test user docs in tatillife_south.
 *
 * Background: the main backfill (denormalize-submission-unitId.mjs) found 4
 * agents whose user docs had no unitId, causing all their submissions to
 * backfill as unitId=null. This script patches those user docs so the main
 * backfill can be re-run and produce correct unitId values on submissions.
 *
 * Target unitId: XQhG6awVgaYkCFX7gnd1OYTr9zt2 (the single test unit manager)
 *
 * Usage:
 *   node scripts/backfill/assign-test-unit.mjs            # dry-run
 *   node scripts/backfill/assign-test-unit.mjs --execute  # real writes
 *
 * Idempotent: skips any doc that already has unitId set (any value).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);
const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Admin SDK init (mirrors preview-test-data-sweep.mjs) ──────────────────────

const KEY_PATH = path.resolve(ROOT, 'functions/service-account-key.json');
if (!existsSync(KEY_PATH)) {
  console.error(`ERROR: service account key not found at ${KEY_PATH}`);
  process.exit(1);
}

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
}
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────

const TENANT_ID   = 'tatillife_south';
const TARGET_UNIT = 'XQhG6awVgaYkCFX7gnd1OYTr9zt2';

const TARGET_UIDS = [
  '4GeeZbhZBwdtGOLoJoggf4MQo142', // Kyron Marchan (tenant_admin)
  'J0j4uBqzTPcfm1IlGCPyDzo27RP2', // Kelsean Agent (agent)
  'XQhG6awVgaYkCFX7gnd1OYTr9zt2', // Test Unit Manager (unit_manager) — self-assigns
  'x8Zfg2TI1yf8JOljqxCsJszxnx93', // Test Branch Manager (branch_manager)
];

// ── Argument parsing ──────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute');

if (DRY_RUN) {
  console.log('[assign-test-unit] DRY-RUN mode (no writes). Pass --execute to apply.');
} else {
  console.log('[assign-test-unit] EXECUTE mode — writes will be applied.');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let updated = 0, skippedAlready = 0, errored = 0;
  const total = TARGET_UIDS.length;

  for (const uid of TARGET_UIDS) {
    const ref  = db.doc(`tenants/${TENANT_ID}/users/${uid}`);
    const snap = await ref.get();

    if (!snap.exists) {
      console.error(`[assign-test-unit] ERROR: doc not found for uid=${uid}`);
      errored++;
      continue;
    }

    const data = snap.data();

    // Idempotency: skip if unitId is already set to any value.
    if (data.unitId !== undefined && data.unitId !== null) {
      console.log(`[assign-test-unit] SKIP (already set): uid=${uid} unitId=${JSON.stringify(data.unitId)}`);
      skippedAlready++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[assign-test-unit] [DRY] would set uid=${uid} (${data.name ?? data.email}) unitId=${TARGET_UNIT}`);
      updated++;
    } else {
      try {
        await ref.update({ unitId: TARGET_UNIT });
        console.log(`[assign-test-unit] SET uid=${uid} (${data.name ?? data.email}) unitId=${TARGET_UNIT}`);
        updated++;
      } catch (err) {
        console.error(`[assign-test-unit] ERROR updating uid=${uid}:`, err.message);
        errored++;
      }
    }
  }

  console.log(`\n[assign-test-unit] Done. updated=${updated} skipped-already=${skippedAlready} errored=${errored} total=${total}`);

  if (!DRY_RUN && errored > 0) {
    console.warn('[assign-test-unit] WARNING: errors occurred — review logs above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[assign-test-unit] Fatal:', err);
  process.exit(1);
});
