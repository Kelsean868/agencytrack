/**
 * Emulator rules tests — P2d "numbers you can trust" (audit 2026-09-24 BUG-01,
 * BUG-05, and the P2c leftover on policy history WRITES).
 *
 * Run with:
 *   firebase emulators:exec --only firestore --project=demo-agencytrack \
 *     "node tests/rules/p2d-numbers.rules.test.mjs"
 * or the whole suite via `npm run test:rules` under emulators:exec.
 *
 * RULES_FILE=<path> loads a different rules file (default: firestore.rules). The
 * PR runs this file once against main's rules to show which deny cases bite.
 *
 * What is enforced (brief docs/briefs/p2d-p2e-numbers-kiosk-appcheck.md § PR 1):
 *   policies Arm F  — an agent self-confirms the four detail fields of their OWN
 *                     settled, not-manager-confirmed, SELF-DECLARED policy,
 *                     stamping selfConfirmedBy/At + enteredBy/At; nothing else moves
 *   head-office lock — Kyron's ruling 27 Sep 2026 (option A): no agent arm changes
 *                     a money field on a policy whose status the OIPA import set
 *                     (Arm F closed; Arm A money fields closed; history event closed)
 *   history (agent) — the settled → settled self-confirm event, own policy only
 *   history (mgr)   — scoped by the PARENT policy: BM own branch, UM own unit,
 *                     SM/TA/PA tenant (was: tenant-wide for BM/TA/PA/flagged SM)
 *   persistency     — an agent write carries enteredBy == caller + enteredAt
 *
 * Fixture tenant
 *   branchA: bmA · umA1 · umA2 · agents a1 (umA1), a2 (umA2)
 *   branchB: bmB · umB1 · agent b1 (umB1)
 *   smF (sales_manager, canConfirmSettlements), ta (tenant_admin)
 */

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, writeBatch, collection, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const RULES_FILE = process.env.RULES_FILE ?? 'firestore.rules';
const T = 'p2d-numbers-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const A = 'branchA';
const B = 'branchB';

