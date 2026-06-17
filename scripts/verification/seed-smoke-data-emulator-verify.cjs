'use strict';
/**
 * Phase 3 emulator verification for seed-smoke-data.cjs
 *
 * Runs seed-smoke-tenant (provision accounts) → seed-smoke-data (seed data),
 * then asserts the smoke agent's Game Plan docs + the varied roster + the
 * hard south-guard + idempotency. Emulator-only; no production touch.
 *
 * Requires emulators running:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:9090
 *
 * Run:
 *   node scripts/verification/seed-smoke-data-emulator-verify.cjs
 */

const { spawnSync } = require('child_process');
const path  = require('path');
const admin = require('../../functions/node_modules/firebase-admin');

const { loadEnv } = require('../lib/loadEnv.cjs');
const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

const TENANT_ID = env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID = 'smoke_branch';
const YEAR = Number(env.A11Y_SMOKE_YEAR) || new Date().getFullYear();
const YEAR_TOTAL = 1_200_000;
const ROSTER_UIDS = ['smoke_roster_1', 'smoke_roster_2', 'smoke_roster_3', 'smoke_roster_4'];

function assert(condition, msg) {
  if (!condition) { console.error('  FAIL:', msg); process.exitCode = 1; }
  else              console.log('  PASS:', msg);
}

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610' });
const db   = admin.firestore();
const auth = admin.auth();

const TENANT_SCRIPT = path.resolve(__dirname, '../../functions/scripts/seed-smoke-tenant.cjs');
const DATA_SCRIPT   = path.resolve(__dirname, '../../functions/scripts/seed-smoke-data.cjs');

function runScript(script, extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    [script, '--apply'],
    { env: { ...process.env, ...extraEnv }, encoding: 'utf8' },
  );
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status };
}

async function verifyAgent(label) {
  console.log(`\n── ${label}: smoke agent Game Plan ──`);
  const agent = await auth.getUserByEmail(env.A11Y_AGENT_EMAIL);
  const uid = agent.uid;
  const base = `tenants/${TENANT_ID}/users/${uid}`;

  // yearPlan committed, Σ targetAPI === YEAR_TOTAL
  const yp = await db.doc(`${base}/yearPlan/${YEAR}`).get();
  assert(yp.exists, `yearPlan/${YEAR} exists`);
  if (yp.exists) {
    const d = yp.data();
    const sum = ['life', 'ah', 'property', 'motor']
      .reduce((s, k) => s + (d.lines?.[k]?.targetAPI ?? 0), 0);
    assert(sum === YEAR_TOTAL, `yearPlan Σ targetAPI === ${YEAR_TOTAL} (got ${sum})`);
    assert(d.status === 'committed', `yearPlan.status === 'committed'`);
  }

  // monthlyPlan committed, anchorAPI === YEAR_TOTAL, targets sum > 0
  const mp = await db.doc(`${base}/monthlyPlan/${YEAR}`).get();
  assert(mp.exists, `monthlyPlan/${YEAR} exists`);
  if (mp.exists) {
    const d = mp.data();
    assert(d.anchorAPI === YEAR_TOTAL, `monthlyPlan.anchorAPI === ${YEAR_TOTAL} (got ${d.anchorAPI})`);
    assert(d.status === 'committed', `monthlyPlan.status === 'committed'`);
    const tsum = (d.targets ?? []).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    assert(Math.abs(tsum - YEAR_TOTAL) < 1, `Σ monthlyPlan.targets ≈ ${YEAR_TOTAL} (got ${tsum})`);
    // The #677 ratio: displayed per-month (anchorAPI/12) is distinct from annual.
    assert(d.anchorAPI / 12 !== YEAR_TOTAL, `per-month (anchorAPI/12) distinct from annual`);
  }

  // moneyNeeds + goals
  const mn = await db.doc(`${base}/moneyNeeds/${YEAR}`).get();
  assert(mn.exists && (mn.data().totalAnnualAfterTax ?? 0) > 0, `moneyNeeds/${YEAR} filled`);
  const goals = await db.doc(`tenants/${TENANT_ID}/goals/${uid}`).get();
  assert(goals.exists && goals.data().gamePlanCommitted === true, `goals.gamePlanCommitted === true`);

  // submissions for completed months
  const completed = new Date().getMonth(); // 0..(CMI) completed
  const subs = await db.collection(`tenants/${TENANT_ID}/submissions`)
    .where('agentId', '==', uid).get();
  assert(subs.size === completed, `agent submissions === completed months (${completed}, got ${subs.size})`);
}

