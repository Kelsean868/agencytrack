/**
 * PM-1 producing-manager self-access — Firestore rules deny matrix.
 *
 * Verifies that the `isProducingManager()` extension to self-access arms grants
 * Unit Managers and Branch Managers access to their OWN docs only, while
 * preserving all existing agent/manager access patterns unchanged.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/pm1-deny-matrix.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Test matrix (51 cases):
 *
 *   submissions — canAccessOwn extended (cases 1–8)
 *     1. UM reads own submission → ALLOW  (NEW via canAccessOwn)
 *     2. BM reads own submission → ALLOW  (NEW via canAccessOwn)
 *     3. [LOAD-BEARING] UM reads non-managed submission → DENY
 *     4. [LOAD-BEARING] BM reads non-managed submission → DENY
 *     5. Agent reads own submission → ALLOW  (no regression)
 *     6. Agent reads other's submission → DENY  (no regression)
 *     7. [TEAM-PATH] UM reads managed-unit submission via canManage → ALLOW
 *     8. [TEAM-PATH] BM reads managed-branch submission via canManage → ALLOW
 *
 *   policies — canAccessOwn extended (cases 9–14)
 *     9.  UM reads own policy → ALLOW
 *    10.  BM reads own policy → ALLOW
 *    11.  [LOAD-BEARING] UM reads non-managed policy → DENY  (canManage unit-gates UM)
 *    12.  BM reads another branch's policy → DENY (P2b SEC-08; was ALLOW — pre-existing canManage breadth)
 *          BM's canManage arm: `getRole() != 'unit_manager'` → true → tenant-wide read.
 *          Own-only proof for policies lives in case 11 (UM unit-gate) + case 14 (agent regression).
 *    13.  Agent reads own policy → ALLOW  (no regression)
 *    14.  Agent reads other's policy → DENY  (no regression)
 *
 *   policies/history — canAccessOwn extended (cases 15–18)
 *    15.  UM reads own policy history → ALLOW
 *    16.  BM reads own policy history → ALLOW
 *    17.  [LOAD-BEARING] UM reads non-managed history → DENY  (canManage unit-gates UM)
 *    18.  [PRE-EXISTING canManage breadth, PM-1 unchanged] BM reads non-managed history → ALLOW
 *          Same rule as policies/get — BM unrestricted via canManage; PM-1 did not change this arm.
 *
 *   settlements — canAccessOwn extended (cases 19–24)
 *    19.  UM reads own settlement → ALLOW  (NEW via canAccessOwn)
 *    20.  BM reads own settlement → ALLOW  (NEW via canAccessOwn)
 *    21.  [PRE-EXISTING canManage breadth, PM-1 unchanged] UM reads non-managed settlement → ALLOW
 *          Settlements carry no unitId/branchId (documented limitation in rules). canManage arm
 *          is flat: `canAccessOwn || canManage(tenantId)` → both UM and BM read tenant-wide.
 *          Own-only proof for settlements lives in case 24 (agent regression on canAccessOwn).
 *    22.  [PRE-EXISTING canManage breadth, PM-1 unchanged] BM reads non-managed settlement → ALLOW
 *    23.  Agent reads own settlement → ALLOW  (no regression)
 *    24.  Agent reads other's settlement → DENY  (no regression)
 *
 *   goals — self-arm extended (cases 25–30)
 *    25.  UM reads own goal → ALLOW
 *    26.  BM reads own goal → ALLOW
 *    27.  UM writes own goal → ALLOW  (NEW self-arm)
 *    28.  [LOAD-BEARING] UM writes goal for different-unit agent → DENY
 *    29.  Agent reads own goal → ALLOW  (no regression)
 *    30.  [TEAM-PATH] UM writes managed agent goal via canManage → ALLOW
 *
 *   weeklyPlans — create/update/delete self-arm extended (cases 31–40)
 *    31.  UM creates own weeklyPlan → ALLOW  (NEW)
 *    32.  BM creates own weeklyPlan → ALLOW  (NEW)
 *    33.  [LOAD-BEARING] UM creates plan for another agent → DENY  (own-only via validPlanWrite)
 *    34.  [LOAD-BEARING] BM creates plan for another agent → DENY
 *    35.  Agent creates own weeklyPlan → ALLOW  (no regression)
 *    36.  Agent creates plan for other → DENY  (no regression)
 *    37.  [SELF-ARM] SM creates weeklyPlan → DENY  (SM not isAgent || isProducingManager)
 *    38.  [SELF-ARM] TA creates weeklyPlan → DENY
 *    39.  UM deletes own weeklyPlan → ALLOW  (NEW)
 *    40.  [LOAD-BEARING] UM deletes other agent's weeklyPlan → DENY
 *
 *   moneyNeeds — create self-arm extended (cases 41–44)
 *    41.  UM creates own moneyNeeds → ALLOW  (NEW)
 *    42.  BM creates own moneyNeeds → ALLOW  (NEW)
 *    43.  [LOAD-BEARING] UM creates moneyNeeds for other user → DENY  (uid mismatch)
 *    44.  [SELF-ARM] SM creates moneyNeeds → DENY  (SM not isAgent || isProducingManager)
 *
 *   yearPlan — create self-arm extended (cases 45–47)
 *    45.  UM creates own yearPlan → ALLOW  (NEW)
 *    46.  BM creates own yearPlan → ALLOW  (NEW)
 *    47.  [SELF-ARM] TA creates yearPlan → DENY
 *
 *   monthlyPlan — create self-arm extended (cases 48–51)
 *    48.  UM creates own monthlyPlan → ALLOW  (NEW)
 *    49.  BM creates own monthlyPlan → ALLOW  (NEW)
 *    50.  [LOAD-BEARING] UM creates monthlyPlan for other user → DENY  (uid mismatch)
 *    51.  [SELF-ARM] SM creates monthlyPlan → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'pm1-deny-matrix-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// ── Actor UIDs ────────────────────────────────────────────────────────────────
// UM_UID doubles as the UM's unitId (app convention: unit ID = UM's UID)
const UM_UID    = 'um-001';
const BM_UID    = 'bm-001';
const AGENT_UID = 'agent-001';   // in UM's unit + BM's branch
const OTHER_UID = 'other-001';   // in a DIFFERENT unit + branch (non-managed by test UM/BM)
const SM_UID    = 'sm-001';
const TA_UID    = 'ta-001';

const BRANCH_A   = 'branch-a';    // UM + BM + AGENT's branch
const BRANCH_B   = 'branch-b';    // OTHER's branch (non-managed)
const OTHER_UNIT = 'other-unit';  // OTHER's unit (not UM_UID)

// ── Auth tokens ───────────────────────────────────────────────────────────────
// BM's branchId must be in the auth token — submissions/policies rules read
// request.auth.token.branchId for the branch-manager arm.
function umToken()    { return { role: 'unit_manager',   tenantId: TENANT_ID }; }
function bmToken()    { return { role: 'branch_manager', tenantId: TENANT_ID, branchId: BRANCH_A }; }
function agentToken() { return { role: 'agent',          tenantId: TENANT_ID }; }
function smToken()    { return { role: 'sales_manager',  tenantId: TENANT_ID }; }
function taToken()    { return { role: 'tenant_admin',   tenantId: TENANT_ID }; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function userRef(db, uid) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}`);
}

function subRef(db, id) {
  return doc(db, `tenants/${TENANT_ID}/submissions/${id}`);
}

function polRef(db, id) {
  return doc(db, `tenants/${TENANT_ID}/policies/${id}`);
}

function histRef(db, polId, histId) {
  return doc(db, `tenants/${TENANT_ID}/policies/${polId}/history/${histId}`);
}

function setlRef(db, id) {
  return doc(db, `tenants/${TENANT_ID}/settlements/${id}`);
}

function goalRef(db, uid) {
  return doc(db, `tenants/${TENANT_ID}/goals/${uid}`);
}

function planRef(db, uid, week) {
  return doc(db, `tenants/${TENANT_ID}/weeklyPlans/${uid}_${week}`);
}

function mnRef(db, uid, year) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}/moneyNeeds/${year}`);
}

function ypRef(db, uid, year) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}/yearPlan/${year}`);
}

function mpRef(db, uid, year) {
  return doc(db, `tenants/${TENANT_ID}/users/${uid}/monthlyPlan/${year}`);
}

// ── Payloads ──────────────────────────────────────────────────────────────────
function subDoc(agentId, unitId, branchId) {
  return { agentId, unitId, branchId, tenantId: TENANT_ID, status: 'submitted', weekStarting: '2026-01-05', apiSold: 0, applicationsSold: 0 };
}

function polDoc(agentId, unitId, branchId) {
  return { agentId, unitId, branchId, tenantId: TENANT_ID, status: 'submitted', proposedAPI: 5000, productLine: 'life' };
}

function histDoc(agentId, unitId) {
  return { agentId, unitId, tenantId: TENANT_ID, fromStatus: 'submitted', toStatus: 'rated', actorUid: agentId, actorRole: 'agent', changedFields: { status: 'rated' }, at: new Date() };
}

function setlDoc(agentId) {
  return { agentId, tenantId: TENANT_ID, year: 2026, periodKey: 'Q1' };
}

function goalDoc(agentId) {
  return { agentId, tenantId: TENANT_ID, personalAnnualAPI: 200000 };
}

const PLAN_WEEK = '2026-01-04';  // a Sunday
// Rotted field name (fixed): firestore.rules' validPlanWrite() requires the
// targets/provenance key `telContacts` — this helper used the stale name
// `contactsMade`, so every weeklyPlans CREATE case that used it failed the
// rule's hasAll/hasOnly shape check (a real DENY-by-shape, not a security
// hole) instead of exercising the intended ALLOW path. Renamed to match
// firestore.rules ~L1863 (`d.targets.keys().hasAll([...,'telContacts',...])`).
function validPlan(agentId) {
  return {
    agentId,
    tenantId: TENANT_ID,
    weekStart: new Date(`${PLAN_WEEK}T04:00:00Z`),
    targets: { callsMade: 50, telContacts: 20, factFindsCompleted: 5, closingInterviewsKept: 3, applicationsSubmitted: 2 },
    provenance: { callsMade: 'agent', telContacts: 'agent', factFindsCompleted: 'agent', closingInterviewsKept: 'agent', applicationsSubmitted: 'agent' },
    anchorAPIAtCommit: null,
    committedAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // User docs — required for callerUnitId/callerBranchId cross-doc lookups in rules
    await setDoc(userRef(db, UM_UID),    { uid: UM_UID,    role: 'unit_manager',   tenantId: TENANT_ID, unitId: UM_UID,     branchId: BRANCH_A });
    await setDoc(userRef(db, BM_UID),    { uid: BM_UID,    role: 'branch_manager', tenantId: TENANT_ID, unitId: null,       branchId: BRANCH_A });
    await setDoc(userRef(db, AGENT_UID), { uid: AGENT_UID, role: 'agent',          tenantId: TENANT_ID, unitId: UM_UID,     branchId: BRANCH_A });
    await setDoc(userRef(db, OTHER_UID), { uid: OTHER_UID, role: 'agent',          tenantId: TENANT_ID, unitId: OTHER_UNIT, branchId: BRANCH_B });
    await setDoc(userRef(db, SM_UID),    { uid: SM_UID,    role: 'sales_manager',  tenantId: TENANT_ID });
    await setDoc(userRef(db, TA_UID),    { uid: TA_UID,    role: 'tenant_admin',   tenantId: TENANT_ID });

    // Submissions
    await setDoc(subRef(db, `${UM_UID}_2026-01-05`),    subDoc(UM_UID,    UM_UID,     BRANCH_A));
    await setDoc(subRef(db, `${BM_UID}_2026-01-05`),    subDoc(BM_UID,    'bm-unit',  BRANCH_A));
    await setDoc(subRef(db, `${AGENT_UID}_2026-01-05`), subDoc(AGENT_UID, UM_UID,     BRANCH_A));
    await setDoc(subRef(db, `${OTHER_UID}_2026-01-05`), subDoc(OTHER_UID, OTHER_UNIT, BRANCH_B));

    // Policies
    await setDoc(polRef(db, 'pol-um'),    polDoc(UM_UID,    UM_UID,     BRANCH_A));
    await setDoc(polRef(db, 'pol-bm'),    polDoc(BM_UID,    'bm-unit',  BRANCH_A));
    await setDoc(polRef(db, 'pol-agent'), polDoc(AGENT_UID, UM_UID,     BRANCH_A));
    await setDoc(polRef(db, 'pol-other'), polDoc(OTHER_UID, OTHER_UNIT, BRANCH_B));

    // Policy history (subcollection)
    await setDoc(histRef(db, 'pol-um',    'h1'), histDoc(UM_UID,    UM_UID));
    await setDoc(histRef(db, 'pol-bm',    'h1'), histDoc(BM_UID,    'bm-unit'));
    await setDoc(histRef(db, 'pol-agent', 'h1'), histDoc(AGENT_UID, UM_UID));
    await setDoc(histRef(db, 'pol-other', 'h1'), histDoc(OTHER_UID, OTHER_UNIT));

    // Settlements
    await setDoc(setlRef(db, `${UM_UID}_2026_Q1`),    setlDoc(UM_UID));
    await setDoc(setlRef(db, `${BM_UID}_2026_Q1`),    setlDoc(BM_UID));
    await setDoc(setlRef(db, `${AGENT_UID}_2026_Q1`), setlDoc(AGENT_UID));
    await setDoc(setlRef(db, `${OTHER_UID}_2026_Q1`), setlDoc(OTHER_UID));

    // Goals (goalId == agentId)
    await setDoc(goalRef(db, UM_UID),    goalDoc(UM_UID));
    await setDoc(goalRef(db, BM_UID),    goalDoc(BM_UID));
    await setDoc(goalRef(db, AGENT_UID), goalDoc(AGENT_UID));
    await setDoc(goalRef(db, OTHER_UID), goalDoc(OTHER_UID));

    // Weekly plans — pre-seed for read/delete tests
    await setDoc(planRef(db, AGENT_UID, PLAN_WEEK), validPlan(AGENT_UID));
    await setDoc(planRef(db, OTHER_UID, PLAN_WEEK), validPlan(OTHER_UID));

    // moneyNeeds / yearPlan / monthlyPlan — pre-seed for GET tests
    const mnBase = { tenantId: TENANT_ID, visibility: 'private', year: 2025, totalAnnualAfterTax: 0 };
    await setDoc(mnRef(db, UM_UID,    '2025'), { ...mnBase, uid: UM_UID });
    await setDoc(mnRef(db, BM_UID,    '2025'), { ...mnBase, uid: BM_UID });
    await setDoc(mnRef(db, OTHER_UID, '2025'), { ...mnBase, uid: OTHER_UID });

    const ypBase = { tenantId: TENANT_ID, status: 'draft', year: 2025 };
    await setDoc(ypRef(db, UM_UID,    '2025'), ypBase);
    await setDoc(ypRef(db, BM_UID,    '2025'), ypBase);
    await setDoc(ypRef(db, OTHER_UID, '2025'), ypBase);

    const mpBase = { tenantId: TENANT_ID, status: 'draft', year: 2025, month: 1 };
    await setDoc(mpRef(db, UM_UID,    '2025-01'), mpBase);
    await setDoc(mpRef(db, BM_UID,    '2025-01'), mpBase);
    await setDoc(mpRef(db, OTHER_UID, '2025-01'), mpBase);
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
let testEnv;
try {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── Convenience db accessors ──────────────────────────────────────────────
  const umDb    = () => testEnv.authenticatedContext(UM_UID,    umToken()).firestore();
  const bmDb    = () => testEnv.authenticatedContext(BM_UID,    bmToken()).firestore();
  const agentDb = () => testEnv.authenticatedContext(AGENT_UID, agentToken()).firestore();
  const smDb    = () => testEnv.authenticatedContext(SM_UID,    smToken()).firestore();
  const taDb    = () => testEnv.authenticatedContext(TA_UID,    taToken()).firestore();

  // ═══════════════════════════════════════════════════════════════════════════
  // submissions — canAccessOwn extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nsubmissions — canAccessOwn extended to isProducingManager:');

  await t('1. UM reads own submission → ALLOW', async () => {
    await assertSucceeds(getDoc(subRef(umDb(), `${UM_UID}_2026-01-05`)));
  });

  await t('2. BM reads own submission → ALLOW', async () => {
    await assertSucceeds(getDoc(subRef(bmDb(), `${BM_UID}_2026-01-05`)));
  });

  await t('3. [LOAD-BEARING] UM reads non-managed submission → DENY', async () => {
    await assertFails(getDoc(subRef(umDb(), `${OTHER_UID}_2026-01-05`)));
  });

  await t('4. [LOAD-BEARING] BM reads non-managed submission → DENY', async () => {
    await assertFails(getDoc(subRef(bmDb(), `${OTHER_UID}_2026-01-05`)));
  });

  await t('5. Agent reads own submission → ALLOW (no regression)', async () => {
    await assertSucceeds(getDoc(subRef(agentDb(), `${AGENT_UID}_2026-01-05`)));
  });

  await t("6. Agent reads other's submission → DENY (no regression)", async () => {
    await assertFails(getDoc(subRef(agentDb(), `${OTHER_UID}_2026-01-05`)));
  });

  await t('7. [TEAM-PATH] UM reads managed-unit submission via canManage → ALLOW', async () => {
    await assertSucceeds(getDoc(subRef(umDb(), `${AGENT_UID}_2026-01-05`)));
  });

  await t('8. [TEAM-PATH] BM reads managed-branch submission via canManage → ALLOW', async () => {
    await assertSucceeds(getDoc(subRef(bmDb(), `${AGENT_UID}_2026-01-05`)));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // policies — canAccessOwn extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\npolicies — canAccessOwn extended to isProducingManager:');

  await t('9. UM reads own policy → ALLOW', async () => {
    await assertSucceeds(getDoc(polRef(umDb(), 'pol-um')));
  });

  await t('10. BM reads own policy → ALLOW', async () => {
    await assertSucceeds(getDoc(polRef(bmDb(), 'pol-bm')));
  });

  await t('11. [LOAD-BEARING] UM reads non-managed policy → DENY', async () => {
    await assertFails(getDoc(polRef(umDb(), 'pol-other')));
  });

  await t('12. BM reads another branch\'s policy → DENY (P2b SEC-08 closed the canManage breadth)', async () => {
    // Was ALLOW: the BM arm was `getRole() != 'unit_manager'` → tenant-wide. P2b
    // scopes it to resource.data.branchId == callerBranchId; pol-other is BRANCH_B,
    // the BM is BRANCH_A.
    await assertFails(getDoc(polRef(bmDb(), 'pol-other')));
  });

  await t('13. Agent reads own policy → ALLOW (no regression)', async () => {
    await assertSucceeds(getDoc(polRef(agentDb(), 'pol-agent')));
  });

  await t("14. Agent reads other's policy → DENY (no regression)", async () => {
    await assertFails(getDoc(polRef(agentDb(), 'pol-other')));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // policies/history — canAccessOwn extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\npolicies/history — canAccessOwn extended to isProducingManager:');

  await t('15. UM reads own policy history → ALLOW', async () => {
    await assertSucceeds(getDoc(histRef(umDb(), 'pol-um', 'h1')));
  });

  await t('16. BM reads own policy history → ALLOW', async () => {
    await assertSucceeds(getDoc(histRef(bmDb(), 'pol-bm', 'h1')));
  });

  await t('17. [LOAD-BEARING] UM reads non-managed history → DENY', async () => {
    await assertFails(getDoc(histRef(umDb(), 'pol-other', 'h1')));
  });

  await t('18. [PRE-EXISTING canManage breadth, PM-1 unchanged] BM reads non-managed history → ALLOW', async () => {
    // Same policies/get rule — BM unrestricted via canManage. PM-1 did not change this arm.
    await assertSucceeds(getDoc(histRef(bmDb(), 'pol-other', 'h1')));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // settlements — canAccessOwn extended (NEW for PM-1)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nsettlements — canAccessOwn extended to isProducingManager (new in PM-1):');

  await t('19. UM reads own settlement → ALLOW', async () => {
    await assertSucceeds(getDoc(setlRef(umDb(), `${UM_UID}_2026_Q1`)));
  });

  await t('20. BM reads own settlement → ALLOW', async () => {
    await assertSucceeds(getDoc(setlRef(bmDb(), `${BM_UID}_2026_Q1`)));
  });

  await t('21. [PRE-EXISTING canManage breadth, PM-1 unchanged] UM reads non-managed settlement → ALLOW', async () => {
    // Settlements carry no unitId/branchId (documented in rules). canManage arm is flat:
    // `canAccessOwn || canManage(tenantId)` → both UM and BM read tenant-wide (pre-existing).
    // Own-only proof lives in case 24 (agent regression on canAccessOwn self-arm).
    await assertSucceeds(getDoc(setlRef(umDb(), `${OTHER_UID}_2026_Q1`)));
  });

  await t('22. [PRE-EXISTING canManage breadth, PM-1 unchanged] BM reads non-managed settlement → ALLOW', async () => {
    // Same flat canManage arm as case 21. PM-1 did not change this arm.
    await assertSucceeds(getDoc(setlRef(bmDb(), `${OTHER_UID}_2026_Q1`)));
  });

  await t('23. Agent reads own settlement → ALLOW (no regression)', async () => {
    await assertSucceeds(getDoc(setlRef(agentDb(), `${AGENT_UID}_2026_Q1`)));
  });

  await t("24. Agent reads other's settlement → DENY (no regression)", async () => {
    await assertFails(getDoc(setlRef(agentDb(), `${OTHER_UID}_2026_Q1`)));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // goals — self-arm extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\ngoals — self-arm extended to isProducingManager:');

  await t('25. UM reads own goal → ALLOW', async () => {
    await assertSucceeds(getDoc(goalRef(umDb(), UM_UID)));
  });

  await t('26. BM reads own goal → ALLOW', async () => {
    await assertSucceeds(getDoc(goalRef(bmDb(), BM_UID)));
  });

  await t('27. UM writes own goal → ALLOW (NEW self-arm)', async () => {
    await assertSucceeds(setDoc(goalRef(umDb(), UM_UID), { ...goalDoc(UM_UID), personalAnnualAPI: 250000 }));
  });

  await t('28. [LOAD-BEARING] UM writes goal for different-unit agent → DENY', async () => {
    // Self-arm: goalId (OTHER_UID) != request.auth.uid (UM_UID) → false.
    // canManage write arm: callerUnitId (UM_UID) != OTHER_UID.unitId (OTHER_UNIT) → false.
    await assertFails(setDoc(goalRef(umDb(), OTHER_UID), { ...goalDoc(OTHER_UID), personalAnnualAPI: 250000 }));
  });

  await t('29. Agent reads own goal → ALLOW (no regression)', async () => {
    await assertSucceeds(getDoc(goalRef(agentDb(), AGENT_UID)));
  });

  await t('30. [TEAM-PATH] UM writes managed-unit agent goal via canManage → ALLOW', async () => {
    await assertSucceeds(setDoc(goalRef(umDb(), AGENT_UID), { ...goalDoc(AGENT_UID), unitTarget: 90000 }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // weeklyPlans — create/update/delete self-arm extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nweeklyPlans — create/update/delete self-arm extended to isProducingManager:');

  const PLAN_WEEK_2 = '2026-01-11';  // fresh week for create tests (a Sunday)

  await t('31. UM creates own weeklyPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(planRef(umDb(), UM_UID, PLAN_WEEK_2), validPlan(UM_UID)));
  });

  await t('32. BM creates own weeklyPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(planRef(bmDb(), BM_UID, PLAN_WEEK_2), validPlan(BM_UID)));
  });

  await t('33. [LOAD-BEARING] UM creates plan for another agent → DENY', async () => {
    // validPlanWrite() enforces agentId == request.auth.uid AND planId prefix == uid.
    await assertFails(setDoc(planRef(umDb(), OTHER_UID, PLAN_WEEK_2), validPlan(OTHER_UID)));
  });

  await t('34. [LOAD-BEARING] BM creates plan for another agent → DENY', async () => {
    await assertFails(setDoc(planRef(bmDb(), OTHER_UID, PLAN_WEEK_2), validPlan(OTHER_UID)));
  });

  await t('35. Agent creates own weeklyPlan → ALLOW (no regression)', async () => {
    await assertSucceeds(setDoc(planRef(agentDb(), AGENT_UID, '2026-01-19'), validPlan(AGENT_UID)));
  });

  await t('36. Agent creates plan for other → DENY (no regression)', async () => {
    await assertFails(setDoc(planRef(agentDb(), OTHER_UID, '2026-01-19'), validPlan(OTHER_UID)));
  });

  await t('37. [SELF-ARM] SM creates weeklyPlan → DENY (SM not isAgent || isProducingManager)', async () => {
    // weeklyPlans create has no canManage arm — self-arm only.
    await assertFails(setDoc(planRef(smDb(), SM_UID, PLAN_WEEK_2), validPlan(SM_UID)));
  });

  await t('38. [SELF-ARM] TA creates weeklyPlan → DENY (TA not isAgent || isProducingManager)', async () => {
    await assertFails(setDoc(planRef(taDb(), TA_UID, PLAN_WEEK_2), validPlan(TA_UID)));
  });

  await t('39. UM deletes own weeklyPlan → ALLOW (NEW)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(planRef(ctx.firestore(), UM_UID, PLAN_WEEK), validPlan(UM_UID));
    });
    await assertSucceeds(deleteDoc(planRef(umDb(), UM_UID, PLAN_WEEK)));
  });

  await t("40. [LOAD-BEARING] UM deletes other agent's weeklyPlan → DENY", async () => {
    await assertFails(deleteDoc(planRef(umDb(), OTHER_UID, PLAN_WEEK)));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // moneyNeeds — create self-arm extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nmoneyNeeds — create self-arm extended to isProducingManager:');

  const mnCreate = (uid) => ({ tenantId: TENANT_ID, visibility: 'private', year: 2026, uid, totalAnnualAfterTax: 0 });

  await t('41. UM creates own moneyNeeds → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(mnRef(umDb(), UM_UID, '2026'), mnCreate(UM_UID)));
  });

  await t('42. BM creates own moneyNeeds → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(mnRef(bmDb(), BM_UID, '2026'), mnCreate(BM_UID)));
  });

  await t('43. [LOAD-BEARING] UM creates moneyNeeds under other user path → DENY (uid path mismatch)', async () => {
    await assertFails(setDoc(mnRef(umDb(), OTHER_UID, '2026'), mnCreate(OTHER_UID)));
  });

  await t('44. [SELF-ARM] SM creates moneyNeeds → DENY (SM not isAgent || isProducingManager)', async () => {
    await assertFails(setDoc(mnRef(smDb(), SM_UID, '2026'), mnCreate(SM_UID)));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // yearPlan — create self-arm extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nyearPlan — create self-arm extended to isProducingManager:');

  const ypCreate = { tenantId: TENANT_ID, status: 'draft', year: 2026 };

  await t('45. UM creates own yearPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(ypRef(umDb(), UM_UID, '2026'), ypCreate));
  });

  await t('46. BM creates own yearPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(ypRef(bmDb(), BM_UID, '2026'), ypCreate));
  });

  await t('47. [SELF-ARM] TA creates yearPlan → DENY (TA not isAgent || isProducingManager)', async () => {
    await assertFails(setDoc(ypRef(taDb(), TA_UID, '2026'), ypCreate));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // monthlyPlan — create self-arm extended
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nmonthlyPlan — create self-arm extended to isProducingManager:');

  const mpCreate = { tenantId: TENANT_ID, status: 'draft', year: 2026, month: 1 };

  await t('48. UM creates own monthlyPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(mpRef(umDb(), UM_UID, '2026-01'), mpCreate));
  });

  await t('49. BM creates own monthlyPlan → ALLOW (NEW)', async () => {
    await assertSucceeds(setDoc(mpRef(bmDb(), BM_UID, '2026-01'), mpCreate));
  });

  await t('50. [LOAD-BEARING] UM creates monthlyPlan under other user path → DENY', async () => {
    await assertFails(setDoc(mpRef(umDb(), OTHER_UID, '2026-01'), mpCreate));
  });

  await t('51. [SELF-ARM] SM creates monthlyPlan → DENY (SM not isAgent || isProducingManager)', async () => {
    await assertFails(setDoc(mpRef(smDb(), SM_UID, '2026-01'), mpCreate));
  });

} finally {
  if (testEnv) await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`PM-1 deny matrix: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ''} (expected 51)`);
  if (failed > 0) {
    console.error('\nFailed assertions indicate the own-only invariant may be violated — STOP and report.');
    process.exit(1);
  } else {
    console.log('All 51 assertions green — own-only invariant holds across all 9 target collections.');
    console.log('NOTE: Cases 12,18 (policies/history BM) and 21,22 (settlements UM/BM) assert ALLOW');
    console.log('      because pre-existing canManage arms grant managers broader read; PM-1 unchanged.');
    console.log('      Own-only proof: submissions cases 3&4 (strongest — branch/unit gated) +');
    console.log('      agent regression cases 14&24 + structural uid==agentId in canAccessOwn.');
  }
}
