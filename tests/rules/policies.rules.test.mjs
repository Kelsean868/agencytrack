import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, serverTimestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'policies-rules-test-tenant';
const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:9090').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '9090', 10);

let testEnv;
const results = [];

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

/**
 * P4e — the status-provenance fields every hand-set status write must now carry.
 *
 * `firestore.rules` guards all seven status arms with
 * `statusSource in ['agent','manager'] && statusSetBy == request.auth.uid`, and
 * rules see the document AFTER the write — so omitting these leaves whatever
 * was there before and the transition is rejected outright. That is deliberate:
 * a status that moves without saying who moved it is the gap P4e closes.
 */
const prov = (uid, source = 'agent') => ({
  statusSource: source, statusSetBy: uid, statusAsOf: '2026-09-19',
});

async function run(label, expectAllow, fn) {
  try {
    if (expectAllow) {
      await assertSucceeds(fn());
    } else {
      await assertFails(fn());
    }
    results.push({ label, pass: true, expected: expectAllow ? 'ALLOW' : 'DENY' });
  } catch (err) {
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 100) });
  }
}

const yesterday  = Timestamp.fromDate(new Date(Date.now() - 86400000));
const twoDaysAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 86400000));
const tomorrow   = Timestamp.fromDate(new Date(Date.now() + 86400000));

const VALID_PAYLOAD = {
  tenantId: TENANT_ID,
  agentId: 'agent-a',
  unitId: 'um-a',
  branchId: 'bm-a',
  status: 'submitted',
  sourceOfProspect: 'referral',
  dateWritten: yesterday,
  dateSubmitted: yesterday,
  proposedAPI: 5000,
  ownerName: 'John Doe',
  insuredName: 'John Doe',
  productLine: 'life',
  newBusinessType: 'nb_ordinary',
  policyClass: 'whole_life',
  proposedFrequency: 'M',
  proposedPremium: 416.67,
  isSelfOrFamily: false,
  cashWithApp: { collected: false, amount: null },
  dateIssued: null,
  policyDeliveryDate: null,
  createdAt: yesterday,
  createdBy: 'agent-a',
};

// Slice 1A (D1): the CREATE arm now pins status to 'written' and no longer
// requires dateSubmitted. VALID_PAYLOAD stays at 'submitted' because it seeds the
// mid-lifecycle fixtures the Arm A/B/C/D tests walk; CREATE_PAYLOAD is what a
// client may actually write.
const CREATE_PAYLOAD = {
  ...VALID_PAYLOAD,
  status: 'written',
  dateSubmitted: null,
};

