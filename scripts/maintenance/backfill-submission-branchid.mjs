/**
 * backfill-submission-branchid.mjs
 *
 * Stamps `branchId` onto every submission doc that is missing the field,
 * using the submitting agent's current `branchId` from their user doc.
 *
 * This is the prerequisite for Slice 2's read rule, which gates BM reads on
 * `submission.branchId == claim.branchId`. All docs must carry the field
 * before that rule deploys, or pre-backfill submissions become unreadable
 * by the BM.
 *
 * Attribution model: point-in-time (submission-time branch). The backfill
 * uses the agent's CURRENT branchId — acceptable for the pilot because no
 * branch transfers have occurred. If an agent moves branches post-pilot,
 * their historical submissions remain attributed to the branch that produced
 * them (already stamped correctly going forward by the write path).
 *
 * Usage:
 *   node scripts/maintenance/backfill-submission-branchid.mjs           # dry-run
 *   node scripts/maintenance/backfill-submission-branchid.mjs --execute  # commit writes
 *
 * Env vars (from .env.local):
 *   VITE_TENANT_ID or TENANT_ID  — target tenant (falls back to tatil_south)
 *   (Admin SDK uses ambient credentials — run `firebase login` or set
 *    GOOGLE_APPLICATION_CREDENTIALS if ambient creds are not active)
 *
 * Idempotent: docs that already carry `branchId` are skipped.
 */

import { createRequire } from 'module';
import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);

// ── env ───────────────────────────────────────────────────────────────────────
const envVars = loadEnv(resolve(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envVars)) {
  if (!(k in process.env)) process.env[k] = v;
}

const EXECUTE = process.argv.includes('--execute');
const TENANT_ID = process.env.TENANT_ID ?? process.env.VITE_TENANT_ID ?? 'tatil_south';

console.log(`backfill-submission-branchid  tenant=${TENANT_ID}  mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}\n`);

// ── Admin SDK ─────────────────────────────────────────────────────────────────
const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load all user docs to build agentId → branchId map
  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const branchByAgent = {};
  for (const d of usersSnap.docs) {
    const data = d.data();
    if (data.branchId) branchByAgent[d.id] = data.branchId;
  }
  console.log(`Loaded ${usersSnap.size} user docs; ${Object.keys(branchByAgent).length} have branchId.\n`);

  // 2. Load all submissions missing branchId
  const subsSnap = await db.collection(`tenants/${TENANT_ID}/submissions`).get();
  const missing = subsSnap.docs.filter((d) => !d.data().branchId);
  const alreadyStamped = subsSnap.size - missing.length;

  console.log(`Submissions total: ${subsSnap.size}`);
  console.log(`Already have branchId: ${alreadyStamped}`);
  console.log(`Need backfill: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('Nothing to backfill. Exiting.');
    return;
  }

  // 3. Group by outcome
  let stamped = 0;
  let skipped = 0; // agent has no branchId in their user doc
  const noAgentBranch = [];

  for (const docSnap of missing) {
    const data = docSnap.data();
    const agentId = data.agentId ?? data.userId ?? null;
    const branch = agentId ? (branchByAgent[agentId] ?? null) : null;

    if (!branch) {
      noAgentBranch.push({ id: docSnap.id, agentId });
      skipped++;
      continue;
    }

    console.log(`  ${EXECUTE ? 'STAMP' : 'WOULD STAMP'}  ${docSnap.id}  agentId=${agentId}  branchId=${branch}`);
    if (EXECUTE) {
      await docSnap.ref.update({ branchId: branch });
    }
    stamped++;
  }

  console.log(`\n── Summary ──`);
  console.log(`  Stamped: ${stamped}${EXECUTE ? '' : ' (dry-run)'}`);
  console.log(`  Skipped (agent has no branchId): ${skipped}`);

  if (noAgentBranch.length > 0) {
    console.log(`\n  Skipped docs (agent missing branchId in user doc):`);
    noAgentBranch.forEach(({ id, agentId }) =>
      console.log(`    submissionId=${id}  agentId=${agentId ?? '(none)'}`)
    );
    console.log(`\n  ACTION: assign branchId to these agents via UserManagementPanel, then re-run.`);
  }

  if (!EXECUTE && stamped > 0) {
    console.log(`\nRe-run with --execute to commit.`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
