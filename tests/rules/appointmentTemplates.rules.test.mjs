/**
 * Emulator rules tests — appointment templates (Run 9 A4).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/appointmentTemplates.rules.test.mjs"
 *
 * Contract: flat tenant collection; PERSONAL templates — owner (agent/producing
 * manager) full CRUD on OWN templates (agentId pinned to auth.uid, hasOnly
 * locks the 11-key shape). NO manager read arms (unlike appointments). Upline /
 * peer / unauthenticated reads + writes + deletes all denied.
 */
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  setDoc, deleteDoc, doc, collection, getDocs, getDoc, query, where, addDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'appt-tpl-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const AGENT1 = 'agent1'; // unit um1, branch A
const AGENT2 = 'agent2'; // unit um2, branch B
const UM1 = 'um1';

const T1 = 'tpl-agent1'; // AGENT1's seeded template

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}
function tplRef(db, id, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/appointmentTemplates/${id}`);
}
function validTemplate(agentId, over = {}) {
  return {
    tenantId: TENANT_ID, agentId,
    name: 'Morning FFI block', type: 'FFI',
    startTime: '09:30', durationMin: 60, note: '',
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
    await setDoc(tplRef(db, T1), validTemplate(AGENT1));
  });
}

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  OK ${label}`); passed++; }
  catch (err) { console.error(`  XX ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('appointmentTemplates - Firestore emulator rules tests');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID, firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const agent1Db = testEnv.authenticatedContext(AGENT1, authToken('agent')).firestore();
  const agent2Db = testEnv.authenticatedContext(AGENT2, authToken('agent')).firestore();
  const um1Db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
  const coll = (db) => collection(db, `tenants/${TENANT_ID}/appointmentTemplates`);

  console.log(''); console.log('create:');
  await t('1. Owner creates a valid template -> ALLOW', () =>
    assertSucceeds(addDoc(coll(agent1Db), validTemplate(AGENT1))));
  await t('2. Owner creates a FREE template with freeBlockLabel + apiAmount -> ALLOW', () =>
    assertSucceeds(addDoc(coll(agent1Db), validTemplate(AGENT1, {
      type: 'SALE', apiAmount: 12000, freeBlockLabel: 'Prospecting time',
    }))));
  await t('3. Forged agentId (save for someone else) -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT2))));
  await t('4. Extra key (hasOnly) -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { date: '2026-07-16' }))));
  await t('5. Missing required key (note) -> DENY', () => {
    const d = validTemplate(AGENT1); delete d.note;
    return assertFails(addDoc(coll(agent1Db), d));
  });
  await t('6. name > 60 chars -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { name: 'x'.repeat(61) }))));
  await t('7. Empty name -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { name: '' }))));
  await t('8. Bad type -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { type: 'LUNCH' }))));
  await t('9. Bad startTime format -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { startTime: '9:30' }))));
  await t('10. Zero duration -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { durationMin: 0 }))));
  await t('11. Negative apiAmount -> DENY', () =>
    assertFails(addDoc(coll(agent1Db), validTemplate(AGENT1, { apiAmount: -5 }))));

  console.log(''); console.log('get/list (owner-only — no manager arms):');
  await t('12. Owner gets own template -> ALLOW', () =>
    assertSucceeds(getDoc(tplRef(agent1Db, T1))));
  await t('13. Owner lists own (agentId==uid) -> ALLOW', () =>
    assertSucceeds(getDocs(query(coll(agent1Db), where('agentId', '==', AGENT1)))));
  await t('14. Peer agent gets another agent template -> DENY', () =>
    assertFails(getDoc(tplRef(agent2Db, T1))));
  await t('15. Peer agent lists another agent -> DENY', () =>
    assertFails(getDocs(query(coll(agent2Db), where('agentId', '==', AGENT1)))));
  await t('16. unit_manager lists (no upline read arm) -> DENY', () =>
    assertFails(getDocs(query(coll(um1Db), where('agentUnitId', '==', UM1)))));
  await t('17. unit_manager lists by agentId -> DENY', () =>
    assertFails(getDocs(query(coll(um1Db), where('agentId', '==', AGENT1)))));

  console.log(''); console.log('delete (owner-only):');
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await t('18. Unauthenticated delete -> DENY', () =>
    assertFails(deleteDoc(tplRef(unauthDb, T1))));
  await t('19. Peer agent deletes another agent template -> DENY', () =>
    assertFails(deleteDoc(tplRef(agent2Db, T1))));
  await t('20. unit_manager (upline) delete -> DENY', () =>
    assertFails(deleteDoc(tplRef(um1Db, T1))));
  await t('21. Owner deletes own template -> ALLOW', () =>
    assertSucceeds(deleteDoc(tplRef(agent1Db, T1))));

  await testEnv.cleanup();
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed (21 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
