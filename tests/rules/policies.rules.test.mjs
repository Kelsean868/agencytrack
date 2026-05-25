import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, collection, getDoc, getDocs, addDoc, query, where, Timestamp,
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

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });

  // Seed existing docs for read/list tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`tenants/${TENANT_ID}/policies/policy-a1`).set(VALID_PAYLOAD);
    await db.doc(`tenants/${TENANT_ID}/policies/policy-b1`).set({
      ...VALID_PAYLOAD,
      agentId: 'agent-b',
      unitId: 'um-b',
    });
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
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
