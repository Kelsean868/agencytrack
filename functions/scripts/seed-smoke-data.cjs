'use strict';

/**
 * seed-smoke-data.cjs — populate the `tatillife_smoke` tenant with realistic
 * Game Plan + production data so visual smokes have teeth.
 *
 * Companion to seed-smoke-tenant.cjs (PR #674): that script PROVISIONS the 6
 * isolated A11Y role accounts; THIS script SEEDS DATA for the smoke agent and a
 * varied manager-visible roster — all in `tatillife_smoke` ONLY.
 *
 * What it seeds (tenant = tatillife_smoke, branch = smoke_branch):
 *   Smoke agent (A11Y_AGENT_EMAIL — resolved by email lookup):
 *     - moneyNeeds/{year}      committed Step-1 figures (cascade rung 1)
 *     - yearPlan/{year}        committed, 4 product lines summing to YEAR_TOTAL
 *     - monthlyPlan/{year}     committed, even split, anchorAPI === YEAR_TOTAL
 *     - goals/{uid}            personalAnnualAPI + gamePlanCommitted
 *     - submissions            one per completed month (drives YTD actuals)
 *   This is what un-skips #677's per-month-figure assertion (S3-c / S3-d).
 *
 *   Varied roster (4 synthetic agent user docs — NO Auth accounts; managers
 *   view them, they never log in): each with different settled/submitted API,
 *   apps, persistency, % of goal, and contractStartDate — so leaderboard ranks
 *   and the future #4-sorting smokes have real spread to assert on.
 *     - users/{rosterUid}      role=agent, unitId=<smoke UM uid>, branch
 *     - goals/{rosterUid}      personalAnnualAPI (drives % of goal)
 *     - submissions            varied submitted API
 *     - settlements/{...}      varied settled API/apps/persistency
 *     - persistency/{...}      varied monthly persistency %
 *
 * SAFETY
 *   - Hard south-guard: ABORTS if the resolved target tenant is `tatillife_south`.
 *   - Idempotent: deterministic doc IDs; re-running overwrites the same docs.
 *   - Passwords are never read or logged (this script touches data only).
 *
 * USAGE
 *   node functions/scripts/seed-smoke-data.cjs --dry-run   # print intent, no writes
 *   node functions/scripts/seed-smoke-data.cjs --apply     # execute
 *
 * EMULATOR (Phase 3 validation)
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:9090 \
 *   node functions/scripts/seed-smoke-data.cjs --apply
 *
 * OPERATOR RUN — production (HUMAN action, AFTER seed-smoke-tenant --apply)
 *   1. Ensure functions/service-account-key.json is present.
 *   2. node functions/scripts/seed-smoke-data.cjs --apply
 *
 * PRECONDITION: seed-smoke-tenant must have run first — this script resolves the
 * smoke agent + unit-manager uids by Auth email lookup and aborts if absent.
 */

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

const { loadEnv } = require('../../scripts/lib/loadEnv.cjs');
const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
// process.env wins over .env.local so CI / the emulator-verify can override the
// target explicitly; the south-guard below protects a `tatillife_south` value
// arriving from EITHER source.
const TENANT_ID = process.env.A11Y_TENANT_ID ?? env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID = 'smoke_branch';
const UNIT_NAME = 'Smoke Unit';
const SEED_ACTOR = 'seed-smoke-data';

// Year defaults to the current calendar year (what the app's GamePlan reads via
// new Date().getFullYear()); override with A11Y_SMOKE_YEAR for deterministic CI.
const YEAR = Number(process.env.A11Y_SMOKE_YEAR ?? env.A11Y_SMOKE_YEAR) || new Date().getFullYear();
const CURRENT_MONTH_INDEX = new Date().getMonth(); // 0-based; completed = [0, CMI)

// Smoke agent annual plan: the canonical 3-line taxonomy (Direction 1.5, PR-U1)
// summing to YEAR_TOTAL — `general` subsumes the legacy property+motor lines
// (300_000, award-neutral, total-preserving). anchorAPI on the monthly plan is
// set === YEAR_TOTAL so the cascade's monthly rung (anchorAPI/12) equals
// (Σ line targetAPI) / 12 — the #677 ratio assertion.
const YEAR_TOTAL = 1_200_000;
const LINES = {
  life:    { targetAPI: 600_000, pct: 50 },
  ah:      { targetAPI: 300_000, pct: 25 },
  general: { targetAPI: 300_000, pct: 25 },
};
const AVG_POLICY_API = 12_000;

