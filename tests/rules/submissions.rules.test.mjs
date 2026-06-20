/**
 * Emulator rules tests — submissions collection.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/submissions.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (31 cases):
 *   allow get
 *     1. Agent reads own submission → ALLOW
 *     2. Agent reads another agent's submission → DENY
 *     3. BM reads own-branch submission → ALLOW
 *     4. UM reads submission where unitId == callerUid → ALLOW
 *     5. UM reads submission where unitId != callerUid → DENY
 *     6. Kiosk reads submission → ALLOW
 *     7. Cross-tenant auth → DENY
 *
 *   allow get — non-existent doc (null resource; fix/submissions-get-nonexistent-draft)
 *    27. Owner reads own NON-EXISTENT submission (fresh week) → ALLOW
 *    28. Non-owner reads another's NON-EXISTENT submission → DENY (existence-oracle guard)
 *    29. Unsigned reads NON-EXISTENT submission → DENY
 *    30. Manager reads NON-EXISTENT non-owned submission → DENY (owner arm owner-scoped)
 *    31. Cross-tenant agent reads NON-EXISTENT doc in this tenant → DENY (tenant isolation; Gemini HIGH)
 *
 *   allow list (CRITICAL — `canAccessOwn` arm was dropped in SHAKEDOWN-002B
 *               regression; restored in hotfix PR #298; BM isolated in Slice 2)
 *     8.  Agent self-list (agentId == uid query) → ALLOW
 *     9.  Agent lists another agent's docs → DENY
 *    10.  BM unconstrained list (no branchId filter) → DENY (crafted-query bypass closed)
 *    11.  UM lists own-unit docs (unitId == callerUid resource) → ALLOW
 *    12.  UM sees cross-unit doc → DENY
 *    24.  BM lists own-branch submissions (branchId filter) → ALLOW
 *    25.  BM reads other-branch submission (get) → DENY
 *    26.  BM crafted query targets other-branch (branchId filter != own branch) → DENY
 *
 *   allow create
 *    13. Agent creates own submission with matching branchId → ALLOW
 *    14. Agent creates submission for another agent → DENY
 *    15. BM creates submission (canManage path, no branchId constraint) → ALLOW
 *    22. Agent creates own submission with forged branchId → DENY
 *
 *   allow update
 *    16. Agent updates own draft submission with matching branchId → ALLOW
 *    17. Agent updates own non-draft (submitted) → DENY
 *    18. BM updates any submission → ALLOW
 *    19. Agent updates another agent's draft → DENY
 *    23. Agent updates own draft with forged branchId → DENY
 *
 *   allow delete
 *    20. BM delete → DENY
 *    21. Agent delete → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  doc,
} from 'firebase/firestore';

const PROJECT_ID  = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID   = 'submissions-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actor UIDs
const TA_ID     = 'ta1';
const BM_ID     = 'bm1';
const UM_ID     = 'um1';      // UM's UID also serves as the unit's ID
const AGENT1_ID = 'agent1';   // unit-a (UM_ID)
const AGENT2_ID = 'agent2';   // unit-b (different UM)
const KIOSK_ID  = 'kiosk1';
const AGENT_X   = 'agent-x';  // cross-tenant

// Submission doc IDs
const SUB_DRAFT_ID     = 'sub-draft-agent1';    // agent1's draft
const SUB_SUBMITTED_ID = 'sub-submitted-agent1'; // agent1's submitted
const SUB_AGENT2_ID    = 'sub-agent2';           // agent2's doc (different unit)
const SUB_BRANCH_B_ID  = 'sub-branch-b';         // submission from a different branch

function authToken(role, tenantId = TENANT_ID, extra = {}) {
  return { role, tenantId, ...extra };
}

function userRef(db, uid, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/users/${uid}`);
}

function subRef(db, subId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/submissions/${subId}`);
}

function draftDoc(agentId, unitId) {
  return {
    agentId,
    unitId,
    branchId:     'branch-a',
    tenantId:     TENANT_ID,
    status:       'draft',
    weekStarting: '2026-05-19',
    apiSold:      0,
    applicationsSold: 0,
  };
}

function submittedDoc(agentId, unitId) {
  return { ...draftDoc(agentId, unitId), status: 'submitted' };
}

function branchBDoc(agentId) {
  return {
    agentId,
    unitId:       null,
    branchId:     'branch-b',   // different branch from BM_ID's claim ('branch-a')
    tenantId:     TENANT_ID,
    status:       'submitted',
    weekStarting: '2026-05-19',
    apiSold:      0,
    applicationsSold: 0,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const user = (uid, role, unitId = null) => ({
      uid, role, tenantId: TENANT_ID, branchId: 'branch-a', unitId, name: `User ${uid}`, active: true,
    });

    await setDoc(userRef(db, TA_ID),     user(TA_ID,     'tenant_admin'));
    await setDoc(userRef(db, BM_ID),     user(BM_ID,     'branch_manager'));
    await setDoc(userRef(db, UM_ID),     user(UM_ID,     'unit_manager', UM_ID));
    await setDoc(userRef(db, AGENT1_ID), user(AGENT1_ID, 'agent',        UM_ID));
    await setDoc(userRef(db, AGENT2_ID), user(AGENT2_ID, 'agent',        'um2'));

    await setDoc(subRef(db, SUB_DRAFT_ID),     draftDoc(AGENT1_ID, UM_ID));
    await setDoc(subRef(db, SUB_SUBMITTED_ID), submittedDoc(AGENT1_ID, UM_ID));
    await setDoc(subRef(db, SUB_AGENT2_ID),    submittedDoc(AGENT2_ID, 'um2'));
    await setDoc(subRef(db, SUB_BRANCH_B_ID),  branchBDoc('agent-b2'));
  });
}

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.slice(0, 200) ?? err}`);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Submissions — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore:  { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── allow get ─────────────────────────────────────────────────────────────
  console.log('\nallow get:');

  await t('1. Agent reads own submission → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertSucceeds(getDoc(subRef(db, SUB_DRAFT_ID)));
  });

  await t("2. Agent reads another agent's submission → DENY", async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(getDoc(subRef(db, SUB_AGENT2_ID)));
  });

  await t('3. BM reads own-branch submission → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    await assertSucceeds(getDoc(subRef(db, SUB_DRAFT_ID)));
  });

  await t('4. UM reads submission where unitId == callerUid → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(subRef(db, SUB_DRAFT_ID)));
  });

  await t('5. UM reads submission where unitId != callerUid → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(subRef(db, SUB_AGENT2_ID)));
  });

  await t('6. Kiosk reads submission → ALLOW', async () => {
    const db = testEnv.authenticatedContext(KIOSK_ID, authToken('kiosk')).firestore();
    await assertSucceeds(getDoc(subRef(db, SUB_DRAFT_ID)));
  });

  await t('7. Cross-tenant auth → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(subRef(db, SUB_DRAFT_ID)));
  });

  // ── allow get — non-existent-doc arm (fix/submissions-get-nonexistent-draft) ──
  // The wizard's getDraft + aggregateCurrentWeekDaily's pre-write getDoc read
  // submissions/{uid}_{weekStarting} for a not-yet-started week → the doc is
  // absent → resource == null. Without the owner arm, canAccessOwn(resource.data.
  // agentId) derefs null → deny, which breaks client-side daily→weekly aggregation.
  // Matrix: owner+existent (test 1) and non-owner+existent (test 2) above; the
  // four below cover the null-resource cases.
  console.log('\nallow get — non-existent doc (null resource):');

  await t('27. Owner reads own NON-EXISTENT submission (fresh week) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    // docId prefix == caller uid; doc never seeded → resource == null.
    await assertSucceeds(getDoc(subRef(db, `${AGENT1_ID}_2026-07-05`)));
  });

  await t('28. Non-owner reads another agent\'s NON-EXISTENT submission → DENY (existence-oracle guard)', async () => {
    // SECURITY-CRITICAL: agent1 must not be able to probe whether agent2's
    // (never-created) draft exists. docId prefix 'agent2' != caller 'agent1'.
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(getDoc(subRef(db, `${AGENT2_ID}_2026-07-05`)));
  });

  await t('29. Unsigned reads NON-EXISTENT submission → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(subRef(db, `${AGENT1_ID}_2026-07-05`)));
  });

  await t('30. Manager reads NON-EXISTENT non-owned submission → DENY (owner arm does not leak to managers)', async () => {
    // The new arm is owner-scoped (id prefix == uid); a BM hitting a missing
    // doc they do not "own" by id falls through to the manager arms, which deref
    // resource.data on null → deny. Confirms the arm grants managers nothing new.
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    await assertFails(getDoc(subRef(db, `${AGENT1_ID}_2026-07-05`)));
  });

  await t('31. Cross-tenant agent reads NON-EXISTENT doc in this tenant (own-uid prefix) → DENY (tenant isolation)', async () => {
    // Gemini HIGH: the null-resource owner arm must still enforce tenant scope.
    // An agent from OTHER_TENANT crafts a path in TENANT_ID with their own uid as
    // the docId prefix; getTenantId() ('other-tenant') != tenantId ('...test-tenant')
    // → the arm is false → DENY. Without the tenant check this would wrongly ALLOW.
    const db = testEnv.authenticatedContext(AGENT_X, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(subRef(db, `${AGENT_X}_2026-07-05`, TENANT_ID)));
  });

  // ── allow list ────────────────────────────────────────────────────────────
  console.log('\nallow list (CRITICAL — regression vector from SHAKEDOWN-002B / hotfix PR #298):');

  await t('8. Agent self-list (agentId == uid query) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('agentId', '==', AGENT1_ID),
    );
    await assertSucceeds(getDocs(q));
  });

  await t("9. Agent lists another agent's docs → DENY", async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('agentId', '==', AGENT2_ID),
    );
    await assertFails(getDocs(q));
  });

  await t('10. BM unconstrained list (no branchId filter) → DENY (crafted-query bypass closed)', async () => {
    // BM has branchId claim but issues no where('branchId') constraint — Firestore cannot
    // guarantee every result passes the branch-isolation rule → query DENIED.
    // This is the closure proof: denormalization + this rule closes the bypass.
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    await assertFails(getDocs(collection(db, `tenants/${TENANT_ID}/submissions`)));
  });

  await t('11. UM own-unit list (unitId == callerUid resource) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('unitId', '==', UM_ID),
    );
    await assertSucceeds(getDocs(q));
  });

  await t('12. UM sees cross-unit submission → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_ID, authToken('unit_manager')).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('unitId', '==', 'um2'),
    );
    await assertFails(getDocs(q));
  });

  await t('24. BM lists own-branch submissions (branchId filter) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('branchId', '==', 'branch-a'),
    );
    await assertSucceeds(getDocs(q));
  });

  await t('25. BM reads other-branch submission (get) → DENY', async () => {
    // SUB_BRANCH_B_ID has branchId='branch-b'; BM token has branchId='branch-a'.
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    await assertFails(getDoc(subRef(db, SUB_BRANCH_B_ID)));
  });

  await t('26. BM crafted query targets other-branch (branchId filter != own branch) → DENY', async () => {
    // BM tries to list submissions of another branch by explicitly filtering for it —
    // rule checks resource.data.branchId == token.branchId ('branch-b' != 'branch-a') → DENY.
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager', TENANT_ID, { branchId: 'branch-a' })).firestore();
    const q  = query(
      collection(db, `tenants/${TENANT_ID}/submissions`),
      where('branchId', '==', 'branch-b'),
    );
    await assertFails(getDocs(q));
  });

  // ── allow create ──────────────────────────────────────────────────────────
  console.log('\nallow create:');

  await t('13. Agent creates own submission with matching branchId → ALLOW', async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-a' })
    ).firestore();
    await assertSucceeds(
      setDoc(subRef(db, 'new-agent1-sub'), draftDoc(AGENT1_ID, UM_ID)),
    );
  });

  await t("14. Agent creates submission for another agent → DENY", async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-a' })
    ).firestore();
    await assertFails(
      setDoc(subRef(db, 'new-agent2-by-agent1'), draftDoc(AGENT2_ID, 'um2')),
    );
  });

  await t('15. BM creates submission (canManage path, no branchId constraint) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(
      setDoc(subRef(db, 'bm-created-sub'), draftDoc(AGENT1_ID, UM_ID)),
    );
  });

  await t('22. Agent creates own submission with forged branchId → DENY', async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-a' })
    ).firestore();
    await assertFails(
      setDoc(subRef(db, 'new-agent1-forged'), {
        ...draftDoc(AGENT1_ID, UM_ID),
        branchId: 'branch-b',   // forged — does not match token branchId 'branch-a'
      }),
    );
  });

  // ── allow update ──────────────────────────────────────────────────────────
  console.log('\nallow update:');

  await t('16. Agent updates own draft submission with matching branchId → ALLOW', async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-a' })
    ).firestore();
    // updateDoc merges; request.resource.data.branchId comes from the existing doc ('branch-a')
    await assertSucceeds(updateDoc(subRef(db, SUB_DRAFT_ID), { apiSold: 5000 }));
  });

  await t('17. Agent updates own submitted (non-draft) → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(updateDoc(subRef(db, SUB_SUBMITTED_ID), { apiSold: 5000 }));
  });

  await t('18. BM updates any submission → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(subRef(db, SUB_SUBMITTED_ID), { apiSold: 9000 }));
  });

  await t("19. Agent updates another agent's draft → DENY", async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-a' })
    ).firestore();
    // agent2's sub is submitted but test is about ownership, not status
    await assertFails(updateDoc(subRef(db, SUB_AGENT2_ID), { apiSold: 1 }));
  });

  await t('23. Agent updates own draft with forged branchId → DENY', async () => {
    const db = testEnv.authenticatedContext(
      AGENT1_ID, authToken('agent', TENANT_ID, { branchId: 'branch-b' })  // token has wrong branch
    ).firestore();
    // The existing draft doc has branchId 'branch-a'; token says 'branch-b'
    // request.resource.data.branchId resolves to 'branch-a' (existing field, not overwritten)
    // 'branch-a' != 'branch-b' → DENY
    await assertFails(updateDoc(subRef(db, SUB_DRAFT_ID), { apiSold: 999 }));
  });

  // ── allow delete ──────────────────────────────────────────────────────────
  console.log('\nallow delete:');

  await t('20. BM delete → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_ID, authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(subRef(db, SUB_DRAFT_ID)));
  });

  await t('21. Agent delete → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT1_ID, authToken('agent')).firestore();
    await assertFails(deleteDoc(subRef(db, SUB_DRAFT_ID)));
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  await testEnv.cleanup();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed  (expected 31)`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
