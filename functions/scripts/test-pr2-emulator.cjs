/**
 * test-pr2-emulator.cjs — PR-2 emulator test suite.
 *
 * Tests createUser (creation matrix, saga, bypass removal) and deactivateUser
 * (deactivation matrix, refresh-token revocation, self-deactivation guard).
 *
 * Uses Firebase Functions v1 .run(data, context) to call handlers directly
 * against the emulator. No HTTP layer involved.
 *
 * Requires emulators running (Firestore + Auth):
 *   firebase emulators:start --only firestore,auth
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   GCLOUD_PROJECT=agencytrack-2a610 \
 *   node functions/scripts/test-pr2-emulator.cjs
 *
 * Compensating-delete tests (saga step C failure, step D audit failure) require
 * mock injection and are not covered here. They are verified by code review of
 * the try/catch shape in doCreateUser.
 */

// ── Set emulator env vars BEFORE any require ──────────────────────────────
process.env.FIRESTORE_EMULATOR_HOST  = process.env.FIRESTORE_EMULATOR_HOST  || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
process.env.GCLOUD_PROJECT           = process.env.GCLOUD_PROJECT           || 'agencytrack-2a610';

const path  = require('path');
const admin = require('firebase-admin');

// ── Bootstrap admin SDK for test setup (separate from index.js instance) ──
// index.js calls initializeApp() at module load; we pre-initialize here so
// our test-setup SDK instance uses the emulator.
const testApp = admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
}, 'test-runner');
const testAuth = admin.auth(testApp);
const testDb   = admin.firestore(testApp);

// ── Load the functions (triggers index.js's initializeApp() with emulator) ─
const fnModule = require('../index');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const TENANT = 'tatillife_south';

// Build a mock onCall context for the given caller
function makeCtx(role, uid, branchId = 'tatil_south', ownedBranchIds = null) {
  const token = { role, tenantId: TENANT, branchId };
  if (ownedBranchIds) token.ownedBranchIds = ownedBranchIds;
  return {
    auth: { uid, token },
    rawRequest: { ip: '127.0.0.1', headers: { 'user-agent': 'test-runner/pr2' } },
  };
}

function unauthCtx() {
  return { auth: null, rawRequest: { ip: '127.0.0.1', headers: {} } };
}

let passCount = 0;
let failCount = 0;
const failures = [];

async function expect(label, fn, expectedCode) {
  try {
    const result = await fn();
    if (expectedCode === null) {
      // Expected success
      passCount++;
      console.log(`  ✓ ${label}`);
      return result;
    } else {
      // Expected an error but didn't get one
      failCount++;
      const msg = `Expected ${expectedCode} but got success`;
      failures.push({ label, msg });
      console.log(`  ✗ ${label} — ${msg}`);
      return null;
    }
  } catch (err) {
    const code = err.code ?? err.httpErrorCode?.status ?? '(no code)';
    if (expectedCode === null) {
      // Expected success but got error
      failCount++;
      const msg = `Expected success but got ${code}: ${err.message}`;
      failures.push({ label, msg });
      console.log(`  ✗ ${label} — ${msg}`);
    } else if (code === expectedCode) {
      passCount++;
      console.log(`  ✓ ${label} → ${code}`);
    } else {
      failCount++;
      const msg = `Expected ${expectedCode} but got ${code}: ${err.message}`;
      failures.push({ label, msg });
      console.log(`  ✗ ${label} — ${msg}`);
    }
    return null;
  }
}

// Create a real Auth user in the emulator and return their UID
async function seedUser(email, role, branchId, ownedBranchIds, unitId) {
  // Clean up any existing user with this email
  try {
    const existing = await testAuth.getUserByEmail(email);
    await testAuth.deleteUser(existing.uid);
  } catch {}

  const rec = await testAuth.createUser({ email, displayName: role, emailVerified: false });
  const uid = rec.uid;

  const claims = { role, tenantId: TENANT, branchId };
  if (ownedBranchIds) claims.ownedBranchIds = ownedBranchIds;
  await testAuth.setCustomUserClaims(uid, claims);

  const doc = { uid, email, role, tenantId: TENANT, branchId, active: true };
  if (ownedBranchIds) doc.ownedBranchIds = ownedBranchIds;
  if (unitId) doc.unitId = unitId;
  await testDb.doc(`tenants/${TENANT}/users/${uid}`).set(doc);

  return uid;
}

