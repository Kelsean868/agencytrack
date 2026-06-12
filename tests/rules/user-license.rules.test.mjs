/**
 * Emulator rules tests — user doc license-state fields (Track I §6).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/user-license.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (6 cases):
 *   1. Manager writes licenseStatus: 'official' on an agent doc → ALLOW
 *   2. Agent writes licenseStatus on own doc                    → DENY (not in self-edit arm)
 *   3. UM writes licenseStatus on agent outside own unit        → DENY (UM scope guard)
 *   4. active cannot be written client-side (regression)        → DENY
 *   5. BM writes licenseProfile on agent doc                    → ALLOW (Slice 2b)
 *   6. Agent writes licenseProfile on own doc                   → ALLOW (agent self-write arm)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { updateDoc, setDoc, doc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'user-license-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const BM_ID    = 'bm1';
const UM_ID    = 'um1';
const AGENT_ID = 'agent1';
const AGENT2_ID = 'agent2'; // belongs to a different unit

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

function userDocRef(db, uid) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}`);
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const userDoc = (uid, role, unitId) => ({
      uid, role, tenantId: TENANT_ID, branchId: 'branch-a', unitId,
      name: `User ${uid}`, active: true,
    });

    await setDoc(userDocRef(db, BM_ID),    userDoc(BM_ID,    'branch_manager', null));
    await setDoc(userDocRef(db, UM_ID),    userDoc(UM_ID,    'unit_manager',   UM_ID));
    await setDoc(userDocRef(db, AGENT_ID), userDoc(AGENT_ID, 'agent',          UM_ID));
    await setDoc(userDocRef(db, AGENT2_ID), { ...userDoc(AGENT2_ID, 'agent', 'other-um'), unitId: 'other-um' });
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
    console.error(`    ${err.message ?? err}`);
    failed++;
  }
}

async function main() {
  console.log('User License Fields — Firestore emulator rules tests (Track I §6)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── Case 1: Manager writes licenseStatus → ALLOW ───────────────────────────
  await t('1. BM writes licenseStatus: "official" on agent doc → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userDocRef(db, AGENT_ID), {
      licenseStatus: 'official',
      updatedAt: new Date(),
      updatedBy: BM_ID,
    }));
  });

  // ── Case 2: Agent writes licenseStatus on own doc → DENY ──────────────────
  await t('2. Agent writes licenseStatus on own doc → DENY (not in self-edit arm)', async () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    await assertFails(updateDoc(userDocRef(db, AGENT_ID), {
      licenseStatus: 'official',
    }));
  });

  // ── Case 3: UM writes licenseStatus on agent outside own unit → DENY ──────
  await t('3. UM writes licenseStatus on agent outside own unit → DENY (UM scope guard)', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    // AGENT2_ID is in 'other-um' unit, not UM_ID's unit
    await assertFails(updateDoc(userDocRef(db, AGENT2_ID), {
      licenseStatus: 'provisional',
      updatedAt: new Date(),
      updatedBy: UM_ID,
    }));
  });

  // ── Case 4: active still cannot be written client-side → DENY (regression) ─
  await t('4. BM writes active on agent doc → DENY (active not in allowlist)', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(userDocRef(db, AGENT_ID), {
      active: false,
    }));
  });

  // ── Case 5: BM writes licenseProfile → ALLOW (Slice 2b) ──────────────────
  await t('5. BM writes licenseProfile: "life_only" on agent doc → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userDocRef(db, AGENT_ID), {
      licenseProfile: 'life_only',
      updatedAt: new Date(),
      updatedBy: BM_ID,
    }));
  });

  // ── Case 6: Agent writes licenseProfile on own doc → ALLOW (self-write arm)
  await t('6. Agent writes licenseProfile on own doc → ALLOW (self-write arm)', async () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userDocRef(db, AGENT_ID), {
      licenseProfile: 'composite',
      updatedAt: new Date(),
    }));
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  await testEnv.cleanup();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
