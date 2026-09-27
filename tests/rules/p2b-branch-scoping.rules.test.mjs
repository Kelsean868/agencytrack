/**
 * Emulator rules tests — P2b branch scoping (audit 2026-09-24 SEC-05 + SEC-08).
 *
 * Run with:
 *   firebase emulators:exec --only firestore --project=demo-agencytrack \
 *     "node tests/rules/p2b-branch-scoping.rules.test.mjs"
 * or the whole suite via `npm run test:rules` under emulators:exec.
 *
 * The rule being enforced (brief docs/briefs/p2b-branch-scoping.md):
 *   agent           own docs only (unchanged)
 *   unit_manager    own unit only        — a UM's unitId IS their uid
 *   branch_manager  own branch only      — caller's USER-DOC branchId
 *                                          (submissions: token branchId, matching its list arm)
 *   sales_manager / tenant_admin / platform_admin  whole tenant (unchanged)
 *
 * For each collection: BM own branch ALLOW · BM other branch DENY · UM own unit
 * ALLOW · UM other unit DENY · SM any branch ALLOW. Plus the audit exploits:
 * a BM lapses another branch's policy → DENY; a UM reads another unit's
 * financing → DENY.
 *
 * Fixture tenant
 *   branchA: bmA · umA1 (unit umA1) · umA2 (unit umA2) · agents a1 (umA1), a2 (umA2)
 *   branchB: bmB · umB1 · agent b1 (umB1)
 *   sm (sales_manager), ta (tenant_admin), bmNoBranch (BM whose user doc has no branchId)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const T = 'p2b-branch-scope-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const A = 'branchA';
const B = 'branchB';

const USERS = {
  bmA:        { role: 'branch_manager', branchId: A },
  bmB:        { role: 'branch_manager', branchId: B },
  bmNoBranch: { role: 'branch_manager' },
  umA1:       { role: 'unit_manager', branchId: A, unitId: 'umA1' },
  umA2:       { role: 'unit_manager', branchId: A, unitId: 'umA2' },
  umB1:       { role: 'unit_manager', branchId: B, unitId: 'umB1' },
  sm:         { role: 'sales_manager', branchId: A, canConfirmSettlements: true },
  ta:         { role: 'tenant_admin', branchId: A },
  a1:         { role: 'agent', branchId: A, unitId: 'umA1', name: 'Agent A1' },
  a2:         { role: 'agent', branchId: A, unitId: 'umA2', name: 'Agent A2' },
  b1:         { role: 'agent', branchId: B, unitId: 'umB1', name: 'Agent B1' },
};
const SCOPE = {
  a1: { branchId: A, unitId: 'umA1' },
  a2: { branchId: A, unitId: 'umA2' },
  b1: { branchId: B, unitId: 'umB1' },
};

const past = Timestamp.fromDate(new Date('2026-01-10T12:00:00Z'));
const issued = Timestamp.fromDate(new Date('2026-02-10T12:00:00Z'));

function token(uid) {
  const u = USERS[uid];
  // Claims mirror createUser: role + tenantId + branchId (no unitId claim).
  const t = { role: u.role, tenantId: T };
  if (u.branchId) t.branchId = u.branchId;
  return t;
}

function settledPolicy(agentId) {
  return {
    tenantId: T, agentId, ...SCOPE[agentId],
    status: 'settled', productLine: 'life', ownerName: 'Owner', insuredName: 'Insured',
    proposedAPI: 5000, settledAPI: 5000, dateWritten: past, dateSubmitted: past,
    dateIssued: issued, createdAt: past,
  };
}

function termsDoc(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId],
    agreedMonthlyFinancing: 8000, currentMonthlyFinancing: 8000, validatingAPI: 30000,
    financingStatus: 'on_financing', effectiveDate: '2026-01-01', statusHistory: [],
    ...overrides,
  };
}

function monthDoc(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId], month: '2026_01',
    runningBalance: 22400, financingPaid: 4000, netCommission: 6200, bonusOffset: 0,
    ...overrides,
  };
}

function reconDoc(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId], year: 2026,
    totalFinancingDrawn: 48000, totalOffsets: 29800, closingBalance: 18200,
    waiverApplied: 12000, serviceMet: true, serviceMonths: 12, reconciledPosition: 6200,
    outcome: 'owing', surplusPaid: 0, garnishStarted: true, triggeredBy: 'auto_month12',
    ...overrides,
  };
}

function submissionDoc(agentId, overrides = {}) {
  return {
    agentId, userId: agentId, tenantId: T, ...SCOPE[agentId],
    status: 'submitted', weekStarting: '2026-05-17', apiSold: 0, applicationsSold: 0,
    ...overrides,
  };
}

const CONFIRM = (uid) => ({
  confirmedByManager: 'Mgr', confirmedByUid: uid, confirmedAt: Timestamp.now(),
  managerSettledAPI: 5000, managerNote: '', hasDiscrepancy: false,
});
const LAPSE = (uid) => ({
  status: 'lapsed', statusUpdatedAt: Timestamp.now(), dateLapsed: Timestamp.now(),
  statusSource: 'manager', statusSetBy: uid, statusAsOf: '2026-09-27',
});

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
  console.log('P2b branch scoping — Firestore emulator rules tests (SEC-05 + SEC-08)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) {
      await setDoc(doc(db, `tenants/${T}/users/${uid}`), { uid, tenantId: T, active: true, ...u });
    }
    for (const id of ['a1', 'a2', 'b1']) {
      await setDoc(doc(db, `tenants/${T}/policies/pol-${id}`), settledPolicy(id));
      await setDoc(doc(db, `tenants/${T}/financingTerms/${id}`), termsDoc(id));
      await setDoc(doc(db, `tenants/${T}/financing/${id}_2026_01`), monthDoc(id));
      await setDoc(doc(db, `tenants/${T}/financingReconciliation/${id}_2026`), reconDoc(id));
      await setDoc(doc(db, `tenants/${T}/submissions/sub-${id}`), submissionDoc(id));
    }
    // Dedicated docs for mutating cases so ALLOW writes do not disturb DENY reads.
    await setDoc(doc(db, `tenants/${T}/policies/pol-a1-confirm`), settledPolicy('a1'));
    await setDoc(doc(db, `tenants/${T}/policies/pol-a1-lapse`), settledPolicy('a1'));
    await setDoc(doc(db, `tenants/${T}/policies/pol-b1-lapse`), settledPolicy('b1'));
    await setDoc(doc(db, `tenants/${T}/policies/pol-b1-lapse-ta`), settledPolicy('b1'));
    await setDoc(doc(db, `tenants/${T}/policies/pol-b1-confirm`), settledPolicy('b1'));
  });

  const as = (uid) => testEnv.authenticatedContext(uid, token(uid)).firestore();
  const pol = (db, id) => doc(db, `tenants/${T}/policies/${id}`);
  const polCol = (db) => collection(db, `tenants/${T}/policies`);
  const terms = (db, id) => doc(db, `tenants/${T}/financingTerms/${id}`);
  const month = (db, id) => doc(db, `tenants/${T}/financing/${id}_2026_01`);
  const monthCol = (db) => collection(db, `tenants/${T}/financing`);
  const recon = (db, id) => doc(db, `tenants/${T}/financingReconciliation/${id}_2026`);
  const reconCol = (db) => collection(db, `tenants/${T}/financingReconciliation`);
  const sub = (db, id) => doc(db, `tenants/${T}/submissions/${id}`);
  const user = (db, id) => doc(db, `tenants/${T}/users/${id}`);

  // ── policies: get / list ────────────────────────────────────────────────────
  console.log('policies — read');
  await t('P1. BM reads own-branch policy → ALLOW', () => assertSucceeds(getDoc(pol(as('bmA'), 'pol-a1'))));
  await t('P2. BM reads other-branch policy → DENY', () => assertFails(getDoc(pol(as('bmA'), 'pol-b1'))));
  await t('P3. UM reads own-unit policy → ALLOW', () => assertSucceeds(getDoc(pol(as('umA1'), 'pol-a1'))));
  await t('P4. UM reads other-unit policy (same branch) → DENY', () => assertFails(getDoc(pol(as('umA1'), 'pol-a2'))));
  await t('P5. SM reads any-branch policy → ALLOW', () => assertSucceeds(getDoc(pol(as('sm'), 'pol-b1'))));
  await t('P6. TA reads any-branch policy → ALLOW', () => assertSucceeds(getDoc(pol(as('ta'), 'pol-b1'))));
  await t('P7. BM lists own branch (getPoliciesForManager shape) → ALLOW', () => assertSucceeds(getDocs(query(
    polCol(as('bmA')), where('tenantId', '==', T), where('branchId', '==', A), orderBy('createdAt', 'desc'),
  ))));
  await t('P8. BM lists other branch (crafted where) → DENY', () => assertFails(getDocs(query(polCol(as('bmA')), where('branchId', '==', B)))));
  await t('P9. BM lists one agent unfiltered (old getOwnPolicies shape) → DENY', () => assertFails(getDocs(query(
    polCol(as('bmA')), where('agentId', '==', 'a1'), orderBy('createdAt', 'desc'),
  ))));
  await t('P10. BM lists one agent + own-branch filter (new getOwnPolicies shape) → ALLOW', () => assertSucceeds(getDocs(query(
    polCol(as('bmA')), where('agentId', '==', 'a1'), where('branchId', '==', A), orderBy('createdAt', 'desc'),
  ))));
  await t('P11. UM lists own unit → ALLOW', () => assertSucceeds(getDocs(query(polCol(as('umA1')), where('unitId', '==', 'umA1')))));
  await t('P12. UM lists other unit → DENY', () => assertFails(getDocs(query(polCol(as('umA1')), where('unitId', '==', 'umA2')))));
  await t('P13. SM lists tenant-wide (unfiltered) → ALLOW', () => assertSucceeds(getDocs(polCol(as('sm')))));
  await t('P14. BM whose user doc has no branchId reads any policy → DENY', () => assertFails(getDoc(pol(as('bmNoBranch'), 'pol-a1'))));

  // ── policies: Arm C confirm, Arm D settled→lapsed ───────────────────────────
  console.log('policies — Arm C / Arm D');
  await t('P15. Arm C: BM confirms own-branch settled policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('bmA'), 'pol-a1-confirm'), CONFIRM('bmA'))));
  await t('P16. Arm C: BM confirms other-branch settled policy → DENY', () =>
    assertFails(updateDoc(pol(as('bmA'), 'pol-b1-confirm'), CONFIRM('bmA'))));
  await t('P17. Arm C: SM (canConfirmSettlements) confirms any-branch policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('sm'), 'pol-b1-confirm'), CONFIRM('sm'))));
  await t('P18. Arm D: BM lapses own-branch settled policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('bmA'), 'pol-a1-lapse'), LAPSE('bmA'))));
  await t('P19. EXPLOIT Arm D: BM lapses ANOTHER branch\'s settled policy → DENY', () =>
    assertFails(updateDoc(pol(as('bmA'), 'pol-b1-lapse'), LAPSE('bmA'))));
  await t('P20. Arm D: TA lapses any-branch settled policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('ta'), 'pol-b1-lapse-ta'), LAPSE('ta'))));

  // ── financingTerms ──────────────────────────────────────────────────────────
  console.log('financingTerms');
  await t('FT1. BM reads own-branch terms → ALLOW', () => assertSucceeds(getDoc(terms(as('bmA'), 'a1'))));
  await t('FT2. BM reads other-branch terms → DENY', () => assertFails(getDoc(terms(as('bmA'), 'b1'))));
  await t('FT3. UM reads own-unit terms → ALLOW', () => assertSucceeds(getDoc(terms(as('umA1'), 'a1'))));
  await t('FT4. UM reads other-unit terms → DENY', () => assertFails(getDoc(terms(as('umA1'), 'a2'))));
  await t('FT5. SM reads any-branch terms → ALLOW', () => assertSucceeds(getDoc(terms(as('sm'), 'b1'))));
  await t('FT6. BM probes a missing terms doc ("no terms yet") → ALLOW (reveals nothing)', () =>
    assertSucceeds(getDoc(terms(as('bmA'), 'agent-with-no-terms'))));
  await t('FT7. BM writes own-branch agent terms → ALLOW', () =>
    assertSucceeds(setDoc(terms(as('bmA'), 'a1'), termsDoc('a1', { validatingAPI: 31000 }))));
  await t('FT8. BM writes other-branch agent terms → DENY', () =>
    assertFails(setDoc(terms(as('bmA'), 'b1'), termsDoc('b1', { validatingAPI: 31000 }))));
  await t('FT9. BM re-stamps an other-branch doc into own branch → DENY', () =>
    assertFails(setDoc(terms(as('bmA'), 'b1'), termsDoc('b1', { branchId: A }))));
  await t('FT10. BM creates terms stamped for another branch → DENY', () =>
    assertFails(setDoc(terms(as('bmA'), 'new-b-agent'), { ...termsDoc('b1'), agentId: 'new-b-agent' })));
  await t('FT11. SM writes any-branch terms → ALLOW', () =>
    assertSucceeds(setDoc(terms(as('sm'), 'b1'), termsDoc('b1', { validatingAPI: 32000 }))));
  await t('FT12. UM writes own-unit terms → DENY (writes stay BM+, contract 5.3)', () =>
    assertFails(setDoc(terms(as('umA1'), 'a1'), termsDoc('a1'))));

  // ── financing (monthly ledger) ──────────────────────────────────────────────
  console.log('financing');
  await t('F1. BM reads own-branch month → ALLOW', () => assertSucceeds(getDoc(month(as('bmA'), 'a1'))));
  await t('F2. BM reads other-branch month → DENY', () => assertFails(getDoc(month(as('bmA'), 'b1'))));
  await t('F3. UM reads own-unit month → ALLOW', () => assertSucceeds(getDoc(month(as('umA1'), 'a1'))));
  await t('F4. EXPLOIT: UM reads ANOTHER unit\'s financing (get) → DENY', () => assertFails(getDoc(month(as('umA1'), 'a2'))));
  await t('F5. EXPLOIT: UM lists ANOTHER unit\'s financing (old unfiltered query) → DENY', () =>
    assertFails(getDocs(query(monthCol(as('umA1')), where('agentId', '==', 'a2')))));
  await t('F6. UM lists own-unit agent with unit filter (UnitFinancingRoster shape) → ALLOW', () =>
    assertSucceeds(getDocs(query(monthCol(as('umA1')), where('agentId', '==', 'a1'), where('unitId', '==', 'umA1')))));
  await t('F7. BM lists own-branch agent with branch filter (listFinancingMonths shape) → ALLOW', () =>
    assertSucceeds(getDocs(query(monthCol(as('bmA')), where('agentId', '==', 'a1'), where('branchId', '==', A)))));
  await t('F8. BM lists other-branch agent unfiltered → DENY', () =>
    assertFails(getDocs(query(monthCol(as('bmA')), where('agentId', '==', 'b1')))));
  await t('F9. SM lists any agent unfiltered → ALLOW', () =>
    assertSucceeds(getDocs(query(monthCol(as('sm')), where('agentId', '==', 'b1')))));
  await t('F10. SM reads any-branch month → ALLOW', () => assertSucceeds(getDoc(month(as('sm'), 'b1'))));
  await t('F11. BM writes own-branch month → ALLOW', () =>
    assertSucceeds(setDoc(month(as('bmA'), 'a1'), monthDoc('a1', { financingPaid: 4100 }))));
  await t('F12. BM writes other-branch month → DENY', () =>
    assertFails(setDoc(month(as('bmA'), 'b1'), monthDoc('b1', { financingPaid: 4100 }))));
  await t('F13. SM writes any-branch month → ALLOW', () =>
    assertSucceeds(setDoc(month(as('sm'), 'b1'), monthDoc('b1', { financingPaid: 4200 }))));
  await t('F14. BM probes a missing month doc → ALLOW (reveals nothing)', () =>
    assertSucceeds(getDoc(doc(as('bmA'), `tenants/${T}/financing/a1_2031_01`))));

  // ── financingReconciliation ─────────────────────────────────────────────────
  console.log('financingReconciliation');
  await t('R1. BM reads own-branch record → ALLOW', () => assertSucceeds(getDoc(recon(as('bmA'), 'a1'))));
  await t('R2. BM reads other-branch record → DENY', () => assertFails(getDoc(recon(as('bmA'), 'b1'))));
  await t('R3. UM reads own-unit record → ALLOW', () => assertSucceeds(getDoc(recon(as('umA1'), 'a1'))));
  await t('R4. UM reads other-unit record → DENY', () => assertFails(getDoc(recon(as('umA1'), 'a2'))));
  await t('R5. SM reads any-branch record → ALLOW', () => assertSucceeds(getDoc(recon(as('sm'), 'b1'))));
  await t('R6. BM lists other-branch agent unfiltered → DENY', () =>
    assertFails(getDocs(query(reconCol(as('bmA')), where('agentId', '==', 'b1')))));
  await t('R7. BM writes own-branch record → ALLOW', () =>
    assertSucceeds(setDoc(recon(as('bmA'), 'a1'), reconDoc('a1', { serviceMonths: 11 }))));
  await t('R8. BM writes other-branch record → DENY', () =>
    assertFails(setDoc(recon(as('bmA'), 'b1'), reconDoc('b1', { serviceMonths: 11 }))));
  await t('R9. SM writes any-branch record → ALLOW', () =>
    assertSucceeds(setDoc(recon(as('sm'), 'b1'), reconDoc('b1', { serviceMonths: 10 }))));

  // ── submissions create/update (manager arm) ─────────────────────────────────
  console.log('submissions — manager write arm');
  await t('S1. BM updates own-branch submission → ALLOW', () =>
    assertSucceeds(updateDoc(sub(as('bmA'), 'sub-a1'), { status: 'draft' })));
  await t('S2. BM updates other-branch submission → DENY', () =>
    assertFails(updateDoc(sub(as('bmA'), 'sub-b1'), { status: 'draft' })));
  await t('S3. BM moves an other-branch submission into own branch → DENY', () =>
    assertFails(updateDoc(sub(as('bmA'), 'sub-b1'), { branchId: A })));
  await t('S4. BM creates a submission in another branch → DENY', () =>
    assertFails(setDoc(sub(as('bmA'), 'new-sub-b'), submissionDoc('b1'))));
  await t('S5. UM updates own-unit submission → ALLOW', () =>
    assertSucceeds(updateDoc(sub(as('umA1'), 'sub-a1'), { status: 'draft' })));
  await t('S6. UM updates other-unit submission → DENY', () =>
    assertFails(updateDoc(sub(as('umA1'), 'sub-a2'), { status: 'draft' })));
  await t('S7. UM creates a submission for another unit → DENY', () =>
    assertFails(setDoc(sub(as('umA1'), 'new-sub-a2'), submissionDoc('a2'))));
  await t('S8. SM updates any-branch submission → ALLOW', () =>
    assertSucceeds(updateDoc(sub(as('sm'), 'sub-b1'), { status: 'draft' })));

  // ── users update (manager edit arm) ─────────────────────────────────────────
  console.log('users — manager edit arm (SEC-05)');
  await t('U1. BM edits own-branch user → ALLOW', () =>
    assertSucceeds(updateDoc(user(as('bmA'), 'a1'), { name: 'A1 renamed' })));
  await t('U2. BM edits other-branch user → DENY', () =>
    assertFails(updateDoc(user(as('bmA'), 'b1'), { name: 'B1 renamed' })));
  await t('U3. UM edits own-unit user → ALLOW', () =>
    assertSucceeds(updateDoc(user(as('umA1'), 'a1'), { phone: '555-0101' })));
  await t('U4. UM edits other-unit user → DENY', () =>
    assertFails(updateDoc(user(as('umA1'), 'a2'), { phone: '555-0102' })));
  await t('U5. SM edits any-branch user → ALLOW', () =>
    assertSucceeds(updateDoc(user(as('sm'), 'b1'), { name: 'B1 by SM' })));
  await t('U6. BM with no branchId on own doc edits any user → DENY', () =>
    assertFails(updateDoc(user(as('bmNoBranch'), 'a1'), { name: 'nope' })));

  // ── agents unchanged ────────────────────────────────────────────────────────
  console.log('agents — unchanged');
  await t('X1. Agent reads own policy / terms / month → ALLOW', async () => {
    await assertSucceeds(getDoc(pol(as('a1'), 'pol-a1')));
    await assertSucceeds(getDoc(terms(as('a1'), 'a1')));
    await assertSucceeds(getDoc(month(as('a1'), 'a1')));
  });
  await t('X2. Agent reads a peer\'s terms / month → DENY', async () => {
    await assertFails(getDoc(terms(as('a1'), 'a2')));
    await assertFails(getDoc(month(as('a1'), 'a2')));
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
