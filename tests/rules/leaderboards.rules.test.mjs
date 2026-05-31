/**
 * Emulator rules tests — leaderboards/{branchId} aggregate doc (Track J P1b).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/leaderboards.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix:
 *   allow get / list
 *     1. Agent reads OWN branch leaderboard → ALLOW (SEC-4 doc-read)
 *     2. Agent reads OTHER branch leaderboard → DENY
 *     3. BM reads branch leaderboard (in tenant) → ALLOW (canManage)
 *     4. UM reads branch leaderboard (in tenant) → ALLOW (canManage)
 *     5. tenant_admin reads → ALLOW (canManage)
 *     6. Kiosk role reads → ALLOW (kioskCanRead)
 *     7. Cross-tenant agent reads → DENY
 *     8. Unauthenticated reads → DENY
 *
 *   allow write
 *     9.  Agent attempts to write OWN branch doc → DENY
 *    10. BM attempts to write → DENY
 *    11. tenant_admin attempts to write → DENY
 *    12. Cross-tenant write attempt → DENY
 *
 *   list (collection-level)
 *    13. Agent lists leaderboards filtered to own branchId → ALLOW
 *    14. Agent lists leaderboards filtered to OTHER branchId → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, collection, query, where, documentId,
} from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'leaderboards-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const TA_ID     = 'ta1';
const BM1_ID    = 'bm1';
const UM1_ID    = 'um1';
const AGENT1_ID = 'agent1';      // branch-south
const AGENT2_ID = 'agent2';      // branch-north
const KIOSK_ID  = 'kiosk1';
const AGENT_X   = 'agent-x';     // cross-tenant

const BRANCH_SOUTH = 'branch-south';
const BRANCH_NORTH = 'branch-north';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function userRef(db, uid, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/users/${uid}`);
}
function lbRef(db, branchId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/leaderboards/${branchId}`);
}

const validDoc = () => ({
  week: [],
  mtd:  [],
  qtd:  [],
  ytd:  [],
  computedAt: new Date(),
});

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const user = (uid, role, branchId, unitId = null, tid = TENANT_ID) => ({
      uid, role, tenantId: tid, branchId, unitId,
      name: `User ${uid}`, active: true,
    });

    // Users
    await setDoc(userRef(db, TA_ID),     user(TA_ID,     'tenant_admin',   BRANCH_SOUTH));
    await setDoc(userRef(db, BM1_ID),    user(BM1_ID,    'branch_manager', BRANCH_SOUTH));
    await setDoc(userRef(db, UM1_ID),    user(UM1_ID,    'unit_manager',   BRANCH_SOUTH, UM1_ID));
    await setDoc(userRef(db, AGENT1_ID), user(AGENT1_ID, 'agent',          BRANCH_SOUTH, UM1_ID));
    await setDoc(userRef(db, AGENT2_ID), user(AGENT2_ID, 'agent',          BRANCH_NORTH, 'um2'));

    // Leaderboard docs (seeded as if the CF had written them)
    await setDoc(lbRef(db, BRANCH_SOUTH), validDoc());
    await setDoc(lbRef(db, BRANCH_NORTH), validDoc());
  });
}

// ── Harness ──────────────────────────────────────────────────────────────────
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
  console.log('Leaderboards — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── allow get / list ───────────────────────────────────────────────────────
  console.log('\nallow get:');

  await t('1. Agent reads OWN branch leaderboard → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  await t('2. Agent reads OTHER branch leaderboard → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(getDoc(lbRef(db, BRANCH_NORTH)));
  });

  await t('3. BM reads branch leaderboard (in tenant) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(lbRef(db, BRANCH_SOUTH)));
    await assertSucceeds(getDoc(lbRef(db, BRANCH_NORTH)));
  });

  await t('4. UM reads branch leaderboard → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  await t('5. tenant_admin reads → ALLOW', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertSucceeds(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  await t('6. Kiosk reads → ALLOW', async () => {
    const db = testEnv.authenticatedContext(KIOSK_ID, authToken('kiosk')).firestore();
    await assertSucceeds(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  await t('7. Cross-tenant agent reads → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  await t('8. Unauthenticated read → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(lbRef(db, BRANCH_SOUTH)));
  });

  // ── allow write — universally DENY ─────────────────────────────────────────
  console.log('\nallow write:');

  await t('9. Agent attempts to write OWN branch doc → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(setDoc(lbRef(db, BRANCH_SOUTH), validDoc()));
  });

  await t('10. BM attempts to write → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(setDoc(lbRef(db, BRANCH_SOUTH), validDoc()));
  });

  await t('11. tenant_admin attempts to write → DENY', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertFails(setDoc(lbRef(db, BRANCH_SOUTH), validDoc()));
  });

  await t('12. Cross-tenant write → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(setDoc(lbRef(db, BRANCH_SOUTH), validDoc()));
  });

  // ── allow list (collection-level) ──────────────────────────────────────────
  console.log('\nallow list (collection query):');

  await t('13. Agent lists leaderboards filtered to own branchId → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    // Rules evaluate list-arm with each matched doc. Since the agent's
    // branchId == BRANCH_SOUTH and the query targets that doc only, list passes.
    await assertSucceeds(getDocs(
      query(collection(db, `tenants/${TENANT_ID}/leaderboards`),
            where(documentId(), '==', BRANCH_SOUTH))
    ));
  });

  await t('14. Agent lists leaderboards filtered to OTHER branchId → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(getDocs(
      query(collection(db, `tenants/${TENANT_ID}/leaderboards`),
            where(documentId(), '==', BRANCH_NORTH))
    ));
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
