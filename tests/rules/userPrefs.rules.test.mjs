// userPrefs.rules.test.mjs — emulator deny-matrix for the owner-only
// `users/{uid}/prefs/{prefId}` block (Nav redesign PR-2).
//
// Run: firebase emulators:exec --only firestore "node tests/rules/userPrefs.rules.test.mjs"
//
// Mirrors the moneyNeeds harness. Owner reads/writes own prefs (allow);
// different-uid, unauthenticated, and cross-tenant all deny.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'user-prefs-rules-test-tenant';

let testEnv;
const results = [];

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

async function run(label, expectAllow, fn) {
  try {
    if (expectAllow) await assertSucceeds(fn());
    else await assertFails(fn());
    results.push({ label, pass: true, expected: expectAllow ? 'ALLOW' : 'DENY' });
  } catch (err) {
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 120) });
  }
}

function prefsPath(uid) {
  return `tenants/${TENANT_ID}/users/${uid}/prefs/app`;
}

const VALID_PINS = { pinnedNav: ['goals', 'planner'], updatedAt: 0 };

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host:  '127.0.0.1',
      port:  9090,
    },
  });

  // Seed an existing prefs doc for agent-a so GET tests hit a real doc.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(prefsPath('agent-a')).set({ pinnedNav: ['daily-log', 'goals'], updatedAt: 0 });
  });

  const agentADb = testEnv.authenticatedContext('agent-a', authToken('agent')).firestore();
  const agentBDb = testEnv.authenticatedContext('agent-b', authToken('agent')).firestore();
  const umDb     = testEnv.authenticatedContext('um-1',    authToken('unit_manager')).firestore();
  const anonDb   = testEnv.unauthenticatedContext().firestore();
  const crossDb  = testEnv.authenticatedContext('agent-a', { role: 'agent', tenantId: 'other-tenant' }).firestore();

  // ── READ ───────────────────────────────────────────────────────────────────
  await run('agent-a GET own prefs → ALLOW', true, () =>
    getDoc(doc(agentADb, prefsPath('agent-a'))));
  await run('agent-b GET agent-a prefs (uid mismatch) → DENY', false, () =>
    getDoc(doc(agentBDb, prefsPath('agent-a'))));
  await run('unit_manager GET agent prefs (no manager arm) → DENY', false, () =>
    getDoc(doc(umDb, prefsPath('agent-a'))));
  await run('unauthenticated GET → DENY', false, () =>
    getDoc(doc(anonDb, prefsPath('agent-a'))));
  await run('cross-tenant agent GET → DENY', false, () =>
    getDoc(doc(crossDb, prefsPath('agent-a'))));

  // ── WRITE ──────────────────────────────────────────────────────────────────
  await run('agent-a WRITE own prefs (valid) → ALLOW', true, () =>
    setDoc(doc(agentADb, prefsPath('agent-a')), VALID_PINS, { merge: true }));
  await run('agent-b WRITE at agent-a path (uid mismatch) → DENY', false, () =>
    setDoc(doc(agentBDb, prefsPath('agent-a')), VALID_PINS, { merge: true }));
  await run('unit_manager WRITE at agent path → DENY', false, () =>
    setDoc(doc(umDb, prefsPath('agent-a')), VALID_PINS, { merge: true }));
  await run('unauthenticated WRITE → DENY', false, () =>
    setDoc(doc(anonDb, prefsPath('agent-a')), VALID_PINS, { merge: true }));
  await run('cross-tenant agent WRITE → DENY', false, () =>
    setDoc(doc(crossDb, prefsPath('agent-a')), VALID_PINS, { merge: true }));

  // Create a not-yet-seeded prefId on the owner's own path (proves create, and
  // that the {prefId} wildcard covers a future doc like PR-4's menuLayout).
  await run('agent-a CREATE own prefs/settings (new prefId) → ALLOW', true, () =>
    setDoc(doc(agentADb, `tenants/${TENANT_ID}/users/agent-a/prefs/settings`), VALID_PINS, { merge: true }));

  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== userPrefs.rules.test results ===');
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
