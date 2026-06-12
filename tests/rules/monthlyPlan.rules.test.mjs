/**
 * monthlyPlan.rules.test.mjs — emulator rules matrix for the Monthly Plan arm.
 *
 * Mirrors yearPlan.rules.test.mjs exactly (same harness, same run() helper).
 * Run: `firebase emulators:exec --only firestore "node tests/rules/monthlyPlan.rules.test.mjs"`
 */

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'monthly-plan-rules-test-tenant';

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
  targets: Array(12).fill(10000),
  split: 'even',
  status: 'draft',
  anchorAPI: 120000,
};

function mpDocPath(uid, year) {
  return `tenants/${TENANT_ID}/users/${uid}/monthlyPlan/${year}`;
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

  // Seed existing monthlyPlan docs
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(mpDocPath('agent-a', '2026')).set({ ...VALID_PAYLOAD });
    await db.doc(mpDocPath('agent-b', '2026')).set({ ...VALID_PAYLOAD, uid: 'agent-b' });
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

  await run('agent-a GET own 2026 monthlyPlan → ALLOW', true, () =>
    getDoc(doc(agentADb, mpDocPath('agent-a', '2026')))
  );

  await run('agent-b GET agent-a monthlyPlan (uid mismatch) → DENY', false, () =>
    getDoc(doc(agentBDb, mpDocPath('agent-a', '2026')))
  );

  await run('unit_manager GET agent-a monthlyPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(umDb, mpDocPath('agent-a', '2026')))
  );

  await run('branch_manager GET agent-a monthlyPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(bmDb, mpDocPath('agent-a', '2026')))
  );

  await run('sales_manager GET agent-a monthlyPlan → DENY (no manager-read arm yet)', false, () =>
    getDoc(doc(smDb, mpDocPath('agent-a', '2026')))
  );

  await run('tenant_admin GET agent-a monthlyPlan → DENY', false, () =>
    getDoc(doc(taDb, mpDocPath('agent-a', '2026')))
  );

  await run('unauthenticated GET → DENY', false, () =>
    getDoc(doc(anonDb, mpDocPath('agent-a', '2026')))
  );

  await run('cross-tenant agent GET → DENY', false, () =>
    getDoc(doc(crossDb, mpDocPath('agent-a', '2026')))
  );

  // ── LIST ──────────────────────────────────────────────────────────────────────

  await run('agent-a LIST own monthlyPlan subcollection → ALLOW', true, () =>
    agentADb.collection(`tenants/${TENANT_ID}/users/agent-a/monthlyPlan`).get()
  );

  await run('agent-b LIST agent-a monthlyPlan → DENY', false, () =>
    agentBDb.collection(`tenants/${TENANT_ID}/users/agent-a/monthlyPlan`).get()
  );

  // ── CREATE ────────────────────────────────────────────────────────────────────

  await run('agent-a CREATE own 2025 monthlyPlan (status:draft) → ALLOW', true, () =>
    setDoc(doc(agentADb, mpDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, year: 2025, uid: 'agent-a' })
  );

  await run('agent CREATE with status:committed → DENY', false, () =>
    setDoc(doc(agentADb, mpDocPath('agent-a', '2024')), { ...VALID_PAYLOAD, year: 2024, status: 'committed' })
  );

  await run('agent CREATE with status:invalid → DENY', false, () =>
    setDoc(doc(agentADb, mpDocPath('agent-a', '2023')), { ...VALID_PAYLOAD, year: 2023, status: 'invalid' })
  );

  await run('agent-b CREATE at agent-a path (uid mismatch) → DENY', false, () =>
    setDoc(doc(agentBDb, mpDocPath('agent-a', '2025')), { ...VALID_PAYLOAD, uid: 'agent-b' })
  );

  await run('unit_manager CREATE at own path → DENY (isAgent() guard)', false, () =>
    setDoc(doc(umDb, mpDocPath('um-1', '2026')), { ...VALID_PAYLOAD, uid: 'um-1' })
  );

  await run('unauthenticated CREATE → DENY', false, () =>
    setDoc(doc(anonDb, mpDocPath('agent-a', '2023')), { ...VALID_PAYLOAD })
  );

  // ── UPDATE ────────────────────────────────────────────────────────────────────

  await run('agent-a UPDATE own monthlyPlan → ALLOW', true, () =>
    updateDoc(doc(agentADb, mpDocPath('agent-a', '2026')), { split: 'custom' })
  );

  await run('agent-b UPDATE agent-a monthlyPlan → DENY', false, () =>
    updateDoc(doc(agentBDb, mpDocPath('agent-a', '2026')), { split: 'custom' })
  );

  await run('unit_manager UPDATE agent-a monthlyPlan → DENY', false, () =>
    updateDoc(doc(umDb, mpDocPath('agent-a', '2026')), { split: 'custom' })
  );

  await run('unauthenticated UPDATE → DENY', false, () =>
    updateDoc(doc(anonDb, mpDocPath('agent-a', '2026')), { split: 'custom' })
  );

  // ── DELETE ────────────────────────────────────────────────────────────────────

  await run('agent-a DELETE own monthlyPlan → DENY (delete: if false)', false, () =>
    deleteDoc(doc(agentADb, mpDocPath('agent-a', '2026')))
  );

  await run('branch_manager DELETE → DENY', false, () =>
    deleteDoc(doc(bmDb, mpDocPath('agent-a', '2026')))
  );

  // ── Summary ───────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== monthlyPlan.rules.test.mjs ===');
  for (const r of results) {
    console.log(`${r.pass ? '✓' : '✗'} [${r.expected}] ${r.label}${r.error ? ` — ${r.error}` : ''}`);
  }
  console.log(`\n${passed}/${results.length} passed`);

  await testEnv.cleanup();

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
