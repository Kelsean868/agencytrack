import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'plan-suggestions-rules-test-tenant';

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
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 140) });
  }
}

function psDocPath(agentId, id) {
  return `tenants/${TENANT_ID}/users/${agentId}/planSuggestions/${id}`;
}
function userDocPath(uid) {
  return `tenants/${TENANT_ID}/users/${uid}`;
}

// The locked ten-field create payload (raiser stamps their own uid).
function validCreate(raiserUid, raiserRole, overrides = {}) {
  return {
    tenantId: TENANT_ID,
    agentId: 'agent-a',
    year: 2026,
    note: 'Lift Life to 65% and trim Motor.',
    raisedByUid: raiserUid,
    raisedByName: 'A Manager',
    raisedByRole: raiserRole,
    status: 'open',
    createdAt: new Date(),
    seenAt: null,
    ...overrides,
  };
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

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // User docs — the upline arm's cross-doc gets read agent unitId/branchId.
    await db.doc(userDocPath('agent-a')).set({ role: 'agent', tenantId: TENANT_ID, uid: 'agent-a', unitId: 'unit-1', branchId: 'branch-1' });
    await db.doc(userDocPath('agent-b')).set({ role: 'agent', tenantId: TENANT_ID, uid: 'agent-b', unitId: 'unit-1', branchId: 'branch-1' });
    await db.doc(userDocPath('um-1')).set({ role: 'unit_manager',   tenantId: TENANT_ID, unitId: 'unit-1' });
    await db.doc(userDocPath('um-2')).set({ role: 'unit_manager',   tenantId: TENANT_ID, unitId: 'unit-2' });
    await db.doc(userDocPath('bm-1')).set({ role: 'branch_manager', tenantId: TENANT_ID, branchId: 'branch-1' });
    await db.doc(userDocPath('bm-2')).set({ role: 'branch_manager', tenantId: TENANT_ID, branchId: 'branch-2' });
    // Seed suggestion docs on agent-a: an OPEN one for reads/list/deny-ack,
    // a second OPEN one the agent will ack (ALLOW), and a SEEN one for re-ack DENY.
    const seed = { tenantId: TENANT_ID, agentId: 'agent-a', year: 2026, note: 'seed', raisedByUid: 'um-1', raisedByName: 'UM', raisedByRole: 'unit_manager' };
    await db.doc(psDocPath('agent-a', 'sug-open')).set({ ...seed, status: 'open', createdAt: new Date(), seenAt: null });
    await db.doc(psDocPath('agent-a', 'sug-ack')).set({ ...seed, status: 'open', createdAt: new Date(), seenAt: null });
    await db.doc(psDocPath('agent-a', 'sug-seen')).set({ ...seed, status: 'seen', createdAt: new Date(), seenAt: new Date() });
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umDb     = testEnv.authenticatedContext('um-1',    authToken('unit_manager')).firestore();
  const um2Db    = testEnv.authenticatedContext('um-2',    authToken('unit_manager')).firestore();
  const bmDb     = testEnv.authenticatedContext('bm-1',    authToken('branch_manager')).firestore();
  const bm2Db    = testEnv.authenticatedContext('bm-2',    authToken('branch_manager')).firestore();
  const smDb     = testEnv.authenticatedContext('sm-1',    authToken('sales_manager')).firestore();
  const taDb     = testEnv.authenticatedContext('ta-1',    authToken('tenant_admin')).firestore();
  const paDb     = testEnv.authenticatedContext('pa-1',    { role: 'platform_admin', tenantId: null }).firestore();
  const crossDb  = testEnv.authenticatedContext('agent-a', { role: 'agent', tenantId: 'other-tenant' }).firestore();

  // ── GET ─────────────────────────────────────────────────────────────────────
  await run('agent-a GET own suggestion → ALLOW', true, () =>
    getDoc(doc(agentADb, psDocPath('agent-a', 'sug-open'))));
  await run('agent-b GET agent-a suggestion (other-agent) → DENY', false, () =>
    getDoc(doc(agentBDb, psDocPath('agent-a', 'sug-open'))));
  await run('UM same-unit GET agent-a suggestion → ALLOW', true, () =>
    getDoc(doc(umDb, psDocPath('agent-a', 'sug-open'))));
  await run('UM other-unit GET agent-a suggestion → DENY', false, () =>
    getDoc(doc(um2Db, psDocPath('agent-a', 'sug-open'))));
  await run('BM same-branch GET agent-a suggestion → ALLOW', true, () =>
    getDoc(doc(bmDb, psDocPath('agent-a', 'sug-open'))));
  await run('BM other-branch GET agent-a suggestion → DENY', false, () =>
    getDoc(doc(bm2Db, psDocPath('agent-a', 'sug-open'))));
  await run('SM GET agent-a suggestion → ALLOW', true, () =>
    getDoc(doc(smDb, psDocPath('agent-a', 'sug-open'))));
  await run('TA GET agent-a suggestion → ALLOW', true, () =>
    getDoc(doc(taDb, psDocPath('agent-a', 'sug-open'))));
  await run('PA GET agent-a suggestion → ALLOW', true, () =>
    getDoc(doc(paDb, psDocPath('agent-a', 'sug-open'))));
  await run('cross-tenant GET → DENY', false, () =>
    getDoc(doc(crossDb, psDocPath('agent-a', 'sug-open'))));

  // ── LIST ────────────────────────────────────────────────────────────────────
  await run('agent-a LIST own suggestions → ALLOW', true, () =>
    agentADb.collection(`tenants/${TENANT_ID}/users/agent-a/planSuggestions`).get());
  await run('agent-b LIST agent-a suggestions (other-agent) → DENY', false, () =>
    agentBDb.collection(`tenants/${TENANT_ID}/users/agent-a/planSuggestions`).get());
  await run('UM same-unit LIST agent-a suggestions → ALLOW', true, () =>
    umDb.collection(`tenants/${TENANT_ID}/users/agent-a/planSuggestions`).get());
  await run('UM other-unit LIST agent-a suggestions → DENY', false, () =>
    um2Db.collection(`tenants/${TENANT_ID}/users/agent-a/planSuggestions`).get());

  // ── CREATE ──────────────────────────────────────────────────────────────────
  await run('UM same-unit CREATE on agent-a → ALLOW', true, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-um')), validCreate('um-1', 'unit_manager')));
  await run('UM other-unit CREATE on agent-a → DENY', false, () =>
    setDoc(doc(um2Db, psDocPath('agent-a', 'c-um2')), validCreate('um-2', 'unit_manager')));
  await run('BM same-branch CREATE on agent-a → ALLOW', true, () =>
    setDoc(doc(bmDb, psDocPath('agent-a', 'c-bm')), validCreate('bm-1', 'branch_manager')));
  await run('BM other-branch CREATE on agent-a → DENY', false, () =>
    setDoc(doc(bm2Db, psDocPath('agent-a', 'c-bm2')), validCreate('bm-2', 'branch_manager')));
  await run('SM CREATE on agent-a → ALLOW (symmetric)', true, () =>
    setDoc(doc(smDb, psDocPath('agent-a', 'c-sm')), validCreate('sm-1', 'sales_manager')));
  await run('TA CREATE on agent-a → ALLOW (symmetric)', true, () =>
    setDoc(doc(taDb, psDocPath('agent-a', 'c-ta')), validCreate('ta-1', 'tenant_admin')));
  await run('PA CREATE on agent-a → ALLOW (symmetric)', true, () =>
    setDoc(doc(paDb, psDocPath('agent-a', 'c-pa')), validCreate('pa-1', 'platform_admin')));
  await run('AGENT self-CREATE on own plan → DENY (no self-suggestions)', false, () =>
    setDoc(doc(agentADb, psDocPath('agent-a', 'c-self')), validCreate('agent-a', 'agent')));
  await run('AGENT-B CREATE on agent-a → DENY (not a manager)', false, () =>
    setDoc(doc(agentBDb, psDocPath('agent-a', 'c-ab')), validCreate('agent-b', 'agent')));
  await run('UM CREATE with forged raisedByUid → DENY', false, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-forge')), validCreate('um-1', 'unit_manager', { raisedByUid: 'someone-else' })));
  await run('UM CREATE missing a required key (note) → DENY', false, () => {
    const p = validCreate('um-1', 'unit_manager'); delete p.note;
    return setDoc(doc(umDb, psDocPath('agent-a', 'c-miss')), p);
  });
  await run('UM CREATE with an extra key → DENY (hasOnly)', false, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-extra')), validCreate('um-1', 'unit_manager', { severity: 'high' })));
  await run("UM CREATE status != 'open' → DENY", false, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-status')), validCreate('um-1', 'unit_manager', { status: 'seen' })));
  await run('UM CREATE seenAt != null → DENY', false, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-seenat')), validCreate('um-1', 'unit_manager', { seenAt: new Date() })));
  await run('UM CREATE with wrong tenantId field → DENY', false, () =>
    setDoc(doc(umDb, psDocPath('agent-a', 'c-tid')), validCreate('um-1', 'unit_manager', { tenantId: 'other-tenant' })));

  // ── UPDATE (ack) ────────────────────────────────────────────────────────────
  await run('agent-a ACK own open suggestion (open→seen, hasOnly) → ALLOW', true, () =>
    updateDoc(doc(agentADb, psDocPath('agent-a', 'sug-ack')), { status: 'seen', seenAt: new Date() }));
  await run('manager ACK agent-a suggestion → DENY (agent-only)', false, () =>
    updateDoc(doc(umDb, psDocPath('agent-a', 'sug-open')), { status: 'seen', seenAt: new Date() }));
  await run('agent-a ACK with an extra field → DENY (hasOnly)', false, () =>
    updateDoc(doc(agentADb, psDocPath('agent-a', 'sug-open')), { status: 'seen', seenAt: new Date(), note: 'tampered' }));
  await run("agent-a ACK to status != 'seen' → DENY", false, () =>
    updateDoc(doc(agentADb, psDocPath('agent-a', 'sug-open')), { status: 'open', seenAt: new Date() }));
  await run('agent-a RE-ACK already-seen suggestion → DENY (resource must be open)', false, () =>
    updateDoc(doc(agentADb, psDocPath('agent-a', 'sug-seen')), { status: 'seen', seenAt: new Date() }));
  await run('agent-b ACK agent-a suggestion → DENY (other-agent)', false, () =>
    updateDoc(doc(agentBDb, psDocPath('agent-a', 'sug-open')), { status: 'seen', seenAt: new Date() }));

  // ── DELETE ──────────────────────────────────────────────────────────────────
  await run('agent-a DELETE own suggestion → DENY (delete: if false)', false, () =>
    deleteDoc(doc(agentADb, psDocPath('agent-a', 'sug-open'))));
  await run('manager DELETE suggestion → DENY', false, () =>
    deleteDoc(doc(umDb, psDocPath('agent-a', 'sug-open'))));

  // ── Results ─────────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== planSuggestions.rules.test results ===');
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
