/**
 * seed-financing-selfview-k9.mjs — subject-signed-in fixture for the K9
 * FinancingSelfView smoke (smoke-financing-selfview-k9.mjs).
 *
 * K9 is the FIRST subject-facing surface. Unlike the K4 synthetic-uid fixture,
 * this seeds financing docs onto the REAL A11Y subject accounts (the agent + the
 * unit-manager) so the smoke can sign in AS THE SUBJECT and exercise the
 * canAccessOwn read arms (agent + isProducingManager) for the first time.
 *
 * Per subject (agent + UM), seeds a production-VALID post_financing_repayment
 * state that carries every SHOWN surface in one screen:
 *   financingTerms/{uid}     status=post_financing_repayment (isOwing → take-home
 *                            split renders; ∈ RECONCILED_STATUSES → recon renders),
 *                            statusHistory carries a PRIVATE note + actor (must be
 *                            suppressed by the view).
 *   financing/{uid}_{M1}     current-month statement — runningBalance 9000,
 *                            managerFinancing 4200 (relabeled "Your draw"), plus
 *                            PRIVATE adjustmentPct / suggestedFinancing / notes /
 *                            audit that MUST NOT render.
 *   financing/{uid}_{M2}     prior-month statement — runningBalance -500 (surplus).
 *   financingReconciliation/{uid}_{YEAR}  closingBalance 7200 (distinct from the
 *                            9000 ledger balance so the recon assertion is unambiguous).
 *   policies/{uid}_k9smoke_1 one nb_ordinary submitted policy so getProjectedBonus
 *                            produces a non-trivial take-home (value NOT pinned in
 *                            the smoke — the real account may carry other in-quarter
 *                            policies; the pinned $5,625/$3,750 arithmetic is locked
 *                            by the FinancingSelfView unit test instead).
 *
 * NOTE on the brief's "on_financing" seed: on_financing has NO reconciliation
 * record per the K1 forward-only state machine (recon is written at
 * reconciling→terminal). To satisfy the brief's own "assert a reconciliation
 * figure" criterion with a PRODUCTION-VALID state, we seed post_financing_repayment
 * (terms + ledger + recon + owing take-home all coexist). Flagged in the smoke +
 * dispatch report.
 *
 * USAGE
 *   node scripts/verification/seed-financing-selfview-k9.mjs --dry-run
 *   node scripts/verification/seed-financing-selfview-k9.mjs --apply
 *   node scripts/verification/seed-financing-selfview-k9.mjs --cleanup
 *
 * SAFETY
 *   - Hard south-guard: ABORTS if TENANT_ID === 'tatillife_south'.
 *   - Writes ONLY financing docs + one deterministic policy per subject; NEVER
 *     touches the subjects' user/auth docs.
 *   - Cleanup deletes ONLY the deterministic docs it writes.
 *   - service-account-key.json used per CLAUDE.md Admin-SDK pattern.
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

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
  } catch { /* rely on process.env */ }
}
loadEnv();

const TENANT_ID = process.env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const ACTOR = 'seed-financing-selfview-k9';

