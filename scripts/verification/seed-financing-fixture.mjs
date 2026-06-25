/**
 * seed-financing-fixture.mjs — reusable K4/K5/K6/K7/K8 smoke fixture.
 *
 * Seeds two synthetic agents into the smoke tenant with known financing terms
 * and one current-quarter policy each, producing a deterministic grossBonus of
 * $15,000 and fully-assertable waterfall values on both the owing and cleared paths.
 *
 * ── PINNED ARITHMETIC ────────────────────────────────────────────────────────
 * Verified against financingBonusEngine.js + DEFAULT_FINANCING_RULESET_2026.
 *
 *   Seed inputs:
 *     effectiveDate  = '2026-06-01'  → today 2026-06-25 → month 0 of agreement → Y1Q1
 *     1 policy: nb_ordinary, proposedAPI=$50,000, status=submitted,
 *               dateSubmitted=2026-06-20T04:00:00Z (TT-midnight, monthKey='2026_06')
 *
 *   Engine chain (Q1 submitted-basis, financingProjectedBonus.js adapter):
 *     creditWeight(nb_ordinary)  = 1.0              (creditMap.nb_ordinary=1.0)
 *     gross                      = $50,000 × 1.0    = $50,000
 *     Q1 gate: gross $50,000 ≥ $37,500 ✓ (Q1 exception — no persistency gate)
 *     netPersistency             = $50,000           (no lapses, no reinstatements)
 *     consistencyBonus           = 0.15 × $50,000   = $7,500  (consistencyRate=0.15)
 *     productionBonus            = 0.15 × $50,000   = $7,500  (Y1 productionRateY1=0.15)
 *     grossBonus                 = $7,500 + $7,500  = $15,000
 *
 *   Take-home — OWING path (smoke_k4_owing: financingStatus=on_financing):
 *     tax              = $15,000 × 0.25      = $3,750
 *     net              = $15,000 − $3,750    = $11,250
 *     financingPortion = $11,250 × 0.50      = $5,625
 *     takeHome         = $11,250 − $5,625    = $5,625
 *     ResultBand                              = 37.5% OF GROSS
 *
 *   Take-home — CLEARED path (smoke_k4_cleared: financingStatus=not_on_financing):
 *     tax              = $3,750
 *     net              = $11,250
 *     financingPortion = $0
 *     takeHome         = $11,250
 *     ResultBand                              = 75% OF GROSS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Docs written (6 total — all in smoke tenant):
 *   tenants/{TENANT}/users/smoke_k4_owing
 *   tenants/{TENANT}/users/smoke_k4_cleared
 *   tenants/{TENANT}/financingTerms/smoke_k4_owing
 *   tenants/{TENANT}/financingTerms/smoke_k4_cleared
 *   tenants/{TENANT}/policies/smoke_k4_owing_policy_1
 *   tenants/{TENANT}/policies/smoke_k4_cleared_policy_1
 *
 * USAGE
 *   node scripts/verification/seed-financing-fixture.mjs --dry-run
 *   node scripts/verification/seed-financing-fixture.mjs --apply
 *   node scripts/verification/seed-financing-fixture.mjs --cleanup
 *
 * SAFETY
 *   - Hard south-guard: ABORTS if TENANT_ID === 'tatillife_south'.
 *   - Cleanup deletes ONLY the 6 deterministic docs above.
 *   - Idempotent: deterministic doc IDs → --apply overwrites same docs on re-run.
 *   - service-account-key.json used per CLAUDE.md Admin-SDK pattern.
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ── env loading (mirrors smoke harness) ──────────────────────────────────────
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
  } catch { /* .env.local absent — rely on process.env */ }
}
loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID  = process.env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID  = 'smoke_branch';
const ACTOR      = 'seed-financing-fixture';

const OWING_UID   = 'smoke_k4_owing';    // on_financing  → 37.5% take-home
const CLEARED_UID = 'smoke_k4_cleared';  // not_on_financing → 75% take-home

// dateSubmitted = 2026-06-20 TT-midnight = 04:00 UTC same day
// monthKeyFromTimestamp → '2026_06' — within Q1 range 2026_06..2026_08
const DATE_SUBMITTED_MS = Date.UTC(2026, 5, 20, 4, 0, 0);
const DATE_WRITTEN_MS   = Date.UTC(2026, 5, 15, 4, 0, 0);
const PROPOSED_API      = 50_000;

