/**
 * Emulator rules tests — financing reconciliation record (Track K · K6).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/financingReconciliation.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Security model (U2 single-boundary precedent; mirrors the K2 financing ledger block
 * — the doc ID is composite {agentId}_{year}, so the read keys on the STORED agentId
 * field, NOT a path var — the settlements/K2 read shape):
 *   get/list:      agent reads OWN (canAccessOwn keyed on resource.data.agentId);
 *                  managers read tenant-wide (canManage — includes UM).
 *   create/update: BM / SM / TA same-tenant + PA cross-tenant. unit_manager EXCLUDED
 *                  (contract 5.3). Coarse validation: agentId string, tenantId == path
 *                  tenant, outcome in [owing, surplus], triggeredBy in [auto_month12,
 *                  manual_election], money fields numbers (closingBalance /
 *                  reconciledPosition MAY be negative = surplus; waiverApplied /
 *                  surplusPaid >= 0), serviceMet / garnishStarted bool. No key-allowlist.
 *   delete:        nobody.
 *
 * Test matrix (18 cases):
 *   GET / LIST
 *    1. Agent reads OWN record                             → ALLOW
 *    2. Agent reads PEER record                            → DENY
 *    3. Agent reads own from cross-tenant path             → DENY
 *    4. Unauthenticated get                                → DENY
 *    5. UM reads agent record (mirrored read scope)        → ALLOW
 *    6. Manager lists agent records (canManage)            → ALLOW
 *    7. Agent lists OWN records (agentId == uid filter)    → ALLOW
 *   WRITE
 *    8. Agent writes own record                            → DENY
 *    9. BM same-tenant write                               → ALLOW
 *   10. SM same-tenant write                               → ALLOW
 *   11. TA same-tenant write                               → ALLOW
 *   12. UM write (excluded per contract 5.3)               → DENY
 *   13. Cross-tenant manager write                         → DENY
 *   14. PA cross-tenant write                              → ALLOW
 *   15. NEGATIVE closingBalance / reconciledPosition (surplus) → ALLOW
 *   16. Bad outcome enum                                   → DENY
 *   17. Bad triggeredBy enum                               → DENY
 *   18. Non-number money field                             → DENY
 *   19. Negative waiverApplied (>= 0 enforced)             → DENY
 *   20. Non-bool serviceMet                                → DENY
 *   DELETE
 *   21. BM delete                                          → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, getDocs, setDoc, deleteDoc, doc, collection, query, where } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'fin-recon-test-tenant';
const OTHER_TENANT = 'fin-recon-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const AGENT_A = 'agentA';
const AGENT_B = 'agentB';
const SEED_YEAR = '2026';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function reconRef(db, agentId, year = SEED_YEAR, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/financingReconciliation/${agentId}_${year}`);
}

function reconCol(db, tenantId = TENANT_ID) {
  return collection(db, `tenants/${tenantId}/financingReconciliation`);
}

function reconPayload(agentId, tenantId = TENANT_ID, overrides = {}) {
  return {
    agentId,
    tenantId,
    year:               2026,
    totalFinancingDrawn: 48000,
    totalOffsets:        29800,
    closingBalance:      18200,
    waiverApplied:       12000,
    serviceMet:          true,
    serviceMonths:       12,
    reconciledPosition:  6200,
    outcome:             'owing',
    surplusPaid:         0,
    garnishStarted:      true,
    triggeredBy:         'auto_month12',
    reconciledBy:        'seedMgr',
    reconciledByName:    'Seed',
    ...overrides,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(reconRef(db, AGENT_A), reconPayload(AGENT_A));
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
  console.log('financing reconciliation — Firestore emulator rules tests (Track K · K6)');
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
  await t('1. Agent reads OWN record → ALLOW', async () => {
    await assertSucceeds(getDoc(reconRef(agentA(), AGENT_A)));
  });

  await t('2. Agent reads PEER record → DENY', async () => {
    await assertFails(getDoc(reconRef(agentB(), AGENT_A)));
  });

  await t('3. Agent reads own from cross-tenant path → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(getDoc(reconRef(db, AGENT_A)));
  });

  await t('4. Unauthenticated get → DENY', async () => {
    await assertFails(getDoc(reconRef(unauth(), AGENT_A)));
  });

  await t('5. UM reads agent record (mirrored read scope) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(reconRef(db, AGENT_A)));
  });

  await t('6. Manager lists agent records (canManage) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(getDocs(query(reconCol(db), where('agentId', '==', AGENT_A))));
  });

  await t('7. Agent lists OWN records (agentId == uid filter) → ALLOW', async () => {
    await assertSucceeds(getDocs(query(reconCol(agentA()), where('agentId', '==', AGENT_A))));
  });

  // ── WRITE ───────────────────────────────────────────────────────────────────
  await t('8. Agent writes own record → DENY', async () => {
    await assertFails(setDoc(reconRef(agentA(), AGENT_A), reconPayload(AGENT_A)));
  });

  await t('9. BM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('10. SM same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    await assertSucceeds(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('11. TA same-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('ta1', authToken('tenant_admin')).firestore();
    await assertSucceeds(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('12. UM write (excluded per contract 5.3) → DENY', async () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('13. Cross-tenant manager write → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('14. PA cross-tenant write → ALLOW', async () => {
    const db = testEnv.authenticatedContext('pa1', authToken('platform_admin', OTHER_TENANT)).firestore();
    await assertSucceeds(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B)));
  });

  await t('15. NEGATIVE closingBalance / reconciledPosition (surplus) → ALLOW', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, {
      closingBalance: -3100, reconciledPosition: -15100, outcome: 'surplus',
      surplusPaid: 15100, garnishStarted: false,
    })));
  });

  await t('16. Bad outcome enum → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, { outcome: 'bogus' })));
  });

  await t('17. Bad triggeredBy enum → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, { triggeredBy: 'bogus' })));
  });

  await t('18. Non-number money field → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, { closingBalance: '18200' })));
  });

  await t('19. Negative waiverApplied (>= 0 enforced) → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, { waiverApplied: -1 })));
  });

  await t('20. Non-bool serviceMet → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(setDoc(reconRef(db, AGENT_B), reconPayload(AGENT_B, TENANT_ID, { serviceMet: 'yes' })));
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  await t('21. BM delete → DENY', async () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(reconRef(db, AGENT_A)));
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
