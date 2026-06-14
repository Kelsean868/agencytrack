/**
 * Emulator rules tests — goals collection (personal commitment write fix).
 *
 * Verifies that the agent arm added to allow write lets agents save their own
 * personal commitment docs via setGoals() (CareerPortal path), while denying
 * cross-user and cross-tenant writes.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/goals.rules.test.mjs"
 *
 * Test matrix (14 cases):
 *
 *   allow read
 *     1. agent reads own goal doc → ALLOW
 *     2. branch_manager reads agent goal doc (same tenant) → ALLOW
 *     3. agent reads ANOTHER agent's goal doc → DENY
 *     4. unauthenticated read → DENY
 *
 *   allow write
 *     5. agent writes own goal doc (create) → ALLOW
 *     6. agent writes own goal doc (update personal fields) → ALLOW
 *     7. agent writes ANOTHER agent's goal doc → DENY
 *     8. branch_manager writes agent goal doc (canManage) → ALLOW
 *     9. unauthenticated write → DENY
 *    10. cross-tenant agent writes → DENY
 *
 *   unit_manager write scoping (SEC-4 pattern + null guard)
 *    11. unit_manager writes goal for agent in SAME unit → ALLOW
 *    12. unit_manager writes goal for agent in DIFFERENT unit → DENY
 *    13. branch_manager writes any agent goal doc in tenant → ALLOW
 *    14. null-null: unit_manager unitId=null + agent unitId=null → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, doc } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'goals-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const AGENT1_ID = 'agent1';
const AGENT2_ID = 'agent2';
const BM_ID     = 'bm1';
const CROSS_ID  = 'cross1';

// Unit-scoping actors (cases 11–14)
const UM_SAME_UNIT    = 'umSameUnit';     // unit_manager, unitId = 'unit-1'
const UM_OTHER_UNIT   = 'umOtherUnit';    // unit_manager, unitId = 'unit-2'
const UM_NULL_UNIT    = 'umNullUnit';     // unit_manager, unitId = null
const AGENT_UNIT1     = 'agentUnit1';     // agent, unitId = 'unit-1'
const AGENT_UNIT2     = 'agentUnit2';     // agent, unitId = 'unit-2' (unused in current cases, defined for completeness)
const AGENT_NULL_UNIT = 'agentNullUnit';  // agent, unitId = null

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function goalRef(db, agentId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/goals/${agentId}`);
}

function personalPayload(agentId) {
  return {
    agentId,
    tenantId: TENANT_ID,
    setBy: agentId,
    setByName: 'Test Agent',
    personalAnnualAPI: 200000,
    personalAnnualApps: 48,
    personalAnnualPersistency: 85,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Seed agent1's goal doc for read + update tests
    await setDoc(goalRef(db, AGENT1_ID), personalPayload(AGENT1_ID));

    // Seed user docs so callerUnitId() cross-doc get() resolves (cases 11–14)
    const u = (uid, role, unitId) => ({ uid, role, tenantId: TENANT_ID, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_SAME_UNIT}`),    u(UM_SAME_UNIT,    'unit_manager', 'unit-1'));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_OTHER_UNIT}`),   u(UM_OTHER_UNIT,   'unit_manager', 'unit-2'));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_NULL_UNIT}`),    u(UM_NULL_UNIT,    'unit_manager', null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_UNIT1}`),     u(AGENT_UNIT1,     'agent',        'unit-1'));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_UNIT2}`),     u(AGENT_UNIT2,     'agent',        'unit-2'));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_NULL_UNIT}`), u(AGENT_NULL_UNIT, 'agent',        null));
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
    console.error(`    ${err.message ?? err}`);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
let testEnv;
try {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await seedDocs(testEnv);
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  console.log('\ngoals — allow read');

  await t('1. agent reads own goal doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(AGENT1_ID, authToken('agent'));
    await assertSucceeds(getDoc(goalRef(ctx.firestore(), AGENT1_ID)));
  });

  await t('2. branch_manager reads agent goal doc (same tenant) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(BM_ID, authToken('branch_manager'));
    await assertSucceeds(getDoc(goalRef(ctx.firestore(), AGENT1_ID)));
  });

  await t("3. agent reads ANOTHER agent's goal doc → DENY", async () => {
    const ctx = testEnv.authenticatedContext(AGENT2_ID, authToken('agent'));
    await assertFails(getDoc(goalRef(ctx.firestore(), AGENT1_ID)));
  });

  await t('4. unauthenticated read → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(goalRef(ctx.firestore(), AGENT1_ID)));
  });

  console.log('\ngoals — allow write');

  await t('5. agent writes own goal doc (create) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(AGENT2_ID, authToken('agent'));
    await assertSucceeds(setDoc(goalRef(ctx.firestore(), AGENT2_ID), personalPayload(AGENT2_ID)));
  });

  await t('6. agent writes own goal doc (update personal fields) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(AGENT1_ID, authToken('agent'));
    const updated = { ...personalPayload(AGENT1_ID), personalAnnualAPI: 250000 };
    await assertSucceeds(setDoc(goalRef(ctx.firestore(), AGENT1_ID), updated, { merge: true }));
  });

  await t("7. agent writes ANOTHER agent's goal doc → DENY", async () => {
    const ctx = testEnv.authenticatedContext(AGENT1_ID, authToken('agent'));
    await assertFails(setDoc(goalRef(ctx.firestore(), AGENT2_ID), personalPayload(AGENT2_ID)));
  });

  await t('8. branch_manager writes agent goal doc (canManage) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(BM_ID, authToken('branch_manager'));
    await assertSucceeds(setDoc(goalRef(ctx.firestore(), AGENT1_ID), personalPayload(AGENT1_ID)));
  });

  await t('9. unauthenticated write → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(setDoc(goalRef(ctx.firestore(), AGENT1_ID), personalPayload(AGENT1_ID)));
  });

  await t('10. cross-tenant agent writes → DENY', async () => {
    const ctx = testEnv.authenticatedContext(CROSS_ID, authToken('agent', OTHER_TENANT));
    await assertFails(setDoc(goalRef(ctx.firestore(), CROSS_ID, TENANT_ID), personalPayload(CROSS_ID)));
  });

  console.log('\ngoals — unit_manager write scoping (SEC-4 + null guard)');

  await t('11. unit_manager writes goal for agent in SAME unit → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(UM_SAME_UNIT, authToken('unit_manager'));
    await assertSucceeds(setDoc(goalRef(ctx.firestore(), AGENT_UNIT1), personalPayload(AGENT_UNIT1)));
  });

  await t('12. unit_manager writes goal for agent in DIFFERENT unit → DENY', async () => {
    const ctx = testEnv.authenticatedContext(UM_OTHER_UNIT, authToken('unit_manager'));
    await assertFails(setDoc(goalRef(ctx.firestore(), AGENT_UNIT1), personalPayload(AGENT_UNIT1)));
  });

  await t('13. branch_manager writes any agent goal doc in tenant → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(BM_ID, authToken('branch_manager'));
    await assertSucceeds(setDoc(goalRef(ctx.firestore(), AGENT_UNIT1), personalPayload(AGENT_UNIT1)));
  });

  await t('14. null-null: unit_manager unitId=null + agent unitId=null → DENY', async () => {
    const ctx = testEnv.authenticatedContext(UM_NULL_UNIT, authToken('unit_manager'));
    await assertFails(setDoc(goalRef(ctx.firestore(), AGENT_NULL_UNIT), personalPayload(AGENT_NULL_UNIT)));
  });

} finally {
  if (testEnv) await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`goals rules: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ''} (expected 14)`);
  if (failed > 0) process.exit(1);
}