async function getUserDoc(uid) {
  const snap = await testDb.doc(`tenants/${TENANT}/users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function getAuthClaims(uid) {
  const rec = await testAuth.getUser(uid);
  return rec.customClaims ?? {};
}

async function cleanup(email) {
  try {
    const rec = await testAuth.getUserByEmail(email);
    await testAuth.deleteUser(rec.uid);
    await testDb.doc(`tenants/${TENANT}/users/${rec.uid}`).delete();
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test runner
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n════════════════════════════════════════════════════');
  console.log(' PR-2 Emulator Test Suite');
  console.log('════════════════════════════════════════════════════');
  console.log(`  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`  Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log('');

  // ── Seed caller UIDs ─────────────────────────────────────────────────────
  console.log('── Seeding test callers ──────────────────────────────');
  const tenantAdminUid  = await seedUser('test-tenant-admin@test.local',  'tenant_admin',   'tatil_south', ['*']);
  const branchMgrUid    = await seedUser('test-branch-mgr@test.local',    'branch_manager', 'tatil_south', ['tatil_south']);
  const unitMgrUid      = await seedUser('test-unit-mgr@test.local',      'unit_manager',   'tatil_south', ['tatil_south'], 'unit_a');
  const unitMgrBUid     = await seedUser('test-unit-mgr-b@test.local',    'unit_manager',   'tatil_south', ['tatil_south'], 'unit_b');
  console.log(`  tenant_admin uid:   ${tenantAdminUid}`);
  console.log(`  branch_manager uid: ${branchMgrUid}`);
  console.log(`  unit_manager uid:   ${unitMgrUid} (unit_a)`);
  console.log(`  unit_manager-b uid: ${unitMgrBUid} (unit_b)`);
  console.log('');

  // ════════════════════════════════════════════════════════════════════════
  // createUser tests
  // ════════════════════════════════════════════════════════════════════════
  console.log('── createUser: matrix validation ─────────────────────');

  await expect(
    'unit_manager cannot create branch_manager',
    () => fnModule.createUser.run(
      { role: 'branch_manager', name: 'X', email: 'x@x.com' },
      makeCtx('unit_manager', unitMgrUid)
    ),
    'permission-denied'
  );

  await expect(
    'branch_manager cannot create sales_manager',
    () => fnModule.createUser.run(
      { role: 'sales_manager', name: 'X', email: 'x@x.com' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'permission-denied'
  );

  await expect(
    'agent cannot create anything (no matrix entry)',
    () => fnModule.createUser.run(
      { role: 'agent', name: 'X', email: 'x@x.com' },
      makeCtx('agent', 'fake-agent-uid')
    ),
    'permission-denied'
  );

  await expect(
    'unauthenticated call rejected',
    () => fnModule.createUser.run(
      { role: 'agent', name: 'X', email: 'x@x.com' },
      unauthCtx()
    ),
    'unauthenticated'
  );

  console.log('\n── createUser: tenant_admin confirmation guard ────────');

  await expect(
    'tenant_admin → tenant_admin without confirmationPhrase',
    () => fnModule.createUser.run(
      { role: 'tenant_admin', name: 'New TA', email: 'new-ta@test.local' },
      makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
    ),
    'invalid-argument'
  );

  await expect(
    'tenant_admin → tenant_admin with wrong phrase',
    () => fnModule.createUser.run(
      { role: 'tenant_admin', name: 'New TA', email: 'new-ta@test.local', confirmationPhrase: 'create tenant admin' },
      makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
    ),
    'invalid-argument'
  );

  console.log('\n── createUser: unitId validation ──────────────────────');

  await expect(
    'agent creation without unitId',
    () => fnModule.createUser.run(
      { role: 'agent', name: 'Agent X', email: 'agentx@test.local' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'invalid-argument'
  );

  const umxResult = await expect(
    'unit_manager creation without unitId succeeds (CF auto-sets unitId = newUid)',
    () => fnModule.createUser.run(
      { role: 'unit_manager', name: 'UM X', email: 'umx@test.local' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    null
  );
  if (umxResult?.uid) {
    const doc = await getUserDoc(umxResult.uid);
    if (doc?.unitId === umxResult.uid) {
      passCount++;
      console.log(`    ✓ unitId auto-set to newUid (${umxResult.uid})`);
    } else {
      failCount++;
      const msg = `unitId not auto-set: ${JSON.stringify(doc)}`;
      failures.push({ label: 'unit_manager auto-unitId', msg });
      console.log(`    ✗ unit_manager auto-unitId — ${msg}`);
    }
    await cleanup('umx@test.local');
  }

  console.log('\n── createUser: unit scoping ───────────────────────────');

  await expect(
    'unit_manager creating agent in wrong unit (unit_b instead of unit_a)',
    () => fnModule.createUser.run(
      { role: 'agent', name: 'Wrong Unit Agent', email: 'wrong-unit@test.local', unitId: 'unit_b' },
      makeCtx('unit_manager', unitMgrUid)  // unitMgrUid is in unit_a
    ),
    'permission-denied'
  );

  console.log('\n── createUser: happy paths ────────────────────────────');

  // Agent creation by branch_manager
  const agentEmail = `new-agent-${Date.now()}@test.local`;
  const agentResult = await expect(
    'branch_manager creates agent (happy path)',
    () => fnModule.createUser.run(
      { role: 'agent', name: 'Test Agent', email: agentEmail, unitId: 'unit_x', agentNumber: 'A-001', contractStartDate: '2026-01-01' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    null
  );
  if (agentResult?.uid) {
    const doc    = await getUserDoc(agentResult.uid);
    const claims = await getAuthClaims(agentResult.uid);
    const docOk = doc && doc.role === 'agent' && doc.branchId === 'tatil_south' && doc.active === true && doc.provisioning === undefined;
    const claimsOk = claims.role === 'agent' && claims.branchId === 'tatil_south' && claims.ownedBranchIds === undefined;
    if (docOk && claimsOk) {
      passCount++;
      console.log(`    ✓ agent doc shape correct (branchId, active, provisioning cleared)`);
      console.log(`    ✓ agent claims correct (role, branchId, no ownedBranchIds)`);
    } else {
      failCount++;
      const msg = `doc shape or claims incorrect: doc=${JSON.stringify(doc)} claims=${JSON.stringify(claims)}`;
      failures.push({ label: 'agent doc/claims shape', msg });
      console.log(`    ✗ agent doc/claims shape — ${msg}`);
    }
    await cleanup(agentEmail);
  }

  // unit_manager creation by branch_manager
  const umEmail = `new-um-${Date.now()}@test.local`;
  const umResult = await expect(
    'branch_manager creates unit_manager (happy path)',
    () => fnModule.createUser.run(
      { role: 'unit_manager', name: 'Test UM', email: umEmail, unitId: 'unit_new' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    null
  );
  if (umResult?.uid) {
    const doc    = await getUserDoc(umResult.uid);
    const claims = await getAuthClaims(umResult.uid);
    const ownedOk = Array.isArray(doc?.ownedBranchIds) && doc.ownedBranchIds[0] === 'tatil_south';
    const claimOwnedOk = Array.isArray(claims?.ownedBranchIds) && claims.ownedBranchIds[0] === 'tatil_south';
    if (ownedOk && claimOwnedOk && doc.provisioning === undefined) {
      passCount++;
      console.log(`    ✓ unit_manager ownedBranchIds=['tatil_south'] in doc + claims; provisioning cleared`);
    } else {
      failCount++;
      const msg = `ownedBranchIds or provisioning wrong: doc=${JSON.stringify(doc)} claims=${JSON.stringify(claims)}`;
      failures.push({ label: 'unit_manager ownedBranchIds', msg });
      console.log(`    ✗ unit_manager ownedBranchIds — ${msg}`);
    }
    await cleanup(umEmail);
  }

  // tenant_admin creation by tenant_admin (full happy path)
  const taEmail = `new-ta-${Date.now()}@test.local`;
  const taResult = await expect(
    'tenant_admin creates tenant_admin with correct phrase (happy path)',
    () => fnModule.createUser.run(
      { role: 'tenant_admin', name: 'New TenantAdmin', email: taEmail, confirmationPhrase: 'CREATE TENANT ADMIN' },
      makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
    ),
    null
  );
  if (taResult?.uid) {
    const doc    = await getUserDoc(taResult.uid);
    const claims = await getAuthClaims(taResult.uid);
    const ownedOk = JSON.stringify(doc?.ownedBranchIds) === JSON.stringify(['*']) &&
                    JSON.stringify(claims?.ownedBranchIds) === JSON.stringify(['*']);
    // Check audit log was written
    const auditSnap = await testDb.collection('auditAdminCreations')
      .where('createdUid', '==', taResult.uid).limit(1).get();
    const auditOk = !auditSnap.empty;
    if (ownedOk && doc.provisioning === undefined && auditOk) {
      passCount++;
      console.log(`    ✓ tenant_admin ownedBranchIds=['*'] in doc + claims; provisioning cleared; audit log written`);
    } else {
      failCount++;
      const msg = `TA creation issue: ownedOk=${ownedOk} provisioning=${doc?.provisioning} auditOk=${auditOk}`;
      failures.push({ label: 'tenant_admin creation', msg });
      console.log(`    ✗ tenant_admin creation — ${msg}`);
    }
    await cleanup(taEmail);
  }

  // setUserClaims cases removed with the callable itself (SEC-01, audit
  // 2026-09-24). functions/__tests__/resolveSalesManagerUid.test.js pins that
  // the export stays gone.

  // ════════════════════════════════════════════════════════════════════════
  // deactivateUser tests
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── deactivateUser: matrix + guards ───────────────────');

  // Seed some target users for deactivation tests
  const targetAgentUid = await seedUser(`target-agent-${Date.now()}@test.local`, 'agent', 'tatil_south', null, 'unit_a');
  const targetUMUid    = await seedUser(`target-um-${Date.now()}@test.local`,    'unit_manager',   'tatil_south', ['tatil_south'], 'unit_a');
  const targetBMUid    = await seedUser(`target-bm-${Date.now()}@test.local`,    'branch_manager', 'tatil_south', ['tatil_south']);
  const targetTAUid    = await seedUser(`target-ta-${Date.now()}@test.local`,    'tenant_admin',   'tatil_south', ['*']);

  await expect(
    'unauthenticated deactivateUser rejected',
    () => fnModule.deactivateUser.run(
      { targetUid: targetAgentUid, active: false },
      unauthCtx()
    ),
    'unauthenticated'
  );

  await expect(
    'self-deactivation blocked (branch_manager)',
    () => fnModule.deactivateUser.run(
      { targetUid: branchMgrUid, active: false },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'permission-denied'
  );

  await expect(
    'self-deactivation blocked (tenant_admin)',
    () => fnModule.deactivateUser.run(
      { targetUid: tenantAdminUid, active: false },
      makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
    ),
    'permission-denied'
  );

  await expect(
    'branch_manager cannot deactivate peer branch_manager',
    () => fnModule.deactivateUser.run(
      { targetUid: targetBMUid, active: false },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'permission-denied'
  );

  await expect(
    'unit_manager cannot deactivate unit_manager peer',
    () => fnModule.deactivateUser.run(
      { targetUid: targetUMUid, active: false },
      makeCtx('unit_manager', unitMgrUid)
    ),
    'permission-denied'
  );

  await expect(
    'missing required fields',
    () => fnModule.deactivateUser.run(
      { targetUid: targetAgentUid },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'invalid-argument'
  );

  console.log('\n── deactivateUser: happy paths ────────────────────────');

  await expect(
    'branch_manager deactivates agent',
    async () => {
      const result = await fnModule.deactivateUser.run(
        { targetUid: targetAgentUid, active: false, reason: 'test deactivation' },
        makeCtx('branch_manager', branchMgrUid)
      );
      const doc = await getUserDoc(targetAgentUid);
      if (doc?.active !== false) throw Object.assign(new Error('active not false after deactivation'), { code: 'assertion-failed' });
      return result;
    },
    null
  );

  await expect(
    'branch_manager deactivates unit_manager',
    async () => {
      const result = await fnModule.deactivateUser.run(
        { targetUid: targetUMUid, active: false },
        makeCtx('branch_manager', branchMgrUid)
      );
      const doc = await getUserDoc(targetUMUid);
      if (doc?.active !== false) throw Object.assign(new Error('active not false'), { code: 'assertion-failed' });
      return result;
    },
    null
  );

  await expect(
    'reactivation (active:true) — no error, doc active flips back',
    async () => {
      const result = await fnModule.deactivateUser.run(
        { targetUid: targetAgentUid, active: true },
        makeCtx('branch_manager', branchMgrUid)
      );
      const doc = await getUserDoc(targetAgentUid);
      if (doc?.active !== true) throw Object.assign(new Error('active not true after reactivation'), { code: 'assertion-failed' });
      return result;
    },
    null
  );

  await expect(
    'tenant_admin deactivates another tenant_admin',
    async () => {
      const result = await fnModule.deactivateUser.run(
        { targetUid: targetTAUid, active: false },
        makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
      );
      const doc = await getUserDoc(targetTAUid);
      if (doc?.active !== false) throw Object.assign(new Error('active not false'), { code: 'assertion-failed' });
      return result;
    },
    null
  );

  await expect(
    'deactivateUser on non-existent uid returns not-found',
    () => fnModule.deactivateUser.run(
      { targetUid: 'nonexistent-uid-xyz', active: false },
      makeCtx('tenant_admin', tenantAdminUid, 'tatil_south', ['*'])
    ),
    'not-found'
  );

  // ── Cleanup ───────────────────────────────────────────────────────────
  const allTestUids = [tenantAdminUid, branchMgrUid, unitMgrUid, unitMgrBUid, targetAgentUid, targetUMUid, targetBMUid, targetTAUid];
  for (const uid of allTestUids) {
    try {
      await testAuth.deleteUser(uid);
      await testDb.doc(`tenants/${TENANT}/users/${uid}`).delete();
    } catch {}
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const total = passCount + failCount;
  console.log('\n════════════════════════════════════════════════════');
  console.log(` RESULTS: ${passCount}/${total} passed`);
  if (failCount > 0) {
    console.log('\n FAILURES:');
    failures.forEach((f) => console.log(`   ✗ ${f.label}: ${f.msg}`));
  }
  console.log('════════════════════════════════════════════════════\n');

  process.exit(failCount > 0 ? 1 : 0);
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
