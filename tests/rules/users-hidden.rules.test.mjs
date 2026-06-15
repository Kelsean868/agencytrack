/**
 * Emulator rules tests — appearOnLeaderboard flag on users/{userId}.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/users-hidden.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (5 cases):
 *   1. BM sets appearOnLeaderboard on self                         → ALLOW
 *   2. UM sets appearOnLeaderboard on self                         → DENY
 *   3. SM sets appearOnLeaderboard on self                         → DENY
 *   4. TA sets appearOnLeaderboard on self                         → DENY
 *   5. Agent sets appearOnLeaderboard on self                      → DENY
 *
 * Security model:
 *   - Only a branch_manager may set appearOnLeaderboard on their OWN doc
 *     (self opt-in). All other roles are denied.
 *   - Write MUST be {appearOnLeaderboard: bool} ONLY — bundling other
 *     fields would hit the wrong hasOnly arm and be denied.
 *   - hasOnly enforcement relies on diff().affectedKeys(): tests seed
 *     {appearOnLeaderboard: false} and write {appearOnLeaderboard: true}
 *     so the key appears in the diff.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID  = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID   = 'appear-on-lb-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const BM_ID    = 'bm1';
const UM_ID    = 'um1';
const SM_ID    = 'sm1';
const TA_ID    = 'ta1';
const AGENT_ID = 'agent1';

const BRANCH_A = 'branch-a';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function userRef(db, uid) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}`);
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const u = (uid, role, branchId) => ({
      uid, role, tenantId: TENANT_ID, branchId,
      name: `User ${uid}`, active: true, appearOnLeaderboard: false,
    });
    await setDoc(userRef(db, BM_ID),    u(BM_ID,    'branch_manager', BRANCH_A));
    await setDoc(userRef(db, UM_ID),    u(UM_ID,    'unit_manager',   BRANCH_A));
    await setDoc(userRef(db, SM_ID),    u(SM_ID,    'sales_manager',  BRANCH_A));
    await setDoc(userRef(db, TA_ID),    u(TA_ID,    'tenant_admin',   BRANCH_A));
    await setDoc(userRef(db, AGENT_ID), u(AGENT_ID, 'agent',          BRANCH_A));
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
  console.log('appearOnLeaderboard — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  console.log('\nappearOnLeaderboard write rules:');

  await t('1. BM sets appearOnLeaderboard on self → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, BM_ID), { appearOnLeaderboard: true }));
  });

  await t('2. UM sets appearOnLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(userRef(db, UM_ID), { appearOnLeaderboard: true }));
  });

  await t('3. SM sets appearOnLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(SM_ID, authToken('sales_manager')).firestore();
    await assertFails(updateDoc(userRef(db, SM_ID), { appearOnLeaderboard: true }));
  });

  await t('4. TA sets appearOnLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(TA_ID, authToken('tenant_admin')).firestore();
    await assertFails(updateDoc(userRef(db, TA_ID), { appearOnLeaderboard: true }));
  });

  await t('5. Agent sets appearOnLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_ID), { appearOnLeaderboard: true }));
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
