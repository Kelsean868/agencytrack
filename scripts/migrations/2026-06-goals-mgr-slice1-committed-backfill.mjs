/**
 * Backfill: gamePlanCommitted flag on goals docs
 *
 * Sets `gamePlanCommitted: true` on each agent's goals/{agentId} doc where
 * their yearPlan/{year} or monthlyPlan/{year} already has status === 'committed'.
 * Idempotent — re-running writes `true` on already-flagged docs with no harm.
 *
 * USAGE
 *   # Preview only (no writes) — default
 *   node scripts/migrations/2026-06-goals-mgr-slice1-committed-backfill.mjs --dry-run
 *   node scripts/migrations/2026-06-goals-mgr-slice1-committed-backfill.mjs
 *
 *   # Apply writes
 *   node scripts/migrations/2026-06-goals-mgr-slice1-committed-backfill.mjs --apply --tenant=tatillife_south
 *
 *   # Target a different year (default: 2026)
 *   node scripts/migrations/2026-06-goals-mgr-slice1-committed-backfill.mjs --apply --year=2025
 *
 * REQUIREMENTS
 *   functions/service-account-key.json  — Firebase Admin service account
 *   firebase-admin in functions/node_modules/
 *
 * SAFETY
 *   --apply is required to write anything. Without it the script is read-only.
 *   The write is `{ merge: true }` — no existing goal fields are touched.
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

const require = createRequire(import.meta.url);
const admin   = require(resolve(ROOT, 'functions/node_modules/firebase-admin'));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = !args.includes('--apply');
const YEAR     = (() => {
  const y = args.find((a) => a.startsWith('--year='));
  const parsed = y ? parseInt(y.split('=')[1], 10) : 2026;
  return Number.isInteger(parsed) ? parsed : 2026;
})();
const TENANT_FILTER = (() => {
  const t = args.find((a) => a.startsWith('--tenant='));
  return t ? t.split('=')[1] : null;
})();

// ── Firebase init ─────────────────────────────────────────────────────────────
const KEY_PATH = resolve(ROOT, 'functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function isCommitted(tenantId, agentId) {
  const yearRef    = db.doc(`tenants/${tenantId}/users/${agentId}/yearPlan/${YEAR}`);
  const monthlyRef = db.doc(`tenants/${tenantId}/users/${agentId}/monthlyPlan/${YEAR}`);
  const [yearSnap, monthlySnap] = await Promise.all([yearRef.get(), monthlyRef.get()]);
  return (
    (yearSnap.exists    && yearSnap.data().status    === 'committed') ||
    (monthlySnap.exists && monthlySnap.data().status === 'committed')
  );
}

async function processAgent(tenantId, agentId, counts) {
  const committed = await isCommitted(tenantId, agentId);
  if (!committed) {
    counts.skipped++;
    return;
  }
  const goalsRef = db.doc(`tenants/${tenantId}/goals/${agentId}`);
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] would set gamePlanCommitted=true on goals/${agentId}`);
    counts.would++;
  } else {
    await goalsRef.set({ gamePlanCommitted: true }, { merge: true });
    console.log(`  [APPLIED] goals/${agentId} → gamePlanCommitted: true`);
    counts.applied++;
  }
}

async function processTenant(tenantId) {
  console.log(`\nTenant: ${tenantId}  (year: ${YEAR})`);
  const usersSnap = await db.collection(`tenants/${tenantId}/users`)
    .where('role', '==', 'agent')
    .get();

  if (usersSnap.empty) {
    console.log('  No agents found.');
    return;
  }

  const counts = { skipped: 0, would: 0, applied: 0 };
  for (const userDoc of usersSnap.docs) {
    try {
      await processAgent(tenantId, userDoc.id, counts);
    } catch (err) {
      console.error(`  Error processing agent ${userDoc.id}:`, err.message);
      counts.skipped++;
    }
  }

  console.log(`  Agents checked: ${usersSnap.size}`);
  console.log(`  Not committed (skipped): ${counts.skipped}`);
  if (DRY_RUN) {
    console.log(`  Would flag: ${counts.would}`);
  } else {
    console.log(`  Flagged: ${counts.applied}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== gamePlanCommitted backfill ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (read-only)' : 'APPLY (writing)'}`);
  console.log(`Year: ${YEAR}`);

  let tenantIds;
  if (TENANT_FILTER) {
    tenantIds = [TENANT_FILTER];
  } else {
    const tenantsSnap = await db.collection('tenants').get();
    tenantIds = tenantsSnap.docs.map((d) => d.id);
  }

  console.log(`Tenants to process: ${tenantIds.join(', ')}`);

  for (const tenantId of tenantIds) {
    await processTenant(tenantId);
  }

  console.log('\nDone.');
  if (DRY_RUN) {
    console.log('Re-run with --apply to write changes.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
