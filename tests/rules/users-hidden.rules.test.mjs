/**
 * Emulator rules tests — hiddenFromLeaderboard flag on users/{userId}.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/users-hidden.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (5 cases):
 *   1. BM sets hiddenFromLeaderboard on self                        → ALLOW
 *   2. BM sets hiddenFromLeaderboard on in-branch agent             → ALLOW
 *   3. BM sets hiddenFromLeaderboard on cross-branch agent          → DENY
 *   4. UM sets hiddenFromLeaderboard on self                        → DENY
 *   5. Agent sets hiddenFromLeaderboard on self                     → DENY
 *
 * Security model:
 *   - Settable on others only by BM/SM/TA, branch-bounded for BM.
 *   - Settable on self only by BM/SM/TA (not UM, not agent).
 *   - Write MUST be {hiddenFromLeaderboard: bool} ONLY — bundling other
 *     fields would hit the wrong hasOnly arm and be denied.
 *   - hasOnly enforcement relies on diff().affectedKeys(): tests write a
 *     value that differs from the seeded state so the key appears in the diff.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'hidden-lb-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor IDs
const BM_ID     = 'bm1';
const BM2_ID    = 'bm2';
const UM_ID     = 'um1';
const AGENT_A   = 'agentA';   // branch-a (same as BM)
const AGENT_B   = 'agentB';   // branch-b (cross-branch from BM)

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';

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
      name: `User ${uid}`, active: true, hiddenFromLeaderboard: false,
    });
    await setDoc(userRef(db, BM_ID),    u(BM_ID,    'branch_manager', BRANCH_A));
    await setDoc(userRef(db, BM2_ID),   u(BM2_ID,   'branch_manager', BRANCH_B));
    await setDoc(userRef(db, UM_ID),    u(UM_ID,    'unit_manager',   BRANCH_A));
    await setDoc(userRef(db, AGENT_A),  u(AGENT_A,  'agent',          BRANCH_A));
    await setDoc(userRef(db, AGENT_B),  u(AGENT_B,  'agent',          BRANCH_B));
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
  console.log('hiddenFromLeaderboard — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  console.log('\nhiddenFromLeaderboard write rules:');

  await t('1. BM sets hiddenFromLeaderboard on self → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, BM_ID), { hiddenFromLeaderboard: true }));
  });

  await t('2. BM sets hiddenFromLeaderboard on in-branch agent → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { hiddenFromLeaderboard: true }));
  });

  await t('3. BM sets hiddenFromLeaderboard on cross-branch agent → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_B), { hiddenFromLeaderboard: true }));
  });

  await t('4. UM sets hiddenFromLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(userRef(db, UM_ID), { hiddenFromLeaderboard: true }));
  });

  await t('5. Agent sets hiddenFromLeaderboard on self → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { hiddenFromLeaderboard: true }));
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
