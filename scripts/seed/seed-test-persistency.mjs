/**
 * Seed Test Persistency — PR-F Phase 3.
 *
 * Writes 21 E3-format persistency docs (3 months × 7 agents) to
 * tenants/tatillife_south/persistency.  Months seeded: Jan, Feb, Mar 2026.
 * enteredBy = test BM's UID, enteredByRole = 'branch_manager'.
 *
 * USAGE
 *   # Dry run (default — no writes)
 *   node scripts/seed/seed-test-persistency.mjs --batch-id <uuid>
 *
 *   # Write to Firestore
 *   node scripts/seed/seed-test-persistency.mjs --batch-id <uuid> --apply
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   All 7 test agents and the test BM must already exist in Firestore
 *   so their UIDs can be resolved from their email addresses.
 *
 * DOC ID
 *   {agentUid}_{YYYY_MM}  e.g.  abc123_2026_01
 *   (underscore between year and month — matches persistencyDocId() in
 *    src/services/persistencyService.js which calls .replace('-','_'))
 *
 * DERIVED FIELDS
 *   grossSettled, netSettled, persistency, meetsAwardGate are inlined
 *   from the same formula as deriveAll() in src/lib/persistency/calculations.js.
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

// ── Months to seed ────────────────────────────────────────────────────────────

const MONTHS = [
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
];

// ── Persistency helpers ───────────────────────────────────────────────────────

// Derived-fields formula — mirrors deriveAll() in src/lib/persistency/calculations.js.
function deriveAll(inputs) {
  const { businessPlaced, notTakens, incPPPs, lumpsums100, lapses, reinstatements } = inputs;
  const grossSettled = businessPlaced - notTakens - incPPPs - lumpsums100;
  const netSettled   = grossSettled - lapses + reinstatements;
  const persistency  = businessPlaced > 0 ? netSettled / businessPlaced : 0;
  return {
    grossSettled,
    netSettled,
    persistency,
    meetsAwardGate: persistency >= 0.90,
  };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function persistencyDocId(agentUid, year, month) {
  return `${agentUid}_${year}_${String(month).padStart(2, '0')}`;
}

function reportPeriod(year, month) {
  const startYear  = month === 12 ? year     : year - 1;
  const startMonth = month === 12 ? 1        : month + 1;
  const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { reportPeriodStart: start, reportPeriodEnd: end };
}

// Deterministic seed values — plausible persistency numbers (90–96% range).
const INPUTS_BY_SLOT = [
  { businessPlaced: 20, notTakens: 0, incPPPs: 1, lumpsums100: 0, lapses: 1, reinstatements: 0 }, // ~90%
  { businessPlaced: 22, notTakens: 0, incPPPs: 1, lumpsums100: 0, lapses: 0, reinstatements: 0 }, // ~95.5%
  { businessPlaced: 18, notTakens: 0, incPPPs: 0, lumpsums100: 0, lapses: 0, reinstatements: 0 }, // 100%
  { businessPlaced: 25, notTakens: 1, incPPPs: 0, lumpsums100: 0, lapses: 1, reinstatements: 1 }, // ~96%
  { businessPlaced: 19, notTakens: 0, incPPPs: 1, lumpsums100: 0, lapses: 0, reinstatements: 0 }, // ~94.7%
  { businessPlaced: 21, notTakens: 0, incPPPs: 0, lumpsums100: 0, lapses: 1, reinstatements: 0 }, // ~95.2%
  { businessPlaced: 17, notTakens: 0, incPPPs: 0, lumpsums100: 0, lapses: 0, reinstatements: 0 }, // 100%
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeed Test Persistency — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`Months:   ${MONTHS.map((m) => monthKey(m.year, m.month)).join(', ')}`);
  console.log(`Agents:   ${AGENTS.length}`);
  console.log(`Expected: ${AGENTS.length * MONTHS.length} docs`);

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

  const bmUid = uidByEmail.get(BRANCH_MANAGER.email.toLowerCase());
  if (!bmUid) {
    console.error(`ERROR: test BM (${BRANCH_MANAGER.email}) not found in Firestore.`);
    process.exit(1);
  }
  console.log(`  Resolved ${uidByEmail.size} users (${AGENTS.length} agents + 1 BM).`);

  // ── Log setup ─────────────────────────────────────────────────────────────
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logDir  = resolve(ROOT, 'verification');
  mkdirSync(logDir, { recursive: true });
  const logPath = resolve(logDir, `seed-persistency-${ts}.log`);
  const log     = (msg) => { console.log(msg); appendFileSync(logPath, msg + '\n'); };

  log(`\nSeeding ${AGENTS.length * MONTHS.length} persistency docs — batch ${batchId}`);

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  let count = 0;

  for (let agentIdx = 0; agentIdx < AGENTS.length; agentIdx++) {
    const agent = AGENTS[agentIdx];
    const agentUid = uidByEmail.get(agent.email.toLowerCase());
    const inputs = INPUTS_BY_SLOT[agentIdx % INPUTS_BY_SLOT.length];
    const derived = deriveAll(inputs);

    for (const { year, month } of MONTHS) {
      const mk  = monthKey(year, month);
      const per = reportPeriod(year, month);
      const docId = persistencyDocId(agentUid, year, month);
      const ref   = db.doc(`tenants/${TENANT_ID}/persistency/${docId}`);

      batch.set(ref, {
        agentId:   agentUid,
        tenantId:  TENANT_ID,
        year,
        month,
        monthKey:  mk,
        reportPeriodStart: per.reportPeriodStart,
        reportPeriodEnd:   per.reportPeriodEnd,
        // Six E3 business inputs
        businessPlaced:   inputs.businessPlaced,
        notTakens:        inputs.notTakens,
        incPPPs:          inputs.incPPPs,
        lumpsums100:      inputs.lumpsums100,
        lapses:           inputs.lapses,
        reinstatements:   inputs.reinstatements,
        // Derived fields (same formula as persistencyService.deriveAll)
        grossSettled:     derived.grossSettled,
        netSettled:       derived.netSettled,
        persistency:      derived.persistency,
        meetsAwardGate:   derived.meetsAwardGate,
        // Audit
        enteredAt:        now,
        enteredBy:        bmUid,
        enteredByRole:    'branch_manager',
        lastEditedAt:     now,
        lastEditedBy:     bmUid,
        lastEditedByRole: 'branch_manager',
        // PR-F test marker
        testDataBatchId:  batchId,
      });

      log(`  SET tenants/${TENANT_ID}/persistency/${docId}`);
      count++;
    }
  }

  await batch.commit();
  log(`\n✓ ${count} persistency docs written (batch ${batchId})`);
  log(`  Log: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
