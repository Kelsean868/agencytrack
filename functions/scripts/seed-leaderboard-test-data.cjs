/**
 * seed-leaderboard-test-data.cjs — Provision SM test account + seed 2 weeks of
 * deliberately-different submissions across both branches so the live leaderboard
 * surfaces light up with real movement / podium / champions / around-me data.
 *
 * **PROD WRITE — TEST TENANT ONLY.** Two-gate lifecycle:
 *   1. Dry-run (default; `--dry-run`) — logs every account spec + submission
 *      doc it WOULD write. Zero writes.
 *   2. Live (`--execute`) — requires explicit dispatcher authorization
 *      AFTER pre-reviewing the dry-run output. NEVER runs automatically.
 *
 * Mirrors seed-first-tenant-admin.cjs's transactional saga pattern for the
 * SM account (Auth user → setCustomUserClaims → Firestore user doc, with
 * compensating delete on failure). Submission seeding uses deterministic
 * doc IDs (`{agentId}_{weekStarting}`) so re-runs OVERWRITE rather than
 * duplicate; every seeded doc carries `seededTestData: true` for cleanup.
 *
 * SAFETY GATES (Phase 1 + at runtime):
 *   - Tenant is hardcoded to `tatillife_south` (the test tenant; pilot is
 *     postponed; all users are *@agencytrack.test or @tatillife.com or
 *     kelsean@gmail.com — verified at runtime).
 *   - Pre-write: lists tenant users, fails fast if ANY email doesn't match
 *     a known test-account allowlist (extends the project's standing
 *     "no real users in tatillife_south" lock).
 *   - --dry-run is DEFAULT. --execute is the ONLY way to write.
 *   - --execute REQUIRES --i-confirm-prod-write (defense-in-depth typo guard).
 *
 * CLEANUP (documented in docs/runbooks/seed-leaderboard-test-data.md):
 *   - Submission docs: delete by `seededTestData == true` query OR by
 *     deterministic ID lookup. Listed in the runbook.
 *   - SM account: delete from Auth + Firestore (only if seeded by this
 *     script — checked via `seededTestData: true` marker on the user doc).
 *
 * Usage:
 *   # dry-run (default; safe; logs only)
 *   node functions/scripts/seed-leaderboard-test-data.cjs --dry-run
 *
 *   # live (REQUIRES dispatcher authorization first)
 *   node functions/scripts/seed-leaderboard-test-data.cjs --execute --i-confirm-prod-write
 *
 * Rule references: Rule 10, 11, 12, 15, 17, 19. Standing account-creation
 * acceptance criterion (single transactional path).
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

// Single shared safety surface — the allowlist + pre-write hard-stop now live
// in ./lib/test-account-allowlist.cjs (extracted in the demo-surfaces seed PR
// so both seed scripts share ONE allowlist definition).
const { isAllowlistedTestUser } = require('./lib/test-account-allowlist.cjs');

// ── Constants — hardcoded for safety (no env-var redirection) ────────────────

const TENANT_ID = 'tatillife_south'; // CANNOT BE OVERRIDDEN AT RUNTIME

// Two branches. tatil_south is the original branch (with the existing test
// agent kelsean + a handful of real test users); ljbBHP1g7lbZXvHlpcDn is
// Cyril Murray (with the PR-F roster's 7 *@agencytrack.test agents).
const BRANCH_PRIMARY   = 'tatil_south';
const BRANCH_SECONDARY = 'ljbBHP1g7lbZXvHlpcDn';

// NOTE: the allowlist (TEST_EMAIL_ALLOWLIST + TEST_ACCOUNT_UID_EMAIL_PAIRS) and
// isAllowlistedTestUser now live in ./lib/test-account-allowlist.cjs (required
// above) so this script and seed-demo-surfaces.cjs share ONE safety surface.

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const hasProdConfirm = args.includes('--i-confirm-prod-write');

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

const MODE = isDryRun ? 'DRY-RUN' : 'EXECUTE';

// ── Admin SDK init (same pattern as seed-first-tenant-admin) ────────────────

const keyPath = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error('ERROR: missing service-account-key.json at', keyPath);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db   = admin.firestore();
const auth = admin.auth();

// ── Test roster + the SM seed spec ──────────────────────────────────────────

// The PR-F roster lives in scripts/seed/test-roster.mjs (ESM). We can't
// `require` it from a .cjs script, so we mirror the relevant emails here
// for the agent-lookup step. The actual roster is the source of truth;
// this script only USES the emails (it doesn't create the roster — that's
// scripts/verification/shakedown/seed-phase.mjs's job, separately gated).
const PR_F_AGENT_EMAILS = [
  'agent-001@agencytrack.test',
  'agent-002@agencytrack.test',
  'agent-003@agencytrack.test',
  'agent-004@agencytrack.test', // UM_001 unit
  'agent-005@agencytrack.test',
  'agent-006@agencytrack.test',
  'agent-007@agencytrack.test', // UM_002 unit
];

// SM seed spec — used only if no existing SM is found in the tenant.
const SM_SEED_SPEC = {
  // We DON'T hard-code email/password here — instead we read from
  // process.env.A11Y_SALES_MANAGER_EMAIL (the credential already in
  // .env.local). If absent, the SM provision is skipped and the script
  // reports it (the seeding of submissions is independent).
  emailFromEnv:    'A11Y_SALES_MANAGER_EMAIL',
  passwordFromEnv: 'A11Y_SALES_MANAGER_PASSWORD',
  name:            'Test Sales Manager',
  role:            'sales_manager',
  branchId:        BRANCH_PRIMARY,
  ownedBranchIds:  ['*'],
};

// ── Data design — two weeks with DELIBERATELY-DIFFERENT rankings ────────────
//
// Movement is calculated as previousRank - rank. The two weeks below produce
// real ▲/▼ in BOTH branches + a ranked-$0 agent in each branch.
//
// weekStarting = the Sunday of each week (TT). Computed at runtime from
// "today" so the seed always lands in the prior + current WAR weeks.
//
// Ranking patterns (by branch):
//   tatil_south (6 agents from the live ranking — Kegan/Kelsean/Letitia/...)
//     PRIOR week: Kegan→1st, Kelsean→2nd, Letitia→3rd, PR-D→4th, PR4b→5th, TestAgent→0 (rank-$0)
//     CURRENT week: Letitia→1st, PR-D→2nd, Kegan→3rd, Kelsean→4th, PR4b→5th (same), TestAgent→0
//     Movement: Letitia ▲2, PR-D ▲2, Kegan ▼2, Kelsean ▼2, PR4b –, TestAgent –
//
//   ljbBHP1g7lbZXvHlpcDn (Cyril Murray, agents 001-007 from PR-F roster)
//     PRIOR week: a1→1st, a2→2nd, a3→3rd, a4→4th, a5→5th, a6→6th, a7→0
//     CURRENT week: a4→1st, a3→2nd, a5→3rd, a1→4th, a6→5th, a2→6th, a7→0
//     Movement: a4 ▲3, a3 ▲1, a5 ▲2, a1 ▼3, a6 ▲1, a2 ▼4, a7 –
//
// PR-F emails are looked up by email → UID at runtime; live tatil_south
// agents are looked up by querying the tenant's user docs (no hard-coded UIDs).

const TATIL_SOUTH_RANKINGS = [
  // Matchers are deterministic: prefer byUid for accounts whose names
  // collide via substring (e.g. "Test Agent" is a substring of "PR4b Test
  // Agent"). byNameContains is fine for unique tokens.
  { match: { byNameContains: 'Kegan' },   prior: 8000, current: 3500, apps: { prior: 4, current: 2 }, ffi: { prior: 5, current: 3 }, ci: { prior: 4, current: 2 } },
  { match: { byNameContains: 'Kelsean' }, prior: 6000, current: 2500, apps: { prior: 3, current: 2 }, ffi: { prior: 4, current: 2 }, ci: { prior: 3, current: 2 } },
  { match: { byNameContains: 'Letitia' }, prior: 3000, current: 9000, apps: { prior: 2, current: 5 }, ffi: { prior: 3, current: 6 }, ci: { prior: 2, current: 5 } },
  { match: { byNameContains: 'PR-D' },    prior: 1500, current: 6000, apps: { prior: 1, current: 4 }, ffi: { prior: 2, current: 5 }, ci: { prior: 1, current: 4 } },
  { match: { byNameContains: 'PR4b' },    prior:  800, current:  800, apps: { prior: 1, current: 1 }, ffi: { prior: 1, current: 1 }, ci: { prior: 1, current: 1 } },
  // Ranked-$0 agent — bare "Test Agent" collides with "PR4b Test Agent"
  // under byNameContains. Pin to its UID instead (the agent's UID from
  // P5-prep prod smoke output: rank=6 agent=C94hjdd6GXfdim9EfgPYAAIbDOJ2
  // name="Test Agent" unitId=null).
  { match: { byUid: 'C94hjdd6GXfdim9EfgPYAAIbDOJ2' }, prior: 0, current: 0, apps: { prior: 0, current: 0 }, ffi: { prior: 0, current: 0 }, ci: { prior: 0, current: 0 } },
];

const CYRIL_RANKINGS = [
  // 7 agents, real movement
  { email: 'agent-001@agencytrack.test', prior: 7000, current: 2000, apps: { prior: 4, current: 1 }, ffi: { prior: 5, current: 2 }, ci: { prior: 4, current: 1 } },
  { email: 'agent-002@agencytrack.test', prior: 5500, current:  600, apps: { prior: 3, current: 1 }, ffi: { prior: 4, current: 1 }, ci: { prior: 3, current: 1 } },
  { email: 'agent-003@agencytrack.test', prior: 4000, current: 7500, apps: { prior: 2, current: 4 }, ffi: { prior: 3, current: 5 }, ci: { prior: 2, current: 4 } },
  { email: 'agent-004@agencytrack.test', prior: 2500, current: 9500, apps: { prior: 2, current: 5 }, ffi: { prior: 2, current: 6 }, ci: { prior: 2, current: 5 } },
  { email: 'agent-005@agencytrack.test', prior: 1500, current: 5000, apps: { prior: 1, current: 3 }, ffi: { prior: 1, current: 4 }, ci: { prior: 1, current: 3 } },
  { email: 'agent-006@agencytrack.test', prior:  500, current: 1000, apps: { prior: 1, current: 1 }, ffi: { prior: 1, current: 1 }, ci: { prior: 1, current: 1 } },
  { email: 'agent-007@agencytrack.test', prior:    0, current:    0, apps: { prior: 0, current: 0 }, ffi: { prior: 0, current: 0 }, ci: { prior: 0, current: 0 } },
];

// ── Date helpers (TT-aware: UTC-4, no DST) ──────────────────────────────────

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function pad2(n) { return String(n).padStart(2, '0'); }

function ttSundayString(date) {
  // Snap to the Sunday of `date`'s TT week (TT-local), return YYYY-MM-DD.
  const tt = new Date(date.getTime() - TRINI_OFFSET_MS);
  tt.setUTCDate(tt.getUTCDate() - tt.getUTCDay());
  return `${tt.getUTCFullYear()}-${pad2(tt.getUTCMonth() + 1)}-${pad2(tt.getUTCDate())}`;
}

function currentWeekStarting(refDate = new Date()) { return ttSundayString(refDate); }
function priorWeekStarting(refDate = new Date()) {
  const d = new Date(refDate.getTime() - 7 * 24 * 3600 * 1000);
  return ttSundayString(d);
}

// ── Submission doc builder ──────────────────────────────────────────────────

function buildSubmissionDoc({ agentId, weekStarting, api, apps, ffi, ci }) {
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    // The aggregate ranking reads extractTotalProductionCredit which prefers
    // the precomputed totalProductionCredit; supplying both lets the CF take
    // the fast path while also keeping the sub-objects parseable.
    totalProductionCredit: api,
    newBusiness:  { api, apps },
    pppIncreases: { apiIncrease: 0, apps: 0 },
    lumpsums:     { apiCredit: 0, commission: 0 },
    // Activity fields (flat-schema reads in the CF's extractActivity).
    ffiConducted:      ffi,
    ciConducted:       ci,
    applicationsSold:  apps,
    seededTestData:    true,
    createdAt:         admin.firestore.FieldValue.serverTimestamp(),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n=== seed-leaderboard-test-data [${MODE}] ===`);
  console.log(`  Tenant:   ${TENANT_ID}`);
  console.log(`  Branches: ${BRANCH_PRIMARY} + ${BRANCH_SECONDARY}`);
  console.log('');

  // ── Step 1: Re-confirm no real (non-test) users in tatillife_south ────────
  console.log('Step 1: re-confirm `tatillife_south` has no non-test users');
  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const users     = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nonTest   = users.filter((u) => u.email && !isAllowlistedTestUser(u));
  if (nonTest.length > 0) {
    console.error(`✗ HARD STOP — found ${nonTest.length} non-test email(s) in ${TENANT_ID}:`);
    for (const u of nonTest) console.error(`    - uid=${u.id} role=${u.role} email=${u.email}`);
    console.error('  Cannot proceed. The tenant must have only test accounts.');
    process.exit(1);
  }
  const usersByEmail = new Map();
  for (const u of users) {
    if (u.email) usersByEmail.set(u.email.toLowerCase().trim(), u);
  }
  console.log(`  ✓ ${users.length} users — all test accounts; no real-user risk`);

  // ── Step 2: Locate the test agents per the data design ───────────────────
  console.log('\nStep 2: resolve test agents per the data design');

  // PR-F roster (Cyril branch) — lookup by email
  const cyrilAgents = [];
  for (const r of CYRIL_RANKINGS) {
    const u = usersByEmail.get(r.email.toLowerCase());
    if (!u) {
      console.log(`  ⚠ PR-F agent ${r.email} NOT FOUND in tenant — skipping (would seed if present)`);
      continue;
    }
    if (u.branchId !== BRANCH_SECONDARY) {
      console.log(`  ⚠ ${r.email} has branchId=${u.branchId} but expected ${BRANCH_SECONDARY} — skipping`);
      continue;
    }
    cyrilAgents.push({ ...r, uid: u.id, name: u.name, email: r.email });
  }
  console.log(`  ✓ Cyril branch (${BRANCH_SECONDARY}): ${cyrilAgents.length} / ${CYRIL_RANKINGS.length} agents resolved`);

  // tatil_south — lookup by byUid (preferred, exact) or byNameContains
  // (collision-prone — use only for unique tokens; the ranked-$0 row uses
  // byUid because "Test Agent" is a substring of "PR4b Test Agent").
  const tatilUsers = users.filter((u) => u.branchId === BRANCH_PRIMARY && u.role === 'agent' && u.provisioning !== true);
  const tatilAgents = [];
  const usedUids = new Set();
  for (const r of TATIL_SOUTH_RANKINGS) {
    let match;
    let matchLabel;
    if (r.match.byUid) {
      match = tatilUsers.find((u) => u.id === r.match.byUid);
      matchLabel = `uid=${r.match.byUid}`;
    } else if (r.match.byNameContains) {
      const needle = r.match.byNameContains.toLowerCase();
      match = tatilUsers.find((u) => !usedUids.has(u.id) && (u.name ?? '').toLowerCase().includes(needle));
      matchLabel = `name contains "${r.match.byNameContains}"`;
    }
    if (!match) {
      console.log(`  ⚠ tatil_south agent matching ${matchLabel} NOT FOUND — skipping`);
      continue;
    }
    if (usedUids.has(match.id)) {
      console.log(`  ⚠ tatil_south matcher ${matchLabel} resolved to already-claimed uid=${match.id} — skipping (matcher collision; fix the data design)`);
      continue;
    }
    usedUids.add(match.id);
    tatilAgents.push({ ...r, uid: match.id, name: match.name, email: match.email });
  }
  console.log(`  ✓ tatil_south (${BRANCH_PRIMARY}): ${tatilAgents.length} / ${TATIL_SOUTH_RANKINGS.length} agents resolved`);

  if (cyrilAgents.length + tatilAgents.length === 0) {
    console.error('\n✗ HARD STOP — no agents resolved; cannot seed.');
    process.exit(1);
  }

  // ── Step 3: SM account check (provision if absent) ───────────────────────
  console.log('\nStep 3: SM account check');
  const smEmail = process.env[SM_SEED_SPEC.emailFromEnv];
  let smSpec = null;
  if (!smEmail) {
    console.log(`  ⚠ ${SM_SEED_SPEC.emailFromEnv} not set in env — SM provision SKIPPED`);
  } else {
    const existingSM = usersByEmail.get(smEmail.toLowerCase());
    if (existingSM && existingSM.role === 'sales_manager') {
      console.log(`  ✓ SM already exists: uid=${existingSM.id} email=${smEmail} role=sales_manager — no provision needed`);
    } else if (existingSM) {
      console.log(`  ⚠ Account exists at ${smEmail} but role is "${existingSM.role}", not sales_manager. SKIPPING provision (manual review needed).`);
    } else {
      // Would provision via canonical transactional saga
      smSpec = {
        email:          smEmail,
        // Password sourced from env at runtime; never logged.
        passwordSource: SM_SEED_SPEC.passwordFromEnv,
        name:           SM_SEED_SPEC.name,
        role:           SM_SEED_SPEC.role,
        tenantId:       TENANT_ID,
        branchId:       SM_SEED_SPEC.branchId,
        ownedBranchIds: SM_SEED_SPEC.ownedBranchIds,
      };
      console.log(`  → WOULD provision SM: ${JSON.stringify({ ...smSpec, passwordSource: `(from env.${SM_SEED_SPEC.passwordFromEnv})` })}`);
      console.log(`    via canonical transactional saga: Auth.createUser → setCustomUserClaims → Firestore user doc (with compensating delete on failure)`);
    }
  }

  // ── Step 4: Compute the two weeks + build the submission write list ──────
  const PRIOR_WK    = priorWeekStarting();
  const CURRENT_WK  = currentWeekStarting();
  console.log(`\nStep 4: build submission write list`);
  console.log(`  Prior week:   ${PRIOR_WK}`);
  console.log(`  Current week: ${CURRENT_WK}`);

  const writes = []; // { docPath, data }
  function pushBoth(agent) {
    const priorPath   = `tenants/${TENANT_ID}/submissions/${agent.uid}_${PRIOR_WK}`;
    const currentPath = `tenants/${TENANT_ID}/submissions/${agent.uid}_${CURRENT_WK}`;
    writes.push({
      docPath: priorPath,
      data: buildSubmissionDoc({
        agentId:      agent.uid,
        weekStarting: PRIOR_WK,
        api:          agent.prior,
        apps:         agent.apps.prior,
        ffi:          agent.ffi.prior,
        ci:           agent.ci.prior,
      }),
      summary: `${agent.email ?? agent.name} (${agent.uid}) prior=${PRIOR_WK} api=${agent.prior} apps=${agent.apps.prior} ffi=${agent.ffi.prior} ci=${agent.ci.prior}`,
    });
    writes.push({
      docPath: currentPath,
      data: buildSubmissionDoc({
        agentId:      agent.uid,
        weekStarting: CURRENT_WK,
        api:          agent.current,
        apps:         agent.apps.current,
        ffi:          agent.ffi.current,
        ci:           agent.ci.current,
      }),
      summary: `${agent.email ?? agent.name} (${agent.uid}) current=${CURRENT_WK} api=${agent.current} apps=${agent.apps.current} ffi=${agent.ffi.current} ci=${agent.ci.current}`,
    });
  }
  for (const a of tatilAgents)  pushBoth(a);
  for (const a of cyrilAgents) pushBoth(a);

  console.log(`  Total submissions to seed: ${writes.length} (${writes.length / 2} agents × 2 weeks)`);

  // Movement preview by branch (sorted by current-week API descending)
  function previewBranchRanking(branchLabel, agents) {
    console.log(`\n  --- ${branchLabel} ranking preview ---`);
    const prior   = [...agents].sort((a, b) => b.prior - a.prior);
    const current = [...agents].sort((a, b) => b.current - a.current);
    const priorRankByUid   = new Map(prior.map((a, i) => [a.uid, i + 1]));
    const currentRankByUid = new Map(current.map((a, i) => [a.uid, i + 1]));
    console.log(`  ${'name'.padEnd(20)} ${'prior$'.padStart(8)} ${'curr$'.padStart(8)} ${'pr-rk'.padStart(6)} ${'cur-rk'.padStart(7)} ${'movement'}`);
    for (const a of current) {
      const pr  = priorRankByUid.get(a.uid);
      const cur = currentRankByUid.get(a.uid);
      const delta = pr - cur; // movement chip = previousRank − rank
      const symbol = a.current === 0 && a.prior === 0
        ? '–  (ranked-$0)'
        : delta > 0 ? `▲${delta}`
        : delta < 0 ? `▼${-delta}`
        : '–';
      console.log(`  ${(a.name ?? a.email).slice(0, 20).padEnd(20)} ${String(a.prior).padStart(8)} ${String(a.current).padStart(8)} ${String(pr).padStart(6)} ${String(cur).padStart(7)} ${symbol}`);
    }
  }
  previewBranchRanking(BRANCH_PRIMARY, tatilAgents);
  previewBranchRanking(BRANCH_SECONDARY, cyrilAgents);

  // ── Step 5: Dry-run vs Execute ───────────────────────────────────────────
  if (isDryRun) {
    console.log(`\n[DRY-RUN] Would write ${writes.length} submission docs and ${smSpec ? 1 : 0} new user account.`);
    console.log(`  No writes performed. Re-run with --execute --i-confirm-prod-write to proceed.`);
    console.log(`\nFull submission write list (${writes.length} docs):`);
    for (const w of writes) {
      console.log(`  ${w.docPath}`);
      console.log(`    ${w.summary}`);
    }
    process.exit(0);
  }

  // ── EXECUTE path (Phase 6 — separate dispatcher-authorized step) ──────────
  console.log('\n[EXECUTE] Proceeding with live writes...');

  // (A) Provision SM if needed
  if (smSpec) {
    const smPass = process.env[SM_SEED_SPEC.passwordFromEnv];
    if (!smPass) {
      console.error(`✗ Missing ${SM_SEED_SPEC.passwordFromEnv} in env — cannot create Auth user. Aborting.`);
      process.exit(1);
    }
    // Transactional saga — mirrors functions/index.js doCreateUser
    let createdUserRecord;
    try {
      createdUserRecord = await auth.createUser({
        email:       smSpec.email,
        password:    smPass,
        displayName: smSpec.name,
      });
      console.log(`  ✓ Auth.createUser: uid=${createdUserRecord.uid}`);
    } catch (e) {
      console.error(`  ✗ Auth.createUser failed: ${e.message}. Aborting before any Firestore writes.`);
      process.exit(1);
    }
    try {
      await auth.setCustomUserClaims(createdUserRecord.uid, {
        role:           smSpec.role,
        tenantId:       smSpec.tenantId,
        branchId:       smSpec.branchId,
        ownedBranchIds: smSpec.ownedBranchIds,
      });
      console.log(`  ✓ setCustomUserClaims OK`);

      await db.doc(`tenants/${smSpec.tenantId}/users/${createdUserRecord.uid}`).set({
        uid:            createdUserRecord.uid,
        email:          smSpec.email,
        name:           smSpec.name,
        role:           smSpec.role,
        tenantId:       smSpec.tenantId,
        branchId:       smSpec.branchId,
        ownedBranchIds: smSpec.ownedBranchIds,
        active:         true,
        seededTestData: true,
        createdAt:      admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Firestore user doc upserted`);
    } catch (sagaErr) {
      console.error(`  ✗ Saga step failed: ${sagaErr.message}. Running compensating delete...`);
      try { await auth.deleteUser(createdUserRecord.uid); console.error(`  ✓ Compensating delete done.`); }
      catch (delErr) { console.error(`  ✗✗ Compensating delete FAILED: ${delErr.message} — manual cleanup required.`); }
      process.exit(1);
    }
  }

  // (B) Write submissions via batch (Firestore batch limit is 500 — we're well under)
  const batch = db.batch();
  for (const w of writes) batch.set(db.doc(w.docPath), w.data);
  await batch.commit();
  console.log(`  ✓ Wrote ${writes.length} submission docs in 1 batch.`);

  console.log(`\n✓ Seed complete. Run \`recomputeLeaderboardOnDemand\` next to rebuild the aggregate.`);
  console.log(`  Verification + recompute live invocation lives in the runbook (Phase 6 dispatcher step).`);
  process.exit(0);
})().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
