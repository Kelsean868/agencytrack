/**
 * Emulator rules tests — recruitingCandidates (Tier-2 2.2 kanban CRM).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/recruitingCandidates.rules.test.mjs"
 *
 * Contract under test (firestore.rules, Tier-2 2.2 block):
 *   - Managers only; creator must self-own (ownerUid == auth.uid).
 *   - Owner may edit but not self-transfer ownerUid; an in-scope senior
 *     (BM same-branch / SM+ / TA) may edit AND reassign.
 *   - branchId immutable in v1; stage enum locked to the 8 design stages;
 *     status active|archived; note <= 2000.
 *   - Lists: UM by ownerUid; BM by own branchId; SM+/TA tenant-wide.
 *   - No delete (archive instead).
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  setDoc, updateDoc, doc, collection, getDocs, getDoc, query, where, addDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'rc-rules-test-tenant';
const OTHER_TENANT = 'rc-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const UM1 = 'um1'; // branch A
const UM3 = 'um3'; // branch A (peer of UM1)
const BM1 = 'bm1'; // branch A
const BM2 = 'bm2'; // branch B
const SM1 = 'sm1';
const AGENT1 = 'agent1';

const C1 = 'cand-um1-a'; // owned by UM1, branch A
const C2 = 'cand-bm1-a'; // owned by BM1, branch A

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function candRef(db, id, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/recruitingCandidates/${id}`);
}

function validCandidate(ownerUid, ownerName, branchId, over = {}) {
  return {
    tenantId: TENANT_ID,
    branchId,
    ownerUid,
    ownerName,
    name: 'Jovan Phillips',
    stage: 'sourced',
    status: 'active',
    source: 'Agent referral',
    referrerName: 'Marsha Singh',
    note: 'Named by Marsha - not yet contacted.',
    stageChangedAt: new Date(),
    lastTouchAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const userDoc = (uid, role, branchId, unitId) => ({ uid, role, tenantId: TENANT_ID, branchId, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM1}`), userDoc(UM1, 'unit_manager', BRANCH_A, UM1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM3}`), userDoc(UM3, 'unit_manager', BRANCH_A, UM3));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM1}`), userDoc(BM1, 'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM2}`), userDoc(BM2, 'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1}`), userDoc(SM1, 'sales_manager', null, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT1}`), userDoc(AGENT1, 'agent', BRANCH_A, UM1));

    await setDoc(candRef(db, C1), validCandidate(UM1, 'UM One', BRANCH_A));
    await setDoc(candRef(db, C2), validCandidate(BM1, 'BM One', BRANCH_A, { stage: 'interview' }));
  });
}

let passed = 0;
let failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  OK ${label}`); passed++; }
  catch (err) { console.error(`  XX ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('recruitingCandidates - Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  console.log('');
  console.log('create:');
  await t('1. UM creates self-owned candidate -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertSucceeds(addDoc(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), validCandidate(UM1, 'UM One', BRANCH_A)));
  });
  await t('2. Agent creates -> DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1, authToken('agent')).firestore();
    await assertFails(addDoc(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), validCandidate(AGENT1, 'Agent One', BRANCH_A)));
  });
  await t('3. UM creates with ownerUid != self -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertFails(addDoc(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), validCandidate(UM3, 'UM Three', BRANCH_A)));
  });
  await t('4. Invalid stage value -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertFails(addDoc(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), validCandidate(UM1, 'UM One', BRANCH_A, { stage: 'ghosted' })));
  });
  await t('5. Oversize note (>2000) -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertFails(addDoc(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), validCandidate(UM1, 'UM One', BRANCH_A, { note: 'x'.repeat(2001) })));
  });

  console.log('');
  console.log('update:');
  await t('6. Owner UM moves own candidate stage -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertSucceeds(updateDoc(candRef(db, C1), { stage: 'contacted', stageChangedAt: new Date(), lastTouchAt: new Date(), updatedAt: new Date() }));
  });
  await t('7. Owner self-transfers ownerUid -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(candRef(db, C1), { ownerUid: UM3, ownerName: 'UM Three', updatedAt: new Date() }));
  });
  await t('8. BM same-branch edits UM candidate -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(candRef(db, C1), { note: 'BM coaching note', updatedAt: new Date() }));
  });
  await t('9. BM same-branch reassigns ownerUid -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(candRef(db, C1), { ownerUid: UM3, ownerName: 'UM Three', updatedAt: new Date() }));
  });
  await t('10. BM cross-branch edit -> DENY', async () => {
    const db = testEnv.authenticatedContext(BM2, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(candRef(db, C2), { note: 'cross-branch touch', updatedAt: new Date() }));
  });
  await t('11. Peer UM (same branch, not owner) edit -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM3, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(candRef(db, C2), { note: 'peer poke', updatedAt: new Date() }));
  });
  await t('12. branchId mutation -> DENY (immutable v1)', async () => {
    const db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(candRef(db, C2), { branchId: BRANCH_B, updatedAt: new Date() }));
  });
  await t('13. SM edits any candidate tenant-wide -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
    await assertSucceeds(updateDoc(candRef(db, C2), { stage: 'assessment', stageChangedAt: new Date(), updatedAt: new Date() }));
  });
  await t('14. Owner archives own candidate -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(candRef(db, C2), { status: 'archived', updatedAt: new Date() }));
  });

  console.log('');
  console.log('get/list:');
  await t('15. UM lists own candidates (ownerUid==uid) -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM3, authToken('unit_manager')).firestore();
    await assertSucceeds(getDocs(query(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), where('ownerUid', '==', UM3))));
  });
  await t('16. UM lists branch-wide -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager')).firestore();
    await assertFails(getDocs(query(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), where('branchId', '==', BRANCH_A))));
  });
  await t('17. BM lists own branch -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1, authToken('branch_manager')).firestore();
    await assertSucceeds(getDocs(query(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), where('branchId', '==', BRANCH_A))));
  });
  await t('18. BM lists other branch -> DENY', async () => {
    const db = testEnv.authenticatedContext(BM2, authToken('branch_manager')).firestore();
    await assertFails(getDocs(query(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`), where('branchId', '==', BRANCH_A))));
  });
  await t('19. SM tenant-wide list -> ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
    await assertSucceeds(getDocs(collection(db, `tenants/${TENANT_ID}/recruitingCandidates`)));
  });
  await t('20. Cross-tenant get -> DENY', async () => {
    const db = testEnv.authenticatedContext(UM1, authToken('unit_manager', OTHER_TENANT)).firestore();
    await assertFails(getDoc(candRef(db, C1)));
  });

  await testEnv.cleanup();
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed (20 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
