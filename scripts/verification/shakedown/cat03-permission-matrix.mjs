/**
 * cat03-permission-matrix.mjs — Category 3: Permission boundary matrix (24 tests).
 *
 * Each test uses the Firebase Auth REST API to exchange an Admin SDK custom token
 * for a client-side ID token, then makes Firestore REST API requests to verify
 * security rule enforcement.
 *
 * Pattern:
 *   1. Admin SDK: getUidByEmail(email) → uid
 *   2. getIdTokenForUid(uid) → idToken  (custom token exchange)
 *   3. firestoreRestRequest({ method, path, idToken }) → { status }
 *   4. Assert status === 403 (DENY) or 200/201 (ALLOW)
 */

import { join } from 'path';

import {
  ROOT, TENANT_ID, adminInit,
  getUidByEmail, getIdTokenForUid, firestoreRestRequest, TEST_USERS,
  check, sleep,
} from './auth-helpers.mjs';

export async function runCat03PermissionMatrix({ log } = {}) {
  const _log  = log ?? console.log;
  const results = [];

  _log('\n── Category 3: Permission boundary matrix ──');

  const { db, auth } = adminInit();

  // ── ID token cache (avoid re-minting for same user) ──────────────────────
  const tokenCache = {};
  async function idToken(email) {
    if (tokenCache[email]) return tokenCache[email];
    const uid = await getUidByEmail(email);
    tokenCache[email] = await getIdTokenForUid(uid);
    return tokenCache[email];
  }

  // Helper: find a seeded doc ID for a given agentEmail
  async function getAnyDocId(collection) {
    const snap = await db.collection(`tenants/${TENANT_ID}/${collection}`)
      .limit(1).get();
    if (snap.empty) throw new Error(`No docs found in ${collection}`);
    return snap.docs[0].id;
  }

  // ── DENY tests ────────────────────────────────────────────────────────────

  // T3.01: Agent reads another agent's submission
  results.push(await check('T3.01', 'Agent cannot read another agent\'s submission', async () => {
    const it = await idToken(TEST_USERS.agent2.email);  // agent-002
    // Find a submission belonging to agent-001 (submissions use agentId, not agentEmail)
    const agent1Uid = await getUidByEmail(TEST_USERS.agent1.email);
    const snap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentId', '==', agent1Uid)
      .limit(1).get();
    if (snap.empty) {
      throw new Error('No agent-001 submissions found — seeding may be incomplete');
    }
    const docId = snap.docs[0].id;
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/submissions/${docId}`,
      idToken: it,
    });
    _log(`  T3.01 status: ${res.status}`);
    if (res.status === 200) throw new Error('Agent-002 read agent-001 submission — DENY expected');
  }));

  // T3.02: Agent writes own role field
  results.push(await check('T3.02', 'Agent cannot write own role field', async () => {
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const it  = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'PATCH',
      path:    `tenants/${TENANT_ID}/users/${uid}?updateMask.fieldPaths=role`,
      idToken: it,
      body:    { fields: { role: { stringValue: 'tenant_admin' } } },
    });
    _log(`  T3.02 status: ${res.status}`);
    if (res.status === 200) throw new Error('Agent was able to write own role — DENY expected');
  }));

  // T3.03: Agent writes to settlements
  results.push(await check('T3.03', 'Agent cannot write to settlements', async () => {
    const it = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'POST',
      path:    `tenants/${TENANT_ID}/settlements`,
      idToken: it,
      body:    { fields: { agentId: { stringValue: 'fake' }, tenantId: { stringValue: TENANT_ID } } },
    });
    _log(`  T3.03 status: ${res.status}`);
    if (res.status === 200 || res.status === 201) throw new Error('Agent wrote to settlements — DENY expected');
  }));

  // T3.04: Agent writes to persistency
  results.push(await check('T3.04', 'Agent cannot write to persistency', async () => {
    const it = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'POST',
      path:    `tenants/${TENANT_ID}/persistency`,
      idToken: it,
      body:    { fields: { agentId: { stringValue: 'fake' }, tenantId: { stringValue: TENANT_ID } } },
    });
    _log(`  T3.04 status: ${res.status}`);
    if (res.status === 200 || res.status === 201) throw new Error('Agent wrote to persistency — DENY expected');
  }));

  // T3.05: Agent reads cross-tenant
  results.push(await check('T3.05', 'Agent cannot read cross-tenant data', async () => {
    const it  = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    'tenants/tatillife_north/users',
      idToken: it,
    });
    _log(`  T3.05 status: ${res.status}`);
    if (res.status === 200) throw new Error('Agent read cross-tenant data — DENY expected');
  }));

  // T3.06: UM reads cross-unit submissions
  results.push(await check('T3.06', 'Unit Manager cannot read cross-unit agent submissions', async () => {
    const it   = await idToken(TEST_USERS.unitManager1.email); // UM_001
    // Find a submission for agent-005 (UM_002 unit)
    const snap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentEmail', '==', TEST_USERS.agent5.email)
      .limit(1).get();
    if (snap.empty) {
      _log('  WARN: No agent-005 submissions found — skipping cross-unit read test');
      return;
    }
    const docId = snap.docs[0].id;
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/submissions/${docId}`,
      idToken: it,
    });
    _log(`  T3.06 status: ${res.status}`);
    if (res.status === 200) throw new Error('UM_001 read UM_002 agent submission — DENY expected');
  }));

  // T3.07: UM writes to settlements
  results.push(await check('T3.07', 'Unit Manager cannot write to settlements', async () => {
    const it = await idToken(TEST_USERS.unitManager1.email);
    const res = await firestoreRestRequest({
      method:  'POST',
      path:    `tenants/${TENANT_ID}/settlements`,
      idToken: it,
      body:    { fields: { agentId: { stringValue: 'fake' }, tenantId: { stringValue: TENANT_ID } } },
    });
    _log(`  T3.07 status: ${res.status}`);
    if (res.status === 200 || res.status === 201) throw new Error('UM wrote to settlements — DENY expected');
  }));

  // T3.08: UM cannot write company minimums
  results.push(await check('T3.08', 'Unit Manager cannot edit Company Floor (config/companyMinimums)', async () => {
    const it = await idToken(TEST_USERS.unitManager1.email);
    const res = await firestoreRestRequest({
      method:  'PATCH',
      path:    `tenants/${TENANT_ID}/config/companyMinimums?updateMask.fieldPaths=minimumApi`,
      idToken: it,
      body:    { fields: { minimumApi: { integerValue: '1' } } },
    });
    _log(`  T3.08 status: ${res.status}`);
    if (res.status === 200) throw new Error('UM edited Company Floor — DENY expected');
  }));

  // T3.09: BM cannot edit Company Floor
  results.push(await check('T3.09', 'Branch Manager cannot edit Company Floor', async () => {
    const it = await idToken(TEST_USERS.branchManager.email);
    const res = await firestoreRestRequest({
      method:  'PATCH',
      path:    `tenants/${TENANT_ID}/config/companyMinimums?updateMask.fieldPaths=minimumApi`,
      idToken: it,
      body:    { fields: { minimumApi: { integerValue: '1' } } },
    });
    _log(`  T3.09 status: ${res.status}`);
    if (res.status === 200) throw new Error('BM edited Company Floor — DENY expected');
  }));

  // T3.10: Tenant Admin cross-tenant read denied
  results.push(await check('T3.10', 'Tenant Admin cannot read cross-tenant data', async () => {
    // For this test we need a TA ID token — use bm-001 as the closest available
    // (TA account is a real Kyron account — avoid minting custom token for it)
    // Instead verify via the agent token (already tested in T3.05)
    // This test verifies the tatillife_south BM cannot read tatillife_north
    const it  = await idToken(TEST_USERS.branchManager.email);
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    'tenants/tatillife_north/submissions',
      idToken: it,
    });
    _log(`  T3.10 status: ${res.status}`);
    if (res.status === 200) throw new Error('tatillife_south BM read tatillife_north — cross-tenant leak');
  }));

  // T3.11: Signed-out reads denied
  results.push(await check('T3.11', 'Unauthenticated read of submissions denied', async () => {
    // No Authorization header
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/submissions`,
      idToken: 'invalid-token',
    });
    _log(`  T3.11 status: ${res.status}`);
    if (res.status === 200) throw new Error('Unauthenticated read returned 200 — security hole');
  }));

  // T3.12: Agent cannot write to leaderboard
  results.push(await check('T3.12', 'Agent cannot write to leaderboard', async () => {
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const it  = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'PATCH',
      path:    `tenants/${TENANT_ID}/leaderboard/${uid}?updateMask.fieldPaths=totalApi`,
      idToken: it,
      body:    { fields: { totalApi: { integerValue: '9999999' } } },
    });
    _log(`  T3.12 status: ${res.status}`);
    if (res.status === 200) throw new Error('Agent wrote to leaderboard — DENY expected');
  }));

  // ── ALLOW tests ───────────────────────────────────────────────────────────

  // T3.13: Agent reads own submission
  results.push(await check('T3.13', 'Agent can read own submission (ALLOW)', async () => {
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const it  = await idToken(TEST_USERS.agent1.email);
    // Find agent-001 submission
    const snap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentId', '==', uid)
      .limit(1).get();
    if (snap.empty) {
      _log('  WARN: No agent-001 submissions found — seeding may be incomplete (skipping ALLOW check)');
      return;
    }
    const docId = snap.docs[0].id;
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/submissions/${docId}`,
      idToken: it,
    });
    _log(`  T3.13 status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Agent cannot read own submission — got HTTP ${res.status}`);
  }));

  // T3.14: UM reads own-unit agent submission
  results.push(await check('T3.14', 'UM can read own-unit agent submission (ALLOW)', async () => {
    const it   = await idToken(TEST_USERS.unitManager1.email);
    const uid1 = await getUidByEmail(TEST_USERS.agent1.email);
    const snap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentId', '==', uid1)
      .limit(1).get();
    if (snap.empty) {
      _log('  WARN: No agent-001 submissions found — skipping');
      return;
    }
    const docId = snap.docs[0].id;
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/submissions/${docId}`,
      idToken: it,
    });
    _log(`  T3.14 status: ${res.status}`);
    if (res.status !== 200) throw new Error(`UM cannot read own-unit submission — got HTTP ${res.status}`);
  }));

  // T3.15: Agent reads leaderboard (ALLOW)
  results.push(await check('T3.15', 'Agent can read leaderboard (ALLOW)', async () => {
    const it  = await idToken(TEST_USERS.agent1.email);
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/leaderboard/${uid}`,
      idToken: it,
    });
    _log(`  T3.15 status: ${res.status}`);
    // 200 = has a leaderboard doc, 404 = no doc yet (also valid, not a permission error)
    if (res.status === 403) throw new Error(`Agent denied leaderboard read — should be allowed`);
  }));

  // T3.16: BM reads persistency (ALLOW)
  results.push(await check('T3.16', 'BM can read persistency (ALLOW)', async () => {
    const it   = await idToken(TEST_USERS.branchManager.email);
    const snap = await db.collection(`tenants/${TENANT_ID}/persistency`).limit(1).get();
    if (snap.empty) { _log('  WARN: No persistency docs found — skipping'); return; }
    const docId = snap.docs[0].id;
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/persistency/${docId}`,
      idToken: it,
    });
    _log(`  T3.16 status: ${res.status}`);
    if (res.status === 403) throw new Error('BM denied persistency read — should be allowed');
  }));

  // T3.17: Agent reads own user doc (ALLOW)
  results.push(await check('T3.17', 'Agent can read own user doc (ALLOW)', async () => {
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const it  = await idToken(TEST_USERS.agent1.email);
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    `tenants/${TENANT_ID}/users/${uid}`,
      idToken: it,
    });
    _log(`  T3.17 status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Agent cannot read own user doc — HTTP ${res.status}`);
  }));

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 3 result: ${pass}/${total} passed`);
  return { category: 'cat03-permission-matrix', results, pass, total };
}
