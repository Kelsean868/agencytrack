/**
 * PR-F Bulk Test Data Smoke — Phase 5.
 *
 * Exercises the full test data lifecycle end-to-end against the real Firebase
 * project (NOT an emulator test).
 *
 * STEPS
 *   1. CSV generation + header/row-count validation
 *   2. Seed users via Admin SDK (bypasses the manual BulkImportUsersModal)
 *   3. Seed goals via Admin SDK; run submission/persistency/campaign seeders
 *   4. Preview cleanup → assert non-zero counts
 *   5. Guard violation assertions (tenant, confirmation, email)
 *   6. Full wipe with typed confirmation
 *   7. Post-wipe preview → assert zero counts
 *
 * USAGE
 *   $env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"
 *   node scripts/verification/pr-f-bulk-test-data-smoke.mjs
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   CLEANUP_ALLOWED_TENANTS env var (set to tatillife_south)
 *   Clean slate recommended: no *@agencytrack.test users should exist before
 *   running. Check first with preview-test-data-sweep.mjs --mode=email-pattern.
 *
 * ON FAILURE
 *   Any remaining test data can be cleaned up with:
 *     node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute
 *
 * OUTPUT
 *   Stdout + verification/pr-f-smoke-<timestamp>.log
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { spawnSync, spawn } from 'child_process';
import { randomUUID }       from 'crypto';

import {
  TENANT_ID,
  BRANCH_ID,
  BRANCH_NAME,
  EMAIL_SUFFIX,
  BRANCH_MANAGER,
  UNIT_MANAGERS,
  AGENTS,
  ALL_USERS,
  AGENT_GOALS,
} from '../seed/test-roster.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── Admin SDK init ────────────────────────────────────────────────────────────

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
const db   = admin.firestore();
const auth = admin.auth();

// ── Log setup ─────────────────────────────────────────────────────────────────

const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logDir  = resolve(ROOT, 'verification');
mkdirSync(logDir, { recursive: true });
const logPath = resolve(logDir, `pr-f-smoke-${ts}.log`);
function log(msg) { console.log(msg); appendFileSync(logPath, msg + '\n'); }

// ── Assert helper ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
function assert(label, condition, detail = '') {
  if (condition) {
    log(`  ✓ ${label}`);
    passed++;
  } else {
    log(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── Subprocess helpers ────────────────────────────────────────────────────────

function runScript(scriptArgs, opts = {}) {
  return spawnSync('node', scriptArgs, {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout:  opts.timeout ?? 120_000,
    env: {
      ...process.env,
      CLEANUP_ALLOWED_TENANTS: TENANT_ID,
      ...opts.env,
    },
    input: opts.input,
  });
}

// Runs wipe --execute interactively: captures the confirmation phrase from stdout,
// then calls answerFn(phrase) to decide what to write to stdin.
function runWipeInteractive(modeArgs, answerFn) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      'scripts/cleanup/wipe-test-data-sweep.mjs',
      ...modeArgs,
      '--execute',
    ], {
      cwd: ROOT,
      env: { ...process.env, CLEANUP_ALLOWED_TENANTS: TENANT_ID },
    });

    let stdout = '';
    let confirmed = false;
    const TIMEOUT_MS = 180_000;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('runWipeInteractive timed out after 3 minutes'));
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
      if (!confirmed) {
        const m = stdout.match(/Type exactly:\n  (DELETE \d+ USERS AT [^\n]+)/);
        if (m) {
          confirmed = true;
          const answer = answerFn(m[1]);
          child.stdin.write(answer + '\n');
          child.stdin.end();
        }
      }
    });

    child.stderr.on('data', (chunk) => process.stderr.write(chunk));

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout });
    });
  });
}

// ── Batch-ID for this smoke run ───────────────────────────────────────────────

const batchId = randomUUID();

log(`\nPR-F Bulk Test Data Smoke`);
log('='.repeat(60));
log(`Tenant:   ${TENANT_ID}`);
log(`Batch ID: ${batchId}`);
log(`Log:      ${logPath}`);

// ── Pre-flight: warn if stale test data exists ────────────────────────────────

{
  const pf = runScript(['scripts/cleanup/preview-test-data-sweep.mjs', '--mode=email-pattern']);
  const m  = [...(pf.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
  const existing = m[0] ? parseInt(m[0][1], 10) : 0;
  if (existing > 0) {
    log(`\nWARNING: ${existing} pre-existing *${EMAIL_SUFFIX} Auth users found.`);
    log('  Smoke will reuse existing users. Run wipe first for clean counts.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — CSV generation + validation
// ─────────────────────────────────────────────────────────────────────────────

log('\n[1/7] CSV generation + validation…');

const usersOut = resolve(logDir, 'test-users.csv');
const goalsOut = resolve(logDir, 'test-goals.csv');

const usersGen = runScript([
  'scripts/seed/generate-users-csv.mjs',
  '--out', logDir,
  '--batch-id', batchId,
]);
assert('generate-users-csv exits 0', usersGen.status === 0, usersGen.stderr?.slice(0, 200));

const goalsGen = runScript([
  'scripts/seed/generate-goals-csv.mjs',
  '--out', logDir,
  '--batch-id', batchId,
]);
assert('generate-goals-csv exits 0', goalsGen.status === 0, goalsGen.stderr?.slice(0, 200));

if (existsSync(usersOut)) {
  const lines  = readFileSync(usersOut, 'utf8').trim().split('\n').filter(Boolean);
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  assert('users CSV: email column',  header.includes('email'));
  assert('users CSV: role column',   header.includes('role'));
  assert('users CSV: name column',   header.includes('name'));
  assert(`users CSV: ${ALL_USERS.length} data rows`, lines.length - 1 === ALL_USERS.length,
    `got ${lines.length - 1}`);
}

if (existsSync(goalsOut)) {
  const lines  = readFileSync(goalsOut, 'utf8').trim().split('\n').filter(Boolean);
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  assert('goals CSV: agentEmail column',      header.includes('agentemail'));
  assert('goals CSV: annualApiTarget column', header.includes('annualapitarget'));
  assert(`goals CSV: ${AGENTS.length} data rows`, lines.length - 1 === AGENTS.length,
    `got ${lines.length - 1}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Seed users via Admin SDK
// ─────────────────────────────────────────────────────────────────────────────

log('\n[2/7] Seeding users via Admin SDK…');

const TEST_PASSWORD = 'TestSeed!2026';
const uidByEmail    = new Map();

async function createTestUser(user, unitId = '') {
  const existing = await auth.getUserByEmail(user.email).catch(() => null);
  if (existing) {
    log(`  SKIP (exists) ${user.role.padEnd(15)} ${user.email}  uid=${existing.uid}`);
    uidByEmail.set(user.email.toLowerCase(), existing.uid);
    return existing.uid;
  }
  const record = await auth.createUser({
    email:       user.email,
    password:    TEST_PASSWORD,
    displayName: user.name,
  });
  await auth.setCustomUserClaims(record.uid, { role: user.role, tenantId: TENANT_ID });
  const fsUnitId = unitId || (user.role === 'unit_manager' ? record.uid : '');
  await db.doc(`tenants/${TENANT_ID}/users/${record.uid}`).set({
    email:             user.email,
    name:              user.name,
    role:              user.role,
    tenantId:          TENANT_ID,
    branchId:          BRANCH_ID,
    branchName:        BRANCH_NAME,
    unitId:            fsUnitId,
    agentNumber:       user.agentNumber ?? '',
    contractStartDate: user.contractStartDate ?? '',
    phone:             '',
    bio:               '',
    careerLevel:       '',
    testDataBatchId:   batchId,
    createdAt:         admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('auditAdminCreations').add({
    createdUid:      record.uid,
    email:           user.email,
    role:            user.role,
    tenantId:        TENANT_ID,
    testDataBatchId: batchId,
    createdAt:       admin.firestore.FieldValue.serverTimestamp(),
  });
  uidByEmail.set(user.email.toLowerCase(), record.uid);
  log(`  CREATE ${user.role.padEnd(15)} ${user.email}  uid=${record.uid}`);
  return record.uid;
}

// Creation order: BM → UMs → agents (agents need UM UIDs for unitId)
await createTestUser(BRANCH_MANAGER);

const umUidMap = {};
for (const um of UNIT_MANAGERS) {
  umUidMap[um.unitKey] = await createTestUser(um);
}

for (const agent of AGENTS) {
  await createTestUser(agent, umUidMap[agent.unitKey] ?? '');
}

assert(`seeded ${ALL_USERS.length} users (Auth + Firestore)`, uidByEmail.size === ALL_USERS.length,
  `resolved ${uidByEmail.size}`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Seed goals (inline) + run seeder scripts
// ─────────────────────────────────────────────────────────────────────────────

log('\n[3/7] Seeding goals via Admin SDK + running seeder scripts…');

// Goals: write directly (smoke bypasses modal)
const goalBatch = db.batch();
let goalCount   = 0;
for (const agent of AGENTS) {
  const uid = uidByEmail.get(agent.email.toLowerCase());
  if (!uid) continue;
  goalBatch.set(db.doc(`tenants/${TENANT_ID}/goals/${uid}`), {
    agentId:          uid,
    tenantId:         TENANT_ID,
    year:             2026,
    annualApiTarget:  AGENT_GOALS.annualApiTarget,
    annualAppsTarget: AGENT_GOALS.annualAppsTarget,
    importedFromCsv:  false,
    testDataBatchId:  batchId,
    updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
  });
  goalCount++;
}
await goalBatch.commit();
assert(`seeded ${AGENTS.length} goal docs`, goalCount === AGENTS.length);

// Run Phase 3 seeders as subprocesses
for (const scriptArgs of [
  ['scripts/seed/seed-test-submissions.mjs', '--batch-id', batchId, '--apply'],
  ['scripts/seed/seed-test-persistency.mjs', '--batch-id', batchId, '--apply'],
  ['scripts/seed/seed-test-campaign.mjs',    '--batch-id', batchId, '--apply'],
]) {
  const name = scriptArgs[0].split('/').pop();
  const r    = runScript(scriptArgs, { timeout: 60_000 });
  assert(`${name} exits 0`, r.status === 0, r.stderr?.slice(0, 300));
  if (r.stdout) process.stdout.write(r.stdout);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Preview cleanup: assert non-zero counts
// ─────────────────────────────────────────────────────────────────────────────

log('\n[4/7] Preview cleanup (email-pattern)…');

const previewR = runScript([
  'scripts/cleanup/preview-test-data-sweep.mjs',
  '--mode=email-pattern',
], { timeout: 60_000 });
assert('preview exits 0', previewR.status === 0, previewR.stderr?.slice(0, 200));

if (previewR.stdout) process.stdout.write(previewR.stdout);

// The preview outputs two "  Total: N" lines: first for auth users, second for Firestore.
const previewTotals = [...(previewR.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
const previewAuth = previewTotals[0] ? parseInt(previewTotals[0][1], 10) : -1;
const previewFs   = previewTotals[1] ? parseInt(previewTotals[1][1], 10) : -1;

assert(`preview: auth count = ${ALL_USERS.length}`, previewAuth === ALL_USERS.length,
  `got ${previewAuth}`);
assert('preview: Firestore count > 0', previewFs > 0, `got ${previewFs}`);
log(`  Preview totals: auth=${previewAuth}, fs=${previewFs}`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Guard violation tests
// ─────────────────────────────────────────────────────────────────────────────

log('\n[5/7] Guard violation tests…');

// Guard A: CLEANUP_ALLOWED_TENANTS unset → abort before Admin SDK
{
  const envWithout = { ...process.env };
  delete envWithout.CLEANUP_ALLOWED_TENANTS;
  const r = spawnSync('node', [
    'scripts/cleanup/wipe-test-data-sweep.mjs',
    '--mode=email-pattern',
    '--execute',
  ], {
    cwd: ROOT, encoding: 'utf8', timeout: 30_000,
    env: envWithout,
  });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert('Guard A (tenant unset) exits non-zero', r.status !== 0,
    `exit=${r.status} output=${out.slice(0, 100)}`);
  assert('Guard A prints ABORT', out.includes('ABORT'),
    out.slice(0, 200));
}

// Guard B: wrong typed confirmation → abort after enumeration
{
  const wipeResult = await runWipeInteractive(
    ['--mode=email-pattern'],
    (_phrase) => 'this is definitely the wrong answer',
  );
  assert('Guard B (wrong confirmation) exits non-zero', wipeResult.code !== 0,
    `exit=${wipeResult.code}`);
  assert('Guard B stdout contains ABORT', wipeResult.stdout.includes('ABORT'),
    wipeResult.stdout.slice(-200));
}

// Guard C: email pattern guard logic (inline — assertEmailsAreSafe equivalent)
{
  const FOREIGN_SUFFIX = '@notagencytrack.test';
  const fakeList = [
    { uid: 'u1', email: `valid${EMAIL_SUFFIX}` },
    { uid: 'u2', email: `danger${FOREIGN_SUFFIX}` },
  ];
  let fired = false;
  for (const u of fakeList) {
    if (!u.email.toLowerCase().endsWith(EMAIL_SUFFIX)) { fired = true; break; }
  }
  assert('Guard C (email pattern logic) fires for non-test email', fired);
  assert('Guard C passes for all-test-email list', (() => {
    for (const u of [{ email: `a${EMAIL_SUFFIX}` }, { email: `b${EMAIL_SUFFIX}` }]) {
      if (!u.email.endsWith(EMAIL_SUFFIX)) return false;
    }
    return true;
  })());
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Full wipe with correct typed confirmation
// ─────────────────────────────────────────────────────────────────────────────

log('\n[6/7] Full wipe (email-pattern, correct confirmation)…');

const wipeResult = await runWipeInteractive(
  ['--mode=email-pattern'],
  (phrase) => phrase, // echo the exact phrase back
);
assert('Wipe exits 0', wipeResult.code === 0,
  `exit=${wipeResult.code} — tail: ${wipeResult.stdout.slice(-300)}`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — Post-wipe preview: assert zero counts
// ─────────────────────────────────────────────────────────────────────────────

log('\n[7/7] Post-wipe preview (email-pattern)…');

const postR = runScript([
  'scripts/cleanup/preview-test-data-sweep.mjs',
  '--mode=email-pattern',
], { timeout: 60_000 });
assert('post-wipe preview exits 0', postR.status === 0, postR.stderr?.slice(0, 200));

if (postR.stdout) process.stdout.write(postR.stdout);

const postTotals = [...(postR.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
const postAuth = postTotals[0] ? parseInt(postTotals[0][1], 10) : -1;
const postFs   = postTotals[1] ? parseInt(postTotals[1][1], 10) : -1;

assert('post-wipe: auth count = 0',  postAuth === 0, `got ${postAuth}`);
assert('post-wipe: Firestore count = 0', postFs === 0,  `got ${postFs}`);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

log('\n' + '='.repeat(60));
log(`Smoke: ${passed} passed, ${failed} failed`);
log(`Batch ID: ${batchId}`);
log(`Log: ${logPath}`);

if (failed > 0) {
  log('\nNOTE: If test data remains, clean up manually:');
  log(`  $env:CLEANUP_ALLOWED_TENANTS = "${TENANT_ID}"`);
  log('  node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute');
  process.exit(1);
}
