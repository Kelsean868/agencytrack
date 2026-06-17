'use strict';
/**
 * Phase 3 emulator verification for seed-smoke-tenant.cjs
 *
 * Requires emulators running:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:9090
 *
 * Run via the npm script or directly:
 *   node scripts/verification/seed-smoke-tenant-emulator-verify.cjs
 */

const { execSync, spawnSync } = require('child_process');
const path  = require('path');
const admin = require('../../functions/node_modules/firebase-admin');

const { loadEnv } = require('../lib/loadEnv.cjs');
const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

const TENANT_ID = env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID = 'smoke_branch';

const ROLE_DEFS = [
  { role: 'platform_admin',  emailKey: 'A11Y_PLATFORM_ADMIN_EMAIL',  claimsOnly: true,
    expectedClaims: { role: 'platform_admin', tenantId: null } },
  { role: 'tenant_admin',    emailKey: 'A11Y_TENANT_ADMIN_EMAIL',
    expectedClaims: { role: 'tenant_admin', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: ['*'] } },
  { role: 'sales_manager',   emailKey: 'A11Y_SALES_MANAGER_EMAIL',
    expectedClaims: { role: 'sales_manager', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: ['*'] } },
  { role: 'branch_manager',  emailKey: 'A11Y_BRANCH_MANAGER_EMAIL',
    expectedClaims: { role: 'branch_manager', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: [BRANCH_ID] } },
  { role: 'unit_manager',    emailKey: 'A11Y_UNIT_MANAGER_EMAIL',
    expectedClaims: { role: 'unit_manager', tenantId: TENANT_ID, branchId: BRANCH_ID } },
  { role: 'agent',           emailKey: 'A11Y_AGENT_EMAIL',
    expectedClaims: { role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_ID } },
];

function assert(condition, msg) {
  if (!condition) { console.error('  FAIL:', msg); process.exitCode = 1; }
  else              console.log('  PASS:', msg);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

admin.initializeApp({ projectId: 'agencytrack-2a610' });
const db   = admin.firestore();
const auth = admin.auth();

const SEED_SCRIPT = path.resolve(__dirname, '../../functions/scripts/seed-smoke-tenant.cjs');

function runSeedScript() {
  const result = spawnSync(
    process.execPath,
    [SEED_SCRIPT, '--apply'],
    {
      env: { ...process.env },
      encoding: 'utf8',
    }
  );
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status };
}

