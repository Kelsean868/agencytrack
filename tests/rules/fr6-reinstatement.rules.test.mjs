/**
 * Emulator rules tests — FR-6 "Mark reinstated" (Option A, Arm G).
 *
 * Run with:
 *   firebase emulators:exec --only firestore --project=demo-agencytrack \
 *     "node tests/rules/fr6-reinstatement.rules.test.mjs"
 * or the whole suite via `node scripts/test/run-rules-tests.mjs` under emulators:exec.
 *
 * RULES_FILE=<path> loads a different rules file (default: firestore.rules), so a
 * mutated copy can show which case bites (the PR's mutation check).
 *
 * What is enforced (docs/audits/fr-6-mark-reinstated-recon.md § 3 Option A;
 * Kyron ruling R-b, 29-09-2026):
 *   policies Arm G — the OWNER (agent or producing manager) of a LAPSED policy
 *                    writes ONLY reinstatementDeclaredAt / reinstatementDeclaredBy /
 *                    reinstatementNote. Declare: by == caller, at == request.time,
 *                    note absent or a string of at most 200 characters.
 *                    Withdraw: all three cleared. Status, statusSource and money
 *                    fields never move, so the P2d head-office lock holds.
 *   history        — a lapsed → lapsed `reinstatement_declared` /
 *                    `reinstatement_withdrawn` event on an own lapsed policy.
 *
 * Fixture tenant
 *   branchA: bmA · umA1 · umA2 · agents a1 (umA1), a2 (umA2)
 *   branchB: agent b1
 *   ta (tenant_admin), smF (sales_manager, canConfirmSettlements)
 *   other tenant: x1 (agent)
 */

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, writeBatch, collection, serverTimestamp, Timestamp, deleteField,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const RULES_FILE = process.env.RULES_FILE ?? 'firestore.rules';
const T = 'fr6-reinstatement-tenant';
const OTHER_T = 'fr6-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const A = 'branchA';
const B = 'branchB';

const USERS = {
  bmA:  { role: 'branch_manager', branchId: A },
  umA1: { role: 'unit_manager', branchId: A, unitId: 'umA1' },
  smF:  { role: 'sales_manager', branchId: A, canConfirmSettlements: true },
  ta:   { role: 'tenant_admin', branchId: A },
  a1:   { role: 'agent', branchId: A, unitId: 'umA1' },
  a2:   { role: 'agent', branchId: A, unitId: 'umA2' },
  b1:   { role: 'agent', branchId: B, unitId: 'umB1' },
};
const SCOPE = {
  a1: { branchId: A, unitId: 'umA1' },
  a2: { branchId: A, unitId: 'umA2' },
  umA1: { branchId: A, unitId: 'umA1' },
};

function token(uid, tenantId = T) {
  const u = USERS[uid] ?? { role: 'agent' };
  const t = { role: u.role, tenantId };
  if (u.branchId) t.branchId = u.branchId;
  return t;
}

const past = Timestamp.fromDate(new Date('2026-01-10T12:00:00Z'));
const issued = Timestamp.fromDate(new Date('2025-03-15T04:00:00Z'));

// A lapsed policy as the OIPA import leaves it: status from head office.
function hoLapsed(agentId, overrides = {}) {
  return {
    tenantId: T, agentId, ...SCOPE[agentId],
    status: 'lapsed', statusSource: 'oipa_import', statusSetBy: 'import',
    productLine: 'life', ownerName: 'Owner', insuredName: 'Insured', policyNumber: `P-${agentId}`,
    proposedAPI: 5000, settledAPI: 5000, dateIssued: issued, createdAt: past,
    ...overrides,
  };
}

// declareReinstatement's policy update — exactly the keys the service writes.
function declare(uid, overrides = {}) {
  return {
    reinstatementDeclaredAt: serverTimestamp(),
    reinstatementDeclaredBy: uid,
    reinstatementNote: 'Receipt 4471',
    ...overrides,
  };
}

// withdrawReinstatement's policy update.
function withdraw() {
  return {
    reinstatementDeclaredAt: deleteField(),
    reinstatementDeclaredBy: deleteField(),
    reinstatementNote: deleteField(),
  };
}

