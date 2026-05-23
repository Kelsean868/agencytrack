/**
 * Emulator rules tests — managerMonthlyRollups collection (I2).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/manager-monthly-rollup.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (21 cases):
 *   CREATE (owner)
 *   1.  UM owner creates own rollup                          → ALLOW
 *   2.  BM owner creates own rollup (unitId: null — Item 3) → ALLOW
 *   3.  Agent attempts create                               → DENY
 *   4.  UM forges managerId (writes another user's id)      → DENY
 *   5.  UM sends wrong managerRoleRank                      → DENY
 *   6.  UM sends negative candidatesAssessed                → DENY
 *   7.  UM sends negative agentsContracted                  → DENY
 *   8.  UM omits a required key (missing monthKey)          → DENY
 *   9.  UM sends bad status value                           → DENY
 *   UPDATE (owner)
 *   10. Owner updates own rollup                            → ALLOW
 *   11. Peer UM updates another UM's rollup                 → DENY
 *   GET (single-doc)
 *   12. Owner reads own rollup (doc exists)                 → ALLOW
 *   13. Owner reads own rollup (doc not yet exists — null-resource prefix check) → ALLOW
 *   14. Non-owner reads with non-matching prefix            → DENY
 *   15. BM same-branch reads UM rollup                      → ALLOW (upline)
 *   16. BM other-branch reads UM rollup                     → DENY
 *   17. SM reads any rollup (tenant-wide)                   → ALLOW
 *   18. Downline peer: another UM reads BM rollup           → DENY (rank)
 *   LIST
 *   19. BM own-branch list                                  → ALLOW
 *   20. SM tenant-wide list                                 → ALLOW
 *   21. UM list                                             → DENY (rank < 2)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  getDoc, setDoc, updateDoc, doc, collection, getDocs, query, where,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'mmr-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// User ids and branches
const UM1_ID  = 'um1';  const BRANCH_A = 'branch-a';
const UM2_ID  = 'um2';  const BRANCH_B = 'branch-b';
const BM1_ID  = 'bm1';  // branch-a
const BM2_ID  = 'bm2';  // branch-b
const SM1_ID  = 'sm1';
const AGENT_ID = 'agent1';

const MONTH_KEY = '2026-05';

// uid is passed as the first arg to authenticatedContext — not in the token.
// branchId is read from the user doc via callerBranchId() — not needed in JWT.
function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

function rollupRef(db, uid, monthKey) {
  return doc(db, `tenants/${TENANT_ID}/managerMonthlyRollups/${uid}_${monthKey}`);
}

function validPayload(uid, role, rank, branchId, unitId = null) {
  return {
    managerId:          uid,
    managerName:        `Manager ${uid}`,
    tenantId:           TENANT_ID,
    monthKey:           MONTH_KEY,
    managerRole:        role,
    managerRoleRank:    rank,
    branchId:           branchId,
    unitId:             unitId,
    candidatesAssessed: 3,
    agentsContracted:   1,
    status:             'draft',
    updatedAt:          new Date(),
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // User docs — callerBranchId() reads branchId from user doc
    const userDoc = (uid, role, branchId, unitId) => ({ uid, role, tenantId: TENANT_ID, branchId, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM1_ID}`),  userDoc(UM1_ID,  'unit_manager',   BRANCH_A, UM1_ID));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM2_ID}`),  userDoc(UM2_ID,  'unit_manager',   BRANCH_B, UM2_ID));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM1_ID}`),  userDoc(BM1_ID,  'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM2_ID}`),  userDoc(BM2_ID,  'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1_ID}`),  userDoc(SM1_ID,  'sales_manager',  null,     null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}`), userDoc(AGENT_ID, 'agent',        BRANCH_A, UM1_ID));

    // Pre-seed UM1's rollup for update/read tests
    await setDoc(rollupRef(db, UM1_ID, MONTH_KEY), validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID));
    // Pre-seed BM1's rollup for upline read tests
    await setDoc(rollupRef(db, BM1_ID, MONTH_KEY), validPayload(BM1_ID, 'branch_manager', 2, BRANCH_A, null));
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
  console.log('Manager Monthly Rollups — Firestore emulator rules tests (I2)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── CREATE ──────────────────────────────────────────────────────────────────

  await t('1. UM owner creates own rollup → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-04');  // different month to avoid conflict
    await assertSucceeds(setDoc(ref, validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID)));
  });

  await t('2. BM owner creates own rollup (unitId: null) → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const ref = rollupRef(db, BM1_ID, '2026-04');
    await assertSucceeds(setDoc(ref, validPayload(BM1_ID, 'branch_manager', 2, BRANCH_A, null)));
  });

  await t('3. Agent attempts create → DENY', async () => {
    const db  = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    const ref = rollupRef(db, AGENT_ID, MONTH_KEY);
    await assertFails(setDoc(ref, { managerId: AGENT_ID, tenantId: TENANT_ID, monthKey: MONTH_KEY, managerRole: 'agent', managerRoleRank: 0, branchId: BRANCH_A, unitId: UM1_ID, candidatesAssessed: 1, agentsContracted: 0, status: 'draft', updatedAt: new Date() }));
  });

  await t('4. UM forges managerId → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM2_ID, MONTH_KEY);  // target UM2's doc
    const payload = { ...validPayload(UM2_ID, 'unit_manager', 1, BRANCH_B, UM2_ID) };  // managerId != caller
    await assertFails(setDoc(ref, payload));
  });

  await t('5. UM sends wrong managerRoleRank (rank 2 for unit_manager) → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-03');
    await assertFails(setDoc(ref, validPayload(UM1_ID, 'unit_manager', 2, BRANCH_A, UM1_ID)));  // rank 2 != roleRank()=1
  });

  await t('6. UM sends negative candidatesAssessed → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-06');
    const payload = { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), candidatesAssessed: -1 };
    await assertFails(setDoc(ref, payload));
  });

  await t('7. UM sends negative agentsContracted → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-07');
    const payload = { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), agentsContracted: -2 };
    await assertFails(setDoc(ref, payload));
  });

  await t('8. UM omits required key (monthKey missing) → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-08');
    const { monthKey: _mk, ...noMonthKey } = validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID);
    await assertFails(setDoc(ref, noMonthKey));
  });

  await t('9. UM sends bad status value → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, '2026-09');
    await assertFails(setDoc(ref, { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), status: 'approved' }));
  });

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  await t('10. Owner updates own rollup → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, MONTH_KEY);
    await assertSucceeds(setDoc(ref, { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), candidatesAssessed: 5 }));
  });

  await t('11. Peer UM updates another UM rollup → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    const ref = rollupRef(db, UM1_ID, MONTH_KEY);  // UM1's doc
    await assertFails(setDoc(ref, validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID)));
  });

  // ── GET ─────────────────────────────────────────────────────────────────────

  await t('12. Owner reads own rollup (doc exists) → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(rollupRef(db, UM1_ID, MONTH_KEY)));
  });

  await t('13. Owner pre-write get on non-existent doc (rollupId prefix check) → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    // Doc for '2099-01' does not exist → resource == null → prefix check
    await assertSucceeds(getDoc(rollupRef(db, UM1_ID, '2099-01')));
  });

  await t('14. Non-owner reads with non-matching prefix → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    // UM2 tries to read UM1's doc via prefix check path (doc doesn't exist in UM2's branch)
    await assertFails(getDoc(rollupRef(db, UM1_ID, '2099-01')));
  });

  await t('15. BM same-branch reads UM rollup → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(rollupRef(db, UM1_ID, MONTH_KEY)));
  });

  await t('16. BM other-branch reads UM rollup → DENY', async () => {
    const db  = testEnv.authenticatedContext(BM2_ID, authToken('branch_manager')).firestore();
    await assertFails(getDoc(rollupRef(db, UM1_ID, MONTH_KEY)));
  });

  await t('17. SM reads any rollup (tenant-wide) → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager')).firestore();
    await assertSucceeds(getDoc(rollupRef(db, UM1_ID, MONTH_KEY)));
  });

  await t('18. UM reads BM rollup (downline/peer — rank mismatch) → DENY', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(rollupRef(db, BM1_ID, MONTH_KEY)));
  });

  // ── LIST ────────────────────────────────────────────────────────────────────

  await t('19. BM own-branch list → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    const q   = query(
      collection(db, `tenants/${TENANT_ID}/managerMonthlyRollups`),
      where('branchId', '==', BRANCH_A),
      where('monthKey', '==', MONTH_KEY),
    );
    await assertSucceeds(getDocs(q));
  });

  await t('20. SM tenant-wide list → ALLOW', async () => {
    const db  = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager')).firestore();
    const q   = query(
      collection(db, `tenants/${TENANT_ID}/managerMonthlyRollups`),
      where('monthKey', '==', MONTH_KEY),
    );
    await assertSucceeds(getDocs(q));
  });

  await t('21. UM list → DENY (rank < 2)', async () => {
    const db  = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const q   = query(
      collection(db, `tenants/${TENANT_ID}/managerMonthlyRollups`),
      where('monthKey', '==', MONTH_KEY),
    );
    await assertFails(getDocs(q));
  });

  // ── Teardown ────────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
