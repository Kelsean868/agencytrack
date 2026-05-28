/**
 * Emulator rules tests — salesManagerGoals collection (Phase 9 SM target layer).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/salesManagerGoals.rules.test.mjs"
 *
 * Test matrix (14 cases):
 *
 *   allow read
 *     1. sales_manager reads own doc → ALLOW
 *     2. tenant_admin reads any SM doc → ALLOW
 *     3. platform_admin reads any SM doc → ALLOW
 *     4. branch_manager reads SM doc (same tenant) → ALLOW
 *     5. agent reads SM doc (same tenant) → ALLOW
 *     6. cross-tenant auth reads → DENY
 *     7. unauthenticated read → DENY
 *
 *   allow write
 *     8. sales_manager writes own doc (docId matches uid_*) → ALLOW
 *     9. tenant_admin writes any SM doc → ALLOW
 *    10. platform_admin writes any SM doc → ALLOW
 *    11. sales_manager writes ANOTHER SM's doc → DENY
 *    12. branch_manager writes → DENY
 *    13. agent writes → DENY
 *    14. cross-tenant auth writes → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, doc } from 'firebase/firestore';

const PROJECT_ID  = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID   = 'smgoals-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const SM1_ID   = 'sm1';      // the sales_manager
const SM2_ID   = 'sm2';      // second SM (for cross-write deny test)
const TA_ID    = 'ta1';      // tenant_admin
const PA_ID    = 'pa1';      // platform_admin
const BM_ID    = 'bm1';      // branch_manager
const AGENT_ID = 'agent1';   // regular agent
const CROSS_ID = 'cross1';   // user from a different tenant

const SM1_DOC_ID = `${SM1_ID}_2026`;
const SM2_DOC_ID = `${SM2_ID}_2026`;

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function smRef(db, docId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/salesManagerGoals/${docId}`);
}

function validPayload(smUid) {
  return { smUid, tenantId: TENANT_ID, year: 2026, api: 500000, apps: 60 };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(smRef(db, SM1_DOC_ID), validPayload(SM1_ID));
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

  console.log('\nsalesManagerGoals — allow read');

  await t('1. sales_manager reads own doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager'));
    await assertSucceeds(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('2. tenant_admin reads any SM doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin'));
    await assertSucceeds(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('3. platform_admin reads any SM doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(PA_ID, authToken('platform_admin'));
    await assertSucceeds(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('4. branch_manager reads SM doc (same tenant) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(BM_ID, authToken('branch_manager'));
    await assertSucceeds(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('5. agent reads SM doc (same tenant) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(AGENT_ID, authToken('agent'));
    await assertSucceeds(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('6. cross-tenant auth reads → DENY', async () => {
    const ctx = testEnv.authenticatedContext(CROSS_ID, authToken('tenant_admin', OTHER_TENANT));
    await assertFails(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  await t('7. unauthenticated read → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(smRef(ctx.firestore(), SM1_DOC_ID)));
  });

  console.log('\nsalesManagerGoals — allow write');

  await t('8. sales_manager writes own doc (docId matches uid_*) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager'));
    await assertSucceeds(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

  await t('9. tenant_admin writes any SM doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin'));
    await assertSucceeds(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

  await t('10. platform_admin writes any SM doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(PA_ID, authToken('platform_admin'));
    await assertSucceeds(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

  await t("11. sales_manager writes ANOTHER SM's doc → DENY", async () => {
    const ctx = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager'));
    await assertFails(setDoc(smRef(ctx.firestore(), SM2_DOC_ID), validPayload(SM2_ID)));
  });

  await t('12. branch_manager writes → DENY', async () => {
    const ctx = testEnv.authenticatedContext(BM_ID, authToken('branch_manager'));
    await assertFails(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

  await t('13. agent writes → DENY', async () => {
    const ctx = testEnv.authenticatedContext(AGENT_ID, authToken('agent'));
    await assertFails(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

  await t('14. cross-tenant auth writes → DENY', async () => {
    const ctx = testEnv.authenticatedContext(CROSS_ID, authToken('tenant_admin', OTHER_TENANT));
    await assertFails(setDoc(smRef(ctx.firestore(), SM1_DOC_ID), validPayload(SM1_ID)));
  });

} finally {
  if (testEnv) await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`salesManagerGoals rules: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
  if (failed > 0) process.exit(1);
}
