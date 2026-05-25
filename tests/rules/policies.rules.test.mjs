import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, serverTimestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'policies-rules-test-tenant';

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
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 100) });
  }
}

const yesterday = Timestamp.fromDate(new Date(Date.now() - 86400000));
const tomorrow  = Timestamp.fromDate(new Date(Date.now() + 86400000));

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
      host: 'localhost',
      port: 8080,
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
    // settled policy — for settled→rated illegal test
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1-settled`).set({
      ...VALID_PAYLOAD,
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
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umADb    = testEnv.authenticatedContext('um-a',    authToken('unit_manager')).firestore();
  const bmADb    = testEnv.authenticatedContext('bm-a',    authToken('branch_manager')).firestore();
  const crossDb  = testEnv.authenticatedContext('other-user', { role: 'branch_manager', tenantId: 'other-tenant' }).firestore();

  // ── CREATE ──
  await run('agent create own policy → ALLOW', true, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), VALID_PAYLOAD)
  );

  await run('agent create with mismatched agentId → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...VALID_PAYLOAD, agentId: 'agent-b' })
  );

  await run('create with invalid sourceOfProspect → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...VALID_PAYLOAD, sourceOfProspect: 'bogus-value' })
  );

  await run('create with future dateWritten → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...VALID_PAYLOAD, dateWritten: tomorrow })
  );

  await run('create with proposedAPI <= 0 → DENY', false, () =>
    addDoc(collection(agentADb, 'tenants', TENANT_ID, 'policies'), { ...VALID_PAYLOAD, proposedAPI: 0 })
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
  await run('BM list in-tenant → ALLOW', true, () =>
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
      { status: 'rated', statusUpdatedAt: Timestamp.now(), ratedPremium: 1200 }
    )
  );

  await run('submitted → settled (+full §7.4 field set) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1'),
      { ...SETTLED_FIELDS }
    )
  );

  await run('rated → settled (+full §7.4 field set) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-rated'),
      { ...SETTLED_FIELDS }
    )
  );

  await run('postponed → submitted (no new fields) → ALLOW', true, () =>
    updateDoc(
      doc(agentADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-postponed'),
      { status: 'submitted', statusUpdatedAt: Timestamp.now() }
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

  // ── Results ──
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
