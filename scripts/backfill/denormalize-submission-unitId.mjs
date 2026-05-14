/**
 * Backfill: denormalize unitId onto existing submission docs.
 *
 * For every submission that lacks a unitId field, looks up the agent's current
 * unitId from their user doc and writes it back onto the submission.
 *
 * Usage:
 *   node scripts/backfill/denormalize-submission-unitId.mjs              # dry-run
 *   node scripts/backfill/denormalize-submission-unitId.mjs --execute    # real writes
 *   node scripts/backfill/denormalize-submission-unitId.mjs --tenant t1  # single tenant
 *
 * Idempotent: submissions that already have unitId populated are skipped.
 * Reassignment policy: each submission receives the agent's CURRENT unitId
 * from their user doc. For agents who have been reassigned since submitting,
 * the historical submission keeps the original unit attribution only if their
 * current user doc still reflects that unit — retroactive correction is
 * intentionally out of scope per the brief.
 *
 * Error handling: an agent doc that is missing or has no unitId logs a warning
 * and skips the submission (no partial-write failure). The script continues.
 *
 * Progress: logged every 100 docs processed.
 * Summary: updated / skipped-already-populated / skipped-no-agent / total.
 *
 * Firebase Admin path: functions/node_modules/firebase-admin (per CLAUDE.md).
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

// ─── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const TENANT_FILTER = (() => {
  const idx = args.indexOf('--tenant');
  return idx !== -1 ? args[idx + 1] : null;
})();

if (DRY_RUN) {
  console.log('[backfill] DRY-RUN mode (no writes). Pass --execute to apply changes.');
} else {
  console.log('[backfill] EXECUTE mode — writes will be applied to Firestore.');
}
if (TENANT_FILTER) {
  console.log(`[backfill] Filtering to tenant: ${TENANT_FILTER}`);
}

const db = admin.firestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns all tenant IDs from /tenants top-level collection, or [TENANT_FILTER]
 * if the --tenant flag was provided.
 */
async function getTenantIds() {
  if (TENANT_FILTER) return [TENANT_FILTER];
  const snap = await db.collection('tenants').listDocuments();
  return snap.map((ref) => ref.id);
}

/**
 * Builds a uid → unitId map for all users in a tenant. One batch read per
 * tenant — avoids N+1 lookups on submissions.
 */
async function buildUnitIdMap(tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/users`).get();
  const map = new Map();
  for (const doc of snap.docs) {
    const unitId = doc.data().unitId ?? null;
    map.set(doc.id, unitId);
  }
  return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function backfillTenant(tenantId) {
  console.log(`\n[backfill] Tenant: ${tenantId}`);

  const unitIdMap = await buildUnitIdMap(tenantId);
  console.log(`[backfill]   Loaded ${unitIdMap.size} user(s).`);

  const submissionsRef = db.collection(`tenants/${tenantId}/submissions`);
  const allSnap = await submissionsRef.get();
  const total = allSnap.size;
  console.log(`[backfill]   ${total} submission(s) to inspect.`);

  let updated = 0;
  let skippedAlready = 0;
  let skippedNoAgent = 0;
  let errored = 0;
  let processed = 0;

  for (const subDoc of allSnap.docs) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`[backfill]   Progress: ${processed}/${total}`);
    }

    const data = subDoc.data();

    // Idempotency: skip if unitId is already populated.
    if (data.unitId !== undefined && data.unitId !== null) {
      skippedAlready++;
      continue;
    }

    const agentId = data.agentId ?? data.userId;
    if (!agentId) {
      console.warn(`[backfill]   WARN: submission ${subDoc.id} has no agentId/userId — skipping.`);
      skippedNoAgent++;
      continue;
    }

    if (!unitIdMap.has(agentId)) {
      console.warn(`[backfill]   WARN: agent doc missing for ${agentId} (submission ${subDoc.id}) — skipping.`);
      skippedNoAgent++;
      continue;
    }

    const unitId = unitIdMap.get(agentId);
    if (unitId === null) {
      // Agent exists but has no unitId (e.g. branch_manager writing their own report).
      // Write null explicitly so the idempotency check fires on subsequent runs.
      console.log(`[backfill]   INFO: agent ${agentId} has no unitId — writing null on ${subDoc.id}.`);
    }

    if (!DRY_RUN) {
      try {
        await subDoc.ref.update({ unitId });
        updated++;
      } catch (err) {
        console.error(`[backfill]   ERROR updating ${subDoc.id}:`, err.message);
        errored++;
      }
    } else {
      // Dry-run: show a sample of what would be written (first 5 per tenant).
      if (updated < 5) {
        console.log(`[backfill]   [DRY] would set ${subDoc.id}.unitId = ${JSON.stringify(unitId)}`);
      }
      updated++;
    }
  }

  console.log(`[backfill]   Done. updated=${updated} skipped-already=${skippedAlready} skipped-no-agent=${skippedNoAgent} errored=${errored} total=${total}`);
  return { updated, skippedAlready, skippedNoAgent, errored, total };
}

async function main() {
  const tenantIds = await getTenantIds();
  console.log(`[backfill] Tenants: ${tenantIds.join(', ')}`);

  let grandTotal = { updated: 0, skippedAlready: 0, skippedNoAgent: 0, errored: 0, total: 0 };

  for (const tenantId of tenantIds) {
    const result = await backfillTenant(tenantId);
    grandTotal.updated       += result.updated;
    grandTotal.skippedAlready += result.skippedAlready;
    grandTotal.skippedNoAgent += result.skippedNoAgent;
    grandTotal.errored        += result.errored;
    grandTotal.total          += result.total;
  }

  console.log('\n[backfill] ── Grand total ─────────────────────────');
  console.log(`[backfill]   updated:          ${grandTotal.updated}`);
  console.log(`[backfill]   skipped-already:  ${grandTotal.skippedAlready}`);
  console.log(`[backfill]   skipped-no-agent: ${grandTotal.skippedNoAgent}`);
  console.log(`[backfill]   errored:          ${grandTotal.errored}`);
  console.log(`[backfill]   total:            ${grandTotal.total}`);

  if (DRY_RUN) {
    console.log('\n[backfill] Dry-run complete. Re-run with --execute to apply writes.');
  } else {
    console.log('\n[backfill] Execute complete.');
    if (grandTotal.errored > 0) {
      console.warn(`[backfill] WARNING: ${grandTotal.errored} error(s) — review logs above.`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
