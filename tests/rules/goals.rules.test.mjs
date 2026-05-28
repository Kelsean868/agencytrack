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
 * Test matrix (10 cases):
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

} finally {
  if (testEnv) await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`goals rules: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
  if (failed > 0) process.exit(1);
}
