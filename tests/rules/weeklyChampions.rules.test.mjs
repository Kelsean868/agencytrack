/**
 * Emulator rules tests — weeklyChampions/{weekStarting} doc (Track J P5-prep).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/weeklyChampions.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix:
 *   allow get
 *     1.  Agent reads weeklyChampions doc → ALLOW (tenant-wide, signed-in)
 *     2.  BM reads → ALLOW
 *     3.  UM reads → ALLOW
 *     4.  tenant_admin reads → ALLOW
 *     5.  Kiosk reads → ALLOW
 *     6.  Cross-tenant agent reads → DENY
 *     7.  Unauthenticated reads → DENY
 *
 *   allow list
 *     8.  Agent lists weeklyChampions collection → ALLOW
 *     9.  Cross-tenant agent lists → DENY
 *
 *   allow write (always denied — CF-only)
 *     10. Agent attempts to write → DENY
 *     11. BM attempts to write → DENY
 *     12. tenant_admin attempts to write → DENY
 *     13. Cross-tenant write attempt → DENY
 *     14. Attempt to delete → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, collection, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'wc-rules-test-tenant';
const OTHER_TENANT = 'wc-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const TA_ID     = 'wc-ta1';
const BM1_ID    = 'wc-bm1';
const UM1_ID    = 'wc-um1';
const AGENT1_ID = 'wc-agent1';
const KIOSK_ID  = 'wc-kiosk1';
const AGENT_X   = 'wc-agent-x'; // cross-tenant

const WEEK_STARTING = '2026-05-03';
const OTHER_WEEK    = '2026-04-26';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function userRef(db, uid, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/users/${uid}`);
}
function wcRef(db, weekStarting, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/weeklyChampions/${weekStarting}`);
}

const validDoc = () => ({
  weekStarting:  WEEK_STARTING,
  topAPI:        { agentId: AGENT1_ID, agentName: 'Test Agent', value: 1000 },
  topApps:       { agentId: AGENT1_ID, agentName: 'Test Agent', value: 5 },
  topActivity:   { agentId: AGENT1_ID, agentName: 'Test Agent', value: 12 },
  computedAt:    new Date(),
});

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const user = (uid, role, tid = TENANT_ID) => ({
      uid, role, tenantId: tid,
      name: `User ${uid}`, active: true,
    });

    // Users
    await setDoc(userRef(db, TA_ID),     user(TA_ID,     'tenant_admin'));
    await setDoc(userRef(db, BM1_ID),    user(BM1_ID,    'branch_manager'));
    await setDoc(userRef(db, UM1_ID),    user(UM1_ID,    'unit_manager'));
    await setDoc(userRef(db, AGENT1_ID), user(AGENT1_ID, 'agent'));

    // Seed weeklyChampions docs (as if CF had written them)
    await setDoc(wcRef(db, WEEK_STARTING),  validDoc());
    await setDoc(wcRef(db, OTHER_WEEK),     { ...validDoc(), weekStarting: OTHER_WEEK });

    // Cross-tenant seed
    await setDoc(wcRef(db, WEEK_STARTING, OTHER_TENANT), {
      ...validDoc(), weekStarting: WEEK_STARTING,
    });
  });
}

let passed = 0;
let failed = 0;
async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.slice(0, 240) ?? err}`);
    failed++;
  }
}

async function main() {
  console.log('weeklyChampions — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── allow get ───────────────────────────────────────────────────────────────
  console.log('\nallow get:');

  await t('1. Agent reads weeklyChampions doc → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDoc(wcRef(db, WEEK_STARTING)));
  });

  await t('2. BM reads → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(wcRef(db, WEEK_STARTING)));
  });

  await t('3. UM reads → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(wcRef(db, WEEK_STARTING)));
  });

  await t('4. tenant_admin reads → ALLOW', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertSucceeds(getDoc(wcRef(db, WEEK_STARTING)));
  });

  await t('5. Kiosk reads (kioskCanRead arm) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(KIOSK_ID, authToken('kiosk')).firestore();
    await assertSucceeds(getDoc(wcRef(db, WEEK_STARTING)));
  });

  await t('6. Cross-tenant agent reads → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    // OTHER_TENANT agent tries to read TENANT_ID's doc
    await assertFails(getDoc(wcRef(db, WEEK_STARTING, TENANT_ID)));
  });

  await t('7. Unauthenticated reads → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(wcRef(db, WEEK_STARTING)));
  });

  // ── allow list ──────────────────────────────────────────────────────────────
  console.log('\nallow list:');

  await t('8. Agent lists weeklyChampions collection (in tenant) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDocs(collection(db, `tenants/${TENANT_ID}/weeklyChampions`)));
  });

  await t('9. Cross-tenant agent lists → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDocs(collection(db, `tenants/${TENANT_ID}/weeklyChampions`)));
  });

  // ── allow write (always denied — CF-only) ───────────────────────────────────
  console.log('\nallow write:');

  await t('10. Agent attempts to write → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(setDoc(wcRef(db, WEEK_STARTING), validDoc()));
  });

  await t('11. BM attempts to write → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(setDoc(wcRef(db, WEEK_STARTING), validDoc()));
  });

  await t('12. tenant_admin attempts to write → DENY (CF-only)', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertFails(setDoc(wcRef(db, WEEK_STARTING), validDoc()));
  });

  await t('13. Cross-tenant write attempt → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(setDoc(wcRef(db, WEEK_STARTING, TENANT_ID), validDoc()));
  });

  await t('14. Agent attempts to delete → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(deleteDoc(wcRef(db, WEEK_STARTING)));
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