async function verifyState(label) {
  console.log(`\n── ${label} ──`);
  const uids = {};

  const paSkipped = !env.A11Y_PLATFORM_ADMIN_EMAIL || !env.A11Y_PLATFORM_ADMIN_PASSWORD;

  // (a) Auth users + correct claim shapes (PA optional)
  console.log('\n[a] Auth users + claims:');
  for (const def of ROLE_DEFS) {
    const email = env[def.emailKey];
    if (!email) {
      if (def.role === 'platform_admin') { console.log('  SKIP (optional) platform_admin'); continue; }
      console.error('  SKIP (no email key):', def.emailKey); continue;
    }
    try {
      const userRecord = await auth.getUserByEmail(email);
      uids[def.role]   = userRecord.uid;
      const claims     = userRecord.customClaims ?? {};

      for (const [k, v] of Object.entries(def.expectedClaims)) {
        assert(deepEqual(claims[k], v), `${def.role} claim[${k}] == ${JSON.stringify(v)} (got ${JSON.stringify(claims[k])})`);
      }
    } catch (err) {
      assert(false, `${def.role} user exists at ${email} — ${err.message}`);
    }
  }

  // (b) Branch doc exists
  console.log('\n[b] Branch doc:');
  const branchSnap = await db.doc(`tenants/${TENANT_ID}/branches/${BRANCH_ID}`).get();
  assert(branchSnap.exists, `branches/${BRANCH_ID} exists`);
  if (branchSnap.exists) {
    const bd = branchSnap.data();
    assert(bd.isActive === true,           `branches/${BRANCH_ID}.isActive === true`);
    assert(bd.managerId === uids['branch_manager'], `branches/${BRANCH_ID}.managerId === BM uid`);
    assert(bd.name === 'Smoke Test Branch', `branches/${BRANCH_ID}.name === 'Smoke Test Branch'`);
  }

  // (b) 5 user docs exist matching expected role fields
  console.log('\n[b] User docs:');
  for (const def of ROLE_DEFS) {
    if (def.claimsOnly) continue; // platform_admin checked in (c)
    const uid  = uids[def.role];
    if (!uid) { console.error('  SKIP (uid unresolved):', def.role); continue; }
    const snap = await db.doc(`tenants/${TENANT_ID}/users/${uid}`).get();
    assert(snap.exists, `users/${uid} exists (role=${def.role})`);
    if (!snap.exists) continue;
    const d = snap.data();
    assert(d.role      === def.role,   `users/${uid}.role === ${def.role}`);
    assert(d.tenantId  === TENANT_ID,  `users/${uid}.tenantId`);
    assert(d.branchId  === BRANCH_ID,  `users/${uid}.branchId`);
    assert(d.active    === true,       `users/${uid}.active`);

    if (def.role === 'unit_manager') {
      assert(d.unitId === uid, `UM unitId === own uid`);
    }
    if (def.role === 'agent') {
      assert(d.unitId === uids['unit_manager'], `agent unitId === UM uid`);
      assert(d.hasSeenWelcome     === true,  `agent.hasSeenWelcome === true`);
      assert(d.onboardingComplete === true,  `agent.onboardingComplete === true`);
    }
    if (def.role === 'branch_manager') {
      assert(deepEqual(d.ownedBranchIds, [BRANCH_ID]), `BM.ownedBranchIds`);
    }
    if (def.role === 'tenant_admin' || def.role === 'sales_manager') {
      assert(deepEqual(d.ownedBranchIds, ['*']), `${def.role}.ownedBranchIds === ['*']`);
    }
  }

  // (c) platform_admin has claims but no Firestore doc (skip if PA not seeded)
  console.log('\n[c] platform_admin claim-only:');
  const paUid = uids['platform_admin'];
  if (paSkipped) {
    console.log('  SKIP (platform_admin credentials not set)');
  } else if (paUid) {
    const paSnap = await db.doc(`tenants/${TENANT_ID}/users/${paUid}`).get();
    assert(!paSnap.exists, `platform_admin has NO Firestore doc`);
  }
}

async function main() {
  console.log('\n=== Phase 3: seed-smoke-tenant emulator verification ===');
  console.log(`tenant=${TENANT_ID}  branch=${BRANCH_ID}`);

  // ── Run 1 ──
  console.log('\n[run 1] Executing seed script...');
  const run1 = runSeedScript();
  assert(run1.status === 0, `run 1 exit code === 0`);
  // (e) no actual password values in stdout
  const passwordValues = ROLE_DEFS.map(d => env[d.passwordKey]).filter(Boolean);
  for (const pv of passwordValues) {
    assert(!run1.stdout.includes(pv), `run 1 stdout does not contain a password value`);
  }

  await verifyState('Run 1 verification');

  // ── Run 2 (idempotency) ──
  console.log('\n[run 2] Re-executing seed script (idempotency check)...');
  const run2 = runSeedScript();
  assert(run2.status === 0, `run 2 exit code === 0`);
  for (const pv of passwordValues) {
    assert(!run2.stdout.includes(pv), `run 2 stdout does not contain a password value`);
  }

  await verifyState('Run 2 verification (idempotent)');

  const exitCode = process.exitCode ?? 0;
  console.log(`\n=== ${exitCode === 0 ? 'ALL PASS' : 'FAILURES DETECTED'} ===`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[verify] FATAL:', err.message ?? err);
  process.exit(1);
});
