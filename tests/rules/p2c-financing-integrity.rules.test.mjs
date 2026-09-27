/**
 * Emulator rules tests — P2c financing integrity (audit 2026-09-24 SEC-09) plus
 * the P2b leftovers (policy history scope, policy create branch pin).
 *
 * Run with:
 *   firebase emulators:exec --only firestore --project=demo-agencytrack \
 *     "node tests/rules/p2c-financing-integrity.rules.test.mjs"
 * or the whole suite via `npm run test:rules` under emulators:exec.
 *
 * RULES_FILE=<path> loads a different rules file (default: firestore.rules). The
 * PR uses it to prove the deny cases bite: run once against main's rules and
 * list which fail there.
 *
 * What is enforced (brief docs/briefs/p2c-financing-integrity.md):
 *   financingTerms / financing / financingReconciliation — hasOnly key allowlist
 *   financing.adjustmentPct                               — -1 <= x <= 1
 *   financingTerms.financingStatus                        — create at not_on_financing;
 *                                                           update = same status or a legal
 *                                                           forward move (financingService.js)
 *   P2b scope (bmFinancingWriteInScope / managerDocInScope) — unchanged on every arm
 *   policies/{id}/history read — scoped by the PARENT policy's branchId / unitId
 *   policies create           — branchId == creator's user-doc branchId; unitId too when set
 *
 * Fixture tenant (same shape as p2b-branch-scoping)
 *   branchA: bmA · umA1 · umA2 · agents a1 (umA1), a2 (umA2)
 *   branchB: bmB · umB1 · agent b1 (umB1)
 *   sm (sales_manager), ta (tenant_admin)
 */

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, orderBy,
  writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const RULES_FILE = process.env.RULES_FILE ?? 'firestore.rules';
const T = 'p2c-financing-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const A = 'branchA';
const B = 'branchB';

const USERS = {
  bmA:  { role: 'branch_manager', branchId: A },
  bmB:  { role: 'branch_manager', branchId: B },
  umA1: { role: 'unit_manager', branchId: A, unitId: 'umA1' },
  umA2: { role: 'unit_manager', branchId: A, unitId: 'umA2' },
  sm:   { role: 'sales_manager', branchId: A },
  ta:   { role: 'tenant_admin', branchId: A },
  a1:   { role: 'agent', branchId: A, unitId: 'umA1' },
  a2:   { role: 'agent', branchId: A, unitId: 'umA2' },
  b1:   { role: 'agent', branchId: B, unitId: 'umB1' },
};
const SCOPE = {
  a1: { branchId: A, unitId: 'umA1' },
  a2: { branchId: A, unitId: 'umA2' },
  b1: { branchId: B, unitId: 'umB1' },
};

function token(uid) {
  const u = USERS[uid];
  const t = { role: u.role, tenantId: T };
  if (u.branchId) t.branchId = u.branchId;
  return t;
}

const past = Timestamp.fromDate(new Date('2026-01-10T12:00:00Z'));

// ── Service-shaped payloads (exactly the keys financingService writes) ─────────

