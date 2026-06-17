/**
 * Emulator round-trip smoke — the Block 0 ENABLER proof.
 *
 * Proves a real log-in → write → reload → assert cycle against the AUTH +
 * FIRESTORE emulators, through the production firestore.rules, with ZERO writes
 * to any production tenant. This is the backend round-trip every per-block smoke
 * builds on.
 *
 * Run under the emulator lifecycle:
 *   firebase emulators:exec --only auth,firestore --project=demo-agencytrack \
 *     "node scripts/verification/emulator-roundtrip-smoke.mjs"
 *
 * Flow:
 *   1. Seed the smoke agent (admin SDK) — auth user + claims + Firestore user doc.
 *   2. Web-SDK client A: sign in, write own submission through the rules.
 *   3. "Reload" = fresh Web-SDK client B: sign in again, read from server, assert.
 *   4. Negative control: client A attempts a forged write (wrong branchId) → expect DENY.
 *
 * Exit 0 = all legs PASS. Non-zero = failure (the harness propagates it).
 */
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';

const require = createRequire(import.meta.url);
const { seedSmokeAgent } = require('./lib/emulator-seed.cjs');

const AUTH_HOST = 'http://127.0.0.1:9099';
const FS_HOST = '127.0.0.1';
const FS_PORT = 9090;
const DEMO_CONFIG = { apiKey: 'demo-api-key', projectId: 'demo-agencytrack' };

const results = [];
function leg(name, pass, note = '') {
  results.push({ name, pass, note });
   
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${note ? ' — ' + note : ''}`);
}

function newClient(tag) {
  const app = initializeApp(DEMO_CONFIG, `roundtrip-${tag}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_HOST, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, FS_PORT);
  return { app, auth, db };
}

async function main() {
  // 1. Seed.
  const agent = await seedSmokeAgent();
  leg('seed smoke agent', !!agent.uid, `uid=${agent.uid} tenant=${agent.tenantId} branch=${agent.branchId}`);

  const subPath = `tenants/${agent.tenantId}/submissions/smoke_${agent.uid}_roundtrip`;
  const writtenApi = 13579;

  // 2. Client A — sign in + write own submission (branchId matches claim).
  const a = newClient('a');
  try {
    await signInWithEmailAndPassword(a.auth, agent.email, agent.password);
    leg('client A login', true, agent.email);
    await setDoc(doc(a.db, subPath), {
      agentId: agent.uid,
      branchId: agent.branchId,
      weekStarting: '2026-06-14', // a Sunday
      status: 'submitted',
      api: writtenApi,
      source: 'emulator-roundtrip-smoke',
    });
    leg('client A write own submission (rules ALLOW)', true, subPath);
  } catch (e) {
    leg('client A write own submission (rules ALLOW)', false, e.message);
  }

  // 3. "Reload" — fresh client B reads from server + asserts.
  const b = newClient('b');
  try {
    await signInWithEmailAndPassword(b.auth, agent.email, agent.password);
    const snap = await getDocFromServer(doc(b.db, subPath));
    const ok = snap.exists() && snap.data().api === writtenApi;
    leg('client B reload + assert (fresh read from server)', ok, ok ? `api=${snap.data().api}` : 'doc missing or value mismatch');
  } catch (e) {
    leg('client B reload + assert (fresh read from server)', false, e.message);
  }

  // 4. Negative control — forged branchId must be DENIED by the rule.
  try {
    await setDoc(doc(a.db, `tenants/${agent.tenantId}/submissions/smoke_${agent.uid}_forged`), {
      agentId: agent.uid,
      branchId: 'some_other_branch', // != claim → forge-validation rule denies
      weekStarting: '2026-06-14',
      status: 'submitted',
      api: 999,
    });
    leg('forged-branchId write DENIED', false, 'write unexpectedly ALLOWED');
  } catch (e) {
    const denied = /permission|insufficient|PERMISSION_DENIED/i.test(e.message);
    leg('forged-branchId write DENIED', denied, denied ? 'rule blocked forge' : e.message);
  }

  await Promise.all([deleteApp(a.app), deleteApp(b.app)]);

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
   
  console.log(`\n${'='.repeat(56)}\nROUND-TRIP: ${passed}/${total} legs PASS\n${'='.repeat(56)}`);
  return passed === total;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((e) => {
     
    console.error('ROUND-TRIP CRASHED:', e && e.stack ? e.stack : e);
    process.exit(1);
  });
