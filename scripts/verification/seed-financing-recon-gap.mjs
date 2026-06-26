/**
 * seed-financing-recon-gap.mjs — K6 gap-fill smoke fixture.
 *
 * Seeds ONE agent in `reconciling` status with a 12-month wind-down ledger that has a
 * deliberately MISSING month (the gap) before the reconciliation month, so the K6 gap-fill
 * surface can be driven end-to-end against the deployed rules.
 *
 * ── PINNED ARITHMETIC (auto_month12; serviceMet today=2026-06-26) ──────────────
 *   effectiveDate = 2025-01-01 → serviceMonths = 17 (>=12 → serviceMet=true, auto_month12)
 *   reconciliation month = effectiveDate-month + 11 = 2025_12
 *   Ledger seeded 2025_01..2025_12 EXCEPT 2025_06 (the gap):
 *     each entered month: financingPaid=1000, netCommission=500, bonusOffset=0,
 *                         runningBalance = MM × 1000 (2025_01=1000 … 2025_12=12000)
 *   Gap 2025_06 carry-forward = preceding entered month 2025_05 → runningBalance 5000.
 *   After confirming the gap (pre-fill: flows 0, runningBalance 5000):
 *     totalFinancingDrawn = Σ financingPaid = 11×1000 + 0(gap) = 11000
 *     closingBalance      = latest runningBalance (2025_12)     = 12000
 *     waiverApplied       = Σ financingPaid[m1–3] (serviceMet)  = 3000
 *     reconciledPosition  = 12000 − 3000                        = 9000  → OWING
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * USAGE
 *   node scripts/verification/seed-financing-recon-gap.mjs --dry-run
 *   node scripts/verification/seed-financing-recon-gap.mjs --apply
 *   node scripts/verification/seed-financing-recon-gap.mjs --cleanup
 *
 * SAFETY
 *   - Hard south-guard: ABORTS if TENANT_ID === 'tatillife_south'.
 *   - Cleanup deletes ONLY this fixture's docs (user, terms, the full 2025_01..2025_12
 *     ledger incl. any gap-fill 2025_06, and the reconciliation record).
 *   - Idempotent: deterministic doc IDs; --apply overwrites + resets status to reconciling.
 *   - service-account-key.json used per CLAUDE.md Admin-SDK pattern.
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

function loadEnv() {
  try {
    const src = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* .env.local absent */ }
}
loadEnv();

const TENANT_ID = process.env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID = 'smoke_branch';
const ACTOR     = 'seed-financing-recon-gap';
const UID       = 'smoke_k6_gap';
const YEAR      = '2025';
const GAP_MONTH = '2025_06';
const EFF_DATE  = '2025-01-01';
// Entered months: all of 2025 EXCEPT the gap (2025_06).
const ENTERED_MM = ['01', '02', '03', '04', '05', '07', '08', '09', '10', '11', '12'];
const ALL_MM     = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

