/**
 * Seed Test Campaign — PR-F Phase 3.
 *
 * Writes one "Test Campaign Q2" doc to tenants/tatillife_south/campaigns
 * with all 7 test agents enrolled in an agent-scoped campaign.
 * Status is set to 'active' which triggers notification fan-out via
 * createCampaign() in campaignService.js — those notification docs
 * will be swept by the cleanup scripts.
 *
 * USAGE
 *   # Dry run (default — no writes)
 *   node scripts/seed/seed-test-campaign.mjs --batch-id <uuid>
 *
 *   # Write to Firestore
 *   node scripts/seed/seed-test-campaign.mjs --batch-id <uuid> --apply
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   All 7 test agents and the test BM must already exist in Firestore.
 *
 * CLEANUP NOTE
 *   Cleanup is a full doc delete — no participant-array surgery needed.
 *   Notification docs created by the fan-out are swept separately by
 *   wipe-test-data-sweep.mjs (queried by userId ∈ testAgentUids).
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

import {
  TENANT_ID,
  AGENTS,
  BRANCH_MANAGER,
} from './test-roster.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function argValue(args, flag) {
  const eqForm = args.find((a) => a.startsWith(`--${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 3);
  const idx = args.indexOf(`--${flag}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return null;
}

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const batchId = argValue(args, 'batch-id') ?? (() => { console.error('ERROR: --batch-id <uuid> required'); process.exit(1); })();

// ── Campaign definition ───────────────────────────────────────────────────────

// Start today, end ~30 days out.
function isoDate(d) { return d.toISOString().slice(0, 10); }
const today    = new Date();
const endDate  = new Date(today);
endDate.setUTCDate(endDate.getUTCDate() + 30);

const CAMPAIGN_NAME = 'Test Campaign Q2';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeed Test Campaign — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Tenant:    ${TENANT_ID}`);
  console.log(`Batch ID:  ${batchId}`);
  console.log(`Campaign:  "${CAMPAIGN_NAME}"`);
  console.log(`Date:      ${isoDate(today)} → ${isoDate(endDate)}`);
  console.log(`Agents:    ${AGENTS.length}`);

  if (DRY_RUN) {
    console.log('\n(Dry run — no writes. Add --apply to seed.)');
    process.exit(0);
  }

  // ── Init Admin SDK ──────────────────────────────────────────────────────────
  const KEY_PATH = resolve(ROOT, 'functions/service-account-key.json');
  if (!existsSync(KEY_PATH)) {
    console.error(`ERROR: service account key not found at ${KEY_PATH}`);
    process.exit(1);
  }

  const require = createRequire(import.meta.url);
  const admin   = require('../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  }
  const db = admin.firestore();

  // ── Resolve UIDs from Firestore ────────────────────────────────────────────
  console.log('\nResolving UIDs…');

  const allEmails = new Set([
    ...AGENTS.map((a) => a.email.toLowerCase()),
    BRANCH_MANAGER.email.toLowerCase(),
  ]);

  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const uidByEmail = new Map();
  for (const doc of usersSnap.docs) {
    const email = (doc.data().email ?? '').toLowerCase();
    if (allEmails.has(email)) uidByEmail.set(email, doc.id);
  }

  const missingAgents = AGENTS.filter((a) => !uidByEmail.has(a.email.toLowerCase()));
  if (missingAgents.length > 0) {
    console.error(`ERROR: ${missingAgents.length} test agent(s) not found. Create test users first.`);
    process.exit(1);
  }

  const bmUid  = uidByEmail.get(BRANCH_MANAGER.email.toLowerCase());
  if (!bmUid) {
    console.error(`ERROR: test BM (${BRANCH_MANAGER.email}) not found.`);
    process.exit(1);
  }

  const agentUids = AGENTS.map((a) => uidByEmail.get(a.email.toLowerCase()));
  console.log(`  Resolved ${agentUids.length} agent UIDs + BM UID.`);

  // ── Log setup ─────────────────────────────────────────────────────────────
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logDir  = resolve(ROOT, 'verification');
  mkdirSync(logDir, { recursive: true });
  const logPath = resolve(logDir, `seed-campaign-${ts}.log`);
  const log     = (msg) => { console.log(msg); appendFileSync(logPath, msg + '\n'); };

  // ── Write campaign doc ─────────────────────────────────────────────────────
  const campaignDoc = {
    tenantId:       TENANT_ID,
    name:           CAMPAIGN_NAME,
    status:         'active',
    startDate:      isoDate(today),
    endDate:        isoDate(endDate),
    prize:          'Test Prize — gift card',
    scope: {
      type:     'agent',
      agentIds: agentUids,
    },
    targets: [
      { metric: 'apiSold',          threshold: 10000 },
      { metric: 'applicationsSold', threshold: 2 },
    ],
    createdBy:       bmUid,
    createdByName:   BRANCH_MANAGER.name,
    createdByRole:   'branch_manager',
    createdAt:       admin.firestore.FieldValue.serverTimestamp(),
    // PR-F test marker
    testDataBatchId: batchId,
  };

  const ref = await db.collection(`tenants/${TENANT_ID}/campaigns`).add(campaignDoc);
  log(`  SET tenants/${TENANT_ID}/campaigns/${ref.id}`);
  log(`  Campaign ID: ${ref.id}`);

  // The Admin SDK write doesn't trigger notification fan-out (that runs
  // client-side via campaignService.createCampaign()). For the smoke test
  // scenario, we manually write notification docs for each agent so the
  // cleanup sweep can verify notification deletion.
  log('\n  Writing notification docs for test agents…');
  const notifBatch = db.batch();
  for (const agentUid of agentUids) {
    const nRef = db.collection(`tenants/${TENANT_ID}/notifications`).doc();
    notifBatch.set(nRef, {
      userId:          agentUid,
      tenantId:        TENANT_ID,
      type:            'campaign_launched',
      title:           `New Campaign: ${CAMPAIGN_NAME}`,
      body:            `A new campaign has launched. Prize: Test Prize — gift card.`,
      link:            null,
      read:            false,
      createdAt:       admin.firestore.FieldValue.serverTimestamp(),
      testDataBatchId: batchId,
    });
    log(`  SET tenants/${TENANT_ID}/notifications/${nRef.id}  (userId=${agentUid})`);
  }
  await notifBatch.commit();

  log(`\n✓ Campaign + ${agentUids.length} notification docs written (batch ${batchId})`);
  log(`  Campaign: tenants/${TENANT_ID}/campaigns/${ref.id}`);
  log(`  Log: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
