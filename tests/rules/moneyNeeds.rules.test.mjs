import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'money-needs-rules-test-tenant';

let testEnv;
const results = [];

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

async function run(label, expectAllow, fn) {
  try {
    if (expectAllow) {
      await assertSucceeds(fn());
    } else {
      await assertFails(fn());
    }
    results.push({ label, pass: true, expected: expectAllow ? 'ALLOW' : 'DENY' });
  } catch (err) {
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 120) });
  }
}

const VALID_PAYLOAD = {
  year: 2026,
  productLines: [],
  expenseGroups: {
    fixedExpenses:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    livingExpenses:      { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    businessExpenses:    { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    savingsAccumulation: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    miscellaneous:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  },
  subCalculators: {
    insuranceIndustry: { lineItems: [], annualTotal: 0 },
    carExpenses:       { lineItems: [], withLoan: false, personalSharePct: 33, businessSharePct: 67, annualTotalPersonal: 0, annualTotalBusiness: 0 },
    loansDebt:         { lineItems: [], annualTotal: 0 },
  },
  totalAnnualAfterTax: 0,
  payeBracketsSnapshot: null,
  payeBracketsVersionId: null,
  computedPAYE: 0,
  totalAnnualPreTax: 0,
  estimatedRenewalIncome: { life: 0, ah: 0, property: 0, motor: 0, total: 0 },
  firstYearCommissionsRequired: 0,
  firstYearCommissionsTargets: { life: 0, ah: 0, property: 0, motor: 0, total: 0 },
  visibility: 'private',
  shareWithSm: false,
  tenantId: TENANT_ID,
  uid: 'agent-a',
};

function mnDocPath(uid, year) {
  return `tenants/${TENANT_ID}/users/${uid}/moneyNeeds/${year}`;
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host:  '127.0.0.1',
      port:  9090,
    },
  });

  // Seed docs for G1 owner tests + G5 manager-read tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // moneyNeeds docs
    await db.doc(mnDocPath('agent-a', '2026')).set(VALID_PAYLOAD);                                                  // private, shareWithSm=false
    await db.doc(mnDocPath('agent-b', '2026')).set({ ...VALID_PAYLOAD, uid: 'agent-b' });
    await db.doc(mnDocPath('agent-a', '2027')).set({ ...VALID_PAYLOAD, year: 2027, visibility: 'shared', shareWithSm: false }); // shared, no SM
    await db.doc(mnDocPath('agent-a', '2028')).set({ ...VALID_PAYLOAD, year: 2028, visibility: 'shared', shareWithSm: true });  // shared + SM
    // user docs for callerUnitId / callerBranchId + target agent field lookups
    await db.doc(`tenants/${TENANT_ID}/users/agent-a`).set({ unitId: 'unit-1', branchId: 'branch-1', role: 'agent',          tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/agent-b`).set({ unitId: 'unit-2', branchId: 'branch-2', role: 'agent',          tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/um-same`).set({ unitId: 'unit-1',                        role: 'unit_manager',   tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/um-diff`).set({ unitId: 'unit-2',                        role: 'unit_manager',   tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/bm-1`).set(   { branchId: 'branch-1',                    role: 'branch_manager', tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/bm-diff`).set({ branchId: 'branch-2',                    role: 'branch_manager', tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/sm-1`).set({                                             role: 'sales_manager',  tenantId: TENANT_ID });
    await db.doc(`tenants/${TENANT_ID}/users/ta-1`).set({                                             role: 'tenant_admin',   tenantId: TENANT_ID });
  });

  const agentADb  = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb  = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umDb      = testEnv.authenticatedContext('um-1',    authToken('unit_manager')).firestore();
  const umSameDb  = testEnv.authenticatedContext('um-same', authToken('unit_manager')).firestore();
  const umDiffDb  = testEnv.authenticatedContext('um-diff', authToken('unit_manager')).firestore();
  const bmDb      = testEnv.authenticatedContext('bm-1',    authToken('branch_manager')).firestore();
  const bmDiffDb  = testEnv.authenticatedContext('bm-diff', authToken('branch_manager')).firestore();
  const smDb      = testEnv.authenticatedContext('sm-1',    authToken('sales_manager')).firestore();
  const taDb      = testEnv.authenticatedContext('ta-1',    authToken('tenant_admin')).firestore();
  const anonDb    = testEnv.unauthenticatedContext().firestore();
  const crossDb   = testEnv.authenticatedContext('agent-a', { role: 'agent', tenantId: 'other-tenant' }).firestore();

  // ── GET ──────────────────────────────────────────────────────────────────────

  await run('agent-a GET own 2026 worksheet → ALLOW', true, () =>
    getDoc(doc(agentADb, mnDocPath('agent-a', '2026')))
  );

  await run('agent-b GET agent-a worksheet (uid mismatch) → DENY', false, () =>
    getDoc(doc(agentBDb, mnDocPath('agent-a', '2026')))
  );

  await run('unit_manager GET private worksheet → DENY', false, () =>
    getDoc(doc(umDb, mnDocPath('agent-a', '2026')))
  );

  await run('branch_manager GET private worksheet → DENY', false, () =>
    getDoc(doc(bmDb, mnDocPath('agent-a', '2026')))
  );

  await run('unauthenticated GET → DENY', false, () =>
    getDoc(doc(anonDb, mnDocPath('agent-a', '2026')))
  );

  await run('cross-tenant agent GET → DENY', false, () =>
    getDoc(doc(crossDb, mnDocPath('agent-a', '2026')))
  );

  // ── CREATE ───────────────────────────────────────────────────────────────────

  await run('agent-a CREATE own 2025 worksheet (visibility:private) → ALLOW', true, () =>
    setDoc(doc(agentADb, mnDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, year: 2025, uid: 'agent-a' })
  );

  await run('agent CREATE with visibility:default (not private) → DENY', false, () =>
    setDoc(doc(agentADb, mnDocPath('agent-a', '2024')), { ...VALID_PAYLOAD, year: 2024, visibility: 'default' })
  );

  await run('agent-b CREATE at agent-a path (uid mismatch) → DENY', false, () =>
    setDoc(doc(agentBDb, mnDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, uid: 'agent-b', visibility: 'private' })
  );

  // Rotted test data (fixed): 'um-1' is umDb's OWN uid, so this previously
  // exercised a unit_manager filing their OWN worksheet — allowed by design
  // (`allow create: if (isAgent() || isProducingManager()) && ... &&
  // request.auth.uid == uid`; producing managers file personal worksheets
  // alongside their management role, same pattern as weeklyPlans/policies).
  // Retargeted at a real agent's path so the assertion exercises the intended
  // "manager cannot create AT an agent's path" boundary (uid mismatch).
  await run("unit_manager CREATE at an agent's path (not own) → DENY", false, () =>
    setDoc(doc(umDb, mnDocPath('agent-a', '2029')), { ...VALID_PAYLOAD, year: 2029, uid: 'agent-a', visibility: 'private' })
  );

  // The own-doc ALLOW the retarget above left untested (FU banked from the
  // PR #972 review): a producing unit_manager files their OWN worksheet via the
  // isProducingManager() arm of `allow create`. Dropping that arm must fail CI.
  await run('unit_manager CREATE own worksheet (visibility:private) → ALLOW', true, () =>
    setDoc(doc(umDb, mnDocPath('um-1', '2029')), { ...VALID_PAYLOAD, year: 2029, uid: 'um-1', visibility: 'private' })
  );

  await run('branch_manager CREATE own worksheet (visibility:private) → ALLOW', true, () =>
    setDoc(doc(bmDb, mnDocPath('bm-1', '2029')), { ...VALID_PAYLOAD, year: 2029, uid: 'bm-1', visibility: 'private' })
  );

  await run('unauthenticated CREATE → DENY', false, () =>
    setDoc(doc(anonDb, mnDocPath('agent-a', '2023')), { ...VALID_PAYLOAD, visibility: 'private' })
  );

  // ── UPDATE ───────────────────────────────────────────────────────────────────

  await run('agent-a UPDATE own worksheet → ALLOW', true, () =>
    updateDoc(doc(agentADb, mnDocPath('agent-a', '2026')), { totalAnnualAfterTax: 5000 })
  );

  await run('agent-b UPDATE agent-a worksheet → DENY', false, () =>
    updateDoc(doc(agentBDb, mnDocPath('agent-a', '2026')), { totalAnnualAfterTax: 9999 })
  );

  await run('unit_manager UPDATE agent-a worksheet → DENY', false, () =>
    updateDoc(doc(umDb, mnDocPath('agent-a', '2026')), { totalAnnualAfterTax: 9999 })
  );

  await run('unauthenticated UPDATE → DENY', false, () =>
    updateDoc(doc(anonDb, mnDocPath('agent-a', '2026')), { totalAnnualAfterTax: 1 })
  );

  // ── DELETE ───────────────────────────────────────────────────────────────────

  await run('agent-a DELETE own worksheet → DENY (delete: if false)', false, () =>
    deleteDoc(doc(agentADb, mnDocPath('agent-a', '2026')))
  );

  await run('branch_manager DELETE → DENY', false, () =>
    deleteDoc(doc(bmDb, mnDocPath('agent-a', '2026')))
  );

  // ── G5 ALLOW — manager-read arms ─────────────────────────────────────────────

  await run('UM same-unit GET shared worksheet → ALLOW', true, () =>
    getDoc(doc(umSameDb, mnDocPath('agent-a', '2027')))
  );

  await run('BM same-branch GET shared worksheet → ALLOW', true, () =>
    getDoc(doc(bmDb, mnDocPath('agent-a', '2027')))
  );

  await run('SM GET shareWithSm=true worksheet → ALLOW', true, () =>
    getDoc(doc(smDb, mnDocPath('agent-a', '2028')))
  );

  // ── G5 DENY — every denial case ──────────────────────────────────────────────

  await run('agent reads another agent private worksheet → DENY', false, () =>
    getDoc(doc(agentBDb, mnDocPath('agent-a', '2026')))
  );

  await run('UM reads private worksheet (own unit) → DENY', false, () =>
    getDoc(doc(umSameDb, mnDocPath('agent-a', '2026')))
  );

  await run('UM reads shared worksheet different unit → DENY', false, () =>
    getDoc(doc(umDiffDb, mnDocPath('agent-a', '2027')))
  );

  await run('BM reads private worksheet → DENY', false, () =>
    getDoc(doc(bmDb, mnDocPath('agent-a', '2026')))
  );

  await run('BM reads shared worksheet different branch → DENY', false, () =>
    getDoc(doc(bmDiffDb, mnDocPath('agent-a', '2027')))
  );

  await run('SM reads shared worksheet (shareWithSm=false) → DENY', false, () =>
    getDoc(doc(smDb, mnDocPath('agent-a', '2027')))
  );

  await run('TA reads shared worksheet → DENY', false, () =>
    getDoc(doc(taDb, mnDocPath('agent-a', '2027')))
  );

  await run('TA reads shareWithSm=true worksheet → DENY', false, () =>
    getDoc(doc(taDb, mnDocPath('agent-a', '2028')))
  );

  await run('TA reads private worksheet → DENY', false, () =>
    getDoc(doc(taDb, mnDocPath('agent-a', '2026')))
  );

  await run('unauthenticated GET shared worksheet → DENY', false, () =>
    getDoc(doc(anonDb, mnDocPath('agent-a', '2027')))
  );

  await run('non-owner (BM) update → DENY', false, () =>
    updateDoc(doc(bmDb, mnDocPath('agent-a', '2027')), { totalAnnualAfterTax: 99999 })
  );

  // ── Results ──────────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== moneyNeeds.rules.test results ===');
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.expected} — ${r.label}${r.error ? ` :: ${r.error}` : ''}`);
  }
  console.log(`\n${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.error('\nFailed cases:', failed.map((r) => r.label).join(', '));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
