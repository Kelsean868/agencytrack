/**
 * Emulator rules tests — onboarding write-once arm on users/{userId}.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/users-onboarding.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (12 cases):
 *   1.  Owner sets agentNumber (field absent)          → ALLOW
 *   2.  Owner cannot change agentNumber once set       → DENY
 *   3.  Owner sets dateOfBirth (field absent)          → ALLOW
 *   4.  Owner cannot change dateOfBirth once set       → DENY
 *   5.  Owner sets all three fields in one write       → ALLOW
 *   6.  Owner sets only onboardingComplete             → ALLOW
 *   7.  Owner sets onboardingComplete when agentNumber already set → ALLOW
 *   8.  Owner writes non-whitelisted field (role)      → DENY
 *   9.  Owner bundles whitelisted + role in one write  → DENY
 *  10.  Cross-user write blocked                       → DENY
 *  11.  canManage (BM) corrects agentNumber            → ALLOW
 *  12.  canManage (BM) resets onboardingComplete       → ALLOW
 *  13.  Owner sets agentNumber to empty string         → DENY  (Gemini #3)
 *  14.  Owner sets dateOfBirth to empty string         → DENY  (Gemini #3)
 *  15.  Owner sets onboardingComplete to non-bool      → DENY  (Gemini #2)
 *
 * Note: hasOnly enforcement relies on diff().affectedKeys().
 * Deny tests write values that DIFFER from the seeded doc so the key
 * appears in the diff (see CLAUDE.md banked pattern).
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'onboarding-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const AGENT_A  = 'agent-a';
const AGENT_B  = 'agent-b';
const BM_ID    = 'bm1';
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

    // agent-a: no identity fields set (blank slate for write-once tests)
    await setDoc(userRef(db, AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });

    // agent-b: agentNumber + dateOfBirth already set (for immutability tests)
    await setDoc(userRef(db, AGENT_B), {
      uid: AGENT_B, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent B', active: true,
      agentNumber: '123X45', dateOfBirth: '1990-01-01', onboardingComplete: false,
    });

    // bm1: branch manager for canManage tests
    await setDoc(userRef(db, BM_ID), {
      uid: BM_ID, role: 'branch_manager', tenantId: TENANT_ID,
      name: 'Branch Manager', active: true, branchId: BRANCH_A,
    });
  });
}

// ── Harness ───────────────────────────────────────────────────────────────────
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
  console.log('users-onboarding — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  console.log('Owner write-once arm:');

  await t('1. Owner sets agentNumber (field absent) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { agentNumber: '456Y78' }));
  });

  // Re-seed agent-a so agentNumber is now set for the next test
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true, agentNumber: '456Y78',
    });
  });

  await t('2. Owner cannot change agentNumber once set → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    // Write a DIFFERENT value so the key appears in affectedKeys()
    await assertFails(updateDoc(userRef(db, AGENT_A), { agentNumber: 'CHANGED' }));
  });

  // Reset agent-a to blank slate for remaining owner tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('3. Owner sets dateOfBirth (field absent) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { dateOfBirth: '1995-06-15' }));
  });

  await t('4. Owner cannot change dateOfBirth once set → DENY', async () => {
    // agent-b already has dateOfBirth: '1990-01-01' from seedDocs
    const db = testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_B), { dateOfBirth: '1991-03-20' }));
  });

  // Reset agent-a fully blank again
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('5. Owner sets agentNumber + dateOfBirth + onboardingComplete in one write → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), {
      agentNumber: '789Z01', dateOfBirth: '2000-12-31', onboardingComplete: true,
    }));
  });

  // Reset agent-a blank for onboardingComplete-only test
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('6. Owner sets only onboardingComplete (fields absent) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { onboardingComplete: true }));
  });

  await t('7. Owner sets onboardingComplete when agentNumber already set → ALLOW', async () => {
    // agent-b has agentNumber set; onboardingComplete is false → setting to true is ok
    const db = testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_B), { onboardingComplete: true }));
  });

  await t('8. Owner writes non-whitelisted field (role) → DENY', async () => {
    // agent-b has role: 'agent'; write 'tenant_admin' so key appears in diff
    const db = testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_B), { role: 'tenant_admin' }));
  });

  await t('9. Owner bundles whitelisted + role in one write → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_B), {
      onboardingComplete: false, role: 'tenant_admin',
    }));
  });

  await t('10. Cross-user write blocked (agent-a writes agent-b doc) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_B), { onboardingComplete: true }));
  });

  console.log('\ncanManage correction arm:');

  await t('11. canManage (BM) corrects agentNumber → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    // agent-b already has agentNumber set; BM can override via canManage arm
    await assertSucceeds(updateDoc(userRef(db, AGENT_B), { agentNumber: 'CORRECTED', updatedAt: new Date().toISOString() }));
  });

  await t('12. canManage (BM) resets onboardingComplete → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_B), { onboardingComplete: false, updatedAt: new Date().toISOString() }));
  });

  console.log('\nType + empty-string guards (Gemini findings #2 and #3):');

  // Reset agent-a to blank for empty-string tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('13. Owner sets agentNumber to empty string → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { agentNumber: '' }));
  });

  await t('14. Owner sets dateOfBirth to empty string → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { dateOfBirth: '' }));
  });

  await t('15. Owner sets onboardingComplete to non-bool (string) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { onboardingComplete: 'yes' }));
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
