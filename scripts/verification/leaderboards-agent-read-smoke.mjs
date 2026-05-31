/**
 * Phase 6 write-read-verify smoke — Track J P1b.
 *
 * Authenticates as the TEST AGENT (kelsean@gmail.com) via the client Firebase
 * JS SDK (not Admin SDK), reads `tenants/tatillife_south/leaderboards/tatil_south`,
 * and asserts the agent's own UID appears in the ranking with the period API
 * the backfill computed.
 *
 * The agent-read is the GATE — it exercises rules + claims + read path that
 * the mocked unit tests can't.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const TENANT_ID    = 'tatillife_south';
const BRANCH_ID    = 'tatil_south';
const AGENT_UID    = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

const REQUIRED = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'];
for (const k of REQUIRED) {
  if (!process.env[k]) { console.error(`Missing ${k} in env`); process.exit(1); }
}
if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exit(1); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

(async () => {
  console.log(`\nPhase 6 write-read-verify smoke — Track J P1b`);
  console.log(`Target: ${firebaseConfig.projectId} / tenants/${TENANT_ID}/leaderboards/${BRANCH_ID}\n`);

  // ── Step 1: client-SDK auth as the test agent (rules path) ────────────────
  console.log('Step 1: client-SDK auth as test agent');
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
  } catch (err) {
    fail(`auth failed: ${err.code ?? err.message}`);
  }
  pass(`signed in as uid=${cred.user.uid}`);
  if (cred.user.uid !== AGENT_UID) {
    fail(`uid mismatch — expected ${AGENT_UID}, got ${cred.user.uid}`);
  }
  pass(`uid matches AGENT_UID`);

  // Confirm claims include role=agent + tenantId
  const idToken = await cred.user.getIdTokenResult();
  pass(`claims: role=${idToken.claims.role} tenantId=${idToken.claims.tenantId}`);
  if (idToken.claims.role !== 'agent') {
    fail(`expected role=agent in claims, got ${idToken.claims.role}`);
  }

  // ── Step 2: read leaderboards/{branchId} as the agent (the GATE) ──────────
  console.log('\nStep 2: read leaderboards doc via client SDK (rules fire here)');
  const ref = doc(db, `tenants/${TENANT_ID}/leaderboards/${BRANCH_ID}`);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    fail(`agent-read DENIED — rules path failure: ${err.code ?? err.message}`);
  }
  if (!snap.exists()) {
    fail(`agent-read returned non-existent doc (backfill should have written it)`);
  }
  pass(`agent-read ALLOWED — doc exists`);

  const data = snap.data();
  const keys = Object.keys(data).sort();
  pass(`doc top-level keys: ${keys.join(', ')}`);

  // ── Step 3: assert the agent appears in the ranking with their API ────────
  console.log('\nStep 3: assert agent appears in the rankings');
  for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
    if (!Array.isArray(data[periodKey])) fail(`period '${periodKey}' missing or non-array`);
    const entry = data[periodKey].find((e) => e.agentId === AGENT_UID);
    if (!entry) fail(`AGENT_UID ${AGENT_UID} NOT in ${periodKey} ranking`);
    pass(`${periodKey}: agent at rank ${entry.rank}, periodApi=${entry.periodApi}, apps=${entry.apps}, unitName="${entry.unitName}"`);
  }

  // YTD-specific assertion — the backfill saw the agent at rank 1 with $25,000.
  const ytdEntry = data.ytd.find((e) => e.agentId === AGENT_UID);
  if (ytdEntry.periodApi === 0) {
    fail(`YTD periodApi is 0 — agent has no submitted YTD production (data drift since backfill?)`);
  }
  pass(`YTD periodApi > 0 (matches backfill expectation)`);

  // ── Step 4: confirm skippedNoBranch metadata is visible to agent ──────────
  console.log('\nStep 4: skippedNoBranch metadata visibility');
  if (!data.skippedNoBranch) {
    fail(`skippedNoBranch metadata missing from doc`);
  }
  pass(`skippedNoBranch.count=${data.skippedNoBranch.count} agentIds=${JSON.stringify(data.skippedNoBranch.agentIds)}`);

  // ── Step 5: negative — agent CANNOT read another branch's doc ─────────────
  console.log('\nStep 5: negative — agent CANNOT read OTHER branch leaderboard');
  // The backfill wrote leaderboards/ljbBHP1g7lbZXvHlpcDn (a different branch)
  const otherRef = doc(db, `tenants/${TENANT_ID}/leaderboards/ljbBHP1g7lbZXvHlpcDn`);
  let otherDenied = false;
  try {
    await getDoc(otherRef);
  } catch (err) {
    otherDenied = (err.code === 'permission-denied') || /permission/i.test(err.message);
  }
  if (!otherDenied) fail(`agent-read of OTHER branch did NOT deny (rule failure)`);
  pass(`agent-read of OTHER branch DENIED by rules`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await signOut(auth);
  console.log(`\nSmoke: ✓ PASS — agent-read gate green; agent appears in rankings; cross-branch DENY enforced.`);
  process.exit(0);
})();
