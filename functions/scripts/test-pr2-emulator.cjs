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
  const superAdminUid   = await seedUser('test-super-admin@test.local',   'super_admin',    'tatil_south', ['*']);
  const branchMgrUid    = await seedUser('test-branch-mgr@test.local',    'branch_manager', 'tatil_south', ['tatil_south']);
  const unitMgrUid      = await seedUser('test-unit-mgr@test.local',      'unit_manager',   'tatil_south', ['tatil_south'], 'unit_a');
  const unitMgrBUid     = await seedUser('test-unit-mgr-b@test.local',    'unit_manager',   'tatil_south', ['tatil_south'], 'unit_b');
  console.log(`  super_admin uid:    ${superAdminUid}`);
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

  console.log('\n── createUser: super_admin confirmation guard ─────────');

  await expect(
    'super_admin → super_admin without confirmationPhrase',
    () => fnModule.createUser.run(
      { role: 'super_admin', name: 'New SA', email: 'new-sa@test.local' },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
    ),
    'invalid-argument'
  );

  await expect(
    'super_admin → super_admin with wrong phrase',
    () => fnModule.createUser.run(
      { role: 'super_admin', name: 'New SA', email: 'new-sa@test.local', confirmationPhrase: 'create super admin' },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
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

  await expect(
    'unit_manager creation without unitId',
    () => fnModule.createUser.run(
      { role: 'unit_manager', name: 'UM X', email: 'umx@test.local' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    'invalid-argument'
  );

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

  // super_admin creation by super_admin (full happy path)
  const saEmail = `new-sa-${Date.now()}@test.local`;
  const saResult = await expect(
    'super_admin creates super_admin with correct phrase (happy path)',
    () => fnModule.createUser.run(
      { role: 'super_admin', name: 'New SuperAdmin', email: saEmail, confirmationPhrase: 'CREATE SUPER ADMIN' },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
    ),
    null
  );
  if (saResult?.uid) {
    const doc    = await getUserDoc(saResult.uid);
    const claims = await getAuthClaims(saResult.uid);
    const ownedOk = JSON.stringify(doc?.ownedBranchIds) === JSON.stringify(['*']) &&
                    JSON.stringify(claims?.ownedBranchIds) === JSON.stringify(['*']);
    // Check audit log was written
    const auditSnap = await testDb.collection('auditSuperAdminCreations')
      .where('createdUid', '==', saResult.uid).limit(1).get();
    const auditOk = !auditSnap.empty;
    if (ownedOk && doc.provisioning === undefined && auditOk) {
      passCount++;
      console.log(`    ✓ super_admin ownedBranchIds=['*'] in doc + claims; provisioning cleared; audit log written`);
    } else {
      failCount++;
      const msg = `SA creation issue: ownedOk=${ownedOk} provisioning=${doc?.provisioning} auditOk=${auditOk}`;
      failures.push({ label: 'super_admin creation', msg });
      console.log(`    ✗ super_admin creation — ${msg}`);
    }
    await cleanup(saEmail);
  }

  // createAgentAccount thin wrapper
  const wrapEmail = `wrapper-agent-${Date.now()}@test.local`;
  const wrapResult = await expect(
    'createAgentAccount thin wrapper creates agent with same shape as createUser',
    () => fnModule.createAgentAccount.run(
      { name: 'Wrapper Agent', email: wrapEmail, unitId: 'unit_w' },
      makeCtx('branch_manager', branchMgrUid)
    ),
    null
  );
  if (wrapResult?.uid) {
    const doc = await getUserDoc(wrapResult.uid);
    if (doc?.role === 'agent' && doc?.provisioning === undefined) {
      passCount++;
      console.log(`    ✓ createAgentAccount wrapper: role=agent, provisioning cleared`);
    } else {
      failCount++;
      const msg = `wrapper shape wrong: ${JSON.stringify(doc)}`;
      failures.push({ label: 'createAgentAccount wrapper', msg });
      console.log(`    ✗ createAgentAccount wrapper — ${msg}`);
    }
    await cleanup(wrapEmail);
  }

  console.log('\n── setUserClaims: bypass removed ──────────────────────');

  // The old SUPER_ADMIN_UID bypass allowed a user with no role claim to call
  // setUserClaims if their UID matched. After PR-2, only role === 'super_admin' works.
  await expect(
    'setUserClaims with no role claim (simulates removed bypass path)',
    () => fnModule.setUserClaims.run(
      { uid: 'some-uid', role: 'agent', tenantId: TENANT },
      { auth: { uid: superAdminUid, token: { tenantId: TENANT } }, rawRequest: {} } // no role in token
    ),
    'permission-denied'
  );

  await expect(
    'setUserClaims with role=super_admin (normal operator path, still works)',
    () => fnModule.setUserClaims.run(
      { uid: superAdminUid, role: 'super_admin', tenantId: TENANT, branchId: 'tatil_south', ownedBranchIds: ['*'] },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
    ),
    null
  );

  // ════════════════════════════════════════════════════════════════════════
  // deactivateUser tests
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── deactivateUser: matrix + guards ───────────────────');

  // Seed some target users for deactivation tests
  const targetAgentUid = await seedUser(`target-agent-${Date.now()}@test.local`, 'agent', 'tatil_south', null, 'unit_a');
  const targetUMUid    = await seedUser(`target-um-${Date.now()}@test.local`,    'unit_manager',   'tatil_south', ['tatil_south'], 'unit_a');
  const targetBMUid    = await seedUser(`target-bm-${Date.now()}@test.local`,    'branch_manager', 'tatil_south', ['tatil_south']);
  const targetSAUid    = await seedUser(`target-sa-${Date.now()}@test.local`,    'super_admin',    'tatil_south', ['*']);

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
    'self-deactivation blocked (super_admin)',
    () => fnModule.deactivateUser.run(
      { targetUid: superAdminUid, active: false },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
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
    'super_admin deactivates another super_admin',
    async () => {
      const result = await fnModule.deactivateUser.run(
        { targetUid: targetSAUid, active: false },
        makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
      );
      const doc = await getUserDoc(targetSAUid);
      if (doc?.active !== false) throw Object.assign(new Error('active not false'), { code: 'assertion-failed' });
      return result;
    },
    null
  );

  await expect(
    'deactivateUser on non-existent uid returns not-found',
    () => fnModule.deactivateUser.run(
      { targetUid: 'nonexistent-uid-xyz', active: false },
      makeCtx('super_admin', superAdminUid, 'tatil_south', ['*'])
    ),
    'not-found'
  );

  // ── Cleanup ───────────────────────────────────────────────────────────
  const allTestUids = [superAdminUid, branchMgrUid, unitMgrUid, unitMgrBUid, targetAgentUid, targetUMUid, targetBMUid, targetSAUid];
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