if (TENANT_ID === 'tatillife_south') {
  console.error('[seed-financing-recon-gap] ABORT: target tenant is tatillife_south (live pilot). Set A11Y_TENANT_ID=tatillife_smoke.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const isDryRun = argv.includes('--dry-run');
const isApply = argv.includes('--apply');
const isCleanup = argv.includes('--cleanup');
if ([isDryRun, isApply, isCleanup].filter(Boolean).length !== 1) {
  console.error('Usage: node seed-financing-recon-gap.mjs --dry-run | --apply | --cleanup');
  process.exit(1);
}

if (isDryRun) {
  console.log(`\n[seed-financing-recon-gap] DRY-RUN  tenant=${TENANT_ID}  agent=${UID}`);
  console.log(`  effectiveDate=${EFF_DATE}  status=reconciling  gap=${GAP_MONTH}`);
  console.log(`  entered months: ${ENTERED_MM.map((m) => `2025_${m}`).join(', ')}`);
  console.log('  Expected after gap-confirm: totalFinancingDrawn=11000 closingBalance=12000 waiverApplied=3000 reconciledPosition=9000 OWING');
  console.log('  gap 2025_06 carry-forward runningBalance = 5000 (from 2025_05)');
  console.log('\n[dry-run complete — no writes]');
  process.exit(0);
}

const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) {
  console.error('[seed-financing-recon-gap] ABORT: functions/service-account-key.json not found.');
  process.exit(1);
}
const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

if (isCleanup) {
  console.log(`\n[seed-financing-recon-gap] CLEANUP  tenant=${TENANT_ID}  agent=${UID}`);
  const paths = [
    `tenants/${TENANT_ID}/users/${UID}`,
    `tenants/${TENANT_ID}/financingTerms/${UID}`,
    `tenants/${TENANT_ID}/financingReconciliation/${UID}_${YEAR}`,
    ...ALL_MM.map((m) => `tenants/${TENANT_ID}/financing/${UID}_${YEAR}_${m}`),
  ];
  for (const p of paths) {
    await db.doc(p).delete();
    console.log(`  [deleted] ${p}`);
  }
  console.log(`\n[cleanup complete — ${paths.length} doc paths deleted]`);
  process.exit(0);
}

// ── Apply ──────────────────────────────────────────────────────────────────────
console.log(`\n[seed-financing-recon-gap] APPLY  tenant=${TENANT_ID}  agent=${UID}`);

await db.doc(`tenants/${TENANT_ID}/users/${UID}`).set({
  uid: UID, tenantId: TENANT_ID, role: 'agent', displayName: 'K6 Gap Smoke',
  branchId: BRANCH_ID, unitId: null, active: true, isSmokeK6Fixture: true,
  onboardingComplete: true, hasSeenWelcome: true,
  createdBy: ACTOR, createdAt: ts(), updatedAt: ts(),
}, { merge: true });
console.log(`  [fs] users/${UID}`);

// financingTerms — status reconciling so the reconciliation worksheet + settle render.
await db.doc(`tenants/${TENANT_ID}/financingTerms/${UID}`).set({
  agentId: UID, tenantId: TENANT_ID, financingStatus: 'reconciling',
  effectiveDate: EFF_DATE, agreedMonthlyFinancing: 2000, currentMonthlyFinancing: 2000,
  validatingAPI: 37500, statusHistory: [],
  createdBy: ACTOR, createdAt: ts(), updatedBy: ACTOR, updatedAt: ts(),
}, { merge: true });
console.log(`  [fs] financingTerms/${UID}  (reconciling, eff ${EFF_DATE})`);

// Remove any leftover gap-fill statement + reconciliation record from a prior run so the
// gap is genuinely missing and the reconcile precondition (status reconciling) holds.
await db.doc(`tenants/${TENANT_ID}/financing/${UID}_${GAP_MONTH}`).delete();
await db.doc(`tenants/${TENANT_ID}/financingReconciliation/${UID}_${YEAR}`).delete();

for (const m of ENTERED_MM) {
  const rb = parseInt(m, 10) * 1000; // 2025_01=1000 … 2025_12=12000
  await db.doc(`tenants/${TENANT_ID}/financing/${UID}_${YEAR}_${m}`).set({
    agentId: UID, tenantId: TENANT_ID, month: `${YEAR}_${m}`,
    financingPaid: 1000, netCommission: 500, bonusOffset: 0, runningBalance: rb,
    notes: '', source: 'manager_entry',
    enteredBy: ACTOR, enteredByName: 'Seed', enteredAt: ts(), updatedAt: ts(),
  }, { merge: true });
}
console.log(`  [fs] financing ledger: ${ENTERED_MM.length} months (gap at ${GAP_MONTH})`);

console.log(`\n[seed-financing-recon-gap] DONE — agent ${UID} reconciling with gap ${GAP_MONTH}.`);
console.log('  Confirm the gap (carry-forward rb=5000) → reconcile → reconciledPosition=9000 OWING.');
process.exit(0);