if (TENANT_ID === 'tatillife_south') {
  console.error('[seed-k9] ABORT: target tenant is tatillife_south (live pilot). Set A11Y_TENANT_ID=tatillife_smoke.');
  process.exit(1);
}

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const UM_EMAIL = process.env.A11Y_UNIT_MANAGER_EMAIL;
if (!AGENT_EMAIL || !UM_EMAIL) {
  console.error('[seed-k9] ABORT: A11Y_AGENT_EMAIL and A11Y_UNIT_MANAGER_EMAIL must be set.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const isDryRun = argv.includes('--dry-run');
const isApply = argv.includes('--apply');
const isCleanup = argv.includes('--cleanup');
if ([isDryRun, isApply, isCleanup].filter(Boolean).length !== 1) {
  console.error('Usage: node seed-financing-selfview-k9.mjs --dry-run | --apply | --cleanup');
  process.exit(1);
}

// ── Month keys (computed from real UTC now — see boundary caveat in the smoke) ──
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const CUR_Y = now.getUTCFullYear();
const CUR_M = now.getUTCMonth(); // 0-based
const M1 = `${CUR_Y}_${pad(CUR_M + 1)}`;
const prev = new Date(Date.UTC(CUR_Y, CUR_M - 1, 1));
const M2 = `${prev.getUTCFullYear()}_${pad(prev.getUTCMonth() + 1)}`;
const EFFECTIVE_DATE = `${CUR_Y}-${pad(CUR_M + 1)}-01`;
const RECON_YEAR = String(CUR_Y);
const DATE_SUBMITTED_MS = Date.UTC(CUR_Y, CUR_M, 20, 4, 0, 0); // TT-midnight-ish, in Q1 range
const PROPOSED_API = 50_000;

if (isDryRun) {
  console.log(`\n[seed-k9] DRY-RUN  tenant=${TENANT_ID}`);
  console.log(`  subjects: agent<${AGENT_EMAIL}>  UM<${UM_EMAIL}>`);
  console.log(`  months: M1=${M1} (current)  M2=${M2} (prior, surplus)  effectiveDate=${EFFECTIVE_DATE}  reconYear=${RECON_YEAR}`);
  console.log('  status=post_financing_repayment (isOwing take-home + recon both render)');
  console.log('  SHOWN seeds:   currentMonthlyFinancing=4500  runningBalance(M1)=9000  managerFinancing=4200  recon.closingBalance=7200');
  console.log('  PRIVATE seeds: adjustmentPct=0.0667  suggestedFinancing=3333  notes=K9-PRIVATE-STMT  enteredByName=K9 Seed Mgr  hist.note=K9-HIST-NOTE');
  console.log('\n  Would write per subject: financingTerms/{uid}, financing/{uid}_M1, financing/{uid}_M2, financingReconciliation/{uid}_YEAR, policies/{uid}_k9smoke_1');
  console.log('\n[dry-run complete — no writes]');
  process.exit(0);
}

const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) {
  console.error('[seed-k9] ABORT: functions/service-account-key.json not found.');
  process.exit(1);
}
const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const auth = admin.auth();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

async function uidFor(email) {
  const u = await auth.getUserByEmail(email);
  return u.uid;
}

function subjectDocPaths(uid) {
  return [
    `tenants/${TENANT_ID}/financingTerms/${uid}`,
    `tenants/${TENANT_ID}/financing/${uid}_${M1}`,
    `tenants/${TENANT_ID}/financing/${uid}_${M2}`,
    `tenants/${TENANT_ID}/financingReconciliation/${uid}_${RECON_YEAR}`,
    `tenants/${TENANT_ID}/policies/${uid}_k9smoke_1`,
  ];
}

if (isCleanup) {
  console.log(`\n[seed-k9] CLEANUP  tenant=${TENANT_ID}`);
  for (const email of [AGENT_EMAIL, UM_EMAIL]) {
    const uid = await uidFor(email);
    for (const p of subjectDocPaths(uid)) {
      await db.doc(p).delete();
      console.log(`  [deleted] ${p}`);
    }
  }
  console.log('\n[cleanup complete]');
  process.exit(0);
}

// ── Apply ──────────────────────────────────────────────────────────────────────
console.log(`\n[seed-k9] APPLY  tenant=${TENANT_ID}`);

function termsDoc(uid) {
  return {
    agentId: uid,
    tenantId: TENANT_ID,
    financingStatus: 'post_financing_repayment',
    effectiveDate: EFFECTIVE_DATE,
    agreedMonthlyFinancing: 5000,
    currentMonthlyFinancing: 4500,
    validatingAPI: 30000,
    statusHistory: [
      { from: 'not_on_financing', to: 'on_financing', at: admin.firestore.Timestamp.now(), by: ACTOR, byName: 'K9 Seed Mgr', role: 'branch_manager', note: 'K9-HIST-NOTE' },
      { from: 'on_financing', to: 'reconciling', at: admin.firestore.Timestamp.now(), by: ACTOR, byName: 'K9 Seed Mgr', role: 'branch_manager', note: 'K9-HIST-NOTE' },
      { from: 'reconciling', to: 'post_financing_repayment', at: admin.firestore.Timestamp.now(), by: ACTOR, byName: 'K9 Seed Mgr', role: 'branch_manager', note: 'K9-HIST-NOTE' },
    ],
    createdBy: ACTOR,
    createdAt: ts(),
    updatedBy: ACTOR,
    updatedAt: ts(),
  };
}

function ledgerM1(uid) {
  return {
    agentId: uid,
    tenantId: TENANT_ID,
    month: M1,
    // SHOWN
    financingPaid: 4500,
    netCommission: 1200,
    bonusOffset: 600,
    validatingAPI: 30000,
    actualAPI: 25000,
    runningBalance: 9000,
    managerFinancing: 4200, // relabeled "Your draw"
    basisSource: 'settled-confirmed',
    // PRIVATE — must never render
    adjustmentPct: 0.0667,
    suggestedFinancing: 3333,
    notes: 'K9-PRIVATE-STMT',
    source: 'manager_entry',
    enteredBy: ACTOR,
    enteredByName: 'K9 Seed Mgr',
    enteredAt: ts(),
    updatedAt: ts(),
  };
}

function ledgerM2(uid) {
  return {
    agentId: uid,
    tenantId: TENANT_ID,
    month: M2,
    financingPaid: 0,
    netCommission: 800,
    bonusOffset: 0,
    runningBalance: -500, // surplus
    basisSource: 'settled-confirmed',
    source: 'manager_entry',
    enteredBy: ACTOR,
    enteredByName: 'K9 Seed Mgr',
    enteredAt: ts(),
    updatedAt: ts(),
  };
}

function reconDoc(uid) {
  return {
    agentId: uid,
    tenantId: TENANT_ID,
    year: CUR_Y,
    totalFinancingDrawn: 9000,
    totalOffsets: 1800,
    closingBalance: 7200, // distinct from the 9000 ledger balance
    waiverApplied: 1800,
    serviceMet: false,
    serviceMonths: 6,
    reconciledPosition: 7200,
    outcome: 'owing',
    surplusPaid: 0,
    garnishStarted: true,
    triggeredBy: 'auto_month12',
    reconciledBy: ACTOR,
    reconciledByName: 'K9 Seed Mgr',
    reconciledAt: ts(),
    createdAt: ts(),
    updatedAt: ts(),
    updatedBy: ACTOR,
  };
}

function policyDoc(uid) {
  return {
    tenantId: TENANT_ID,
    agentId: uid,
    unitId: null,
    branchId: null,
    status: 'submitted',
    statusDate: ts(),
    ownerName: 'K9 Smoke Owner',
    insuredName: 'K9 Smoke Insured',
    productLine: 'life',
    newBusinessType: 'nb_ordinary',
    policyClass: 'whole_life',
    proposedAPI: PROPOSED_API,
    proposedFrequency: 'A',
    dateWritten: admin.firestore.Timestamp.fromMillis(DATE_SUBMITTED_MS),
    dateSubmitted: admin.firestore.Timestamp.fromMillis(DATE_SUBMITTED_MS),
    isSelfOrFamily: false,
    sourceOfProspect: 'referral',
    cashWithApp: { collected: false, amount: null },
    dateIssued: null,
    isK9SmokeFixture: true,
    createdAt: ts(),
    createdBy: ACTOR,
  };
}

for (const email of [AGENT_EMAIL, UM_EMAIL]) {
  const uid = await uidFor(email);
  console.log(`  subject ${email} → uid ${uid}`);
  await db.doc(`tenants/${TENANT_ID}/financingTerms/${uid}`).set(termsDoc(uid), { merge: true });
  await db.doc(`tenants/${TENANT_ID}/financing/${uid}_${M1}`).set(ledgerM1(uid), { merge: true });
  await db.doc(`tenants/${TENANT_ID}/financing/${uid}_${M2}`).set(ledgerM2(uid), { merge: true });
  await db.doc(`tenants/${TENANT_ID}/financingReconciliation/${uid}_${RECON_YEAR}`).set(reconDoc(uid), { merge: true });
  await db.doc(`tenants/${TENANT_ID}/policies/${uid}_k9smoke_1`).set(policyDoc(uid), { merge: true });
  console.log(`    [fs] terms + ledger(${M1}, ${M2}) + recon(${RECON_YEAR}) + policy written`);
}

console.log(`\n[seed-k9] DONE. SHOWN: current=4500 balance(M1)=9000 yourDraw=4200 recon.closing=7200.`);
console.log('PRIVATE that must NOT render: 3333, adjustmentPct 6.67%, K9-PRIVATE-STMT, K9 Seed Mgr, K9-HIST-NOTE.');
console.log('Run --cleanup when the smoke is complete.');
