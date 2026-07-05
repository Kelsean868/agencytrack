/**
 * Emulator rules tests — kiosk cross-branch read scope (FU SEC-012).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/kioskBranchScope.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * NOTE: this repo runs the Firestore emulator on PORT 9090 (see firebase.json).
 *
 * ── HISTORY ───────────────────────────────────────────────────────────────────
 * Phase 0 (falsification) proved the hole: `kioskCanRead` scoped reads by TENANT
 * only, so a Branch-A kiosk could read Branch-B users/submissions/leaderboards/
 * AgentOfMonth (13/13 green against the pre-fix rules). This file now asserts the
 * POST-FIX behavior — the cross-branch cases that used to prove the hole are
 * flipped to DENY.
 *
 * Test matrix (post-fix):
 *   Cross-branch — HOLE CLOSED (was ALLOW pre-fix, now DENY):
 *     1. Branch-A kiosk get  Branch-B user            → DENY
 *     2. Branch-A kiosk get  Branch-B submission      → DENY
 *     3. Branch-A kiosk list ALL submissions (no filt)→ DENY
 *     4. Branch-A kiosk list Branch-B submissions     → DENY
 *     5. Branch-A kiosk get  Branch-B leaderboard     → DENY
 *     6. Branch-A kiosk get  Branch-B AgentOfMonth    → DENY
 *   Same-branch — NO REGRESSION (still ALLOW):
 *     7. Branch-A kiosk get  Branch-A user            → ALLOW
 *     8. Branch-A kiosk get  Branch-A submission      → ALLOW
 *     9. Branch-A kiosk list Branch-A submissions     → ALLOW (branchId==own)
 *    10. Branch-A kiosk get  Branch-A leaderboard     → ALLOW
 *    11. Branch-A kiosk get  Branch-A AgentOfMonth    → ALLOW
 *   Tenant isolation — UNCHANGED (still DENY):
 *    12. Cross-tenant kiosk get Branch-A leaderboard  → DENY
 *    13. Cross-tenant kiosk get Branch-A submission   → DENY
 *   Tenant-wide-by-design — UNCHANGED (still ALLOW):
 *    14. Branch-A kiosk get weeklyChampions           → ALLOW
 *   Non-kiosk regression — inline short-circuit safety (design guard):
 *    15. Agent-A get OWN submission (own branch)      → ALLOW (canAccessOwn)
 *    16. tenant_admin get a BRANCHLESS user doc       → ALLOW (kiosk branch arm
 *          must short-circuit on kioskCanRead()==false and never deref
 *          resource.data.branchId on a doc that has none)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, collection, query, where,
} from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'kiosk-branch-scope-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:9090').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '9090', 10);

// Branches under the one tenant
const BRANCH_A = 'branch-a';   // the kiosk's OWN branch
const BRANCH_B = 'branch-b';   // the cross-branch target

// Actor / doc IDs
const AGENT_A    = 'agent-a';       // in BRANCH_A
const AGENT_B    = 'agent-b';       // in BRANCH_B
const TA_NOBRANCH = 'ta-nobranch';  // tenant_admin, user doc has NO branchId
const KIOSK_A    = 'kiosk_branch_a';
const KIOSK_X    = 'kiosk_cross_tenant';

const WEEK      = '2026-06-07';
const SUB_A     = `${AGENT_A}_${WEEK}`;
const SUB_B     = `${AGENT_B}_${WEEK}`;
const MONTH_B   = '2026-06';    // AOM doc stamped branchId=BRANCH_B
const MONTH_A   = '2026-05';    // AOM doc stamped branchId=BRANCH_A

// Kiosk token claims carry branchId (validateToken.js mints role/tenantId/branchId).
function kioskToken(branchId, tenantId = TENANT_ID) {
  return { role: 'kiosk', tenantId, branchId };
}

function userRef(db, uid, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/users/${uid}`);
}
function subRef(db, id, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/submissions/${id}`);
}
function lbRef(db, branchId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/leaderboards/${branchId}`);
}
function aomRef(db, monthKey, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/agentOfMonth/${monthKey}`);
}
function wcRef(db, weekStarting, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/weeklyChampions/${weekStarting}`);
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const user = (uid, role, branchId, unitId) => ({
      uid, role, tenantId: TENANT_ID, branchId, unitId,
      name: `User ${uid}`, active: true,
    });
    await setDoc(userRef(db, AGENT_A), user(AGENT_A, 'agent', BRANCH_A, 'unit-a'));
    await setDoc(userRef(db, AGENT_B), user(AGENT_B, 'agent', BRANCH_B, 'unit-b'));
    // tenant_admin doc intentionally has NO branchId field (short-circuit guard).
    await setDoc(userRef(db, TA_NOBRANCH), {
      uid: TA_NOBRANCH, role: 'tenant_admin', tenantId: TENANT_ID, name: 'TA', active: true,
    });

    const sub = (agentId, branchId, unitId) => ({
      agentId, branchId, unitId, tenantId: TENANT_ID,
      status: 'submitted', weekStarting: WEEK,
    });
    await setDoc(subRef(db, SUB_A), sub(AGENT_A, BRANCH_A, 'unit-a'));
    await setDoc(subRef(db, SUB_B), sub(AGENT_B, BRANCH_B, 'unit-b'));

    const lb = () => ({ week: [], mtd: [], qtd: [], ytd: [], computedAt: new Date() });
    await setDoc(lbRef(db, BRANCH_A), lb());
    await setDoc(lbRef(db, BRANCH_B), lb());

    // agentOfMonth is one doc per monthKey, stamped with a single branchId.
    const aom = (branchId, monthKey) => ({
      monthKey, tenantId: TENANT_ID, branchId,
      api: { agentUid: AGENT_A, agentName: 'X', achievementValue: 1 },
    });
    await setDoc(aomRef(db, MONTH_B), aom(BRANCH_B, MONTH_B));
    await setDoc(aomRef(db, MONTH_A), aom(BRANCH_A, MONTH_A));

    // weeklyChampions is tenant-wide by design (one doc per week, no branch dim).
    await setDoc(wcRef(db, WEEK), {
      topAPI: null, topApps: null, topActivity: null,
      weekStarting: WEEK, computedAt: new Date(),
    });
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
  console.log('Kiosk cross-branch read scope (SEC-012) — POST-FIX verification');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const kioskA = () => testEnv.authenticatedContext(KIOSK_A, kioskToken(BRANCH_A)).firestore();
  const kioskX = () => testEnv.authenticatedContext(KIOSK_X, kioskToken(BRANCH_A, OTHER_TENANT)).firestore();

  console.log('CROSS-BRANCH — hole closed (DENY):');

  await t('1. Branch-A kiosk get Branch-B user → DENY', async () => {
    await assertFails(getDoc(userRef(kioskA(), AGENT_B)));
  });
  await t('2. Branch-A kiosk get Branch-B submission → DENY', async () => {
    await assertFails(getDoc(subRef(kioskA(), SUB_B)));
  });
  await t('3. Branch-A kiosk list ALL submissions (no filter) → DENY', async () => {
    await assertFails(getDocs(collection(kioskA(), `tenants/${TENANT_ID}/submissions`)));
  });
  await t('4. Branch-A kiosk list Branch-B submissions → DENY', async () => {
    await assertFails(getDocs(
      query(collection(kioskA(), `tenants/${TENANT_ID}/submissions`),
            where('branchId', '==', BRANCH_B))
    ));
  });
  await t('5. Branch-A kiosk get Branch-B leaderboard → DENY', async () => {
    await assertFails(getDoc(lbRef(kioskA(), BRANCH_B)));
  });
  await t('6. Branch-A kiosk get Branch-B AgentOfMonth → DENY', async () => {
    await assertFails(getDoc(aomRef(kioskA(), MONTH_B)));
  });

  console.log('\nSAME-BRANCH — no regression (ALLOW):');

  await t('7. Branch-A kiosk get Branch-A user → ALLOW', async () => {
    await assertSucceeds(getDoc(userRef(kioskA(), AGENT_A)));
  });
  await t('8. Branch-A kiosk get Branch-A submission → ALLOW', async () => {
    await assertSucceeds(getDoc(subRef(kioskA(), SUB_A)));
  });
  await t('9. Branch-A kiosk list Branch-A submissions (branchId==own) → ALLOW', async () => {
    await assertSucceeds(getDocs(
      query(collection(kioskA(), `tenants/${TENANT_ID}/submissions`),
            where('branchId', '==', BRANCH_A))
    ));
  });
  await t('10. Branch-A kiosk get Branch-A leaderboard → ALLOW', async () => {
    await assertSucceeds(getDoc(lbRef(kioskA(), BRANCH_A)));
  });
  await t('11. Branch-A kiosk get Branch-A AgentOfMonth → ALLOW', async () => {
    await assertSucceeds(getDoc(aomRef(kioskA(), MONTH_A)));
  });

  console.log('\nTENANT ISOLATION — unchanged (DENY):');

  await t('12. Cross-tenant kiosk get Branch-A leaderboard → DENY', async () => {
    await assertFails(getDoc(lbRef(kioskX(), BRANCH_A)));
  });
  await t('13. Cross-tenant kiosk get Branch-A submission → DENY', async () => {
    await assertFails(getDoc(subRef(kioskX(), SUB_A)));
  });

  console.log('\nTENANT-WIDE-BY-DESIGN — unchanged (ALLOW):');

  await t('14. Branch-A kiosk get weeklyChampions → ALLOW', async () => {
    await assertSucceeds(getDoc(wcRef(kioskA(), WEEK)));
  });

  console.log('\nNON-KIOSK REGRESSION — inline short-circuit safety:');

  await t('15. Agent-A get OWN submission (own branch) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, { role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_A }).firestore();
    await assertSucceeds(getDoc(subRef(db, SUB_A)));
  });
  await t('16. tenant_admin get BRANCHLESS user doc → ALLOW (no eager deref)', async () => {
    // TA token has no branchId; target user doc has no branchId. The kiosk branch
    // arm must short-circuit (kioskCanRead()==false) and never deref branchId.
    const db = testEnv.authenticatedContext('ta-caller', { role: 'tenant_admin', tenantId: TENANT_ID }).firestore();
    await assertSucceeds(getDoc(userRef(db, TA_NOBRANCH)));
  });
  await t('17. Branch-A kiosk get NON-EXISTENT submission → DENY (resource!=null guard)', async () => {
    // A missing-doc get must deny cleanly (resource != null short-circuits) rather
    // than throw an eval error on resource.data.branchId.
    await assertFails(getDoc(subRef(kioskA(), 'agent-a_2099-01-04')));
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