// The history event both services write alongside the policy update.
function declEvent(uid, overrides = {}) {
  return {
    fromStatus: 'lapsed', toStatus: 'lapsed', event: 'reinstatement_declared',
    changedFields: { reinstatementDeclaredBy: uid },
    actorUid: uid, actorRole: USERS[uid]?.role ?? 'agent', agentId: uid,
    unitId: SCOPE[uid]?.unitId ?? null, at: serverTimestamp(),
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
  console.log('FR-6 Mark reinstated (Arm G) — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT} · rules: ${RULES_FILE}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT, rules: readFileSync(RULES_FILE, 'utf8') },
  });
  await testEnv.clearFirestore();

  const declared = { reinstatementDeclaredAt: past, reinstatementDeclaredBy: 'a1', reinstatementNote: 'Receipt 1' };
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) {
      await setDoc(doc(db, `tenants/${T}/users/${uid}`), { uid, tenantId: T, active: true, ...u });
    }
    await setDoc(doc(db, `tenants/${OTHER_T}/users/x1`), { uid: 'x1', tenantId: OTHER_T, role: 'agent', branchId: A });
    const pols = {
      'a1-ho':          hoLapsed('a1'),
      'a1-ho-2':        hoLapsed('a1'),
      'a1-ho-3':        hoLapsed('a1'),
      'a1-ho-batch':    hoLapsed('a1'),
      'a1-ho-nonote':   hoLapsed('a1'),
      'a1-ho-200':      hoLapsed('a1'),
      // Lapsed by the branch manager (Arm D) — not a head-office status.
      'a1-mgr':         hoLapsed('a1', { statusSource: 'manager', statusSetBy: 'bmA' }),
      'a1-settled':     hoLapsed('a1', { status: 'settled' }),
      'a1-declared':    hoLapsed('a1', declared),
      'a1-declared-2':  hoLapsed('a1', declared),
      'a1-declared-3':  hoLapsed('a1', declared),
      'a1-declared-4':  hoLapsed('a1', declared),
      'a1-declared-b':  hoLapsed('a1', declared),
      'a2-ho':          hoLapsed('a2'),
      'umA1-own':       hoLapsed('umA1'),
    };
    for (const [id, p] of Object.entries(pols)) {
      await setDoc(doc(db, `tenants/${T}/policies/${id}`), p);
    }
    // The same policy id in another tenant, owned by x1 there.
    await setDoc(doc(db, `tenants/${OTHER_T}/policies/x1-ho`), { ...hoLapsed('a1'), tenantId: OTHER_T, agentId: 'x1' });
  });

  const as = (uid, tenantId = T) => testEnv.authenticatedContext(uid, token(uid, tenantId)).firestore();
  const pol = (db, id, tenantId = T) => doc(db, `tenants/${tenantId}/policies/${id}`);
  const hist = (db, id, h) => doc(db, `tenants/${T}/policies/${id}/history/${h}`);

  // ── Arm G — allow ───────────────────────────────────────────────────────────
  console.log('policies Arm G — allowed');
  await t('G1. agent declares on an OWN LAPSED HEAD-OFFICE policy (with a note) → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-ho'), declare('a1'))));
  await t('G2. agent declares with NO note → ALLOW', async () => {
    const { reinstatementNote: _n, ...rest } = declare('a1');
    await assertSucceeds(updateDoc(pol(as('a1'), 'a1-ho-nonote'), rest));
  });
  await t('G3. agent declares on an own policy a MANAGER lapsed (Arm D) → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-mgr'), declare('a1'))));
  await t('G4. note of exactly 200 characters → ALLOW (boundary)', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-ho-200'), declare('a1', { reinstatementNote: 'x'.repeat(200) }))));
  await t('G5. producing manager (UM) declares on their OWN lapsed policy → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('umA1'), 'umA1-own'), declare('umA1'))));
  await t('G6. agent WITHDRAWS (all three deleted) → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-declared'), withdraw())));
  await t('G7. agent withdraws by writing nulls → ALLOW', () =>
    assertSucceeds(updateDoc(pol(as('a1'), 'a1-declared-2'), {
      reinstatementDeclaredAt: null, reinstatementDeclaredBy: null, reinstatementNote: null,
    })));
  await t('G8. declareReinstatement batch (policy + lapsed→lapsed history event) → ALLOW', async () => {
    const db = as('a1');
    const batch = writeBatch(db);
    batch.update(pol(db, 'a1-ho-batch'), declare('a1'));
    batch.set(doc(collection(db, `tenants/${T}/policies/a1-ho-batch/history`)), declEvent('a1'));
    await assertSucceeds(batch.commit());
  });
  await t('G9. withdrawReinstatement batch (policy + withdrawn event) → ALLOW', async () => {
    const db = as('a1');
    const batch = writeBatch(db);
    batch.update(pol(db, 'a1-declared-b'), withdraw());
    batch.set(doc(collection(db, `tenants/${T}/policies/a1-declared-b/history`)),
      declEvent('a1', { event: 'reinstatement_withdrawn', changedFields: { reinstatementDeclaredBy: null } }));
    await assertSucceeds(batch.commit());
  });

  // ── Arm G — deny ────────────────────────────────────────────────────────────
  console.log('policies Arm G — denied');
  await t('D1. agent declares on ANOTHER agent\'s lapsed policy → DENY', () =>
    assertFails(updateDoc(pol(as('a2'), 'a1-ho-2'), declare('a2'))));
  await t('D2. agent declares on an own SETTLED (not lapsed) policy → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-settled'), declare('a1'))));
  await t('D3. declare that also moves status lapsed → settled → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { status: 'settled' }))));
  await t('D4. declare that also rewrites statusSource (leaves the head-office bucket) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { statusSource: 'agent', statusSetBy: 'a1' }))));
  await t('D5. declare that also changes a money field (proposedAPI) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { proposedAPI: 9000 }))));
  await t('D5b. declare that also changes settledAPI → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { settledAPI: 9000 }))));
  await t('D6. BACKDATED declaration (at ≠ request.time) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { reinstatementDeclaredAt: past }))));
  await t('D7. FORGED declaredBy (someone else) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { reinstatementDeclaredBy: 'a2' }))));
  await t('D8. note of 201 characters → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { reinstatementNote: 'x'.repeat(201) }))));
  await t('D8b. note that is not a string → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), declare('a1', { reinstatementNote: 4471 }))));
  await t('D9. note only, no stamps → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-2'), { reinstatementNote: 'Receipt 9' })));
  await t('D10. branch manager declares on an own-branch agent\'s lapsed policy → DENY', () =>
    assertFails(updateDoc(pol(as('bmA'), 'a1-ho-2'), declare('bmA'))));
  await t('D11. unit manager declares on an own-unit agent\'s lapsed policy → DENY', () =>
    assertFails(updateDoc(pol(as('umA1'), 'a1-ho-2'), declare('umA1'))));
  await t('D12. tenant admin declares on an agent\'s lapsed policy → DENY', () =>
    assertFails(updateDoc(pol(as('ta'), 'a1-ho-2'), declare('ta'))));
  await t('D13. flagged sales manager declares on an agent\'s lapsed policy → DENY', () =>
    assertFails(updateDoc(pol(as('smF'), 'a1-ho-2'), declare('smF'))));
  await t('D14. agent of ANOTHER tenant declares on this tenant\'s policy → DENY', () =>
    assertFails(updateDoc(pol(as('x1', OTHER_T), 'a1-ho-2'), declare('x1'))));
  await t('D15. unauthenticated declare → DENY', () =>
    assertFails(updateDoc(pol(testEnv.unauthenticatedContext().firestore(), 'a1-ho-2'), declare('a1'))));
  await t('D16. withdraw that leaves the note behind → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-declared-3'), {
      reinstatementDeclaredAt: deleteField(), reinstatementDeclaredBy: deleteField(),
    })));
  await t('D17. partial withdraw (clears the date, keeps declaredBy) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-declared-4'), {
      reinstatementDeclaredAt: deleteField(), reinstatementNote: deleteField(),
    })));
  await t('D18. another agent withdraws a1\'s declaration → DENY', () =>
    assertFails(updateDoc(pol(as('a2'), 'a1-declared-4'), withdraw())));
  await t('D19. REGRESSION: agent moves own lapsed policy to settled (no arm allows it) → DENY', () =>
    assertFails(updateDoc(pol(as('a1'), 'a1-ho-3'), {
      status: 'settled', statusUpdatedAt: serverTimestamp(),
      statusSource: 'agent', statusSetBy: 'a1', statusAsOf: '2026-09-29',
    })));

  // ── history — the declaration event ────────────────────────────────────────
  console.log('policies/{id}/history — the lapsed → lapsed declaration event');
  await t('H1. agent writes reinstatement_declared on OWN lapsed policy → ALLOW', () =>
    assertSucceeds(setDoc(hist(as('a1'), 'a1-ho-3', 'h1'), declEvent('a1'))));
  await t('H2. agent writes reinstatement_withdrawn on OWN lapsed policy → ALLOW', () =>
    assertSucceeds(setDoc(hist(as('a1'), 'a1-ho-3', 'h2'), declEvent('a1', { event: 'reinstatement_withdrawn' }))));
  await t('H3. producing manager writes the event on OWN lapsed policy → ALLOW', () =>
    assertSucceeds(setDoc(hist(as('umA1'), 'umA1-own', 'h3'), declEvent('umA1'))));
  await t('H4. agent writes the event under ANOTHER agent\'s lapsed policy → DENY', () =>
    assertFails(setDoc(hist(as('a2'), 'a1-ho-3', 'h4'), declEvent('a2'))));
  await t('H5. agent writes the event on own SETTLED policy (parent not lapsed) → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-settled', 'h5'), declEvent('a1'))));
  await t('H6. lapsed → lapsed with NO event name → DENY', async () => {
    const { event: _e, ...rest } = declEvent('a1');
    await assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h6'), rest));
  });
  await t('H7. lapsed → lapsed with an unknown event name → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h7'), declEvent('a1', { event: 'reinstated' }))));
  await t('H8. event with a forged agentId → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h8'), declEvent('a1', { agentId: 'a2' }))));
  await t('H9. event with a forged actorUid → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h9'), declEvent('a1', { actorUid: 'a2' }))));
  await t('H10. REGRESSION: agent writes a lapsed → settled event → DENY', () =>
    assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h10'), declEvent('a1', { toStatus: 'settled' }))));
  await t('H11. event missing a required key (changedFields) → DENY', async () => {
    const { changedFields: _c, ...rest } = declEvent('a1');
    await assertFails(setDoc(hist(as('a1'), 'a1-ho-3', 'h11'), rest));
  });

  await testEnv.cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
