/**
 * Emulator rules tests — appointments (Tier-3 3.2 planner).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/appointments.rules.test.mjs"
 *
 * Contract: flat tenant collection; owner (agent/producing-manager) creates/
 * updates OWN appointments (agentId pinned to auth.uid, full validApptWrite
 * shape); upline READ-ONLY (UM own unit via agentUnitId, BM own branch via
 * caller's user-doc branchId, SM+/TA tenant-wide); split list arms; no deletes.
 */
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  setDoc, updateDoc, deleteDoc, doc, collection, getDocs, getDoc, query, where, addDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'appt-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const AGENT1 = 'agent1'; // unit um1, branch A
const AGENT2 = 'agent2'; // unit um2, branch B
const UM1 = 'um1';
const BM1 = 'bm1';
const BM2 = 'bm2';
const SM1 = 'sm1';

const A1 = 'appt-agent1';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}
function apptRef(db, id, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/appointments/${id}`);
}
function validAppt(agentId, unitId, branchId, over = {}) {
  return {
    tenantId: TENANT_ID, agentId, agentUnitId: unitId, agentBranchId: branchId,
    date: '2026-07-13', startTime: '09:30', durationMin: 60,
    type: 'FFI', status: 'scheduled', note: 'First fact-find',
    prospectId: null, freeBlockLabel: null, apiAmount: null, rescheduledToId: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const userDoc = (uid, role, branchId, unitId) => ({ uid, role, tenantId: TENANT_ID, branchId, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT1}`), userDoc(AGENT1, 'agent', BRANCH_A, UM1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT2}`), userDoc(AGENT2, 'agent', BRANCH_B, 'um2'));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM1}`), userDoc(UM1, 'unit_manager', BRANCH_A, UM1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM1}`), userDoc(BM1, 'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM2}`), userDoc(BM2, 'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1}`), userDoc(SM1, 'sales_manager', null, null));
    await setDoc(apptRef(db, A1), validAppt(AGENT1, UM1, BRANCH_A));
  });
}

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  OK ${label}`); passed++; }
  catch (err) { console.error(`  XX ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('appointments - Firestore emulator rules tests');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID, firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const agent1Db = testEnv.authenticatedContext(AGENT1, authToken('agent')).firestore();
  const agent2Db = testEnv.authenticatedContext(AGENT2, authToken('agent')).firestore();
  const um1Db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
  const bm1Db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
  const bm2Db = testEnv.authenticatedContext(BM2, authToken('branch_manager')).firestore();
  const sm1Db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
  const coll = (db) => collection(db, `tenants/${TENANT_ID}/appointments`);

  console.log(''); console.log('create/update:');
  await t('1. Agent creates own appointment -> ALLOW', () =>
    assertSucceeds(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A))));
  await t('2. Agent forges agentId (books for someone else) -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT2, 'um2', BRANCH_B))));
  await t('3. Invalid type -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { type: 'LUNCH' }))));
  await t('4. Invalid status -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { status: 'ghosted' }))));
  await t('5. Bad date format -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { date: '13-07-2026' }))));
  await t('6. Zero duration -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { durationMin: 0 }))));
  await t('7. Owner updates own appt (postpone + link) -> ALLOW', () =>
    assertSucceeds(setDoc(apptRef(agent1Db, A1),
      validAppt(AGENT1, UM1, BRANCH_A, { status: 'postponed', rescheduledToId: 'appt-next', updatedAt: new Date() }))));
  await t('8. Peer agent updates another agent appt -> DENY', () =>
    assertFails(updateDoc(apptRef(agent2Db, A1), { note: 'peer poke', updatedAt: new Date() })));
  await t('9. UM (upline) attempts a write -> DENY (read-only upline)', () =>
    assertFails(updateDoc(apptRef(um1Db, A1), { note: 'coach note', updatedAt: new Date() })));
  await t('10. SALE with apiAmount -> ALLOW', () =>
    assertSucceeds(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { type: 'SALE', apiAmount: 12000 }))));
  await t('11. Negative apiAmount -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validAppt(AGENT1, UM1, BRANCH_A, { type: 'SALE', apiAmount: -5 }))));

  console.log(''); console.log('get/list:');
  await t('12. Owner lists own (agentId==uid) -> ALLOW', () =>
    assertSucceeds(getDocs(query(coll(agent1Db), where('agentId', '==', AGENT1)))));
  await t('13. UM lists own unit -> ALLOW', () =>
    assertSucceeds(getDocs(query(coll(um1Db), where('agentUnitId', '==', UM1)))));
  await t('14. BM lists own branch -> ALLOW', () =>
    assertSucceeds(getDocs(query(coll(bm1Db), where('agentBranchId', '==', BRANCH_A)))));
  await t('15. BM lists OTHER branch -> DENY', () =>
    assertFails(getDocs(query(coll(bm2Db), where('agentBranchId', '==', BRANCH_A)))));
  await t('16. SM tenant-wide list -> ALLOW', () =>
    assertSucceeds(getDocs(coll(sm1Db))));
  await t('17. Agent lists ANOTHER agent -> DENY', () =>
    assertFails(getDocs(query(coll(agent2Db), where('agentId', '==', AGENT1)))));
  await t('18. UM gets a unit appt doc -> ALLOW', () =>
    assertSucceeds(getDoc(apptRef(um1Db, A1))));
  await t('19. Cross-branch BM gets doc -> DENY', () =>
    assertFails(getDoc(apptRef(bm2Db, A1))));
  await t('20. Owner delete -> DENY (no hard deletes)', () =>
    assertFails(deleteDoc(apptRef(agent1Db, A1))));

  await testEnv.cleanup();
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed (20 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
