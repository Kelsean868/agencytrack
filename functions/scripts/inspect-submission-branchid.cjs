'use strict';

/**
 * inspect-submission-branchid.cjs — READ-ONLY audit of submission `branchId`.
 *
 * Counts submissions WITH vs WITHOUT a `branchId` field for a tenant. Answers
 * whether a branch_manager's Team Roster under-counts submitted production:
 * getAllYTDSubmissions queries `where('branchId', '==', claims.branchId)`, so any
 * submission written before branchId stamping is invisible to the BM view.
 *
 * READ-ONLY: performs ZERO writes. Safe to run against production. There is no
 * --execute flag because nothing is ever mutated.
 *
 * USAGE
 *   # default tenant (A11Y_TENANT_ID or tatillife_smoke):
 *   node functions/scripts/inspect-submission-branchid.cjs
 *   # explicit tenant:
 *   node functions/scripts/inspect-submission-branchid.cjs --tenant tatillife_south
 *
 * EMULATOR (validation)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:9090 \
 *   node functions/scripts/inspect-submission-branchid.cjs --tenant tatillife_smoke
 *
 * OPERATOR RUN — south branchId audit (read-only, HUMAN action):
 *   node functions/scripts/inspect-submission-branchid.cjs --tenant tatillife_south
 */

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

const { loadEnv } = require('../../scripts/lib/loadEnv.cjs');
const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

// ─────────────────────────────────────────────────────────────────────────────
// Tenant resolution — --tenant flag wins, then A11Y_TENANT_ID, then smoke default.
// ─────────────────────────────────────────────────────────────────────────────
const cliArgs = process.argv.slice(2);
const tenantFlagIdx = cliArgs.indexOf('--tenant');
const tenantFromFlag = tenantFlagIdx !== -1 ? cliArgs[tenantFlagIdx + 1] : null;
const TENANT_ID = tenantFromFlag
  ?? process.env.A11Y_TENANT_ID
  ?? env.A11Y_TENANT_ID
  ?? 'tatillife_smoke';

if (!TENANT_ID) {
  console.error('[inspect-branchid] ABORT: no tenant resolved. Pass --tenant <id>.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init — emulator-aware (mirrors seed-smoke-data.cjs)
// ─────────────────────────────────────────────────────────────────────────────
const isEmulator = !!(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

if (isEmulator) {
  console.log('[inspect-branchid] Emulator mode — skipping key file');
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610' });
} else {
  const keyPath = path.join(__dirname, '..', 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error('[inspect-branchid] Missing service-account-key.json at', keyPath);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
}

const db = admin.firestore();

function hasBranchId(data) {
  return typeof data.branchId === 'string' && data.branchId.trim() !== '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — read-only scan
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[inspect-branchid] READ-ONLY scan  tenant=${TENANT_ID}\n`);

  const snap = await db.collection(`tenants/${TENANT_ID}/submissions`).get();

  let withBranch = 0;
  let withoutBranch = 0;
  const byBranch = new Map();      // branchId → count
  const missingSample = [];        // up to 10 doc IDs missing branchId

  snap.forEach((doc) => {
    const data = doc.data();
    if (hasBranchId(data)) {
      withBranch++;
      byBranch.set(data.branchId, (byBranch.get(data.branchId) ?? 0) + 1);
    } else {
      withoutBranch++;
      if (missingSample.length < 10) missingSample.push(doc.id);
    }
  });

  const total = snap.size;
  console.log(`  total submissions:     ${total}`);
  console.log(`  WITH branchId:         ${withBranch}`);
  console.log(`  WITHOUT branchId:      ${withoutBranch}`);

  if (byBranch.size > 0) {
    console.log('\n  breakdown by branchId:');
    for (const [bid, n] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${bid}: ${n}`);
    }
  }

  if (missingSample.length > 0) {
    console.log(`\n  sample doc IDs missing branchId (first ${missingSample.length}):`);
    for (const id of missingSample) console.log(`    ${id}`);
  }

  console.log('\n  VERDICT:');
  if (total === 0) {
    console.log('    No submissions in this tenant — nothing to audit.');
  } else if (withoutBranch === 0) {
    console.log('    All submissions carry branchId — BM Team Roster will NOT under-count. No backfill needed.');
  } else {
    const pct = ((withoutBranch / total) * 100).toFixed(1);
    console.log(`    ${withoutBranch}/${total} (${pct}%) submissions LACK branchId — the BM Team Roster`);
    console.log('    submitted column under-counts by these. A branchId backfill is warranted');
    console.log('    (separate Tier-C task). This script is read-only and did NOT modify anything.');
  }
  console.log('');
}

main().catch((err) => {
  console.error('[inspect-branchid] FATAL:', err.message ?? err);
  process.exit(1);
});
