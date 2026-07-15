/**
 * Emulator rules tests — kiosk per-branch rotation config (Tier-3 #15).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/kioskConfig.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * NOTE: this repo runs the Firestore emulator on PORT 9090 (see firebase.json).
 *
 * Covers the new `match /kioskConfig/{branchId}` block:
 *   WRITE (manager, client-side — subject to rules):
 *     1. branch_manager write own-branch config (valid)        → ALLOW
 *     2. tenant_admin  write config (valid)                    → ALLOW
 *     3. agent         write config                            → DENY (not canManage)
 *     4. unauthenticated write                                 → DENY
 *     5. updatedBy != caller uid                               → DENY
 *     6. extra field (keys not in the allowed set)             → DENY
 *     7. disabledPanels NOT a list (string)                    → DENY
 *     8. disabledPanels contains an UNKNOWN key                → DENY
 *     9. disabledPanels OVERSIZED (>13 entries)                → DENY
 *   READ:
 *    10. kiosk token get OWN branch config                     → ALLOW
 *    11. kiosk token get OTHER branch config                   → DENY
 *    12. manager get any branch config                         → ALLOW
 *    13. unauthenticated get                                   → DENY
 *    14. cross-tenant kiosk get                                → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'kiosk-config-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:9090').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '9090', 10);

const BRANCH_A = 'branch-a';   // the actor's OWN branch
const BRANCH_B = 'branch-b';   // cross-branch target

const BM_A    = 'bm_branch_a';   // branch_manager in tenant
const TA      = 'ta_tenant';     // tenant_admin
const AGENT_A = 'agent_a';       // agent
const KIOSK_A = 'kiosk_branch_a';
const KIOSK_X = 'kiosk_cross_tenant';

// Kiosk token claims carry branchId (validateToken.js mints role/tenantId/branchId).
function kioskToken(branchId, tenantId = TENANT_ID) {
  return { role: 'kiosk', tenantId, branchId };
}
function managerToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function cfgRef(db, branchId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/kioskConfig/${branchId}`);
}

// A well-formed config write body for a given author uid.
function validBody(uid, disabledPanels = ['compliance']) {
  return { disabledPanels, updatedBy: uid, updatedAt: new Date() };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Pre-seed configs so read-path tests exercise an existing doc.
    await setDoc(cfgRef(db, BRANCH_A), { disabledPanels: ['compliance'], updatedBy: BM_A, updatedAt: new Date() });
    await setDoc(cfgRef(db, BRANCH_B), { disabledPanels: [], updatedBy: BM_A, updatedAt: new Date() });
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
  console.log('Kiosk per-branch rotation config (Tier-3 #15) — rules verification');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const bmA     = () => testEnv.authenticatedContext(BM_A, managerToken('branch_manager')).firestore();
  const ta      = () => testEnv.authenticatedContext(TA, managerToken('tenant_admin')).firestore();
  const agentA  = () => testEnv.authenticatedContext(AGENT_A, { role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_A }).firestore();
  const kioskA  = () => testEnv.authenticatedContext(KIOSK_A, kioskToken(BRANCH_A)).firestore();
  const kioskX  = () => testEnv.authenticatedContext(KIOSK_X, kioskToken(BRANCH_A, OTHER_TENANT)).firestore();
  const anon    = () => testEnv.unauthenticatedContext().firestore();

  console.log('WRITE — manager client-side (validation):');

  await t('1. branch_manager write valid own-branch config → ALLOW', async () => {
    await assertSucceeds(setDoc(cfgRef(bmA(), BRANCH_A), validBody(BM_A)));
  });
  await t('2. tenant_admin write valid config → ALLOW', async () => {
    await assertSucceeds(setDoc(cfgRef(ta(), BRANCH_A), validBody(TA)));
  });
  await t('3. agent write config → DENY', async () => {
    await assertFails(setDoc(cfgRef(agentA(), BRANCH_A), validBody(AGENT_A)));
  });
  await t('4. unauthenticated write → DENY', async () => {
    await assertFails(setDoc(cfgRef(anon(), BRANCH_A), validBody('nobody')));
  });
  await t('5. updatedBy != caller uid → DENY', async () => {
    await assertFails(setDoc(cfgRef(bmA(), BRANCH_A), validBody('someone-else')));
  });
  await t('6. extra field beyond the allowed set → DENY', async () => {
    await assertFails(setDoc(cfgRef(bmA(), BRANCH_A), { ...validBody(BM_A), rogue: 1 }));
  });
  await t('7. disabledPanels not a list (string) → DENY', async () => {
    await assertFails(setDoc(cfgRef(bmA(), BRANCH_A), { disabledPanels: 'compliance', updatedBy: BM_A, updatedAt: new Date() }));
  });
  await t('8. disabledPanels contains an unknown key → DENY', async () => {
    await assertFails(setDoc(cfgRef(bmA(), BRANCH_A), validBody(BM_A, ['compliance', 'bogusPanel'])));
  });
  await t('9. disabledPanels oversized (>13) → DENY', async () => {
    await assertFails(setDoc(cfgRef(bmA(), BRANCH_A), validBody(BM_A, Array(14).fill('welcome'))));
  });

  console.log('\nREAD:');

  await t('10. kiosk token get OWN branch config → ALLOW', async () => {
    await assertSucceeds(getDoc(cfgRef(kioskA(), BRANCH_A)));
  });
  await t('11. kiosk token get OTHER branch config → DENY', async () => {
    await assertFails(getDoc(cfgRef(kioskA(), BRANCH_B)));
  });
  await t('12. manager get any branch config → ALLOW', async () => {
    await assertSucceeds(getDoc(cfgRef(bmA(), BRANCH_B)));
  });
  await t('13. unauthenticated get → DENY', async () => {
    await assertFails(getDoc(cfgRef(anon(), BRANCH_A)));
  });
  await t('14. cross-tenant kiosk get → DENY', async () => {
    await assertFails(getDoc(cfgRef(kioskX(), BRANCH_A)));
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