// setFinancingTerms create (core + create audit).
function termsCreate(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId],
    agreedMonthlyFinancing: 8000, currentMonthlyFinancing: 8000, validatingAPI: 30000,
    effectiveDate: '2026-01-01', updatedAt: serverTimestamp(), updatedBy: 'bmA',
    financingStatus: 'not_on_financing', statusHistory: [],
    createdAt: serverTimestamp(), createdBy: 'bmA',
    ...overrides,
  };
}
// A stored terms doc at a given status (seeded with rules disabled).
function termsAt(agentId, status, extra = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId],
    agreedMonthlyFinancing: 8000, currentMonthlyFinancing: 8000, validatingAPI: 30000,
    effectiveDate: '2026-01-01', financingStatus: status, statusHistory: [],
    createdAt: past, createdBy: 'bmA', updatedAt: past, updatedBy: 'bmA',
    ...extra,
  };
}
// transitionFinancingStatus payload (merge).
function statusMove(from, to, by = 'bmA') {
  return {
    financingStatus: to,
    statusHistory: [{ from, to, at: Timestamp.now(), by, byName: 'Mgr', role: 'branch_manager' }],
    updatedAt: serverTimestamp(), updatedBy: by,
  };
}
// setFinancingMonth create.
function monthCreate(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId], month: '2026_02',
    runningBalance: 22400, financingPaid: 4000, netCommission: 6200, bonusOffset: 0,
    notes: '', source: 'manager_entry', updatedAt: serverTimestamp(),
    enteredBy: 'bmA', enteredByName: 'Mgr', enteredAt: serverTimestamp(),
    ...overrides,
  };
}
// setFinancingProration create (proration-only, forward of any statement).
function prorationCreate(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId], month: '2026_03',
    validatingAPI: 30000, actualAPI: 15000, suggestedFinancing: 4000, basisSource: 'submitted-final',
    prorationUpdatedAt: serverTimestamp(), prorationUpdatedBy: 'bmA',
    managerFinancing: 3600, adjustmentPct: 0.1,
    source: 'manager_entry',
    prorationEnteredBy: 'bmA', prorationEnteredByName: 'Mgr', prorationEnteredAt: serverTimestamp(),
    ...overrides,
  };
}
// reconcileFinancing create.
function reconCreate(agentId, overrides = {}) {
  return {
    agentId, tenantId: T, ...SCOPE[agentId], year: 2026,
    totalFinancingDrawn: 48000, totalOffsets: 29800, closingBalance: 18200,
    waiverApplied: 12000, serviceMet: true, serviceMonths: 12, reconciledPosition: 6200,
    outcome: 'owing', surplusPaid: 0, garnishStarted: true, triggeredBy: 'auto_month12',
    updatedAt: serverTimestamp(), updatedBy: 'bmA',
    reconciledBy: 'bmA', reconciledByName: 'Mgr', reconciledAt: serverTimestamp(), createdAt: serverTimestamp(),
    ...overrides,
  };
}

