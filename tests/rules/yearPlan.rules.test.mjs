import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'year-plan-rules-test-tenant';

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
  tenantId: TENANT_ID,
  uid: 'agent-a',
  licenseProfile: 'composite',
  status: 'draft',
  lines: {
    life:     { targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true },
    ah:       { targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true },
    property: { targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true },
    motor:    { targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true },
  },
};

function ypDocPath(uid, year) {
  return `tenants/${TENANT_ID}/users/${uid}/yearPlan/${year}`;
}

function userDocPath(uid) {
  return `tenants/${TENANT_ID}/users/${uid}`;
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

  // Seed existing yearPlan docs + user docs needed for self-update allowlist tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // yearPlan docs
    await db.doc(ypDocPath('agent-a', '2026')).set({ ...VALID_PAYLOAD });
    await db.doc(ypDocPath('agent-b', '2026')).set({ ...VALID_PAYLOAD, uid: 'agent-b' });
    // user docs — needed for licenseProfile self-update allowlist tests
    await db.doc(userDocPath('agent-a')).set({ role: 'agent', tenantId: TENANT_ID, uid: 'agent-a', hasSeenWelcome: false });
    await db.doc(userDocPath('agent-b')).set({ role: 'agent', tenantId: TENANT_ID, uid: 'agent-b', hasSeenWelcome: false });
    await db.doc(userDocPath('um-1')).set({    role: 'unit_manager',   tenantId: TENANT_ID, unitId: 'unit-1' });
    await db.doc(userDocPath('bm-1')).set({    role: 'branch_manager', tenantId: TENANT_ID, branchId: 'branch-1' });
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umDb     = testEnv.authenticatedContext('um-1',    authToken('unit_manager')).firestore();
  const bmDb     = testEnv.authenticatedContext('bm-1',    authToken('branch_manager')).firestore();
  const smDb     = testEnv.authenticatedContext('sm-1',    authToken('sales_manager')).firestore();
  const taDb     = testEnv.authenticatedContext('ta-1',    authToken('tenant_admin')).firestore();
  const anonDb   = testEnv.unauthenticatedContext().firestore();
  const crossDb  = testEnv.authenticatedContext('agent-a', { role: 'agent', tenantId: 'other-tenant' }).firestore();

  // ── GET ───────────────────────────────────────────────────────────────────────

  await run('agent-a GET own 2026 yearPlan → ALLOW', true, () =>
    getDoc(doc(agentADb, ypDocPath('agent-a', '2026')))
  );

  await run('agent-b GET agent-a yearPlan (uid mismatch) → DENY', false, () =>
    getDoc(doc(agentBDb, ypDocPath('agent-a', '2026')))
  );

  await run('unit_manager GET agent-a yearPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(umDb, ypDocPath('agent-a', '2026')))
  );

  await run('branch_manager GET agent-a yearPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(bmDb, ypDocPath('agent-a', '2026')))
  );

  await run('sales_manager GET agent-a yearPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(smDb, ypDocPath('agent-a', '2026')))
  );

  await run('tenant_admin GET agent-a yearPlan → DENY', false, () =>
    getDoc(doc(taDb, ypDocPath('agent-a', '2026')))
  );

  await run('unauthenticated GET → DENY', false, () =>
    getDoc(doc(anonDb, ypDocPath('agent-a', '2026')))
  );

  await run('cross-tenant agent GET → DENY', false, () =>
    getDoc(doc(crossDb, ypDocPath('agent-a', '2026')))
  );

  // ── CREATE ────────────────────────────────────────────────────────────────────

  await run('agent-a CREATE own 2025 yearPlan (status:draft) → ALLOW', true, () =>
    setDoc(doc(agentADb, ypDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, year: 2025, uid: 'agent-a' })
  );

  await run('agent CREATE with status:committed → DENY', false, () =>
    setDoc(doc(agentADb, ypDocPath('agent-a', '2024')), { ...VALID_PAYLOAD, year: 2024, status: 'committed' })
  );

  await run('agent CREATE with status:invalid → DENY', false, () =>
    setDoc(doc(agentADb, ypDocPath('agent-a', '2023')), { ...VALID_PAYLOAD, year: 2023, status: 'invalid' })
  );

  await run('agent-b CREATE at agent-a path (uid mismatch) → DENY', false, () =>
    setDoc(doc(agentBDb, ypDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, uid: 'agent-b' })
  );

  await run('unit_manager CREATE at own path → DENY (isAgent() guard)', false, () =>
    setDoc(doc(umDb, ypDocPath('um-1', '2026')), { ...VALID_PAYLOAD, uid: 'um-1' })
  );

  await run('unauthenticated CREATE → DENY', false, () =>
    setDoc(doc(anonDb, ypDocPath('agent-a', '2023')), { ...VALID_PAYLOAD })
  );

  // ── UPDATE ────────────────────────────────────────────────────────────────────

  await run('agent-a UPDATE own yearPlan → ALLOW', true, () =>
    updateDoc(doc(agentADb, ypDocPath('agent-a', '2026')), { 'lines.life.targetAPI': 50000 })
  );

  await run('agent-b UPDATE agent-a yearPlan → DENY', false, () =>
    updateDoc(doc(agentBDb, ypDocPath('agent-a', '2026')), { 'lines.life.targetAPI': 99999 })
  );

  await run('unit_manager UPDATE agent-a yearPlan → DENY', false, () =>
    updateDoc(doc(umDb, ypDocPath('agent-a', '2026')), { 'lines.life.targetAPI': 99999 })
  );

  await run('unauthenticated UPDATE → DENY', false, () =>
    updateDoc(doc(anonDb, ypDocPath('agent-a', '2026')), { 'lines.life.targetAPI': 1 })
  );

  // ── DELETE ────────────────────────────────────────────────────────────────────

  await run('agent-a DELETE own yearPlan → DENY (delete: if false)', false, () =>
    deleteDoc(doc(agentADb, ypDocPath('agent-a', '2026')))
  );

  await run('branch_manager DELETE → DENY', false, () =>
    deleteDoc(doc(bmDb, ypDocPath('agent-a', '2026')))
  );

  // ── licenseProfile allowlist (user-doc arm, not yearPlan arm) ─────────────────
  // These exercise the edit to the user self-update hasOnly — regression guard.

  await run('agent-a SET licenseProfile on own user doc → ALLOW', true, () =>
    updateDoc(doc(agentADb, userDocPath('agent-a')), { licenseProfile: 'life_only', updatedAt: new Date() })
  );

  await run('agent SET non-allowlisted field on own user doc → DENY (regression guard)', false, () =>
    updateDoc(doc(agentADb, userDocPath('agent-a')), { role: 'branch_manager' })
  );

  await run('agent-b SET licenseProfile on agent-a user doc (uid mismatch) → DENY', false, () =>
    updateDoc(doc(agentBDb, userDocPath('agent-a')), { licenseProfile: 'general_only', updatedAt: new Date() })
  );

  // ── Results ───────────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== yearPlan.rules.test results ===');
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