// Full §7.4 settled field set for transition tests
const SETTLED_FIELDS = {
  status: 'settled',
  statusUpdatedAt: Timestamp.now(),
  dateIssued: yesterday,
  settledAPI: 5000,
  issuedCoverage: 100000,
  initialPremium: 416.67,
  earnedCommission: 250,
};

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: EMU_HOST,
      port: EMU_PORT,
    },
  });

  // Seed docs for update/transition tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // submitted policies
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1`).set(VALID_PAYLOAD);
    await db.doc(`tenants/${TENANT_ID}/policies/policy-b1`).set({
      ...VALID_PAYLOAD,
      agentId: 'agent-b',
      unitId: 'um-b',
    });
    // ── Slice 1A: `written` fixtures ──
    // One per ALLOW test (they mutate); one shared doc for every DENY test (they
    // do not). policy-b1-written is agent-b's, for the cross-agent refusals.
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-written-edit`).set({
      ...VALID_PAYLOAD, status: 'written', dateSubmitted: null,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-written-submit`).set({
      ...VALID_PAYLOAD, status: 'written', dateSubmitted: null,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-written-ntu`).set({
      ...VALID_PAYLOAD, status: 'written', dateSubmitted: null,
    });
    // dateWritten is YESTERDAY here so a twoDaysAgo dateSubmitted is provably earlier.
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-written-deny`).set({
      ...VALID_PAYLOAD, status: 'written', dateWritten: yesterday, dateSubmitted: null,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-b1-written`).set({
      ...VALID_PAYLOAD, agentId: 'agent-b', unitId: 'um-b', status: 'written', dateSubmitted: null,
    });
    // policy in rated status — for rated→settled, ntu→rated (illegal) tests
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-rated`).set({
      ...VALID_PAYLOAD,
      status: 'rated',
      ratedPremium: 1200,
    });
    // policy in postponed status — for postponed→submitted test
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-postponed`).set({
      ...VALID_PAYLOAD,
      status: 'postponed',
    });
    // policy in ntu status — terminal, no outbound transitions
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-ntu`).set({
      ...VALID_PAYLOAD,
      status: 'ntu',
    });
    // settled policy — for Arm C confirmation tests + back-transition DENY
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-settled`).set({
      ...VALID_PAYLOAD,
      ...SETTLED_FIELDS,
    });
    // Tier-3 3.1 Arm E: dedicated fixtures for CRO delivery tests
    // (other fixtures get mutated by Arm A/B/C/D tests before the CRO block runs).
    await db.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).set({
      ...VALID_PAYLOAD,
      ...SETTLED_FIELDS,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-cro-submitted`).set({
      ...VALID_PAYLOAD,
    });
    // settled policy owned by agent-b in unit um-b —
    // used to test UM unit-scope DENY (um-a trying to confirm um-b's policy)
    await db.doc(`tenants/${TENANT_ID}/policies/policy-b1-settled`).set({
      ...VALID_PAYLOAD,
      agentId: 'agent-b',
      unitId: 'um-b',
      ...SETTLED_FIELDS,
    });
    // history doc for update/delete deny tests
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1/history/hist-1`).set({
      fromStatus: 'submitted',
      toStatus: 'rated',
      changedFields: { status: 'rated', ratedPremium: 1200 },
      actorUid: 'agent-a',
      actorRole: 'agent',
      agentId: 'agent-a',
      unitId: 'um-a',
      at: yesterday,
    });
    // H2a: user doc for um-a — canConfirmSettlements: true (needed for Arm C get() check)
    await db.doc(`tenants/${TENANT_ID}/users/um-a`).set({
      role: 'unit_manager',
      unitId: 'um-a',
      branchId: 'bm-a', // P2c: policy create pins the creator's user-doc branchId
      canConfirmSettlements: true,
    });
    // P2c: the policy create arm reads the CREATOR's user doc for branchId (and
    // unitId when set) — agent-a is in unit um-a, branch bm-a (VALID_PAYLOAD's scope).
    await db.doc(`tenants/${TENANT_ID}/users/agent-a`).set({
      role: 'agent',
      unitId: 'um-a',
      branchId: 'bm-a',
    });
    // P2b (SEC-08): BM user doc — the rules read the BM's branch from here
    // (callerBranchId). Fixture policies carry branchId 'bm-a'.
    await db.doc(`tenants/${TENANT_ID}/users/bm-a`).set({
      role: 'branch_manager',
      branchId: 'bm-a',
    });
    // user doc for um-b — no canConfirmSettlements flag (or false) — for DENY tests
    await db.doc(`tenants/${TENANT_ID}/users/um-b`).set({
      role: 'unit_manager',
      unitId: 'um-b',
      canConfirmSettlements: false,
    });
    // H2c: dedicated settled policies for Arm D lapse tests (one per ALLOW actor to avoid status-collision)
    await db.doc(`tenants/${TENANT_ID}/policies/policy-arm-d-bm`).set({
      ...VALID_PAYLOAD,
      ...SETTLED_FIELDS,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-arm-d-ta`).set({
      ...VALID_PAYLOAD,
      ...SETTLED_FIELDS,
    });
    // H2c: dedicated rated policy untouched by Arm B tests — Arm D DENY (non-settled) test target.
    // policy-a1-rated is mutated by the "rated → settled" ALLOW test, so we need a separate doc.
    // P4e provenance-guard fixture — a submitted policy of agent-a's own.
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-prov`).set({
      ...VALID_PAYLOAD,
      status: 'submitted',
      dateSubmitted: yesterday,
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-arm-d-rated`).set({
      ...VALID_PAYLOAD,
      status: 'rated',
      ratedPremium: 1200,
    });
    // Producing-manager write tests — submitted policies owned by BM and UM directly.
    await db.doc(`tenants/${TENANT_ID}/policies/policy-pm-bm`).set({
      ...VALID_PAYLOAD,
      agentId:   'bm-a',
      unitId:    'um-a',
      branchId:  'bm-a',
      createdBy: 'bm-a',
    });
    await db.doc(`tenants/${TENANT_ID}/policies/policy-pm-um`).set({
      ...VALID_PAYLOAD,
      agentId:   'um-a',
      unitId:    'um-a',
      branchId:  'bm-a',
      createdBy: 'um-a',
    });
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umADb    = testEnv.authenticatedContext('um-a',    authToken('unit_manager')).firestore();
  const umBDb    = testEnv.authenticatedContext('um-b',    authToken('unit_manager')).firestore();
  const bmADb    = testEnv.authenticatedContext('bm-a',    authToken('branch_manager')).firestore();
  const taDb     = testEnv.authenticatedContext('ta-1',    authToken('tenant_admin')).firestore();
  const crossDb  = testEnv.authenticatedContext('other-user', { role: 'branch_manager', tenantId: 'other-tenant' }).firestore();

  // ── CREATE ──
  await run('agent create own policy at written (1A) → ALLOW', true, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), CREATE_PAYLOAD)
  );

  await run('create at status submitted → DENY (1A: create arm pins written)', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...CREATE_PAYLOAD, status: 'submitted', dateSubmitted: yesterday })
  );

  await run('agent create with mismatched agentId → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...CREATE_PAYLOAD, agentId: 'agent-b' })
  );

  await run('create with invalid sourceOfProspect → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...CREATE_PAYLOAD, sourceOfProspect: 'bogus-value' })
  );

  await run('create with future dateWritten → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...CREATE_PAYLOAD, dateWritten: tomorrow })
  );

  await run('create with proposedAPI <= 0 → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...CREATE_PAYLOAD, proposedAPI: 0 })
  );

  // ── AGENT LIST ──
  await run('agent list own (where agentId==uid) → ALLOW', true, () =>
    getDocs(query(collection(agentADb, 'tenants', TENANT_ID, 'policies'), where('agentId', '==', 'agent-a')))
  );

  await run('agent list all (no agentId filter) → DENY', false, () =>
    getDocs(collection(agentADb, 'tenants', TENANT_ID, 'policies'))
  );

  // ── UM LIST ──
  await run('UM list own unit (unitId==uid) → ALLOW', true, () =>
    getDocs(query(
      collection(umADb, 'tenants', TENANT_ID, 'policies'),
      where('tenantId', '==', TENANT_ID),
      where('unitId', '==', 'um-a')
    ))
  );

  await run('UM list other unit → DENY', false, () =>
    getDocs(query(
      collection(umADb, 'tenants', TENANT_ID, 'policies'),
      where('tenantId', '==', TENANT_ID),
      where('unitId', '==', 'um-b')
    ))
  );

  // ── BM + CROSS-TENANT ──
  // P2b (SEC-08): the BM list must carry the own-branch filter.
  await run('BM list own branch (where branchId) → ALLOW', true, () =>
    getDocs(query(collection(bmADb, 'tenants', TENANT_ID, 'policies'), where('branchId', '==', 'bm-a')))
  );

  await run('BM list unfiltered (tenant-wide) → DENY (P2b SEC-08)', false, () =>
    getDocs(collection(bmADb, 'tenants', TENANT_ID, 'policies'))
  );

  await run('cross-tenant get → DENY', false, () =>
    getDoc(doc(crossDb, 'tenants', TENANT_ID, 'policies', 'policy-a1'))
  );

  // ── ARM A — BODY EDIT ──
  await run('agent body-edit own submitted policy → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { ownerName: 'Jane Updated', proposedAPI: 5000, dateWritten: yesterday, sourceOfProspect: 'referral' }
    )
  );

  await run('body-edit with bogus sourceOfProspect → DENY (FU Entry 2)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { sourceOfProspect: 'bogus-value' }
    )
  );

  await run('body-edit changing status field → DENY (Arm A blocks status change)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'rated', ownerName: 'Sneaky' }
    )
  );

  await run('body-edit another agent policy → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      { ownerName: 'Hijack Attempt' }
    )
  );

  // ── ARM B — LEGAL STATUS TRANSITIONS (ALLOW) ──
  await run('submitted → rated (+ratedPremium) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200, ...prov('agent-a') }
    )
  );

  await run('submitted → settled (+full §7.4 field set) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { ...SETTLED_FIELDS, ...prov('agent-a') }
    )
  );

  await run('rated → settled (+full §7.4 field set) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-rated'),
      { ...SETTLED_FIELDS, ...prov('agent-a') }
    )
  );

  await run('postponed → submitted (no new fields) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-postponed'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now(), ...prov('agent-a') }
    )
  );

  // ── ARM B — ILLEGAL TRANSITIONS (DENY) ──
  await run('submitted → lapsed → DENY (explicit lapsed guard)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'lapsed', statusUpdatedAt: Timestamp.now() }
    )
  );

  await run('ntu → rated → DENY (out of terminal)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-ntu'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('settled → rated → DENY (illegal back-transition)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('transition missing required ratedPremium → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now() }
    )
  );

  await run('settled transition missing dateIssued → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      {
        status: 'settled',
        statusUpdatedAt: Timestamp.now(),
        settledAPI: 5000,
        issuedCoverage: 100000,
        initialPremium: 416.67,
        earnedCommission: 250,
        // dateIssued intentionally omitted
      }
    )
  );

  await run('transition another agent policy → DENY', false, () =>
    updateDoc(
      doc(agentBDb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('transition with disallowed affectedKey → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200, ownerName: 'Sneaky' }
    )
  );

  // ── SLICE 1A — `written` AS THE STARTING STATUS (D1) ────────────────────
  // Arm A widened to accept a written policy; Arm B gains the written → submitted
  // edge with a per-edge dateSubmitted requirement.

  await run('1A: agent body-edits own WRITTEN policy → ALLOW (Arm A widened)', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-edit'),
      { ownerName: 'Typo Fixed', proposedAPI: 6000, dateWritten: yesterday, sourceOfProspect: 'referral' }
    )
  );

  await run('1A: body-edit of a WRITTEN policy changing status → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-edit'),
      { status: 'rated', ownerName: 'Sneaky' }
    )
  );

  await run('1A: written → submitted WITHOUT dateSubmitted → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now() }
    )
  );

  await run('1A: written → submitted with dateSubmitted < dateWritten → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now(), dateSubmitted: twoDaysAgo }
    )
  );

  await run('1A: written → submitted with FUTURE dateSubmitted → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now(), dateSubmitted: tomorrow }
    )
  );

  await run('1A: written → settled → DENY (no such edge)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { ...SETTLED_FIELDS }
    )
  );

  await run('1A: written → rated → DENY (no such edge)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('1A: written → denied → DENY (abandoned unsigned is an NTU, not a denial)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'denied', statusUpdatedAt: Timestamp.now(), reason: 'x' }
    )
  );

  await run('1A: second agent body-edits a WRITTEN policy → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-written'),
      { ownerName: 'Hijack Attempt' }
    )
  );

  await run('1A: second agent transitions a WRITTEN policy → DENY', false, () =>
    updateDoc(
      doc(agentBDb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-deny'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now(), dateSubmitted: yesterday, ...prov('agent-a') }
    )
  );

  await run('1A: written → ntu (+reason) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-ntu'),
      { status: 'ntu', statusUpdatedAt: Timestamp.now(), reason: 'client did not sign', ...prov('agent-a') }
    )
  );

  // ALLOW last on this fixture — it moves the doc off `written`.
  await run('1A: written → submitted (+dateSubmitted) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-written-submit'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now(), dateSubmitted: yesterday, ...prov('agent-a') }
    )
  );

  // ── P4e — STATUS PROVENANCE GUARD ──
  // These four are the reason the seven hasOnly lists were touched at all. The
  // guard makes the arms STRICTER: a caller may claim only that THEY set the
  // status, and only as a person.
  await run('P4e: transition WITHOUT provenance → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-prov'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('P4e: statusSetBy forged to another uid → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-prov'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200,
        ...prov('agent-b') }
    )
  );

  await run('P4e: client claims the import set it → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-prov'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200,
        statusSource: 'oipa_import', statusSetBy: 'import', statusAsOf: '2026-09-15' }
    )
  );

  await run('P4e: correct provenance → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-prov'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200,
        ...prov('agent-a') }
    )
  );


  // ── HISTORY SUBCOLLECTION ──
  const VALID_HISTORY = {
    fromStatus: 'submitted',
    toStatus: 'rated',
    changedFields: { status: 'rated', ratedPremium: 1200 },
    actorUid: 'agent-a',
    actorRole: 'agent',
    agentId: 'agent-a',
    unitId: 'um-a',
    at: Timestamp.now(),
  };

  await run('agent create history on own policy → ALLOW', true, () =>
    addDoc(
      collection(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'),
      VALID_HISTORY
    )
  );

  await run('history update → DENY (append-only)', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history', 'hist-1'),
      { actorRole: 'manager' }
    )
  );

  await run('history delete → DENY (append-only)', false, () =>
    deleteDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history', 'hist-1')
    )
  );

  await run('BM list history on in-tenant policy → ALLOW', true, () =>
    getDocs(collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'))
  );

  // Agent list own history — requires where('agentId','==',uid) to satisfy the list rule.
  await run('agent list own history (where agentId==uid) → ALLOW', true, () =>
    getDocs(query(
      collection(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'),
      where('agentId', '==', 'agent-a'),
    ))
  );

  // Agent trying to list another agent's history should be denied.
  await run('agent list other-agent history (where agentId==agent-b) → DENY', false, () =>
    getDocs(query(
      collection(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'),
      where('agentId', '==', 'agent-b'),
    ))
  );

  // ── ARM B TIGHTENED (loosening #1 closed) — per-target field sets ──
  // A settled-only field written on an ntu transition must now DENY.
  // Under the old union hasOnly, settledAPI was in the union and would ALLOW.
  await run('Arm B tightened: ntu transition with settledAPI field → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { status: 'ntu', statusUpdatedAt: Timestamp.now(), settledAPI: 1000 }
    )
  );

  // A rated-only field (ratedPremium) written on a settled transition must DENY.
  await run('Arm B tightened: settled transition with ratedPremium field → DENY', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { ...SETTLED_FIELDS, ratedPremium: 1200 }
    )
  );

  // ── HISTORY AGENT ARM — loosening #2 closed ──
  // agent-b attempts to write a history doc on policy-a1 (owned by agent-a).
  // Previously allowed because only request.resource.data.agentId == request.auth.uid
  // was checked. After fix, the parent-policy get() also must match.
  const ORPHAN_HISTORY = {
    fromStatus: 'submitted',
    toStatus:   'rated',
    changedFields: { status: 'rated', ratedPremium: 1200 },
    actorUid:   'agent-b',
    actorRole:  'agent',
    agentId:    'agent-b',
    unitId:     'um-b',
    at:         Timestamp.now(),
  };
  await run('agent-b write history on agent-a policy → DENY (loosening #2 closed)', false, () =>
    addDoc(
      collection(agentBDb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'),
      ORPHAN_HISTORY
    )
  );

  // ── ARM C — MANAGER CONFIRMATION ──
  const CONFIRM_FIELDS = {
    confirmedByManager: 'BM Name',
    confirmedByUid:     'bm-a',
    confirmedAt:        Timestamp.now(),
    managerSettledAPI:  5000,
    managerNote:        '',
    hasDiscrepancy:     false,
  };

  // BM confirms in-scope settled policy → ALLOW
  await run('Arm C ALLOW: BM confirms settled policy (6 fields only)', true, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      CONFIRM_FIELDS
    )
  );

  // tenant_admin confirms → ALLOW
  await run('Arm C ALLOW: tenant_admin confirms settled policy', true, () =>
    updateDoc(
      doc(taDb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { ...CONFIRM_FIELDS, confirmedByUid: 'ta-1', confirmedByManager: 'TA Name' }
    )
  );

  // UM with canConfirmSettlements flag confirms own-unit settled policy → ALLOW
  // um-a has canConfirmSettlements: true in their user doc (seeded above).
  // policy-a1-settled has unitId: 'um-a'.
  await run('Arm C ALLOW: UM with canConfirmSettlements flag confirms own-unit settled policy', true, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { ...CONFIRM_FIELDS, confirmedByUid: 'um-a', confirmedByManager: 'UM Name' }
    )
  );

  // Plain agent tries to write manager confirmation fields → DENY
  await run('Arm C DENY: agent cannot write manager confirmation fields', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      CONFIRM_FIELDS
    )
  );

  // UM without canConfirmSettlements flag → DENY
  // um-b has canConfirmSettlements: false in their user doc.
  await run('Arm C DENY: UM without canConfirmSettlements flag', false, () =>
    updateDoc(
      doc(umBDb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      { ...CONFIRM_FIELDS, confirmedByUid: 'um-b', confirmedByManager: 'UM-B Name' }
    )
  );

  // UM with flag confirming another unit's policy → DENY (unit-scope check)
  // um-a has the flag but policy-b1-settled has unitId: 'um-b'
  await run('Arm C DENY: UM confirming another unit policy', false, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      { ...CONFIRM_FIELDS, confirmedByUid: 'um-a', confirmedByManager: 'UM-A Name' }
    )
  );

  // Confirming a non-settled policy → DENY (status guard).
  // policy-b1 is in submitted status and has not been modified by any prior test.
  // (policy-a1 is not used here because prior transition tests leave it in 'settled' status.)
  await run('Arm C DENY: confirming a non-settled (submitted) policy', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      CONFIRM_FIELDS
    )
  );

  // affectedKeys includes a status change → DENY.
  // Write status: 'rated' (different from the doc's 'settled') so 'status' IS in affectedKeys.
  // Writing status: 'settled' to an already-settled doc produces no diff for that field —
  // Firestore's affectedKeys() only includes keys that actually changed.
  await run('Arm C DENY: affectedKeys includes status field (changed to rated)', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { ...CONFIRM_FIELDS, status: 'rated' }
    )
  );

  // affectedKeys includes an agent field (ownerName) → DENY
  await run('Arm C DENY: affectedKeys includes agent field (ownerName)', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { ...CONFIRM_FIELDS, ownerName: 'Tampered' }
    )
  );

  // confirmedByUid != request.auth.uid → DENY
  await run('Arm C DENY: confirmedByUid does not match caller uid', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled'),
      { ...CONFIRM_FIELDS, confirmedByUid: 'someone-else' }
    )
  );

  // ── HISTORY — MANAGER ARM ──
  const MANAGER_HISTORY = {
    fromStatus:    'settled',
    toStatus:      'settled',
    changedFields: { managerSettledAPI: 5000, hasDiscrepancy: false },
    actorUid:      'bm-a',
    actorRole:     'branch_manager',
    agentId:       'agent-a',
    unitId:        'um-a',
    at:            Timestamp.now(),
  };

  // BM creates manager history on in-scope settled policy → ALLOW
  await run('History manager arm ALLOW: BM writes confirmation history doc', true, () =>
    addDoc(
      collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled', 'history'),
      MANAGER_HISTORY
    )
  );

  // Agent tries to write a manager-arm history shape (fromStatus==toStatus) → DENY
  // The agent arm requires isLegalAgentTransition which rejects fromStatus==toStatus.
  await run('History manager arm DENY: agent cannot write fromStatus==toStatus history', false, () =>
    addDoc(
      collection(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled', 'history'),
      { ...MANAGER_HISTORY, actorUid: 'agent-a', actorRole: 'agent', agentId: 'agent-a' }
    )
  );

  // UM with canConfirmSettlements writes manager history on own-unit policy → ALLOW
  await run('History manager arm ALLOW: UM with flag writes confirmation history on own-unit policy', true, () =>
    addDoc(
      collection(umADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled', 'history'),
      { ...MANAGER_HISTORY, actorUid: 'um-a', actorRole: 'unit_manager' }
    )
  );

  // UM with flag writing history on another unit's policy → DENY
  await run('History manager arm DENY: UM writes confirmation history on another unit policy', false, () =>
    addDoc(
      collection(umADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled', 'history'),
      { ...MANAGER_HISTORY, actorUid: 'um-a', actorRole: 'unit_manager', agentId: 'agent-b', unitId: 'um-b' }
    )
  );

  // H2b: agentId-pinning hardening — BM writes history on policy-a1-settled with wrong agentId
  // policy-a1-settled.agentId == 'agent-a'; writing agentId: 'agent-b' should DENY.
  await run('History manager arm DENY: BM writes history with wrong agentId (agentId != parent.agentId)', false, () =>
    addDoc(
      collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled', 'history'),
      { ...MANAGER_HISTORY, agentId: 'agent-b', unitId: 'um-b' }
    )
  );

  // ── ARM D — BM-ONLY LAPSE (H2c) ──
  const LAPSE_FIELDS = {
    status:          'lapsed',
    statusUpdatedAt: Timestamp.now(),
    dateLapsed:      Timestamp.now(),
  };

  // BM lapses settled policy → ALLOW
  await run('Arm D ALLOW: BM lapses settled policy', true, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-arm-d-bm'),
      { ...LAPSE_FIELDS, ...prov('bm-a', 'manager') }
    )
  );

  // tenant_admin lapses settled policy → ALLOW
  await run('Arm D ALLOW: tenant_admin lapses settled policy', true, () =>
    updateDoc(
      doc(taDb, 'tenants', TENANT_ID, 'policies', 'policy-arm-d-ta'),
      { ...LAPSE_FIELDS, ...prov('ta-1', 'manager') }
    )
  );

  // agent tries to lapse → DENY (not a manager + Arm B rejects 'lapsed' as target)
  await run('Arm D DENY: agent cannot lapse a policy', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      { ...LAPSE_FIELDS, agentId: 'agent-a' }
    )
  );

  // unit_manager tries to lapse (even with canConfirmSettlements flag) → DENY
  // um-a has canConfirmSettlements: true but role is 'unit_manager', not in Arm D role list
  await run('Arm D DENY: UM (canConfirmSettlements) cannot lapse a policy', false, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      LAPSE_FIELDS
    )
  );

  // BM tries to lapse a non-settled (rated) policy → DENY (resource.data.status != 'settled')
  // Use policy-arm-d-rated (dedicated seed) — policy-a1-rated is transitioned to 'settled'
  // by the earlier Arm B "rated → settled" ALLOW test and would incorrectly ALLOW here.
  await run('Arm D DENY: BM cannot lapse a non-settled (rated) policy', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-arm-d-rated'),
      LAPSE_FIELDS
    )
  );

  // BM includes extra key beyond allowed affectedKeys → DENY
  await run('Arm D DENY: extra key (managerNote) beyond affectedKeys', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      { ...LAPSE_FIELDS, managerNote: 'tampered' }
    )
  );

  // BM omits dateLapsed (not a timestamp) → DENY (dateLapsed is timestamp guard fails)
  await run('Arm D DENY: missing dateLapsed fails timestamp guard', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-b1-settled'),
      { status: 'lapsed', statusUpdatedAt: Timestamp.now() }   // no dateLapsed
    )
  );

  // ── socialPlatform field (PR #319) ──
  // Arm A body-edit includes socialPlatform in the hasOnly list — must ALLOW.
  // policy-a1 is in 'settled' status at this point (mutated by earlier transition tests),
  // so we need a dedicated submitted-status seed doc.
  // Use a fresh setDoc (rules disabled) then Arm A test.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore()
      .doc(`tenants/${TENANT_ID}/policies/policy-arm-sp-submitted`)
      .set(VALID_PAYLOAD);
  });

  await run('Arm A ALLOW: body-edit with socialPlatform field (PR #319)', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-arm-sp-submitted'),
      {
        sourceOfProspect: 'social-media',
        socialPlatform:   'instagram',
        ownerName:        'Social Prospect',
        proposedAPI:      5000,
        dateWritten:      yesterday,
      }
    )
  );

  await run('Arm A DENY: body-edit with socialPlatform + disallowed agentId field', false, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-arm-sp-submitted'),
      {
        socialPlatform: 'facebook',
        agentId:        'tampered-id',  // different value → diff sees it → hasOnly denies
      }
    )
  );

  // ── PRODUCING MANAGER WRITE (policy-ledger-mgr-write) ──
  // CREATE — ALLOW: BM and UM can create their own policies (agentId == auth.uid).
  await run('producing-mgr CREATE ALLOW: BM creates own policy', true, () =>
    addDoc(collection(bmADb, 'tenants', TENANT_ID, 'policies'), {
      ...CREATE_PAYLOAD, agentId: 'bm-a', createdBy: 'bm-a',
    })
  );

  await run('producing-mgr CREATE ALLOW: UM creates own policy', true, () =>
    addDoc(collection(umADb, 'tenants', TENANT_ID, 'policies'), {
      ...CREATE_PAYLOAD, agentId: 'um-a', createdBy: 'um-a',
    })
  );

  // SELF-ONLY INVARIANT — DENY: producing manager cannot write another user's policy.
  await run('producing-mgr CREATE DENY: BM with another agentId (self-only invariant)', false, () =>
    addDoc(collection(bmADb, 'tenants', TENANT_ID, 'policies'), {
      ...CREATE_PAYLOAD, agentId: 'agent-a', createdBy: 'bm-a',
    })
  );

  await run('producing-mgr CREATE DENY: UM with another agentId (self-only invariant)', false, () =>
    addDoc(collection(umADb, 'tenants', TENANT_ID, 'policies'), {
      ...CREATE_PAYLOAD, agentId: 'agent-a', createdBy: 'um-a',
    })
  );

  // Non-producing role — DENY: tenant_admin cannot create a policy entry.
  await run('producing-mgr CREATE DENY: tenant_admin (non-producing role)', false, () =>
    addDoc(collection(taDb, 'tenants', TENANT_ID, 'policies'), {
      ...CREATE_PAYLOAD, agentId: 'ta-1', createdBy: 'ta-1',
    })
  );

  // Arm A — ALLOW: BM and UM can body-edit their own submitted policies.
  await run('producing-mgr Arm A ALLOW: BM body-edits own submitted policy', true, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-pm-bm'),
      { ownerName: 'BM Client Updated', proposedAPI: 5000, dateWritten: yesterday, sourceOfProspect: 'referral' }
    )
  );

  await run('producing-mgr Arm A ALLOW: UM body-edits own submitted policy', true, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-pm-um'),
      { ownerName: 'UM Client Updated', proposedAPI: 5000, dateWritten: yesterday, sourceOfProspect: 'referral' }
    )
  );

  // SELF-ONLY INVARIANT — DENY: BM cannot body-edit another user's submitted policy.
  // policy-b1 has agentId='agent-b', status='submitted' (untouched by prior tests).
  await run('producing-mgr Arm A DENY: BM body-edits another user policy (self-only)', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      { ownerName: 'BM Hijack' }
    )
  );

  // SELF-ONLY INVARIANT — DENY: UM cannot body-edit another user's submitted policy.
  // policy-b1 has agentId='agent-b' (unit um-b); um-a is in unit um-a → DENY.
  await run('producing-mgr Arm A DENY: UM body-edits another user policy (self-only)', false, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      { ownerName: 'UM Hijack' }
    )
  );

  // Arm B — ALLOW: BM can transition own policy through legal status change.
  // policy-pm-bm is in 'submitted' status after the body-edit above (Arm A preserves status).
  await run('producing-mgr Arm B ALLOW: BM transitions own policy submitted→rated', true, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-pm-bm'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200, ...prov('bm-a', 'manager') }
    )
  );

  // SELF-ONLY INVARIANT — DENY: BM cannot transition another user's policy.
  // policy-b1 has agentId='agent-b', status='submitted'.
  await run('producing-mgr Arm B DENY: BM transitions another user policy (self-only)', false, () =>
    updateDoc(
      doc(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  // SELF-ONLY INVARIANT — DENY: UM cannot transition another user's policy.
  // policy-b1 has agentId='agent-b' (unit um-b); um-a is in unit um-a → DENY.
  await run('producing-mgr Arm B DENY: UM transitions another user policy (self-only)', false, () =>
    updateDoc(
      doc(umADb, 'tenants', TENANT_ID, 'policies', 'policy-b1'),
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  // ── PRODUCING MANAGER HISTORY ARM ──
  // Verifies the history agent-arm fix: (isAgent() || isProducingManager()).
  // BM and UM must be able to write history entries on their OWN policies
  // (agentId == auth.uid AND parent policy agentId == auth.uid).
  const BM_HISTORY = {
    fromStatus:    'submitted',
    toStatus:      'rated',
    changedFields: { status: 'rated', ratedPremium: 1200 },
    actorUid:      'bm-a',
    actorRole:     'branch_manager',
    agentId:       'bm-a',
    unitId:        'um-a',
    at:            Timestamp.now(),
  };

  await run('producing-mgr HISTORY ALLOW: BM creates history on own policy', true, () =>
    addDoc(
      collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-pm-bm', 'history'),
      BM_HISTORY
    )
  );

  await run('producing-mgr HISTORY ALLOW: UM creates history on own policy', true, () =>
    addDoc(
      collection(umADb, 'tenants', TENANT_ID, 'policies', 'policy-pm-um', 'history'),
      { ...BM_HISTORY, actorUid: 'um-a', actorRole: 'unit_manager', agentId: 'um-a' }
    )
  );

  // Self-only invariant: BM cannot write a history entry on another user's policy.
  // policy-a1.agentId == 'agent-a' != 'bm-a' → parent-policy get() check fails → DENY.
  await run('producing-mgr HISTORY DENY: BM creates history on another user policy (self-only)', false, () =>
    addDoc(
      collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1', 'history'),
      { ...BM_HISTORY, agentId: 'bm-a' }
    )
  );

  // ── Results ──
  // ── Tier-3 3.1: CRO read arms + Arm E delivery confirmation ──────────────
  const croDb = testEnv.authenticatedContext('cro-1', authToken('cro')).firestore();
  const croOtherTenantDb = testEnv
    .authenticatedContext('cro-x', { role: 'cro', tenantId: 'some-other-tenant' })
    .firestore();
  const deliveryWrite = (over = {}) => ({
    policyDeliveryDate: Timestamp.now(),
    deliveredBy: 'cro-1',
    deliveredAt: Timestamp.now(),
    ...over,
  });

  await run('CRO gets any tenant policy (read arm)', true, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).get());
  await run('CRO lists policies tenant-wide (read arm)', true, () =>
    croDb.collection(`tenants/${TENANT_ID}/policies`).get());
  await run('Cross-tenant CRO get', false, () =>
    croOtherTenantDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).get());
  await run('CRO marks settled policy delivered (3 fields)', true, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).update(deliveryWrite()));
  await run('CRO delivery on a SUBMITTED policy', false, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-submitted`).update(deliveryWrite()));
  await run('CRO forges deliveredBy (!= auth.uid)', false, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).update(deliveryWrite({ deliveredBy: 'someone-else', policyDeliveryDate: Timestamp.fromMillis(Date.now() - 60_000) })));
  await run('CRO smuggles a non-delivery field (settledAPI)', false, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).update({ ...deliveryWrite({ policyDeliveryDate: Timestamp.fromMillis(Date.now() - 120_000) }), settledAPI: 99999 }));
  await run('CRO future policyDeliveryDate', false, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).update(deliveryWrite({ policyDeliveryDate: Timestamp.fromMillis(Date.now() + 86_400_000) })));
  await run('Agent attempts the delivery write on own settled policy', false, () =>
    agentADb.doc(`tenants/${TENANT_ID}/policies/policy-a1-settled`).update({
      policyDeliveryDate: Timestamp.now(), deliveredBy: 'agent-a', deliveredAt: Timestamp.now(),
    }));
  await run('CRO attempts a status change (settled -> lapsed)', false, () =>
    croDb.doc(`tenants/${TENANT_ID}/policies/policy-cro-settled`).update({
      status: 'lapsed', statusUpdatedAt: Timestamp.now(), dateLapsed: Timestamp.now(), lapseReason: 'x',
    }));


  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== policies.rules.test results ===');
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