async function verifyRoster(label) {
  console.log(`\n── ${label}: roster spread ──`);
  const um = await auth.getUserByEmail(env.A11Y_UNIT_MANAGER_EMAIL);
  for (const ruid of ROSTER_UIDS) {
    const u = await db.doc(`tenants/${TENANT_ID}/users/${ruid}`).get();
    assert(u.exists, `roster user ${ruid} exists`);
    if (u.exists) {
      const d = u.data();
      assert(d.role === 'agent', `${ruid}.role === 'agent'`);
      assert(d.unitId === um.uid, `${ruid}.unitId === smoke UM uid`);
      assert(d.branchId === BRANCH_ID, `${ruid}.branchId === ${BRANCH_ID}`);
    }
    const g = await db.doc(`tenants/${TENANT_ID}/goals/${ruid}`).get();
    assert(g.exists && (g.data().personalAnnualAPI ?? 0) > 0, `${ruid} goals.personalAnnualAPI > 0`);

    const set = await db.collection(`tenants/${TENANT_ID}/settlements`)
      .where('agentId', '==', ruid).get();
    assert(set.size >= 1, `${ruid} has ≥1 settlement`);

    const per = await db.collection(`tenants/${TENANT_ID}/persistency`)
      .where('agentId', '==', ruid).get();
    assert(per.size >= 1, `${ruid} has ≥1 persistency doc`);
  }

  // Spread check — settled API strictly descending across the roster.
  const settled = [];
  for (const ruid of ROSTER_UIDS) {
    const s = await db.collection(`tenants/${TENANT_ID}/settlements`)
      .where('agentId', '==', ruid).get();
    settled.push(s.docs[0]?.data()?.settledAPI ?? 0);
  }
  const descending = settled.every((v, i) => i === 0 || settled[i - 1] > v);
  assert(descending, `roster settledAPI has strict spread (${settled.join(' > ')})`);
}

async function main() {
  console.log('\n=== Phase 3: seed-smoke-data emulator verification ===');
  console.log(`tenant=${TENANT_ID}  branch=${BRANCH_ID}  year=${YEAR}`);

  // ── Provision accounts first ──
  console.log('\n[provision] seed-smoke-tenant --apply ...');
  const prov = runScript(TENANT_SCRIPT);
  assert(prov.status === 0, `seed-smoke-tenant exit code === 0`);

  // ── Run 1: seed data ──
  console.log('\n[run 1] seed-smoke-data --apply ...');
  const run1 = runScript(DATA_SCRIPT);
  assert(run1.status === 0, `seed-smoke-data run 1 exit code === 0`);
  await verifyAgent('Run 1');
  await verifyRoster('Run 1');

  // ── South-guard: must ABORT when target resolves to tatillife_south ──
  console.log('\n[south-guard] seed-smoke-data with A11Y_TENANT_ID=tatillife_south ...');
  const guard = runScript(DATA_SCRIPT, { A11Y_TENANT_ID: 'tatillife_south' });
  assert(guard.status !== 0, `south-guard: non-zero exit when target is tatillife_south`);
  assert(/tatillife_south/.test(guard.stderr) && /ABORT/.test(guard.stderr),
    `south-guard: stderr names tatillife_south + ABORT`);

  // ── Run 2: idempotency ──
  console.log('\n[run 2] seed-smoke-data --apply (idempotency) ...');
  const run2 = runScript(DATA_SCRIPT);
  assert(run2.status === 0, `seed-smoke-data run 2 exit code === 0`);
  await verifyAgent('Run 2 (idempotent)');
  await verifyRoster('Run 2 (idempotent)');

  const exitCode = process.exitCode ?? 0;
  console.log(`\n=== ${exitCode === 0 ? 'ALL PASS' : 'FAILURES DETECTED'} ===`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[verify] FATAL:', err.message ?? err);
  process.exit(1);
});
