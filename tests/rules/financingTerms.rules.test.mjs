/**
 * Emulator rules tests — financingTerms collection (Track K · K1).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/financingTerms.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Security model (U2 single-boundary precedent — coarse type/role/enum only;
 * current<=agreed and transition legality live in financingService, NOT rules):
 *   get:           agent reads OWN doc (canAccessOwn, keyed on {agentId} path
 *                  var); managers read tenant-wide (canManage — includes UM).
 *   create/update: BM / SM / TA same-tenant + PA cross-tenant. unit_manager
 *                  EXCLUDED (contract 5.3). Coarse data validation: the three
 *                  financing numerics are numbers >= 0; financingStatus ∈ the 5
 *                  enum values; effectiveDate is string; agentId == doc ID;
 *                  tenantId == path tenant.
 *   delete:        nobody.
 *   no list arm:   K1 reads a single per-agent doc.
 *
 * Test matrix (14 cases):
 *   GET
 *    1. Agent reads OWN financingTerms                       → ALLOW
 *    2. Agent reads PEER financingTerms                      → DENY
 *    3. Agent reads own from cross-tenant path               → DENY
 *    4. Unauthenticated get                                  → DENY
 *    5. UM reads agent financingTerms (mirrored read scope)  → ALLOW
 *   WRITE
 *    6. Agent writes own financingTerms                      → DENY
 *    7. BM same-tenant write                                 → ALLOW
 *    8. SM same-tenant write                                 → ALLOW
 *    9. TA same-tenant write                                 → ALLOW
 *   10. UM write (excluded per contract 5.3)                 → DENY
 *   11. Cross-tenant manager write                           → DENY
 *   12. PA cross-tenant write                                → ALLOW
 *   13. Bad financingStatus enum value                       → DENY
 *   14. Non-number financing field                           → DENY
 *   DELETE
 *   15. BM delete                                            → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, deleteDoc, doc } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'fin-rules-test-tenant';
const OTHER_TENANT = 'fin-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const AGENT_A = 'agentA';
const AGENT_B = 'agentB';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function finRef(db, agentId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/financingTerms/${agentId}`);
}

function termsPayload(agentId, tenantId = TENANT_ID, overrides = {}) {
  return {
    agentId,
    tenantId,
    agreedMonthlyFinancing:  8000,
    currentMonthlyFinancing: 8000,
    validatingAPI:           30000,
    effectiveDate:           '2025-12-01',
    financingStatus:         'not_on_financing',
    statusHistory:           [],
    createdBy:               'seedMgr',
    updatedBy:               'seedMgr',
    ...overrides,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Pre-seed agentA's financing terms for the read tests.
    await setDoc(finRef(db, AGENT_A), termsPayload(AGENT_A));
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
  console.log('financingTerms — Firestore emulator rules tests (Track K · K1)');
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

  // ── GET ───────────────────────────────────────────────────────────────────
  await t('1. Agent reads OWN financingTerms → ALLOW', async () => {
    await assertSucceeds(getDoc(finRef(agentA(), AGENT_A)));
  });

  await t('2. Agent reads PEER financingTerms → DENY', async () => {
    await assertFails(getDoc(finRef(agentB(), AGENT_A)));
  });

  await t('3. Agent reads own from cross-tenant path → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(finRef(db, AGENT_A)));
  });

  await t('4. Unauthenticated get → DENY', async () => {
    await assertFails(getDoc(finRef(unauth(), AGENT_A)));
  });

  await t('5. UM reads agent financingTerms (mirrored read scope) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(finRef(db, AGENT_A)));
  });

  // ── WRITE ───────────────────────────────────────────────────────────────────
  await t('6. Agent writes own financingTerms → DENY', async () => {
    await assertFails(setDoc(finRef(agentA(), AGENT_A), termsPayload(AGENT_A)));
  });

  await t('7. BM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('8. SM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('9. TA same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('ta1', authToken('tenant_admin')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('10. UM write (excluded per contract 5.3) → DENY', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('11. Cross-tenant manager write → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('12. PA cross-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('pa1', authToken('platform_admin', OTHER_TENANT)).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B)));
  });

  await t('13. Bad financingStatus enum value → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B, TENANT_ID, { financingStatus: 'bogus_state' })));
  });

  await t('14. Non-number financing field → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), termsPayload(AGENT_B, TENANT_ID, { agreedMonthlyFinancing: '8000' })));
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  await t('15. BM delete → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(finRef(db, AGENT_A)));
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