// ─────────────────────────────────────────────────────────────────────────────
// HARD SOUTH-GUARD — never seed the live pilot tenant.
// ─────────────────────────────────────────────────────────────────────────────
if (TENANT_ID === 'tatillife_south') {
  console.error('[seed-smoke-data] ABORT: resolved target tenant is `tatillife_south` (the LIVE pilot tenant).');
  console.error('  This script seeds DATA into the isolated smoke tenant ONLY. Set A11Y_TENANT_ID=tatillife_smoke.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const cliArgs  = process.argv.slice(2);
const isDryRun = cliArgs.includes('--dry-run');
const isApply  = cliArgs.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('Usage: node seed-smoke-data.cjs --dry-run | --apply');
  process.exit(1);
}
if (isDryRun && isApply) {
  console.error('--dry-run and --apply are mutually exclusive');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Varied roster — 4 synthetic agents (no Auth). Deterministic uids so re-runs
// overwrite the same docs. Descending settled API gives clear leaderboard spread.
//
// persistencyPct is the human-readable percentage; it is written to the
// persistency doc as a DECIMAL (÷100) via buildE3Persistency() — faithful to
// production, where persistency = netSettled/grossSettled is a decimal in [0,1+]
// (see src/lib/persistency/calculations.js). The roster's PersBandCell then
// ×100's it back (via assembleRosterRow) to render the 0–100 band.
//   noGoal: true  → no goals doc written → exercises the "—" (% of goal) path.
// ─────────────────────────────────────────────────────────────────────────────
const ROSTER = [
  { uid: 'smoke_roster_1', name: 'Smoke Roster One',   contractStartDate: '2020-01-01', goalAPI: 700_000, settledAPI: 800_000, settledApps: 66, submittedAPI: 95_000, persistencyPct: 95 },
  { uid: 'smoke_roster_2', name: 'Smoke Roster Two',   contractStartDate: '2022-03-15', goalAPI: 600_000, settledAPI: 450_000, settledApps: 38, submittedAPI: 60_000, persistencyPct: 88 },
  { uid: 'smoke_roster_3', name: 'Smoke Roster Three', contractStartDate: '2024-06-01', goalAPI: 500_000, settledAPI: 180_000, settledApps: 15, submittedAPI: 30_000, persistencyPct: 76 },
  { uid: 'smoke_roster_4', name: 'Smoke Roster Four',  contractStartDate: '2025-09-10', goalAPI: 400_000, settledAPI:  60_000, settledApps:  5, submittedAPI: 12_000, persistencyPct: 64, noGoal: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init — emulator-aware (mirrors seed-smoke-tenant.cjs)
// ─────────────────────────────────────────────────────────────────────────────
const isEmulator = !!(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

if (isEmulator) {
  console.log('[seed-smoke-data] Emulator mode — skipping key file');
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610' });
} else {
  const keyPath = path.join(__dirname, '..', 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error('[seed-smoke-data] Missing service-account-key.json at', keyPath);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
}

if (process.env.FIRESTORE_EMULATOR_HOST) console.log('[seed-smoke-data] Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) console.log('[seed-smoke-data] Auth emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST);

const db   = admin.firestore();
const auth = admin.auth();
const ts   = () => admin.firestore.FieldValue.serverTimestamp();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// 12 equal monthly targets summing to anchor exactly (mirrors lib/monthlyPlanMath
// seedEvenSplit — last month absorbs the rounding remainder).
function seedEvenSplit(anchorAPI) {
  const anchor = parseFloat(anchorAPI) || 0;
  const perMonth = Math.round((anchor / 12) * 100) / 100;
  const targets = Array(11).fill(perMonth);
  targets.push(parseFloat((anchor - perMonth * 11).toFixed(2)));
  return targets;
}

// Year-plan line scaffold matching saveYearPlan's sanitized shape.
function buildLine(targetAPI, pct) {
  const derivedApps = parseFloat((targetAPI / AVG_POLICY_API).toFixed(4));
  return {
    targetAPI,
    pct,
    derivedApps,
    derivedCommission: parseFloat((targetAPI * 0.35).toFixed(2)),
    enabled: true,
  };
}

// `YYYY-MM-DD` of the 2nd Sunday of a month (always a valid Sunday weekStarting,
// safely mid-month for TT-local bucketing).
function secondSundayOfMonth(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const dow = first.getUTCDay();            // 0 = Sunday
  const firstSundayDay = 1 + ((7 - dow) % 7);
  const day = firstSundayDay + 7;           // 2nd Sunday
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function completedMonthIndices() {
  const out = [];
  for (let i = 0; i < CURRENT_MONTH_INDEX; i++) out.push(i);
  return out;
}

// A flat-V2 submission doc (mirrors seed-weekly-floors-test-submission shape).
// totalProductionCredit is the field extractTotalProductionCredit reads first.
// branchId is stamped so the BM's getAllYTDSubmissions (where branchId == claims.
// branchId) returns these — without it the BM submitted column reads 0.
function buildSubmission(uid, name, unitId, weekStarting, api) {
  return {
    userId:       uid,
    agentId:      uid,
    agentName:    `${name} [smoke-data ${YEAR}]`,
    unitId:       unitId ?? null,
    branchId:     BRANCH_ID,
    weekStarting,
    status:       'submitted',
    version:      2,
    newBusiness:  { apps: Math.max(1, Math.round(api / AVG_POLICY_API)), api },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
    totalCommission:       parseFloat((api * 0.35).toFixed(2)),
    updatedAt:   ts(),
    submittedAt: ts(),
  };
}

// Builds an E3-shaped persistency doc body whose six business-input fields make
// isE3Doc() pass AND derive (netSettled/grossSettled) to the target decimal.
// gross fixed at 100 → lapses = round((1−P)×100); persistency stored as DECIMAL
// (production shape — the roster ×100's it for display).
function buildE3Persistency(targetPct) {
  const targetDecimal = targetPct / 100;
  const grossSettled = 100;
  const lapses = Math.round((1 - targetDecimal) * grossSettled);
  const netSettled = grossSettled - lapses;
  return {
    businessPlaced: grossSettled, // gross = (BP − NT) + incPPPs + lumpsums100×0.1
    notTakens: 0,
    incPPPs: 0,
    lumpsums100: 0,
    lapses,
    reinstatements: 0,
    grossSettled,
    netSettled,
    persistency: netSettled / grossSettled, // DECIMAL in [0,1] — production shape
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve smoke account uids (seed-smoke-tenant must have run first)
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUid(emailKey, label) {
  const email = process.env[emailKey] ?? env[emailKey];
  if (!email) {
    console.error(`[seed-smoke-data] ABORT: ${emailKey} not set in .env.local (needed for ${label}).`);
    process.exit(1);
  }
  try {
    const rec = await auth.getUserByEmail(email);
    return rec.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`[seed-smoke-data] ABORT: no Auth account for ${label} (${email}).`);
      console.error('  Run seed-smoke-tenant.cjs --apply FIRST to provision the A11Y accounts.');
      process.exit(1);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[seed-smoke-data]  tenant=${TENANT_ID}  branch=${BRANCH_ID}  year=${YEAR}  mode=${isDryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`[seed-smoke-data]  completed months (YTD actuals): ${completedMonthIndices().length} (0..${CURRENT_MONTH_INDEX - 1})\n`);

  const agentUid = await resolveUid('A11Y_AGENT_EMAIL', 'smoke agent');
  const umUid    = await resolveUid('A11Y_UNIT_MANAGER_EMAIL', 'smoke unit manager');
  console.log(`[seed-smoke-data] resolved agent uid + unit-manager uid (for roster unitId)\n`);

  const monthlyTargets = seedEvenSplit(YEAR_TOTAL);
  const lineSum = Object.values(LINES).reduce((s, l) => s + l.targetAPI, 0);
  if (lineSum !== YEAR_TOTAL) {
    console.error(`[seed-smoke-data] ABORT: line sum ${lineSum} !== YEAR_TOTAL ${YEAR_TOTAL}`);
    process.exit(1);
  }

  // ── Dry-run: print intent and exit ──────────────────────────────────────────
  if (isDryRun) {
    console.log('Intended operations (no writes):');
    console.log(`  Smoke agent:`);
    console.log(`    moneyNeeds/${YEAR}      (Step 1 figures)`);
    console.log(`    yearPlan/${YEAR}        Σ targetAPI = ${YEAR_TOTAL}, status=committed`);
    console.log(`    monthlyPlan/${YEAR}     anchorAPI = ${YEAR_TOTAL}, even split, status=committed`);
    console.log(`    goals/<agentUid>        personalAnnualAPI = ${YEAR_TOTAL}, gamePlanCommitted=true`);
    console.log(`    submissions             ${completedMonthIndices().length} (one per completed month)`);
    console.log(`  Roster (${ROSTER.length} synthetic agents under smoke UM):`);
    for (const r of ROSTER) {
      const e3 = buildE3Persistency(r.persistencyPct);
      console.log(`    ${r.uid}: settledAPI=${r.settledAPI} apps=${r.settledApps} persistencyPct=${r.persistencyPct} (decimal=${e3.persistency}) goal=${r.noGoal ? 'NONE (— path)' : r.goalAPI} unitName=${UNIT_NAME} contract=${r.contractStartDate}`);
    }
    console.log('\n[dry-run complete — no writes performed]');
    return;
  }

  // ── Smoke agent — Game Plan + production ─────────────────────────────────────
  console.log('── Smoke agent: Game Plan + production ──');
  const userBase = `tenants/${TENANT_ID}/users/${agentUid}`;

  // moneyNeeds (Step 1) — minimal-but-honest figures the cascade rung reads.
  await db.doc(`${userBase}/moneyNeeds/${YEAR}`).set({
    year: YEAR,
    tenantId: TENANT_ID,
    uid: agentUid,
    totalAnnualAfterTax: 240_000,
    totalAnnualPreTax:   320_000,
    estimatedRenewalIncome: { total: 50_000 },
    status: 'committed',
    updatedAt: ts(),
    updatedBy: SEED_ACTOR,
  }, { merge: true });
  console.log(`  [fs] moneyNeeds/${YEAR}`);

  // yearPlan (Step 2) — committed.
  await db.doc(`${userBase}/yearPlan/${YEAR}`).set({
    year: YEAR,
    tenantId: TENANT_ID,
    uid: agentUid,
    licenseProfile: 'composite',
    status: 'committed',
    committedAt: ts(),
    lines: {
      life:    buildLine(LINES.life.targetAPI, LINES.life.pct),
      ah:      buildLine(LINES.ah.targetAPI, LINES.ah.pct),
      general: buildLine(LINES.general.targetAPI, LINES.general.pct),
    },
    updatedAt: ts(),
    updatedBy: SEED_ACTOR,
  }, { merge: true });
  console.log(`  [fs] yearPlan/${YEAR}  (Σ targetAPI = ${YEAR_TOTAL})`);

  // monthlyPlan (Step 3) — committed; anchorAPI === yearPlan total.
  await db.doc(`${userBase}/monthlyPlan/${YEAR}`).set({
    year: YEAR,
    tenantId: TENANT_ID,
    uid: agentUid,
    targets: monthlyTargets,
    split: 'even',
    anchorAPI: YEAR_TOTAL,
    status: 'committed',
    committedAt: ts(),
    updatedAt: ts(),
  }, { merge: true });
  console.log(`  [fs] monthlyPlan/${YEAR}  (anchorAPI = ${YEAR_TOTAL}, per-month = ${YEAR_TOTAL / 12})`);

  // goals — personal commitment + gamePlanCommitted (Step 4 / API chip).
  await db.doc(`tenants/${TENANT_ID}/goals/${agentUid}`).set({
    agentId: agentUid,
    tenantId: TENANT_ID,
    personalAnnualAPI: YEAR_TOTAL,
    personalAnnualApps: Math.round(YEAR_TOTAL / AVG_POLICY_API),
    playgroundAvgPolicyAPI: AVG_POLICY_API,
    gamePlanCommitted: true,
    updatedAt: ts(),
  }, { merge: true });
  console.log(`  [fs] goals/<agentUid>`);

  // submissions — one per completed month (drives YTD actuals; agent slightly ahead).
  for (const m of completedMonthIndices()) {
    const ws = secondSundayOfMonth(YEAR, m);
    const api = 105_000; // > 100k per-month target → "ahead" YTD badge
    await db.doc(`tenants/${TENANT_ID}/submissions/${agentUid}_${ws}`)
      .set(buildSubmission(agentUid, 'Smoke Agent', umUid, ws, api), { merge: true });
  }
  console.log(`  [fs] submissions  (${completedMonthIndices().length} months)`);

  // ── Roster — manager-visible spread ──────────────────────────────────────────
  console.log('\n── Roster: varied manager-visible agents ──');
  for (const r of ROSTER) {
    // user doc
    await db.doc(`tenants/${TENANT_ID}/users/${r.uid}`).set({
      uid: r.uid,
      tenantId: TENANT_ID,
      role: 'agent',
      name: r.name,
      branchId: BRANCH_ID,
      unitId: umUid,
      unitName: UNIT_NAME,
      agentNumber: '',
      contractStartDate: r.contractStartDate,
      active: true,
      hasSeenWelcome: true,
      onboardingComplete: true,
      isSmokeRoster: true,
      createdAt: ts(),
      createdBy: SEED_ACTOR,
    }, { merge: true });

    // goals (% of goal) — noGoal members get their goal doc DELETED (not just
    // skipped) so the roster's % column shows the "—" (no committed target)
    // fallback even on re-runs over a prior seed that wrote a goal here.
    const goalRef = db.doc(`tenants/${TENANT_ID}/goals/${r.uid}`);
    if (r.noGoal) {
      await goalRef.delete();
    } else {
      await goalRef.set({
        agentId: r.uid,
        tenantId: TENANT_ID,
        personalAnnualAPI: r.goalAPI,
        personalAnnualApps: Math.round(r.goalAPI / AVG_POLICY_API),
        playgroundAvgPolicyAPI: AVG_POLICY_API,
        gamePlanCommitted: true,
        updatedAt: ts(),
      }, { merge: true });
    }

    // submissions (submitted API) — two completed months, or current if none completed
    const subMonths = completedMonthIndices().slice(-2);
    const monthsToSeed = subMonths.length ? subMonths : [CURRENT_MONTH_INDEX];
    for (const m of monthsToSeed) {
      const ws = secondSundayOfMonth(YEAR, m);
      const api = Math.round(r.submittedAPI / monthsToSeed.length);
      await db.doc(`tenants/${TENANT_ID}/submissions/${r.uid}_${ws}`)
        .set(buildSubmission(r.uid, r.name, umUid, ws, api), { merge: true });
    }

    // settlement (settled API/apps/persistency) — one YTD monthly settlement
    const periodKey = `${YEAR}-${String(CURRENT_MONTH_INDEX + 1).padStart(2, '0')}`;
    await db.doc(`tenants/${TENANT_ID}/settlements/${r.uid}_${YEAR}_${periodKey}`).set({
      agentId: r.uid,
      tenantId: TENANT_ID,
      year: YEAR,
      periodKey,
      periodType: 'monthly',
      settledAPI: r.settledAPI,
      settledApps: r.settledApps,
      persistency: r.persistencyPct,
      notes: 'smoke-data seed',
      confirmedBy: SEED_ACTOR,
      confirmedByName: 'Seed Smoke Data',
      confirmedAt: ts(),
    }, { merge: true });

    // persistency doc (monthly) — current month. E3-shaped (passes isE3Doc) with
    // persistency stored as a DECIMAL (production shape); the roster ×100's it.
    const monthNum = CURRENT_MONTH_INDEX + 1;
    const monthKey = `${YEAR}-${String(monthNum).padStart(2, '0')}`;
    await db.doc(`tenants/${TENANT_ID}/persistency/${r.uid}_${YEAR}_${String(monthNum).padStart(2, '0')}`).set({
      agentId: r.uid,
      agentName: r.name,
      tenantId: TENANT_ID,
      year: YEAR,
      month: monthNum,
      monthKey,
      ...buildE3Persistency(r.persistencyPct),
      enteredBy: SEED_ACTOR,
      enteredAt: ts(),
    }, { merge: true });

    console.log(`  [fs] roster ${r.uid}  (user + goals + submissions + settlement + persistency)`);
  }

  console.log(`\n[seed-smoke-data] DONE — agent Game Plan + ${ROSTER.length}-agent roster seeded in ${TENANT_ID}.`);
  console.log('Re-runnable: deterministic doc IDs → idempotent overwrite on every run.');
}

main().catch((err) => {
  console.error('[seed-smoke-data] FATAL:', err.message ?? err);
  process.exit(1);
});