function policyDoc(agentId, overrides = {}) {
  return {
    tenantId: T, agentId, ...SCOPE[agentId],
    status: 'settled', productLine: 'life', ownerName: 'Owner', insuredName: 'Insured',
    proposedAPI: 5000, settledAPI: 5000, dateWritten: past, createdAt: past,
    ...overrides,
  };
}
function historyDoc(agentId) {
  return {
    fromStatus: 'submitted', toStatus: 'settled', changedFields: ['status'],
    actorUid: agentId, actorRole: 'agent', at: past, agentId, unitId: SCOPE[agentId].unitId,
  };
}
// createPolicy payload (policiesService.createPolicy) — only the keys the create
// arm evaluates matter; the arm has no hasOnly.
function newPolicy(agentId, overrides = {}) {
  return {
    tenantId: T, agentId, ...SCOPE[agentId],
    status: 'written', ownerName: 'New Owner', insuredName: 'New Owner',
    productLine: 'life', newBusinessType: 'nb_ordinary', policyClass: 'whole_life',
    proposedAPI: 6000, proposedFrequency: 'M', dateWritten: past,
    sourceOfProspect: 'referral', createdAt: serverTimestamp(), createdBy: agentId,
    ...overrides,
  };
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
  console.log('P2c financing integrity — Firestore emulator rules tests (SEC-09 + P2b leftovers)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT} · rules: ${RULES_FILE}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT, rules: readFileSync(RULES_FILE, 'utf8') },
  });
  await testEnv.clearFirestore();

  const STATUSES = ['not_on_financing', 'on_financing', 'reconciling', 'post_financing_repayment', 'cleared'];

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) {
      await setDoc(doc(db, `tenants/${T}/users/${uid}`), { uid, tenantId: T, active: true, ...u });
    }
    // One terms doc per (agent, status) for transition cases: financingTerms is
    // keyed by agentId, so status fixtures live under synthetic agent ids that
    // carry a1's scope.
    for (const st of STATUSES) {
      for (const to of STATUSES) {
        const id = `a1__${st}__${to}`;
        await setDoc(doc(db, `tenants/${T}/financingTerms/${id}`), { ...termsAt('a1', st), agentId: id });
      }
    }
    await setDoc(doc(db, `tenants/${T}/financingTerms/b1`), termsAt('b1', 'on_financing'));
    // adjustmentPct ruling fixtures: a1 at agreed 8,000; a1-cut after a clause-5 cut
    // (agreed 3,000 / current 1,000). a1-noterms has a ledger month but no terms doc.
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1`), termsAt('a1', 'on_financing'));
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1-cut`), {
      ...termsAt('a1', 'on_financing'), agentId: 'a1-cut', agreedMonthlyFinancing: 3000, currentMonthlyFinancing: 1000,
    });
    // A month confirmed at 3,000 while agreed was 3,000; stored as-is, then re-edited below.
    await setDoc(doc(db, `tenants/${T}/financing/a1-cut_2026_05`), {
      ...prorationCreate('a1', { agentId: 'a1-cut', month: '2026_05', managerFinancing: 3000, adjustmentPct: -2 }),
      prorationUpdatedAt: past, prorationEnteredAt: past,
    });
    // Legacy month whose stored manager figure (9,000) now exceeds agreed (3,000).
    await setDoc(doc(db, `tenants/${T}/financing/a1-cut_2026_06`), {
      ...monthCreate('a1', { agentId: 'a1-cut', month: '2026_06' }), updatedAt: past, enteredAt: past,
      managerFinancing: 9000, adjustmentPct: -8,
    });
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1-edit`), { ...termsAt('a1', 'on_financing'), agentId: 'a1-edit' });
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1-legacy`), { ...termsAt('a1', 'on_financing'), agentId: 'a1-legacy', strayField: 'x' });
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1-recon-ok`), { ...termsAt('a1', 'reconciling'), agentId: 'a1-recon-ok' });
    await setDoc(doc(db, `tenants/${T}/financingTerms/a1-recon-bad`), { ...termsAt('a1', 'on_financing'), agentId: 'a1-recon-bad' });
    await setDoc(doc(db, `tenants/${T}/financing/a1_2026_01`), {
      agentId: 'a1', tenantId: T, ...SCOPE.a1, month: '2026_01',
      runningBalance: 22400, financingPaid: 4000, netCommission: 6200, bonusOffset: 0,
      notes: '', source: 'manager_entry', enteredBy: 'bmA', enteredByName: 'Mgr', enteredAt: past, updatedAt: past,
    });
    await setDoc(doc(db, `tenants/${T}/financingReconciliation/a1_2025`), {
      ...reconCreate('a1'), year: 2025, updatedAt: past, reconciledAt: past, createdAt: past,
    });
    for (const id of ['a1', 'a2', 'b1']) {
      await setDoc(doc(db, `tenants/${T}/policies/pol-${id}`), policyDoc(id));
      await setDoc(doc(db, `tenants/${T}/policies/pol-${id}/history/h1`), historyDoc(id));
    }
  });

  const as = (uid) => testEnv.authenticatedContext(uid, token(uid)).firestore();
  const termsRef = (db, id) => doc(db, `tenants/${T}/financingTerms/${id}`);
  const monthRef = (db, id) => doc(db, `tenants/${T}/financing/${id}`);
  const reconRef = (db, id) => doc(db, `tenants/${T}/financingReconciliation/${id}`);
  const histRef  = (db, pol, h = 'h1') => doc(db, `tenants/${T}/policies/${pol}/history/${h}`);
  const histCol  = (db, pol) => collection(db, `tenants/${T}/policies/${pol}/history`);
  const polCol   = (db) => collection(db, `tenants/${T}/policies`);

  // ── financingTerms ─────────────────────────────────────────────────────────
  console.log('financingTerms — key allowlist + status machine');
  await t('FT1. BM creates own-branch terms (service shape, not_on_financing) → ALLOW', () =>
    assertSucceeds(setDoc(termsRef(as('bmA'), 'a2'), termsCreate('a2'))));
  await t('FT2. create with an unknown key → DENY', () =>
    assertFails(setDoc(termsRef(as('bmA'), 'a1-new1'), { ...termsCreate('a1'), agentId: 'a1-new1', bonusOverride: 1 })));
  await t('FT3. create already on_financing (skips the machine) → DENY', () =>
    assertFails(setDoc(termsRef(as('bmA'), 'a1-new2'), { ...termsCreate('a1'), agentId: 'a1-new2', financingStatus: 'on_financing' })));
  await t('FT4. terms-only edit (status unchanged, setFinancingTerms merge) → ALLOW', () =>
    assertSucceeds(setDoc(termsRef(as('bmA'), 'a1-edit'), {
      agentId: 'a1-edit', tenantId: T, ...SCOPE.a1, agreedMonthlyFinancing: 9000, currentMonthlyFinancing: 8500,
      validatingAPI: 32000, effectiveDate: '2026-01-01', updatedAt: serverTimestamp(), updatedBy: 'bmA',
    }, { merge: true })));
  await t('FT5. update adding an unknown key → DENY', () =>
    assertFails(updateDoc(termsRef(as('bmA'), 'a1-edit'), { writtenOff: true })));

  const LEGAL = [
    ['not_on_financing', 'on_financing'],
    ['on_financing', 'reconciling'],
    ['reconciling', 'post_financing_repayment'],
    ['reconciling', 'cleared'],
    ['post_financing_repayment', 'cleared'],
  ];
  const isLegal = (f, to) => LEGAL.some(([a, b]) => a === f && b === to);
  let n = 6;
  for (const [from, to] of LEGAL) {
    await t(`FT${n++}. legal ${from} → ${to} → ALLOW`, () =>
      assertSucceeds(setDoc(termsRef(as('bmA'), `a1__${from}__${to}`), statusMove(from, to), { merge: true })));
  }
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      if (from === to || isLegal(from, to)) continue;
      await t(`FT${n++}. illegal ${from} → ${to} → DENY`, () =>
        assertFails(setDoc(termsRef(as('bmA'), `a1__${from}__${to}`), statusMove(from, to), { merge: true })));
    }
  }
  await t(`FT${n++}. SM legal move on another branch's agent → ALLOW (tenant-wide, P2b unchanged)`, () =>
    assertSucceeds(setDoc(termsRef(as('sm'), 'b1'), statusMove('on_financing', 'reconciling', 'sm'), { merge: true })));
  await t(`FT${n++}. BM legal move on another branch's agent → DENY (P2b scope kept)`, () =>
    assertFails(setDoc(termsRef(as('bmA'), 'b1'), statusMove('reconciling', 'cleared'), { merge: true })));
  await t(`FT${n++}. UM legal move on own-unit agent → DENY (UM never writes financing, P2b kept)`, () =>
    assertFails(setDoc(termsRef(as('umA1'), 'a1__on_financing__reconciling'), statusMove('on_financing', 'reconciling', 'umA1'), { merge: true })));
  await t(`FT${n++}. legacy doc carrying a stray key: next update → DENY (the dry-run script counts these)`, () =>
    assertFails(updateDoc(termsRef(as('bmA'), 'a1-legacy'), { updatedAt: serverTimestamp(), updatedBy: 'bmA' })));
  await t(`FT${n++}. P2b read scope kept — BM reads own-branch terms ALLOW, other branch DENY`, async () => {
    await assertSucceeds(getDoc(termsRef(as('bmA'), 'a1-edit')));
    await assertFails(getDoc(termsRef(as('bmA'), 'b1')));
  });

  // ── financing (monthly ledger) ─────────────────────────────────────────────
  console.log('financing — key allowlist + adjustmentPct <= 1 + manager figure <= agreed');
  await t('FM1. BM creates own-branch statement (setFinancingMonth shape) → ALLOW', () =>
    assertSucceeds(setDoc(monthRef(as('bmA'), 'a1_2026_02'), monthCreate('a1'))));
  await t('FM2. BM creates proration-only month (setFinancingProration shape, adjustmentPct 0.1) → ALLOW', () =>
    assertSucceeds(setDoc(monthRef(as('bmA'), 'a1_2026_03'), prorationCreate('a1'))));
  await t('FM3. create with an unknown key → DENY', () =>
    assertFails(setDoc(monthRef(as('bmA'), 'a1_2026_04'), monthCreate('a1', { month: '2026_04', commissionOverride: 500 }))));
  await t('FM4. update adding an unknown key → DENY', () =>
    assertFails(updateDoc(monthRef(as('bmA'), 'a1_2026_01'), { writeOff: 22400 })));
  await t('FM5. adjustmentPct 1.5 → DENY', () =>
    assertFails(setDoc(monthRef(as('bmA'), 'a1_2026_05'), prorationCreate('a1', { month: '2026_05', adjustmentPct: 1.5 }))));
  // Ruling (Kyron, 27 Sep 2026): no -1 floor; the manager figure must not exceed agreed.
  await t('FM6. RULING: agreed 3,000 / current 1,000 / manager 3,000 (adjustmentPct -2) → ALLOW', () =>
    assertSucceeds(setDoc(monthRef(as('bmA'), 'a1-cut_2026_03'),
      prorationCreate('a1', { agentId: 'a1-cut', month: '2026_03', managerFinancing: 3000, adjustmentPct: -2 }))));
  await t('FM7. RULING: agreed 3,000 / current 1,000 / manager 3,500 (adjustmentPct -2.5) → DENY', () =>
    assertFails(setDoc(monthRef(as('bmA'), 'a1-cut_2026_04'),
      prorationCreate('a1', { agentId: 'a1-cut', month: '2026_04', managerFinancing: 3500, adjustmentPct: -2.5 }))));
  await t('FM7b. adjustmentPct 1 (manager 0) → ALLOW', () =>
    assertSucceeds(setDoc(monthRef(as('bmA'), 'a1_2026_07'), prorationCreate('a1', { month: '2026_07', adjustmentPct: 1, managerFinancing: 0 }))));
  await t('FM7c. update raising the manager figure above agreed → DENY; within agreed → ALLOW', async () => {
    await assertFails(updateDoc(monthRef(as('bmA'), 'a1-cut_2026_05'), { managerFinancing: 3001, adjustmentPct: -2.001 }));
    await assertSucceeds(updateDoc(monthRef(as('bmA'), 'a1-cut_2026_05'), { managerFinancing: 2500, adjustmentPct: -1.5 }));
  });
  await t('FM7d. statement-only edit of a legacy month (stored manager 9,000 > agreed 3,000) → ALLOW (not re-judged)', () =>
    assertSucceeds(updateDoc(monthRef(as('bmA'), 'a1-cut_2026_06'), { runningBalance: 1200, updatedAt: serverTimestamp() })));
  await t('FM7e. manager figure for an agent with NO terms doc → DENY', () =>
    assertFails(setDoc(monthRef(as('bmA'), 'a1-noterms_2026_03'),
      prorationCreate('a1', { agentId: 'a1-noterms', month: '2026_03' }))));
  await t('FM8. negative runningBalance (surplus) → ALLOW; non-number runningBalance → DENY', async () => {
    await assertSucceeds(setDoc(monthRef(as('bmA'), 'a1_2026_09'), monthCreate('a1', { month: '2026_09', runningBalance: -500 })));
    await assertFails(setDoc(monthRef(as('bmA'), 'a1_2026_10'), monthCreate('a1', { month: '2026_10', runningBalance: '22400' })));
  });
  await t('FM9. BM writes another branch\'s ledger → DENY (P2b scope kept)', () =>
    assertFails(setDoc(monthRef(as('bmA'), 'b1_2026_02'), monthCreate('b1'))));
  await t('FM10. SM writes any branch\'s ledger → ALLOW (P2b unchanged)', () =>
    assertSucceeds(setDoc(monthRef(as('sm'), 'b1_2026_02'), monthCreate('b1'))));
  await t('FM11. P2b list scope kept — BM own-branch list ALLOW, unfiltered DENY', async () => {
    await assertSucceeds(getDocs(query(collection(as('bmA'), `tenants/${T}/financing`), where('agentId', '==', 'a1'), where('branchId', '==', A))));
    await assertFails(getDocs(query(collection(as('bmA'), `tenants/${T}/financing`), where('agentId', '==', 'a1'))));
  });

  // ── financingReconciliation ────────────────────────────────────────────────
  console.log('financingReconciliation — key allowlist + atomic status move');
  await t('FR1. BM creates own-branch record (reconcileFinancing shape) → ALLOW', () =>
    assertSucceeds(setDoc(reconRef(as('bmA'), 'a2_2026'), reconCreate('a2'))));
  await t('FR2. create with an unknown key → DENY', () =>
    assertFails(setDoc(reconRef(as('bmA'), 'a1_2027'), reconCreate('a1', { year: 2027, forgiven: 6200 }))));
  await t('FR3. update adding an unknown key → DENY', () =>
    assertFails(updateDoc(reconRef(as('bmA'), 'a1_2025'), { forgiven: 6200 })));
  await t('FR4. BM writes another branch\'s record → DENY (P2b scope kept)', () =>
    assertFails(setDoc(reconRef(as('bmA'), 'b1_2026'), reconCreate('b1'))));
  await t('FR5. record + LEGAL terms move (reconciling → post_financing_repayment) in one batch → ALLOW', async () => {
    const db = as('bmA');
    const batch = writeBatch(db);
    batch.set(reconRef(db, 'a1-recon-ok_2026'), { ...reconCreate('a1'), agentId: 'a1-recon-ok' });
    batch.set(termsRef(db, 'a1-recon-ok'), statusMove('reconciling', 'post_financing_repayment'), { merge: true });
    await assertSucceeds(batch.commit());
  });
  await t('FR6. record + ILLEGAL terms move (on_financing → cleared) in one batch → DENY, record not written', async () => {
    const db = as('bmA');
    const batch = writeBatch(db);
    batch.set(reconRef(db, 'a1-recon-bad_2026'), { ...reconCreate('a1'), agentId: 'a1-recon-bad' });
    batch.set(termsRef(db, 'a1-recon-bad'), statusMove('on_financing', 'cleared'), { merge: true });
    await assertFails(batch.commit());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), `tenants/${T}/financingReconciliation/a1-recon-bad_2026`));
      if (snap.exists()) throw new Error('record was written despite the failed batch');
    });
  });

  // ── policy history (P2b leftover) ──────────────────────────────────────────
  console.log('policies/history — scoped by the parent policy');
  await t('PH1. BM reads own-branch policy history → ALLOW', () => assertSucceeds(getDoc(histRef(as('bmA'), 'pol-a1'))));
  await t('PH2. BM reads other-branch policy history → DENY', () => assertFails(getDoc(histRef(as('bmA'), 'pol-b1'))));
  await t('PH3. BM lists own-branch policy history (getPolicyHistory shape) → ALLOW', () =>
    assertSucceeds(getDocs(query(histCol(as('bmA'), 'pol-a1'), orderBy('at', 'desc')))));
  await t('PH4. BM lists other-branch policy history → DENY', () =>
    assertFails(getDocs(query(histCol(as('bmA'), 'pol-b1'), orderBy('at', 'desc')))));
  await t('PH5. UM reads own-unit history ALLOW, other unit (same branch) DENY', async () => {
    await assertSucceeds(getDoc(histRef(as('umA1'), 'pol-a1')));
    await assertFails(getDoc(histRef(as('umA1'), 'pol-a2')));
  });
  await t('PH6. SM and TA read any-branch history → ALLOW', async () => {
    await assertSucceeds(getDoc(histRef(as('sm'), 'pol-b1')));
    await assertSucceeds(getDoc(histRef(as('ta'), 'pol-b1')));
  });
  await t('PH7. agent reads own history ALLOW, a peer\'s DENY', async () => {
    await assertSucceeds(getDoc(histRef(as('a1'), 'pol-a1')));
    await assertFails(getDoc(histRef(as('a1'), 'pol-a2')));
  });

  // ── policy create (P2b leftover) ───────────────────────────────────────────
  console.log('policies create — creator branch / unit pin');
  await t('PC1. agent creates with own branchId + unitId → ALLOW', () =>
    assertSucceeds(addDoc(polCol(as('a1')), newPolicy('a1'))));
  await t('PC2. agent creates with another branch\'s branchId → DENY', () =>
    assertFails(addDoc(polCol(as('a1')), newPolicy('a1', { branchId: B }))));
  await t('PC3. agent creates with another unit\'s unitId → DENY', () =>
    assertFails(addDoc(polCol(as('a1')), newPolicy('a1', { unitId: 'umA2' }))));
  await t('PC4. agent creates with branchId null → DENY', () =>
    assertFails(addDoc(polCol(as('a1')), newPolicy('a1', { branchId: null }))));
  await t('PC5. BM (no unit on user doc) creates own policy in own branch → ALLOW', () =>
    assertSucceeds(addDoc(polCol(as('bmA')), newPolicy('a1', { agentId: 'bmA', createdBy: 'bmA', unitId: null }))));
  await t('PC6. BM creates own policy stamped with another branch → DENY', () =>
    assertFails(addDoc(polCol(as('bmA')), newPolicy('a1', { agentId: 'bmA', createdBy: 'bmA', branchId: B, unitId: null }))));

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