// ── South-guard ───────────────────────────────────────────────────────────────
if (TENANT_ID === 'tatillife_south') {
  console.error('[seed-financing-fixture] ABORT: target tenant is tatillife_south (live pilot). Set A11Y_TENANT_ID=tatillife_smoke.');
  process.exit(1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv      = process.argv.slice(2);
const isDryRun  = argv.includes('--dry-run');
const isApply   = argv.includes('--apply');
const isCleanup = argv.includes('--cleanup');

if ([isDryRun, isApply, isCleanup].filter(Boolean).length !== 1) {
  console.error('Usage: node seed-financing-fixture.mjs --dry-run | --apply | --cleanup');
  process.exit(1);
}

// ── Dry-run (no admin init needed) ───────────────────────────────────────────
if (isDryRun) {
  console.log(`\n[seed-financing-fixture] DRY-RUN  tenant=${TENANT_ID}  branch=${BRANCH_ID}`);
  console.log('\nPinned arithmetic (grossBonus=$15,000):');
  console.log('  proposedAPI=$50,000, effectiveDate=2026-06-01 → Y1Q1');
  console.log('  dateSubmitted=2026-06-20T04:00Z → monthKey=2026_06 ∈ Q1 range');
  console.log('  creditWeight(nb_ordinary)=1.0 → gross=$50,000 ≥ $37,500 gate ✓');
  console.log('  netPersistency=$50,000 (no lapses), consistencyBonus=$7,500, productionBonus=$7,500');
  console.log('  → grossBonus=$15,000');
  console.log('\n  smoke_k4_owing   (on_financing):      tax=$3,750 net=$11,250 fin=$5,625 th=$5,625  37.5%');
  console.log('  smoke_k4_cleared (not_on_financing):  tax=$3,750 net=$11,250 fin=$0     th=$11,250  75%');
  console.log('\nWould write:');
  for (const uid of [OWING_UID, CLEARED_UID]) {
    console.log(`  tenants/${TENANT_ID}/users/${uid}`);
    console.log(`  tenants/${TENANT_ID}/financingTerms/${uid}`);
    console.log(`  tenants/${TENANT_ID}/policies/${uid}_policy_1`);
  }
  console.log('\n[dry-run complete — no writes performed]');
  process.exit(0);
}

// ── Admin SDK init (apply + cleanup both need it) ─────────────────────────────
const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) {
  console.error('[seed-financing-fixture] ABORT: functions/service-account-key.json not found.');
  process.exit(1);
}
const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

// ── Cleanup ───────────────────────────────────────────────────────────────────
if (isCleanup) {
  console.log(`\n[seed-financing-fixture] CLEANUP  tenant=${TENANT_ID}`);
  const paths = [
    `tenants/${TENANT_ID}/users/${OWING_UID}`,
    `tenants/${TENANT_ID}/users/${CLEARED_UID}`,
    `tenants/${TENANT_ID}/financingTerms/${OWING_UID}`,
    `tenants/${TENANT_ID}/financingTerms/${CLEARED_UID}`,
    `tenants/${TENANT_ID}/policies/${OWING_UID}_policy_1`,
    `tenants/${TENANT_ID}/policies/${CLEARED_UID}_policy_1`,
  ];
  for (const p of paths) {
    await db.doc(p).delete();
    console.log(`  [deleted] ${p}`);
  }
  console.log('\n[cleanup complete — 6 docs deleted]');
  process.exit(0);
}

// ── Apply ─────────────────────────────────────────────────────────────────────
console.log(`\n[seed-financing-fixture] APPLY  tenant=${TENANT_ID}  branch=${BRANCH_ID}`);

function buildUserDoc(uid, label) {
  return {
    uid,
    tenantId: TENANT_ID,
    role: 'agent',
    displayName: `K4 Smoke ${label}`,
    branchId: BRANCH_ID,
    unitId: null,
    active: true,
    isSmokeK4Fixture: true,
    onboardingComplete: true,
    hasSeenWelcome: true,
    createdBy: ACTOR,
    createdAt: ts(),
    updatedAt: ts(),
  };
}

function buildFinancingTerms(uid, financingStatus) {
  return {
    agentId: uid,
    tenantId: TENANT_ID,
    financingStatus,
    effectiveDate: '2026-06-01',
    agreedMonthlyFinancing: 2000,
    currentMonthlyFinancing: 2000,
    validatingAPI: 37500,
    statusHistory: [],
    createdBy: ACTOR,
    createdAt: ts(),
    updatedBy: ACTOR,
    updatedAt: ts(),
  };
}

function buildPolicy(agentId) {
  return {
    tenantId: TENANT_ID,
    agentId,
    agentNumber: null,
    unitId: null,
    branchId: BRANCH_ID,
    status: 'submitted',
    statusDate: ts(),
    ownerName: 'K4 Smoke Owner',
    insuredName: 'K4 Smoke Insured',
    policyNumber: null,
    productLine: 'life',
    newBusinessType: 'nb_ordinary',
    policyClass: 'whole_life',
    planId: null,
    planName: null,
    proposedPremium: null,
    proposedFrequency: 'A',
    proposedAPI: PROPOSED_API,
    proposedCoverage: null,
    dateWritten:   admin.firestore.Timestamp.fromMillis(DATE_WRITTEN_MS),
    dateSubmitted: admin.firestore.Timestamp.fromMillis(DATE_SUBMITTED_MS),
    notes: null,
    isSelfOrFamily: false,
    replacedPolicyAPI: null,
    sourceOfProspect: 'referral',
    socialPlatform: null,
    cashWithApp: { collected: false, amount: null },
    dateIssued: null,
    policyDeliveryDate: null,
    isSmokeK4Fixture: true,
    createdAt: ts(),
    createdBy: ACTOR,
  };
}

// User docs — BM dropdown scopes by branchId; agents must be in smoke_branch.
await db.doc(`tenants/${TENANT_ID}/users/${OWING_UID}`)
  .set(buildUserDoc(OWING_UID, 'Owing'), { merge: true });
console.log(`  [fs] users/${OWING_UID}`);

await db.doc(`tenants/${TENANT_ID}/users/${CLEARED_UID}`)
  .set(buildUserDoc(CLEARED_UID, 'Cleared'), { merge: true });
console.log(`  [fs] users/${CLEARED_UID}`);

// financingTerms — adapter reads effectiveDate + financingStatus from here.
await db.doc(`tenants/${TENANT_ID}/financingTerms/${OWING_UID}`)
  .set(buildFinancingTerms(OWING_UID, 'on_financing'), { merge: true });
console.log(`  [fs] financingTerms/${OWING_UID}  (on_financing)`);

await db.doc(`tenants/${TENANT_ID}/financingTerms/${CLEARED_UID}`)
  .set(buildFinancingTerms(CLEARED_UID, 'not_on_financing'), { merge: true });
console.log(`  [fs] financingTerms/${CLEARED_UID}  (not_on_financing)`);

// Policies — deterministic IDs for idempotent re-runs.
// Adapter reads: dateSubmitted (Timestamp), newBusinessType, proposedAPI (Q1 basis), isSelfOrFamily, status.
await db.doc(`tenants/${TENANT_ID}/policies/${OWING_UID}_policy_1`)
  .set(buildPolicy(OWING_UID), { merge: true });
console.log(`  [fs] policies/${OWING_UID}_policy_1  (proposedAPI=${PROPOSED_API})`);

await db.doc(`tenants/${TENANT_ID}/policies/${CLEARED_UID}_policy_1`)
  .set(buildPolicy(CLEARED_UID), { merge: true });
console.log(`  [fs] policies/${CLEARED_UID}_policy_1  (proposedAPI=${PROPOSED_API})`);

console.log(`\n[seed-financing-fixture] DONE — 6 docs written to ${TENANT_ID}.`);
console.log('Expected waterfall (grossBonus=$15,000):');
console.log('  smoke_k4_owing:   gross=$15,000 → tax=$3,750 → net=$11,250 → fin=$5,625 → th=$5,625  (37.5% OF GROSS)');
console.log('  smoke_k4_cleared: gross=$15,000 → tax=$3,750 → net=$11,250 → fin=$0     → th=$11,250 (75% OF GROSS)');
console.log('\nRun --cleanup when smoke is complete.');