const USERS = {
  bmA:  { role: 'branch_manager', branchId: A },
  bmB:  { role: 'branch_manager', branchId: B },
  umA1: { role: 'unit_manager', branchId: A, unitId: 'umA1' },
  umA2: { role: 'unit_manager', branchId: A, unitId: 'umA2' },
  smF:  { role: 'sales_manager', branchId: A, canConfirmSettlements: true },
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
const issued = Timestamp.fromDate(new Date('2026-08-15T04:00:00Z'));

// A settled policy as the OIPA import leaves it: status from head office,
// settledAPI null, no issue details.
function hoSettled(agentId, overrides = {}) {
  return {
    tenantId: T, agentId, ...SCOPE[agentId],
    status: 'settled', statusSource: 'oipa_import', statusSetBy: 'import',
    productLine: 'life', ownerName: 'Owner', insuredName: 'Insured',
    proposedAPI: 5000, settledAPI: null, dateIssued: issued, createdAt: past,
    ...overrides,
  };
}

// selfConfirmPolicy's policy update — exactly the keys the service writes.
function selfConfirm(uid, overrides = {}) {
  return {
    settledAPI: 5200, issuedCoverage: 250000, initialPremium: 433.33, earnedCommission: 1300,
    selfConfirmedBy: uid, selfConfirmedAt: serverTimestamp(),
    enteredBy: uid, enteredAt: serverTimestamp(),
    ...overrides,
  };
}

// selfConfirmPolicy's history event.
function selfConfirmEvent(uid) {
  return {
    fromStatus: 'settled', toStatus: 'settled',
    changedFields: { settledAPI: 5200, selfConfirmedBy: uid },
    actorUid: uid, actorRole: 'agent', agentId: uid, unitId: SCOPE[uid]?.unitId ?? null,
    at: serverTimestamp(),
  };
}

// confirmPolicy's manager history event.
function managerEvent(uid, agentId) {
  return {
    fromStatus: 'settled', toStatus: 'settled',
    changedFields: { managerSettledAPI: 5000, hasDiscrepancy: false },
    actorUid: uid, actorRole: USERS[uid].role, agentId, unitId: SCOPE[agentId].unitId,
    at: serverTimestamp(),
  };
}

// savePersistency payload for an agent (legacy six-input model, Jan 2026).
function persistencyDoc(agentId, writerUid, role, overrides = {}) {
  return {
    agentId, tenantId: T, year: 2026, month: 1, monthKey: '2026-01',
    businessPlaced: 100000, notTakens: 0, incPPPs: 0, lumpsums100: 0, lapses: 5000, reinstatements: 0,
    grossSettled: 100000, netSettled: 95000, persistency: 0.95, meetsAwardGate: true,
    lastEditedAt: serverTimestamp(), lastEditedBy: writerUid, lastEditedByRole: role,
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
  console.log('P2d numbers you can trust — Firestore emulator rules tests (BUG-01, BUG-05, history writes)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT} · rules: ${RULES_FILE}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT, rules: readFileSync(RULES_FILE, 'utf8') },
  });
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) {
      await setDoc(doc(db, `tenants/${T}/users/${uid}`), { uid, tenantId: T, active: true, ...u });
    }
    const selfSettled = (extra = {}) => hoSettled('a1', { statusSource: 'agent', statusSetBy: 'a1', settledAPI: 4800, ...extra });
    // Arm A shape: a written/submitted application with the arm's value-guard fields.
    const submittedApp = (statusSource) => hoSettled('a1', {
      status: 'submitted', statusSource, statusSetBy: statusSource === 'agent' ? 'a1' : 'import',
      dateIssued: null, dateWritten: past, sourceOfProspect: 'referral', proposedAPI: 6000,
    });
    const pols = {
      'a1-ho':        hoSettled('a1'),
      'a1-self-batch': selfSettled(),
      'a1-self-2':    selfSettled(),
      'a1-agent':     selfSettled(),
      'a1-ho-sub':    submittedApp('oipa_import'),
      'a1-self-sub':  submittedApp('agent'),
      'a1-mgr-conf':  hoSettled('a1', {
        statusSource: 'agent', statusSetBy: 'a1', settledAPI: 4800,
        confirmedByManager: 'BM A', confirmedByUid: 'bmA', confirmedAt: past,
        managerSettledAPI: 4800, managerNote: '', hasDiscrepancy: false,
      }),
      'a1-submitted': hoSettled('a1', { status: 'submitted', statusSource: 'agent', statusSetBy: 'a1', dateIssued: null }),
      'a2-ho':        hoSettled('a2'),
      'b1-ho':        hoSettled('b1'),
    };
    for (const [id, p] of Object.entries(pols)) {
      await setDoc(doc(db, `tenants/${T}/policies/${id}`), p);
    }
    // a1's January persistency, first entered by the branch manager.
    await setDoc(doc(db, `tenants/${T}/persistency/a1_2026_01`), {
      ...persistencyDoc('a1', 'bmA', 'branch_manager'),
      lastEditedAt: past, enteredBy: 'bmA', enteredByRole: 'branch_manager', enteredAt: past,
    });
  });

  const as = (uid) => testEnv.authenticatedContext(uid, token(uid)).firestore();
  const pol = (db, id) => doc(db, `tenants/${T}/policies/${id}`);
  const hist = (db, id, h) => doc(db, `tenants/${T}/policies/${id}/history/${h}`);
  const pers = (db, id) => doc(db, `tenants/${T}/persistency/${id}`);

  // ── Arm F — agent self-confirm ─────────────────────────────────────────────
  console.log('policies Arm F — agent self-confirm of an own settled policy');
  // Kyron's ruling, 27 Sep 2026 (option A): head-office figures are locked.
  await t('F1. RULING: agent edits settled API on an IMPORTED (head-office) policy → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho'), selfConfirm('a1'))));
  await t('F1b. RULING: agent edits ONLY settledAPI on an imported policy (no stamps) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho'), { settledAPI: 9999 })));
  await t('F2. agent self-confirms ANOTHER agent\'s policy → DENY', () =>
    assertFails(updateDoc(pol(as('a2'), 'a1-self-2'), selfConfirm('a2'))));
  await t('F3. RULING: agent edits settled API on own SELF-DECLARED policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-agent'), selfConfirm('a1'))));
  await t('F4. self-confirm on a MANAGER-confirmed policy → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-mgr-conf'), selfConfirm('a1'))));
  await t('F5. self-confirm that also moves dateIssued (award period) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), selfConfirm('a1', { dateIssued: past }))));
  await t('F6. self-confirm that rewrites statusSource to head office (fakes the provenance bucket) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), selfConfirm('a1', { statusSource: 'oipa_import' }))));
  await t('F7. self-confirm writing the MANAGER stamp confirmedAt → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), selfConfirm('a1', { confirmedAt: serverTimestamp() }))));
  await t('F8. self-confirm stamped as someone else (selfConfirmedBy ≠ caller) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), selfConfirm('a1', { selfConfirmedBy: 'a2' }))));
  await t('F9. self-confirm without enteredBy → DENY', async () => {
    const { enteredBy: _e, ...rest } = selfConfirm('a1');
    await assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), rest));
  });
  await t('F10. self-confirm with settledAPI 0 → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-self-2'), selfConfirm('a1', { settledAPI: 0 }))));
  await t('F11. self-confirm on a SUBMITTED (not settled) policy → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-submitted'), selfConfirm('a1'))));
  await t('F12. BM "self-confirms" an agent\'s policy in own branch → DENY (owner only)', () =>
    assertFails(updateDoc(pol(as('bmA'), 'a1-self-2'), selfConfirm('bmA'))));
  await t('F13. selfConfirmPolicy batch (policy + settled→settled history) on own self-declared policy → ALLOW', async () => {
    const db = as('a1');
    const batch = writeBatch(db);
    batch.update(pol(db, 'a1-self-batch'), selfConfirm('a1'));
    batch.set(doc(collection(db, `tenants/${T}/policies/a1-self-batch/history`)), selfConfirmEvent('a1'));
    await assertSucceeds(batch.commit());
  });

  // ── history — agent self-confirm event + manager scope ─────────────────────
  console.log('policies/{id}/history — self-confirm event (agent) + parent-scoped manager writes');
  await t('H1. agent writes settled→settled event on OWN settled policy → ALLOW', () =>
    assertSucceeds(setDoc(hist(as('a1'), 'a1-self-2', 'h-self'), selfConfirmEvent('a1'))));
  await t('H2. agent writes settled→settled event under ANOTHER agent\'s policy → DENY', () =>
    assertFails(setDoc(hist(as('a2'), 'a1-self-2', 'h-self-x'), selfConfirmEvent('a2'))));
  await t('H2b. RULING: agent writes settled→settled event on own HEAD-OFFICE policy → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-ho', 'h-self-ho'), selfConfirmEvent('a1'))));
  await t('H3. agent writes settled→settled event on own SUBMITTED policy → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-submitted', 'h-self-sub'), selfConfirmEvent('a1'))));
  await t('H4. BM writes manager history on a policy in ANOTHER branch → DENY', () =>
    assertFails(setDoc(hist(as('bmA'), 'b1-ho', 'h-bm-x'), managerEvent('bmA', 'b1'))));
  await t('H5. BM writes manager history on a policy in OWN branch → ALLOW', () =>
    assertSucceeds(setDoc(hist(as('bmA'), 'a2-ho', 'h-bm'), managerEvent('bmA', 'a2'))));
  await t('H6. UM writes manager history on ANOTHER unit\'s policy → DENY', () =>
    assertFails(setDoc(hist(as('umA1'), 'a2-ho', 'h-um-x'), managerEvent('umA1', 'a2'))));
  await t('H7. flagged SM writes manager history on another branch\'s policy → ALLOW (tenant)', () =>
    assertSucceeds(setDoc(hist(as('smF'), 'b1-ho', 'h-sm'), managerEvent('smF', 'b1'))));
  await t('H8. TA writes manager history on another branch\'s policy → ALLOW (tenant)', () =>
    assertSucceeds(setDoc(hist(as('ta'), 'b1-ho', 'h-ta'), managerEvent('ta', 'b1'))));

  // ── Arm A — the head-office money lock on body edits ───────────────────────
  console.log('policies Arm A — head-office money fields locked (ruling, option A)');
  await t('A1. RULING: agent raises proposedAPI on an IMPORTED (head-office) application → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-sub'), { proposedAPI: 60000 })));
  await t('A2. RULING: agent changes proposedPremium on an imported application → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-sub'), { proposedPremium: 900 })));
  await t('A3. agent fixes a non-money field (ownerName) on an imported application → ALLOW (unchanged)', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-ho-sub'), { ownerName: 'Owner Fixed' })));
  await t('A4. RULING: agent raises proposedAPI on own SELF-DECLARED application → ALLOW (unchanged)', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-self-sub'), { proposedAPI: 7000 })));

  await t('A5. RULING+: agent changes productLine on an imported application → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-sub'), { productLine: 'lump-sum-changed' })));
  await t('A6. RULING+: agent changes dateSubmitted on an imported application → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-sub'), { dateSubmitted: '2026-01-02' })));
  await t('A7. RULING+: agent flips isSelfOrFamily on an imported application → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-sub'), { isSelfOrFamily: true })));
  // The fixture is already productLine 'life', so the write must CHANGE it — a
  // same-value write has no affected keys and passes whatever the lock does.
  await t('A8. agent changes productLine on own SELF-DECLARED application → ALLOW (unchanged)', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-self-sub'), { productLine: 'ah' })));
  // ── persistency — enteredBy on agent writes ────────────────────────────────
  console.log('persistency — agent writes carry enteredBy == caller');
  await t('P1. agent creates own doc WITHOUT enteredBy → DENY', () =>
    assertFails(setDoc(pers(as('a2'), 'a2_2026_01'), persistencyDoc('a2', 'a2', 'agent'))));
  await t('P2. agent creates own doc with enteredBy = someone else → DENY', () =>
    assertFails(setDoc(pers(as('a2'), 'a2_2026_01'),
      persistencyDoc('a2', 'a2', 'agent', { enteredBy: 'bmA', enteredByRole: 'agent', enteredAt: serverTimestamp() }))));
  await t('P3. agent creates own doc with enteredBy = self + enteredAt → ALLOW', () =>
    assertSucceeds(setDoc(pers(as('a2'), 'a2_2026_01'),
      persistencyDoc('a2', 'a2', 'agent', { enteredBy: 'a2', enteredByRole: 'agent', enteredAt: serverTimestamp() }))));
  await t('P4. agent overwrites a BM-entered doc KEEPING enteredBy = BM → DENY', () =>
    assertFails(setDoc(pers(as('a1'), 'a1_2026_01'),
      persistencyDoc('a1', 'a1', 'agent', { enteredBy: 'bmA', enteredByRole: 'branch_manager', enteredAt: past }))));
  await t('P5. agent overwrites a BM-entered doc RE-STAMPED to self → ALLOW', () =>
    assertSucceeds(setDoc(pers(as('a1'), 'a1_2026_01'),
      persistencyDoc('a1', 'a1', 'agent', { enteredBy: 'a1', enteredByRole: 'agent', enteredAt: serverTimestamp() }))));
  await t('P6. BM writes own-branch agent doc (manager arm unchanged) → ALLOW', () =>
    assertSucceeds(setDoc(pers(as('bmA'), 'a2_2026_02'),
      persistencyDoc('a2', 'bmA', 'branch_manager', { month: 2, monthKey: '2026-02', enteredBy: 'bmA', enteredByRole: 'branch_manager', enteredAt: serverTimestamp() }))));

  await testEnv.cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
