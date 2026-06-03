/**
 * seed-demo-surfaces.cjs — Seed the NET-NEW demo surfaces (personal goals,
 * policies, manager WAR) that seed-leaderboard-test-data.cjs (PR #410) does NOT
 * cover, plus a UNIFIED teardown that sweeps ALL `seededTestData` docs across
 * submissions + goals + policies + managerWeeklyReports.
 *
 * **PROD WRITE — TEST TENANT ONLY.** Same two-gate lifecycle as the leaderboard
 * seed:
 *   1. Dry-run (default; `--dry-run`) — logs every doc it WOULD write/delete.
 *      Zero writes.
 *   2. Live (`--execute --i-confirm-prod-write`) — requires explicit dispatcher
 *      authorization AFTER pre-reviewing the dry-run output. NEVER automatic.
 *
 * SAFETY (shared single surface — see ./lib/test-account-allowlist.cjs):
 *   - Tenant hardcoded to `tatillife_south` (CANNOT be overridden at runtime).
 *   - Pre-write hard-stop: lists tenant users, fails fast if ANY email is not
 *     on the shared TEST allowlist (the standing "no real users in
 *     tatillife_south" lock).
 *   - Marker: every seeded doc carries `seededTestData: true`.
 *   - --dry-run is DEFAULT acknowledge; --execute REQUIRES --i-confirm-prod-write.
 *   - CREATE-ONLY safety invariant: the seed NEVER merges seeded fields into a
 *     pre-existing real doc and marks it seeded. For each target doc it checks
 *     existence first; if a doc already exists WITHOUT `seededTestData: true`
 *     it is SKIPPED (treated as real). Teardown therefore only ever deletes
 *     docs the seed itself created.
 *
 * ROSTER (who is seeded): the REAL existing test agents, resolved at runtime
 *   from the tenant's user docs by role — NOT the absent @agencytrack.test
 *   roster (test-roster.mjs was never imported into production; dispatcher
 *   directive 2026-06-03). Goals + policies → role==='agent'; manager WAR →
 *   the branch_manager (the UM already has real WARs; left untouched).
 *
 * USAGE
 *   # seed dry-run (default; safe; logs only)
 *   node functions/scripts/seed-demo-surfaces.cjs --dry-run
 *   # seed live (REQUIRES dispatcher authorization first)
 *   node functions/scripts/seed-demo-surfaces.cjs --execute --i-confirm-prod-write
 *   # teardown dry-run (lists every seededTestData doc that WOULD be deleted)
 *   node functions/scripts/seed-demo-surfaces.cjs --teardown --dry-run
 *   # teardown live
 *   node functions/scripts/seed-demo-surfaces.cjs --teardown --execute --i-confirm-prod-write
 *
 * Rule references: Rule 12 (hard stop), Rule 17 (single source of truth),
 * Rule 19 (no self-merge/deploy).
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

const {
  isAllowlistedTestUser,
  assertNoNonTestUsers,
} = require('./lib/test-account-allowlist.cjs');

// ── Constants — hardcoded for safety (no env-var redirection) ────────────────

const TENANT_ID = 'tatillife_south'; // CANNOT BE OVERRIDDEN AT RUNTIME

// Collections swept by the unified teardown (all keyed on seededTestData==true).
// submissions is included so this is the ONE teardown for the whole seed
// ecosystem (the leaderboard seed writes seededTestData submissions but ships
// no teardown of its own).
const SEEDED_COLLECTIONS = ['submissions', 'goals', 'policies', 'managerWeeklyReports'];

// ── CLI args ──────────────────────────────────────────────────────────────────

const args            = process.argv.slice(2);
const isTeardown      = args.includes('--teardown');
const isDryRun        = args.includes('--dry-run');
const isExecute       = args.includes('--execute');
const hasProdConfirm  = args.includes('--i-confirm-prod-write');

if (!isDryRun && !isExecute) {
  console.error('ERROR: must pass --dry-run or --execute.');
  console.error('       Default behavior is dry-run; pass --dry-run explicitly to acknowledge.');
  process.exit(1);
}
if (isDryRun && isExecute) {
  console.error('ERROR: --dry-run and --execute are mutually exclusive.');
  process.exit(1);
}
if (isExecute && !hasProdConfirm) {
  console.error('ERROR: --execute requires --i-confirm-prod-write (defense-in-depth typo guard).');
  process.exit(1);
}

const MODE   = isDryRun ? 'DRY-RUN' : 'EXECUTE';
const ACTION = isTeardown ? 'TEARDOWN' : 'SEED';

// ── Admin SDK init (same pattern as seed-leaderboard-test-data) ──────────────

const keyPath = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error('ERROR: missing service-account-key.json at', keyPath);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();
const { serverTimestamp } = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ── Date helpers (TT-aware: UTC-4, no DST) ──────────────────────────────────

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;
function pad2(n) { return String(n).padStart(2, '0'); }
function ttSundayString(date) {
  const tt = new Date(date.getTime() - TRINI_OFFSET_MS);
  tt.setUTCDate(tt.getUTCDate() - tt.getUTCDay());
  return `${tt.getUTCFullYear()}-${pad2(tt.getUTCMonth() + 1)}-${pad2(tt.getUTCDate())}`;
}
function currentWeekStarting(refDate = new Date()) { return ttSundayString(refDate); }
function priorWeekStarting(refDate = new Date()) {
  return ttSundayString(new Date(refDate.getTime() - 7 * 24 * 3600 * 1000));
}
function tsFromDateOnly(yyyyMmDd) {
  return Timestamp.fromDate(new Date(`${yyyyMmDd}T12:00:00Z`));
}

// ── Doc builders ─────────────────────────────────────────────────────────────

function buildGoalDoc(agent) {
  // Personal annual goal. Values are above the tatillife_south company floor
  // (200k API / 42 apps); a small per-agent spread keeps gap analysis varied.
  const spread = [240000, 260000, 280000, 300000, 320000, 340000];
  const personalAnnualAPI = spread[agent._idx % spread.length];
  return {
    agentId:                   agent.uid,
    tenantId:                  TENANT_ID,
    personalAnnualAPI,
    personalAnnualApps:        50,
    personalAnnualPersistency: 85,
    setBy:                     agent.uid,        // personal goals are agent-set
    setByName:                 agent.name ?? '',
    seededTestData:            true,
    updatedAt:                 serverTimestamp(),
  };
}

// 4 policies per agent: 1 submitted, 2 settled, 1 lapsed (was settled).
function buildPolicyDocs(agent) {
  const base = {
    tenantId:          TENANT_ID,
    agentId:           agent.uid,
    agentNumber:       agent.agentNumber ?? null,
    unitId:            agent.unitId ?? null,
    branchId:          agent.branchId ?? null,
    productLine:       'life',
    newBusinessType:   'nb_ordinary',
    policyClass:       'whole_life',
    planId:            null,
    planName:          null,
    proposedFrequency: 'M',
    proposedCoverage:  500000,
    proposedPremium:   1500,
    notes:             null,
    isSelfOrFamily:    false,
    replacedPolicyAPI: null,
    sourceOfProspect:  'referral',
    socialPlatform:    null,
    policyDeliveryDate: null,
    createdBy:         agent.uid,
    seededTestData:    true,
  };
  const mk = (idx, fields) => ({
    id: `seedpolicy_${agent.uid}_${idx}`,
    data: {
      ...base,
      ownerName:     `${agent.name ?? 'Test'} Client ${idx}`,
      insuredName:   `${agent.name ?? 'Test'} Client ${idx}`,
      policyNumber:  `SEED-${agent.uid.slice(0, 6)}-${idx}`,
      dateWritten:   tsFromDateOnly('2026-05-04'),
      dateSubmitted: tsFromDateOnly('2026-05-06'),
      cashWithApp:   { collected: true, amount: 500 },
      statusDate:    serverTimestamp(),
      createdAt:     serverTimestamp(),
      ...fields,
    },
  });

  return [
    mk(1, {
      status:      'submitted',
      proposedAPI: 12000,
      dateIssued:  null,
    }),
    mk(2, {
      status:           'settled',
      proposedAPI:      18000,
      statusUpdatedAt:  serverTimestamp(),
      dateIssued:       tsFromDateOnly('2026-05-20'),
      settledAPI:       18000,
      issuedCoverage:   500000,
      initialPremium:   1500,
      earnedCommission: 6300,
    }),
    mk(3, {
      status:           'settled',
      proposedAPI:      9000,
      statusUpdatedAt:  serverTimestamp(),
      dateIssued:       tsFromDateOnly('2026-05-18'),
      settledAPI:       9000,
      issuedCoverage:   250000,
      initialPremium:   750,
      earnedCommission: 3150,
    }),
    mk(4, {
      // lapsed = a previously-settled policy that lapsed (carries the settled
      // fields + dateLapsed) so the ledger + persistency derivation see it.
      status:           'lapsed',
      proposedAPI:      6000,
      statusUpdatedAt:  serverTimestamp(),
      dateIssued:       tsFromDateOnly('2026-05-10'),
      settledAPI:       6000,
      issuedCoverage:   150000,
      initialPremium:   500,
      earnedCommission: 2100,
      dateLapsed:       tsFromDateOnly('2026-05-28'),
      lapseReason:      'Non-payment',
    }),
  ];
}

function buildWarDoc(bm, weekStart) {
  return {
    id: `${bm.uid}_${weekStart}`,
    data: {
      managerId:            bm.uid,
      managerName:          bm.name ?? '',
      tenantId:             TENANT_ID,
      weekStart,
      managerRole:          'branch_manager',
      managerRoleRank:      2,
      branchId:             bm.branchId ?? null,
      unitId:               bm.unitId ?? null,
      oneOnOnesConducted:   5,
      namesSourced:         12,
      interviewsConducted:  3,
      recruitsInFirstWeeks: 1,
      trainingSessions:     2,
      trainingTopic:        'Objection Handling',
      unitMeetingHeld:      true,
      attendanceCount:      8,
      dashboardReviewDone:  true,
      jfwCount:             0,
      status:               'submitted',
      seededTestData:       true,
      createdAt:            serverTimestamp(),
      updatedAt:            serverTimestamp(),
      submittedAt:          serverTimestamp(),
    },
  };
}

// Create-only safety: classify a target doc as create | overwrite-own-seed | skip-real.
async function classifyTarget(collection, docId) {
  const ref  = db.doc(`tenants/${TENANT_ID}/${collection}/${docId}`);
  const snap = await ref.get();
  if (!snap.exists) return { ref, action: 'create' };
  if (snap.data().seededTestData === true) return { ref, action: 'overwrite' };
  return { ref, action: 'skip' }; // pre-existing REAL doc — never touch
}

// ── SEED ─────────────────────────────────────────────────────────────────────

async function runSeed() {
  console.log('\nStep 1: pre-write hard-stop — re-confirm only test accounts in tenant');
  const { users } = await assertNoNonTestUsers(db, TENANT_ID);
  console.log(`  ✓ ${users.length} users — all test accounts; no real-user risk`);

  const agents = users.filter((u) => u.role === 'agent').sort((a, b) => a.id.localeCompare(b.id));
  agents.forEach((a, i) => { a._idx = i; });
  const bm = users.find((u) => u.role === 'branch_manager');
  console.log(`\nStep 2: resolved ${agents.length} agent(s)` + (bm ? ` + BM "${bm.name}" (${bm.id})` : ' + NO branch_manager found'));

  // Build the write plan with create-only classification.
  const planned = []; // { kind, ref, data, summary }
  const skipped = []; // { kind, summary }

  // Goals — create-only (skip any agent that already has a goal doc).
  for (const a of agents) {
    const { ref, action } = await classifyTarget('goals', a.uid);
    const data = buildGoalDoc(a);
    const sum  = `goals/${a.uid} (${a.name}) personalAnnualAPI=${data.personalAnnualAPI} apps=${data.personalAnnualApps} pers=${data.personalAnnualPersistency}`;
    if (action === 'skip') { skipped.push({ kind: 'goal', summary: `${sum} — SKIP (pre-existing real goal doc)` }); continue; }
    planned.push({ kind: 'goal', ref, data, summary: `${sum} [${action}]` });
  }

  // Policies — deterministic seed IDs (collision with real auto-IDs impossible).
  for (const a of agents) {
    for (const p of buildPolicyDocs(a)) {
      const { ref, action } = await classifyTarget('policies', p.id);
      const sum = `policies/${p.id} (${a.name}) status=${p.data.status} api=${p.data.proposedAPI}`;
      if (action === 'skip') { skipped.push({ kind: 'policy', summary: `${sum} — SKIP (pre-existing real doc)` }); continue; }
      planned.push({ kind: 'policy', ref, data: p.data, summary: `${sum} [${action}]` });
    }
  }

  // Manager WAR — BM only, prior + current week (UM's real WARs untouched).
  if (bm) {
    for (const wk of [priorWeekStarting(), currentWeekStarting()]) {
      const w = buildWarDoc(bm, wk);
      const { ref, action } = await classifyTarget('managerWeeklyReports', w.id);
      const sum = `managerWeeklyReports/${w.id} (BM ${bm.name}) week=${wk}`;
      if (action === 'skip') { skipped.push({ kind: 'war', summary: `${sum} — SKIP (pre-existing real doc)` }); continue; }
      planned.push({ kind: 'war', ref, data: w.data, summary: `${sum} [${action}]` });
    }
  }

  // Report the plan.
  const byKind = (k) => planned.filter((p) => p.kind === k).length;
  console.log(`\nStep 3: write plan — ${planned.length} doc(s) to write, ${skipped.length} skipped`);
  console.log(`  goals=${byKind('goal')}  policies=${byKind('policy')}  managerWAR=${byKind('war')}`);
  console.log('\n  --- planned writes ---');
  for (const p of planned) console.log(`  WRITE ${p.summary}`);
  if (skipped.length) {
    console.log('\n  --- skipped (create-only safety) ---');
    for (const s of skipped) console.log(`  SKIP  ${s.summary}`);
  }

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Would write ${planned.length} docs. No writes performed.`);
    console.log('  Re-run with --execute --i-confirm-prod-write to proceed.');
    process.exit(0);
  }

  // EXECUTE — batched writes (well under the 500-op batch limit).
  console.log('\n[EXECUTE] Writing...');
  const batch = db.batch();
  for (const p of planned) batch.set(p.ref, p.data);
  await batch.commit();
  console.log(`  ✓ Wrote ${planned.length} docs in 1 batch (goals + policies + manager WAR).`);
  console.log('\n✓ Seed complete. (Submissions/leaderboard are seeded separately by seed-leaderboard-test-data.cjs.)');
  process.exit(0);
}

// ── TEARDOWN (unified — all seededTestData docs across the ecosystem) ─────────

async function runTeardown() {
  console.log('\nStep 1: pre-write hard-stop — re-confirm only test accounts in tenant');
  const { users } = await assertNoNonTestUsers(db, TENANT_ID);
  console.log(`  ✓ ${users.length} users — all test accounts; no real-user risk`);

  console.log('\nStep 2: enumerate seededTestData docs across all seeded collections');
  const toDelete = []; // refs
  for (const coll of SEEDED_COLLECTIONS) {
    const snap = await db.collection(`tenants/${TENANT_ID}/${coll}`)
      .where('seededTestData', '==', true).get();
    snap.forEach((d) => toDelete.push(d.ref));
    console.log(`  ${coll}: ${snap.size} seededTestData doc(s)`);
  }
  console.log(`\n  Total to delete: ${toDelete.length}`);
  for (const ref of toDelete) console.log(`  DEL ${ref.path}`);

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Would delete ${toDelete.length} seededTestData docs. No deletes performed.`);
    console.log('  Re-run with --teardown --execute --i-confirm-prod-write to proceed.');
    process.exit(0);
  }

  if (toDelete.length === 0) {
    console.log('\nNothing to delete — exiting cleanly.');
    process.exit(0);
  }

  console.log('\n[EXECUTE] Deleting (only docs carrying seededTestData: true)...');
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of toDelete.slice(i, i + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
  }
  console.log(`  ✓ Deleted ${deleted} seededTestData docs. Real data untouched.`);
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n=== seed-demo-surfaces [${ACTION}] [${MODE}] ===`);
  console.log(`  Tenant: ${TENANT_ID}`);
  if (isTeardown) await runTeardown();
  else await runSeed();
})().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
