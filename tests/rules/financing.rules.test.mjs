/**
 * Emulator rules tests — financing monthly ledger (Track K · K2).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/financing.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Security model (U2 single-boundary precedent; mirrors the K1 financingTerms
 * block but keys the read on the STORED agentId field — the doc ID is composite
 * {agentId}_{YYYY_MM}, so the {agentId} path-var trick K1 uses does not apply.
 * This is the settlements read shape):
 *   get/list:      agent reads OWN (canAccessOwn keyed on resource.data.agentId);
 *                  managers in scope (P2b SEC-08): BM own branch, UM own unit,
 *                  SM/TA/PA tenant. Fixtures carry branchId/unitId + caller user
 *                  docs; cross-branch/unit denials live in
 *                  tests/rules/p2b-branch-scoping.rules.test.mjs.
 *   create/update: BM / SM / TA same-tenant + PA cross-tenant. unit_manager
 *                  EXCLUDED (contract 5.3). Coarse validation: agentId string,
 *                  tenantId == path tenant, month matches YYYY_MM, runningBalance
 *                  is number (MAY be negative = surplus), financingPaid /
 *                  netCommission / bonusOffset are numbers >= 0. No key-allowlist.
 *   delete:        nobody.
 *
 * Test matrix (27 cases):
 *   GET / LIST
 *    1. Agent reads OWN month                              → ALLOW
 *    2. Agent reads PEER month                             → DENY
 *    3. Agent reads own from cross-tenant path             → DENY
 *    4. Unauthenticated get                                → DENY
 *    5. UM reads own-unit agent month                      → ALLOW
 *    6. BM lists own-branch agent months (where branchId)  → ALLOW
 *    7. Agent lists OWN months (agentId == uid filter)     → ALLOW
 *   WRITE
 *    8. Agent writes own month                             → DENY
 *    9. BM same-tenant write                               → ALLOW
 *   10. SM same-tenant write                               → ALLOW
 *   11. TA same-tenant write                               → ALLOW
 *   12. UM write (excluded per contract 5.3)               → DENY
 *   13. Cross-tenant manager write                         → DENY
 *   14. PA cross-tenant write                              → ALLOW
 *   15. NEGATIVE runningBalance (surplus)                  → ALLOW
 *   16. Bad month format                                   → DENY
 *   17. Non-number statement field                         → DENY
 *   18. Negative financingPaid (>= 0 enforced)             → DENY
 *   DELETE
 *   19. BM delete                                          → DENY
 *   K5 PRORATION (forward-create + restructured statement-core gate)
 *   20. BM proration-only create (no statement fields)     → ALLOW
 *   21. Proration-only, non-number validatingAPI           → DENY
 *   22. Proration-only, bad basisSource enum               → DENY
 *   23. UM proration-only write (excluded 5.3)             → DENY
 *   24. Cross-tenant proration write                       → DENY
 *   25. PARTIAL statement (one core field, rest missing)   → DENY
 *   26. Proration MERGE onto existing statement doc        → ALLOW
 *   K6 GAP-FILL (reconciliation_gap_fill provenance — no rules change; no source constraint)
 *   27. BM gap-fill statement (source:reconciliation_gap_fill) → ALLOW
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, getDocs, setDoc, updateDoc, deleteDoc, doc, collection, query, where } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'fin-ledger-test-tenant';
const OTHER_TENANT = 'fin-ledger-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const AGENT_A = 'agentA';
const AGENT_B = 'agentB';
const SEED_MONTH = '2026_01';
// P2b: every fixture doc sits in bm1's branch and um1's unit.
const BRANCH = 'branchA';
const UNIT = 'um1';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function finRef(db, agentId, month = SEED_MONTH, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/financing/${agentId}_${month}`);
}

function ledgerCol(db, tenantId = TENANT_ID) {
  return collection(db, `tenants/${tenantId}/financing`);
}

// K5 proration-only payload — NO statement-core fields (forward of any statement).
function prorationPayload(agentId, tenantId = TENANT_ID, overrides = {}) {
  return {
    agentId,
    tenantId,
    month:              SEED_MONTH,
    validatingAPI:      30000,
    actualAPI:          15000,
    suggestedFinancing: 4000,
    basisSource:        'submitted-final',
    source:             'manager_entry',
    branchId:           BRANCH,
    unitId:             UNIT,
    ...overrides,
  };
}

function statementPayload(agentId, tenantId = TENANT_ID, overrides = {}) {
  return {
    agentId,
    tenantId,
    month:          SEED_MONTH,
    runningBalance: 22400,
    financingPaid:  4000,
    netCommission:  6200,
    bonusOffset:    0,
    notes:          '',
    source:         'manager_entry',
    enteredBy:      'seedMgr',
    enteredByName:  'Seed',
    branchId:       BRANCH,
    unitId:         UNIT,
    ...overrides,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(finRef(db, AGENT_A), statementPayload(AGENT_A));
    // P2b: caller user docs — the rules read the BM's branch from here.
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/bm1`), { role: 'branch_manager', branchId: BRANCH });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/um1`), { role: 'unit_manager', branchId: BRANCH, unitId: UNIT });
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
  console.log('financing monthly ledger — Firestore emulator rules tests (Track K · K2)');
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

  // ── GET / LIST ──────────────────────────────────────────────────────────────
  await t('1. Agent reads OWN month → ALLOW', async () => {
    await assertSucceeds(getDoc(finRef(agentA(), AGENT_A)));
  });

  await t('2. Agent reads PEER month → DENY', async () => {
    await assertFails(getDoc(finRef(agentB(), AGENT_A)));
  });

  await t('3. Agent reads own from cross-tenant path → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(finRef(db, AGENT_A)));
  });

  await t('4. Unauthenticated get → DENY', async () => {
    await assertFails(getDoc(finRef(unauth(), AGENT_A)));
  });

  await t('5. UM reads own-unit agent month → ALLOW', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(finRef(db, AGENT_A)));
  });

  await t('6. BM lists own-branch agent months (where branchId) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(getDocs(query(ledgerCol(db), where('agentId', '==', AGENT_A), where('branchId', '==', BRANCH))));
  });

  await t('7. Agent lists OWN months (agentId == uid filter) → ALLOW', async () => {
    await assertSucceeds(getDocs(query(ledgerCol(agentA()), where('agentId', '==', AGENT_A))));
  });

  // ── WRITE ───────────────────────────────────────────────────────────────────
  await t('8. Agent writes own month → DENY', async () => {
    await assertFails(setDoc(finRef(agentA(), AGENT_A), statementPayload(AGENT_A)));
  });

  await t('9. BM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('10. SM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('11. TA same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('ta1', authToken('tenant_admin')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('12. UM write (excluded per contract 5.3) → DENY', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('13. Cross-tenant manager write → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('14. PA cross-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('pa1', authToken('platform_admin', OTHER_TENANT)).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B)));
  });

  await t('15. NEGATIVE runningBalance (surplus) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B, TENANT_ID, { runningBalance: -1500 })));
  });

  await t('16. Bad month format → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B, TENANT_ID, { month: '2026-01' })));
  });

  await t('17. Non-number statement field → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B, TENANT_ID, { financingPaid: '4000' })));
  });

  await t('18. Negative financingPaid (>= 0 enforced) → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), statementPayload(AGENT_B, TENANT_ID, { financingPaid: -1 })));
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  await t('19. BM delete → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(finRef(db, AGENT_A)));
  });

  // ── K5 PRORATION ────────────────────────────────────────────────────────────
  // Use AGENT_B's doc for proration-create cases (setDoc full-replaces, so prior
  // statement writes to AGENT_B don't interfere — the post-write state is proration-only).
  await t('20. BM proration-only create (no statement fields) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(finRef(db, AGENT_B), prorationPayload(AGENT_B)));
  });

  await t('21. Proration-only, non-number validatingAPI → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), prorationPayload(AGENT_B, TENANT_ID, { validatingAPI: '30000' })));
  });

  await t('22. Proration-only, bad basisSource enum → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), prorationPayload(AGENT_B, TENANT_ID, { basisSource: 'bogus' })));
  });

  await t('23. UM proration-only write (excluded 5.3) → DENY', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), prorationPayload(AGENT_B)));
  });

  await t('24. Cross-tenant proration write → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), prorationPayload(AGENT_B)));
  });

  await t('25. PARTIAL statement (one core field, rest missing) → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(finRef(db, AGENT_B), {
      agentId: AGENT_B, tenantId: TENANT_ID, month: SEED_MONTH, runningBalance: 100,
    }));
  });

  await t('26. Proration MERGE onto existing statement doc → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    // AGENT_A's seeded doc is a full statement; adding proration fields keeps the
    // statement core present (post-merge state) → validStatementCore still holds.
    await assertSucceeds(updateDoc(finRef(db, AGENT_A), {
      validatingAPI: 30000, actualAPI: 15000, suggestedFinancing: 4000,
      basisSource: 'settled-confirmed', managerFinancing: 4000, adjustmentPct: 0.5,
    }));
  });

  // ── K6 GAP-FILL ───────────────────────────────────────────────────────────
  await t('27. BM gap-fill statement (source:reconciliation_gap_fill) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    // A manager-confirmed previously-missing month (here a genuine $0). The K2 rule has
    // no source constraint, so the gap-fill provenance flag is accepted unchanged.
    await assertSucceeds(setDoc(finRef(db, AGENT_B, '2026_07'), statementPayload(AGENT_B, TENANT_ID, {
      month: '2026_07', source: 'reconciliation_gap_fill',
      financingPaid: 0, netCommission: 0, bonusOffset: 0, runningBalance: 16000,
    })));
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
