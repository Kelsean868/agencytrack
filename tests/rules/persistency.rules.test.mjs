/**
 * Emulator rules tests — persistency collection (E3 persistency entry path).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/persistency.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (22 cases):
 *   allow list
 *     1. In-tenant signed-in user lists → ALLOW (intentionally permissive)
 *     2. Cross-tenant auth lists → DENY
 *
 *   allow get (existing doc)
 *     3. Agent reads own persistency doc → ALLOW
 *     4. Agent reads another agent's doc → DENY
 *     5. BM reads agent doc in same branch → ALLOW
 *     6. BM reads agent doc in different branch → DENY
 *     7. UM reads agent doc in same unit → ALLOW
 *     8. UM reads agent doc in different unit → DENY
 *
 *   allow get (null resource — non-existent doc)
 *     9. Pre-write getDoc on non-existent path → ALLOW (resource == null arm)
 *    10. Cross-tenant auth on non-existent path → DENY
 *
 *   allow create / update
 *    11. BM creates doc for agent in same branch (valid inputs) → ALLOW
 *    12. BM creates doc for agent in different branch → DENY
 *    13. Agent creates own persistency doc (valid inputs) → ALLOW
 *    14. Agent creates doc for another agent → DENY
 *    15. BM creates doc with negative businessPlaced → DENY (invalid inputs)
 *    16. UM create → DENY (UM not in create/update allow-list)
 *    19. BM creates doc with negative decreases → DENY (new 24-month input)
 *    20. BM creates doc with decreases: 0 → ALLOW
 *    21. BM creates doc with NO decreases at all → ALLOW (legacy month)
 *    22. BM creates doc with a positive decreases → ALLOW
 *
 *   allow delete
 *    17. BM delete → DENY (allow delete: if false)
 *    18. Tenant_admin delete → DENY (allow delete: if false)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, doc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'persistency-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const TA_ID     = 'ta1';       // tenant_admin
const BM1_ID    = 'bm1';       // branch-a BM
const BM2_ID    = 'bm2';       // branch-b BM
const UM1_ID    = 'um1';       // unit-a UM (branch-a)
const AGENT1_ID = 'agent1';    // branch-a, unit-a
const AGENT2_ID = 'agent2';    // branch-b, unit-b
const AGENT_X   = 'agent-x';   // cross-tenant (different tenantId claim)

// Persistency doc IDs
const P1_ID = `${AGENT1_ID}_2026_01`;  // agent1's January 2026
const P2_ID = `${AGENT2_ID}_2026_01`;  // agent2's January 2026
const P1_NEW_ID = `${AGENT1_ID}_2026_02`; // non-existent (for null-resource test)

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function userRef(db, uid, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/users/${uid}`);
}
function persistRef(db, docId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/persistency/${docId}`);
}

function validDoc(agentId, writtenByRole, writtenById) {
  return {
    agentId,
    tenantId:         TENANT_ID,
    year:             2026,
    month:            1,
    persistency:      85.0,
    businessPlaced:   10,
    notTakens:        1,
    incPPPs:          0,
    lumpsums100:      0,
    lapses:           0,
    reinstatements:   0,
    lastEditedByRole: writtenByRole,
    lastEditedBy:     writtenById,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const user = (uid, role, branchId, unitId, tid = TENANT_ID) => ({
      uid, role, tenantId: tid, branchId, unitId, name: `User ${uid}`, active: true,
    });

    // Users
    await setDoc(userRef(db, TA_ID),     user(TA_ID,     'tenant_admin',   'branch-a', null));
    await setDoc(userRef(db, BM1_ID),    user(BM1_ID,    'branch_manager', 'branch-a', null));
    await setDoc(userRef(db, BM2_ID),    user(BM2_ID,    'branch_manager', 'branch-b', null));
    await setDoc(userRef(db, UM1_ID),    user(UM1_ID,    'unit_manager',   'branch-a', UM1_ID));
    await setDoc(userRef(db, AGENT1_ID), user(AGENT1_ID, 'agent',          'branch-a', UM1_ID));
    await setDoc(userRef(db, AGENT2_ID), user(AGENT2_ID, 'agent',          'branch-b', 'um2'));

    // Persistency docs
    await setDoc(persistRef(db, P1_ID), validDoc(AGENT1_ID, 'branch_manager', BM1_ID));
    await setDoc(persistRef(db, P2_ID), validDoc(AGENT2_ID, 'branch_manager', BM2_ID));
  });
}

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.slice(0, 200) ?? err}`);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Persistency — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore:  { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── allow list ──────────────────────────────────────────────────────────────
  console.log('\nallow list:');

  await t('1. In-tenant agent lists persistency → ALLOW (intentionally permissive)', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDocs(collection(db, `tenants/${TENANT_ID}/persistency`)));
  });

  await t('2. Cross-tenant auth lists persistency → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDocs(collection(db, `tenants/${TENANT_ID}/persistency`)));
  });

  // ── allow get (existing doc) ────────────────────────────────────────────────
  console.log('\nallow get (existing doc):');

  await t('3. Agent reads own persistency doc → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDoc(persistRef(db, P1_ID)));
  });

  await t('4. Agent reads another agent\'s doc → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(getDoc(persistRef(db, P2_ID)));
  });

  await t('5. BM reads agent doc in same branch (branch-a) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(persistRef(db, P1_ID)));
  });

  await t('6. BM reads agent doc in different branch → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(getDoc(persistRef(db, P2_ID)));
  });

  await t('7. UM reads agent doc in same unit (um1) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(persistRef(db, P1_ID)));
  });

  await t('8. UM reads agent doc in different unit (um2) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(persistRef(db, P2_ID)));
  });

  // ── allow get (null resource) ───────────────────────────────────────────────
  console.log('\nallow get (null resource / non-existent doc):');

  await t('9. Pre-write getDoc on non-existent path → ALLOW (resource == null arm)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(persistRef(db, P1_NEW_ID)));
  });

  await t('10. Cross-tenant auth on non-existent path → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(persistRef(db, P1_NEW_ID)));
  });

  // ── allow create / update ───────────────────────────────────────────────────
  console.log('\nallow create / update:');

  await t('11. BM creates doc for agent in same branch (valid inputs) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(
      persistRef(db, `${AGENT1_ID}_2026_03`),
      validDoc(AGENT1_ID, 'branch_manager', BM1_ID),
    ));
  });

  await t('12. BM creates doc for agent in different branch → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(setDoc(
      persistRef(db, `${AGENT2_ID}_2026_03`),
      validDoc(AGENT2_ID, 'branch_manager', BM1_ID),
    ));
  });

  await t('13. Agent creates own persistency doc (valid inputs) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(setDoc(
      persistRef(db, `${AGENT1_ID}_2026_04`),
      validDoc(AGENT1_ID, 'agent', AGENT1_ID),
    ));
  });

  await t('14. Agent creates doc for another agent → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(setDoc(
      persistRef(db, `${AGENT2_ID}_2026_04`),
      validDoc(AGENT2_ID, 'agent', AGENT1_ID),
    ));
  });

  await t('15. BM creates doc with negative businessPlaced → DENY (invalid inputs)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const invalidDoc = { ...validDoc(AGENT1_ID, 'branch_manager', BM1_ID), businessPlaced: -1 };
    await assertFails(setDoc(persistRef(db, `${AGENT1_ID}_2026_05`), invalidDoc));
  });

  await t('16. UM create → DENY (UM not in create/update allow-list)', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(
      persistRef(db, `${AGENT1_ID}_2026_06`),
      { ...validDoc(AGENT1_ID, 'unit_manager', UM1_ID) },
    ));
  });

  // decreases — the seventh money input (Tatil memo, 29 Aug 2026).
  //
  // The rule clause is "absent OR >= 0". These cases pin every branch of it,
  // and case 21 is the one that matters most: it proves the additive guard did
  // NOT break writes for pre-September documents, which never carry the field.
  console.log('\ndecreases (24-month model input):');

  await t('19. BM creates doc with negative decreases → DENY (invalid input)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const invalidDoc = { ...validDoc(AGENT1_ID, 'branch_manager', BM1_ID), decreases: -1 };
    await assertFails(setDoc(persistRef(db, `${AGENT1_ID}_2026_09`), invalidDoc));
  });

  await t('20. BM creates doc with decreases: 0 → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const validWithZero = { ...validDoc(AGENT1_ID, 'branch_manager', BM1_ID), decreases: 0 };
    await assertSucceeds(setDoc(persistRef(db, `${AGENT1_ID}_2026_10`), validWithZero));
  });

  await t('21. BM creates doc with NO decreases → ALLOW (legacy month, field absent)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const legacyDoc = validDoc(AGENT1_ID, 'branch_manager', BM1_ID);
    if ('decreases' in legacyDoc) {
      throw new Error('fixture regression: validDoc must omit decreases');
    }
    await assertSucceeds(setDoc(persistRef(db, `${AGENT1_ID}_2026_11`), legacyDoc));
  });

  await t('22. BM creates doc with a positive decreases + modelId → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const withDecreases = {
      ...validDoc(AGENT1_ID, 'branch_manager', BM1_ID),
      decreases: 5000,
      modelId: 'tatil24',
    };
    await assertSucceeds(setDoc(persistRef(db, `${AGENT1_ID}_2026_12`), withDecreases));
  });

  // ── allow delete ────────────────────────────────────────────────────────────
  console.log('\nallow delete:');

  await t('17. BM delete → DENY (allow delete: if false)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(persistRef(db, P1_ID)));
  });

  await t('18. Tenant_admin delete → DENY (allow delete: if false)', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertFails(deleteDoc(persistRef(db, P1_ID)));
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  await testEnv.cleanup();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
