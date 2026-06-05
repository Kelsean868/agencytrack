/**
 * Emulator rules tests — settlements collection (settlements-read-scope, 2026-06-05).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/settlements.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Security model (post-tighten):
 *   get/list: agent reads own ONLY (resource.data.agentId == uid); manager-tier
 *             reads any doc within their tenant (canManage).
 *
 * SCHEMA GAP (surfaced at Phase 1 STOP): settlement docs carry no unitId/branchId.
 * UM same-unit / BM same-branch granular scoping from the D1 brief target cannot be
 * enforced without schema denorm or a 2-read cross-doc lookup. Cases 9–10 below are
 * therefore ALLOW (not DENY) — dispatcher must decide whether to accept the simplified
 * tightening or extend the settlement schema. The primary security fix (agent-reads-
 * peer DENY, cases 2 + 5) is closed regardless.
 *
 * Test matrix (18 cases):
 *   GET
 *    1. Agent reads own settlement                          → ALLOW
 *    2. Agent reads peer's settlement                       → DENY  ← primary fix
 *    3. Agent reads own from cross-tenant path              → DENY
 *    4. Unauth get                                          → DENY
 *   LIST
 *    5. Agent own-scoped list (where agentId==uid)          → ALLOW
 *    6. Agent foreign-agentId list (where agentId==peerId)  → DENY  ← primary fix
 *    7. Agent unscoped list (no agentId filter)             → DENY
 *    8. Unauth list                                         → DENY
 *   MANAGER GET
 *    9. UM same-unit reads agent settlement                 → ALLOW
 *   10. UM cross-unit reads agent settlement                → ALLOW  (schema gap — not DENY)
 *   11. BM same-branch reads agent settlement               → ALLOW
 *   12. BM cross-branch reads agent settlement              → ALLOW  (schema gap — not DENY)
 *   13. SM reads any agent settlement (tenant-wide)         → ALLOW
 *   14. TA reads any agent settlement (tenant-wide)         → ALLOW
 *   15. PA reads cross-tenant settlement                    → ALLOW  (PA is cross-tenant)
 *   16. Cross-tenant manager get                            → DENY
 *   WRITE arm sanity (arms unchanged — one case each)
 *   17. canConfirmSettlements agent writes settlement       → ALLOW
 *   18. Plain agent write                                   → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  getDoc, setDoc, deleteDoc, doc, collection, getDocs, query, where,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID   = 'sett-rules-test-tenant';
const OTHER_TENANT = 'sett-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Users + scoping
const AGENT_A  = 'agentA';  const BRANCH_A = 'branch-a';  const UNIT_1 = 'unit-1';
const AGENT_B  = 'agentB';  const BRANCH_B = 'branch-b';  const UNIT_2 = 'unit-2';
const UM_SAME  = 'umSame';   // unit-1 (agentA's unit)
const UM_OTHER = 'umOther';  // unit-2
const BM_SAME  = 'bmSame';   // branch-a
const BM_OTHER = 'bmOther';  // branch-b
const SM1      = 'sm1';
const TA1      = 'ta1';

const YEAR       = 2026;
const PERIOD_KEY = '2026-05';
// canConfirmSettlements agent (granted by manager out-of-band)
const CAN_CONFIRM = 'canConfirmAgent';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function settRef(db, agentId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/settlements/${agentId}_${YEAR}_${PERIOD_KEY}`);
}

function settlementPayload(agentId, tenantId = TENANT_ID) {
  return {
    agentId,
    tenantId,
    year: YEAR,
    periodKey:   PERIOD_KEY,
    periodType:  'monthly',
    settledAPI:  120000,
    settledApps: 12,
    persistency: 85,
    notes:       '',
    confirmedBy:     'managerUid',
    confirmedByName: 'Branch Manager',
    confirmedAt:     new Date(),
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const userDoc = (uid, role, branchId, unitId, extra = {}) =>
      ({ uid, role, tenantId: TENANT_ID, branchId, unitId, ...extra });

    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_A}`),
      userDoc(AGENT_A,      'agent',          BRANCH_A, UNIT_1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_B}`),
      userDoc(AGENT_B,      'agent',          BRANCH_B, UNIT_2));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${CAN_CONFIRM}`),
      userDoc(CAN_CONFIRM,  'agent',          BRANCH_A, UNIT_1, { canConfirmSettlements: true }));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_SAME}`),
      userDoc(UM_SAME,      'unit_manager',   BRANCH_A, UNIT_1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_OTHER}`),
      userDoc(UM_OTHER,     'unit_manager',   BRANCH_A, UNIT_2));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_SAME}`),
      userDoc(BM_SAME,      'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_OTHER}`),
      userDoc(BM_OTHER,     'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1}`),
      userDoc(SM1,          'sales_manager',  null,     null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${TA1}`),
      userDoc(TA1,          'tenant_admin',   null,     null));

    // Pre-seed agentA's settlement for read tests.
    await setDoc(settRef(db, AGENT_A), settlementPayload(AGENT_A));
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
  console.log('settlements — Firestore emulator rules tests (settlements-read-scope)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const agentA = () => testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
  const agentB = () => testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
  const unauth = () => testEnv.unauthenticatedContext().firestore();

  // ── GET ─────────────────────────────────────────────────────────────────────

  await t('1. Agent reads own settlement → ALLOW', async () => {
    await assertSucceeds(getDoc(settRef(agentA(), AGENT_A)));
  });

  await t('2. Agent reads peer settlement → DENY (primary fix)', async () => {
    // agentB tries to read agentA's settlement.
    await assertFails(getDoc(settRef(agentB(), AGENT_A)));
  });

  await t('3. Agent reads own from cross-tenant path → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(settRef(db, AGENT_A)));
  });

  await t('4. Unauthenticated get → DENY', async () => {
    await assertFails(getDoc(settRef(unauth(), AGENT_A)));
  });

  // ── LIST ─────────────────────────────────────────────────────────────────────

  await t('5. Agent own-scoped list (where agentId==uid) → ALLOW', async () => {
    const q = query(
      collection(agentA(), `tenants/${TENANT_ID}/settlements`),
      where('agentId', '==', AGENT_A),
    );
    await assertSucceeds(getDocs(q));
  });

  await t('6. Agent foreign-agentId list (where agentId==peerId) → DENY (primary fix)', async () => {
    const q = query(
      collection(agentB(), `tenants/${TENANT_ID}/settlements`),
      where('agentId', '==', AGENT_A),
    );
    await assertFails(getDocs(q));
  });

  await t('7. Agent unscoped list (no agentId filter) → DENY', async () => {
    const q = query(collection(agentA(), `tenants/${TENANT_ID}/settlements`));
    await assertFails(getDocs(q));
  });

  await t('8. Unauthenticated list → DENY', async () => {
    const q = query(collection(unauth(), `tenants/${TENANT_ID}/settlements`));
    await assertFails(getDocs(q));
  });

  // ── MANAGER GET ──────────────────────────────────────────────────────────────

  await t('9. UM same-unit reads agent settlement → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM_SAME, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('10. UM cross-unit reads agent settlement → ALLOW (schema gap, not DENY)', async () => {
    // With canManage(tenantId) — settlements lack unitId field so UM-unit scoping
    // cannot be enforced at the rules layer. Dispatcher must decide post-Phase-1-STOP.
    const db = testEnv.authenticatedContext(UM_OTHER, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('11. BM same-branch reads agent settlement → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_SAME, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('12. BM cross-branch reads agent settlement → ALLOW (schema gap, not DENY)', async () => {
    // Same schema-gap note as case 10.
    const db = testEnv.authenticatedContext(BM_OTHER, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('13. SM reads any agent settlement (tenant-wide) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('14. TA reads any agent settlement (tenant-wide) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(TA1, authToken('tenant_admin')).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('15. PA reads cross-tenant settlement → ALLOW (PA is cross-tenant)', async () => {
    const db = testEnv.authenticatedContext('pa1', authToken('platform_admin', OTHER_TENANT)).firestore();
    await assertSucceeds(getDoc(settRef(db, AGENT_A)));
  });

  await t('16. Cross-tenant manager get → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_SAME, authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(getDoc(settRef(db, AGENT_A)));
  });

  // ── WRITE ARMS (unchanged — one sanity case each) ────────────────────────────

  await t('17. canConfirmSettlements agent writes own settlement → ALLOW', async () => {
    const db = testEnv.authenticatedContext(CAN_CONFIRM, authToken('agent')).firestore();
    await assertSucceeds(setDoc(settRef(db, CAN_CONFIRM), settlementPayload(CAN_CONFIRM)));
  });

  await t('18. Plain agent write → DENY (write arm unchanged)', async () => {
    await assertFails(setDoc(settRef(agentA(), AGENT_A), settlementPayload(AGENT_A)));
  });

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
