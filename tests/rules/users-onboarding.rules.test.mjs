/**
 * Emulator rules tests — onboarding write-once arm on users/{userId}.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/users-onboarding.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (32 cases):
 *   ── Original identity fields (agentNumber / dateOfBirth / onboardingComplete) ──
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
 *   ── Tenure fields (contractStartDate / monthsAtTatil / monthsInIndustry) ──
 *  16.  Owner sets contractStartDate (field == '')     → ALLOW
 *  17.  Owner cannot change contractStartDate once set → DENY
 *  18.  Owner sets monthsAtTatil (field absent)        → ALLOW
 *  19.  Owner cannot change monthsAtTatil once set     → DENY
 *  20.  Owner sets monthsInIndustry (field absent)     → ALLOW
 *  21.  Owner cannot change monthsInIndustry once set  → DENY
 *  22.  Owner sets all three tenure fields together    → ALLOW
 *  23.  canManage (BM) corrects contractStartDate      → ALLOW
 *  24.  canManage (BM) corrects monthsAtTatil + monthsInIndustry → ALLOW
 *  25.  Owner sets contractStartDate to empty string   → DENY
 *  26.  Owner sets monthsAtTatil to non-number         → DENY
 *  27.  Owner sets monthsInIndustry to non-number      → DENY
 *  28.  Owner sets monthsAtTatil to negative           → DENY  (>= 0)
 *  29.  Owner sets monthsAtTatil to float (14.5)       → DENY  (is int)
 *  30.  canManage (BM) corrects monthsAtTatil alone    → ALLOW (correction path)
 *  31.  Owner sets monthsInIndustry to negative (-1)   → DENY  (>= 0)
 *  32.  Owner sets monthsInIndustry to float (14.5)    → DENY  (is int)
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
const AGENT_C  = 'agent-c';   // has tenure fields pre-set (immutability deny tests)
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

    // agent-a: CF-stamped blank slate (contractStartDate: '' mimics doCreateUser output)
    await setDoc(userRef(db, AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true, contractStartDate: '',
    });

    // agent-b: agentNumber + dateOfBirth already set (for immutability tests)
    await setDoc(userRef(db, AGENT_B), {
      uid: AGENT_B, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent B', active: true,
      agentNumber: '123X45', dateOfBirth: '1990-01-01', onboardingComplete: false,
    });

    // agent-c: tenure fields already set (for immutability deny tests 17/19/21)
    await setDoc(userRef(db, AGENT_C), {
      uid: AGENT_C, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent C', active: true,
      contractStartDate: '2024-03-01', monthsAtTatil: 14, monthsInIndustry: 14,
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

  // ── Tenure fields (contractStartDate / monthsAtTatil / monthsInIndustry) ──────
  console.log('\nTenure fields — write-once:');

  // Reset agent-a: contractStartDate: '' mimics CF-stamped state (field exists but empty)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true, contractStartDate: '',
    });
  });

  await t('16. Owner sets contractStartDate (field == \'\') → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { contractStartDate: '2024-01-15' }));
  });

  await t('17. Owner cannot change contractStartDate once set → DENY', async () => {
    // agent-c has contractStartDate: '2024-03-01' from seed; write a different value
    const db = testEnv.authenticatedContext(AGENT_C, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_C), { contractStartDate: '2023-01-01' }));
  });

  // Reset agent-a blank for monthsAtTatil test
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('18. Owner sets monthsAtTatil (field absent) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { monthsAtTatil: 6 }));
  });

  await t('19. Owner cannot change monthsAtTatil once set → DENY', async () => {
    // agent-c has monthsAtTatil: 14 from seed; write a different number
    const db = testEnv.authenticatedContext(AGENT_C, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_C), { monthsAtTatil: 99 }));
  });

  // Reset agent-a blank for monthsInIndustry test
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('20. Owner sets monthsInIndustry (field absent) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), { monthsInIndustry: 24 }));
  });

  await t('21. Owner cannot change monthsInIndustry once set → DENY', async () => {
    // agent-c has monthsInIndustry: 14 from seed; write a different number
    const db = testEnv.authenticatedContext(AGENT_C, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_C), { monthsInIndustry: 99 }));
  });

  // Reset agent-a blank for atomic tenure write test
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('22. Owner sets all three tenure fields in one write → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_A), {
      contractStartDate: '2024-06-01', monthsAtTatil: 12, monthsInIndustry: 36,
    }));
  });

  console.log('\ncanManage correction arm — tenure fields:');

  await t('23. canManage (BM) corrects contractStartDate → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    // agent-c has contractStartDate set; BM can override via canManage arm
    await assertSucceeds(updateDoc(userRef(db, AGENT_C), {
      contractStartDate: '2024-04-01', updatedAt: new Date().toISOString(),
    }));
  });

  await t('24. canManage (BM) corrects monthsAtTatil + monthsInIndustry → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_C), {
      monthsAtTatil: 15, monthsInIndustry: 15, updatedAt: new Date().toISOString(),
    }));
  });

  await t('30. canManage (BM) corrects monthsAtTatil alone after owner set → ALLOW', async () => {
    // agent-c now has monthsAtTatil: 15 (set by test 24); BM corrects just this field
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(userRef(db, AGENT_C), {
      monthsAtTatil: 16, updatedAt: new Date().toISOString(),
    }));
  });

  console.log('\nType + empty-string guards — tenure fields:');

  // Reset agent-a blank for type-guard tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(userRef(ctx.firestore(), AGENT_A), {
      uid: AGENT_A, role: 'agent', tenantId: TENANT_ID,
      name: 'Agent A', active: true,
    });
  });

  await t('25. Owner sets contractStartDate to empty string → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { contractStartDate: '' }));
  });

  await t('26. Owner sets monthsAtTatil to non-number (string) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsAtTatil: '12' }));
  });

  await t('27. Owner sets monthsInIndustry to non-number (string) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsInIndustry: '24' }));
  });

  await t('28. Owner sets monthsAtTatil to negative (-1) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsAtTatil: -1 }));
  });

  await t('29. Owner sets monthsAtTatil to float (14.5) → DENY (is int)', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsAtTatil: 14.5 }));
  });

  await t('31. Owner sets monthsInIndustry to negative (-1) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsInIndustry: -1 }));
  });

  await t('32. Owner sets monthsInIndustry to float (14.5) → DENY (is int)', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
    await assertFails(updateDoc(userRef(db, AGENT_A), { monthsInIndustry: 14.5 }));
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
