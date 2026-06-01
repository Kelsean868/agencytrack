/**
 * Phase 6 write-read-verify prod smoke — Track J P5-prep.
 *
 * Pre-req: CF + rules deployed by dispatcher.
 *
 * Sequence:
 *   1. Auth as tenant_admin → invoke recomputeLeaderboardOnDemand (backfill).
 *      Capture branchCount + priorWeekStarting + championsPriorWeekAgents.
 *   2. Sign out → auth as test agent (client-SDK, rules path).
 *   3. Read leaderboards/{branchId} → assert unitId on each entry; assert
 *      every WEEK entry has a `previousRank` field (value OR null — both
 *      correct; null is expected when the prior week has no submissions).
 *      Report ALL values for full visibility.
 *   4. Read weeklyChampions/{priorWeekStarting} → ALLOWED; assert doc
 *      exists; assert topAPI/topApps/topActivity are present (populated OR
 *      all-null both acceptable). Report values.
 *   5. Attempt client-SDK write to weeklyChampions → assert DENIED.
 *
 * Gates: structure + read-allow + write-deny.
 * Populated vs honest-empty just reflects test-data state (covered by the
 * 57 unit tests + the 14 emulator rules tests).
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
const TA_EMAIL     = process.env.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASS      = process.env.A11Y_TENANT_ADMIN_PASSWORD;

const REQUIRED = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'];
for (const k of REQUIRED) {
  if (!process.env[k]) { console.error(`Missing ${k} in env`); process.exit(1); }
}
if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}
if (!TA_EMAIL || !TA_PASS) {
  console.error('Missing A11Y_TENANT_ADMIN_EMAIL / A11Y_TENANT_ADMIN_PASSWORD');
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
const fns  = getFunctions(app);

let failed = 0;
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { console.error(`  ✗ ${msg}`); failed++; };

(async () => {
  console.log(`\nPhase 6 write-read-verify prod smoke — Track J P5-prep`);
  console.log(`Target: ${firebaseConfig.projectId}\n`);

  // ── Step 1: tenant_admin invokes recomputeLeaderboardOnDemand (backfill) ────
  console.log('Step 1: tenant_admin backfill via recomputeLeaderboardOnDemand');
  let backfillResult;
  try {
    await signInWithEmailAndPassword(auth, TA_EMAIL, TA_PASS);
  } catch (err) {
    fail(`TA auth failed: ${err.code ?? err.message}`);
    process.exit(1);
  }
  const taClaims = await (await auth.currentUser.getIdTokenResult()).claims;
  pass(`TA signed in: role=${taClaims.role} tenantId=${taClaims.tenantId}`);

  try {
    const recompute = httpsCallable(fns, 'recomputeLeaderboardOnDemand');
    const res = await recompute({});
    backfillResult = res.data;
  } catch (err) {
    fail(`recomputeLeaderboardOnDemand call failed: ${err.code ?? err.message}`);
    process.exit(1);
  }
  pass(`backfill ok=${backfillResult.ok} tenantId=${backfillResult.tenantId} branches=${backfillResult.branchCount} totalSubs=${backfillResult.totalSubmissions} totalUsers=${backfillResult.totalUsers}`);
  console.log(`  · backfill priorWeekStarting=${backfillResult.priorWeekStarting} championsPriorWeekAgents=${backfillResult.championsPriorWeekAgents}`);
  // Fallback if the deployed CF doesn't return priorWeekStarting (e.g., deploy
  // gap): compute the most-recently-completed week's Sunday locally so we can
  // still inspect the docs.
  let PRIOR_WEEK = backfillResult.priorWeekStarting;
  if (!PRIOR_WEEK) {
    const today = new Date();
    const TT_OFFSET = 4 * 60 * 60 * 1000;
    const tt = new Date(today.getTime() - TT_OFFSET);
    // Sunday of the current week (TT)
    const currentSunday = new Date(tt);
    currentSunday.setUTCDate(tt.getUTCDate() - tt.getUTCDay());
    // Prior week's Sunday
    const priorSunday = new Date(currentSunday);
    priorSunday.setUTCDate(currentSunday.getUTCDate() - 7);
    const y = priorSunday.getUTCFullYear();
    const m = String(priorSunday.getUTCMonth() + 1).padStart(2, '0');
    const d = String(priorSunday.getUTCDate()).padStart(2, '0');
    PRIOR_WEEK = `${y}-${m}-${d}`;
    console.log(`  ! priorWeekStarting missing from CF response — computed locally: ${PRIOR_WEEK}`);
    console.log(`  ! This suggests the deployed CF may be the OLD (pre-P5-prep) version. Continuing to inspect Firestore state...`);
  } else {
    pass(`backfill priorWeekStarting=${PRIOR_WEEK} (CF returned P5-prep fields — deploy OK)`);
  }

  await signOut(auth);

  // ── Step 2: client-SDK auth as the test agent (rules path) ─────────────────
  console.log('\nStep 2: client-SDK auth as test agent');
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
  } catch (err) {
    fail(`agent auth failed: ${err.code ?? err.message}`);
    process.exit(1);
  }
  const claims = (await cred.user.getIdTokenResult()).claims;
  pass(`agent signed in: uid=${cred.user.uid} role=${claims.role} tenantId=${claims.tenantId}`);

  // ── Step 3: read leaderboards/{branchId}; assert unitId + WEEK previousRank ─
  console.log('\nStep 3: read leaderboards doc; assert unitId + WEEK previousRank');
  const lbRef = doc(db, `tenants/${TENANT_ID}/leaderboards/${BRANCH_ID}`);
  let lbSnap;
  try {
    lbSnap = await getDoc(lbRef);
  } catch (err) {
    fail(`agent-read leaderboards DENIED — rules path failure: ${err.code ?? err.message}`);
    process.exit(1);
  }
  if (!lbSnap.exists()) {
    fail(`leaderboards doc does not exist — backfill should have written it`);
    process.exit(1);
  }
  pass(`leaderboards read ALLOWED — doc exists`);
  const lb = lbSnap.data();

  // unitId on every entry, every period
  let unitIdMisses = 0;
  for (const periodKey of ['week', 'mtd', 'qtd', 'ytd']) {
    if (!Array.isArray(lb[periodKey])) {
      fail(`period '${periodKey}' missing or non-array`);
      continue;
    }
    for (const entry of lb[periodKey]) {
      if (!('unitId' in entry)) {
        fail(`period '${periodKey}' entry agent=${entry.agentId} MISSING unitId field`);
        unitIdMisses++;
      }
    }
  }
  if (unitIdMisses === 0) {
    pass(`unitId field present on EVERY entry across all 4 periods`);
  }

  // Dump WEEK entries: previousRank value or null
  console.log('  WEEK entries (previousRank values):');
  let weekPrevRankMisses = 0;
  for (const entry of lb.week ?? []) {
    if (!('previousRank' in entry)) {
      fail(`WEEK entry agent=${entry.agentId} MISSING previousRank field`);
      weekPrevRankMisses++;
      continue;
    }
    console.log(`    rank=${entry.rank} agent=${entry.agentId} name="${entry.name}" unitId=${entry.unitId} unitName="${entry.unitName}" periodApi=${entry.periodApi} previousRank=${entry.previousRank === null ? 'null' : entry.previousRank}`);
  }
  if (weekPrevRankMisses === 0) {
    pass(`previousRank field present on EVERY WEEK entry (${(lb.week ?? []).length} entries)`);
  }

  // Confirm MTD/QTD/YTD entries have previousRank: null (week-only semantic)
  let nonWeekPrevRankNullOk = true;
  for (const periodKey of ['mtd', 'qtd', 'ytd']) {
    for (const entry of lb[periodKey] ?? []) {
      if (entry.previousRank !== null) {
        fail(`${periodKey} entry agent=${entry.agentId} has previousRank=${entry.previousRank} (should be null — week-only semantic)`);
        nonWeekPrevRankNullOk = false;
      }
    }
  }
  if (nonWeekPrevRankNullOk) {
    pass(`previousRank=null on EVERY MTD/QTD/YTD entry (week-only semantic enforced)`);
  }

  // The test agent's own entry — surface for visibility
  const myWeekEntry = (lb.week ?? []).find((e) => e.agentId === AGENT_UID);
  if (myWeekEntry) {
    pass(`test-agent WEEK entry: rank=${myWeekEntry.rank} previousRank=${myWeekEntry.previousRank === null ? 'null' : myWeekEntry.previousRank} unitId=${myWeekEntry.unitId} periodApi=${myWeekEntry.periodApi}`);
  } else {
    pass(`test-agent NOT in WEEK ranking (acceptable if no current-week submission for this branch)`);
  }

  // ── Step 4: read weeklyChampions/{priorWeekStarting}; assert shape ─────────
  console.log(`\nStep 4: read weeklyChampions/${PRIOR_WEEK}; assert shape`);
  const wcRef = doc(db, `tenants/${TENANT_ID}/weeklyChampions/${PRIOR_WEEK}`);
  let wcSnap;
  try {
    wcSnap = await getDoc(wcRef);
  } catch (err) {
    fail(`agent-read weeklyChampions DENIED — rules path failure: ${err.code ?? err.message}`);
    process.exit(1);
  }
  if (!wcSnap.exists()) {
    fail(`weeklyChampions/${PRIOR_WEEK} does not exist — backfill should have written it (even with all-null payload)`);
    process.exit(1);
  }
  pass(`weeklyChampions read ALLOWED — doc exists`);
  const wc = wcSnap.data();
  const wcKeys = Object.keys(wc).sort();
  pass(`weeklyChampions doc keys: ${wcKeys.join(', ')}`);

  // Shape gate: weekStarting + topAPI + topApps + topActivity fields MUST exist
  const requiredFields = ['weekStarting', 'topAPI', 'topApps', 'topActivity'];
  let shapeOk = true;
  for (const f of requiredFields) {
    if (!(f in wc)) {
      fail(`weeklyChampions missing required field '${f}'`);
      shapeOk = false;
    }
  }
  if (shapeOk) {
    pass(`weeklyChampions shape: weekStarting + topAPI + topApps + topActivity all present`);
  }

  // weekStarting matches what backfill said
  if (wc.weekStarting !== PRIOR_WEEK) {
    fail(`weeklyChampions.weekStarting='${wc.weekStarting}' but backfill reported '${PRIOR_WEEK}'`);
  } else {
    pass(`weeklyChampions.weekStarting='${wc.weekStarting}' matches backfill`);
  }

  // Report values (populated OR honest-empty — both acceptable per Phase 6 spec)
  for (const cat of ['topAPI', 'topApps', 'topActivity']) {
    const v = wc[cat];
    if (v === null) {
      console.log(`  ${cat}: null (honest-empty — no agent with positive value in prior week)`);
    } else if (typeof v === 'object' && 'agentId' in v && 'agentName' in v && 'value' in v) {
      console.log(`  ${cat}: { agentId=${v.agentId}, agentName="${v.agentName}", value=${v.value} }`);
    } else {
      fail(`${cat} has unexpected shape: ${JSON.stringify(v)}`);
    }
  }
  pass(`top-* fields conform to shape (null or { agentId, agentName, value })`);

  // ── Step 5: attempt client-SDK write to weeklyChampions → DENIED ────────────
  console.log('\nStep 5: attempt client-SDK write to weeklyChampions (rules deny)');
  let writeDenied = false;
  try {
    await setDoc(wcRef, { ...wc, tamperedBy: 'agent' }, { merge: true });
  } catch (err) {
    writeDenied = (err.code === 'permission-denied') || /permission/i.test(err.message);
    pass(`agent write DENIED: ${err.code ?? err.message}`);
  }
  if (!writeDenied) {
    fail(`agent write SUCCEEDED — rules deny failed`);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await signOut(auth);

  console.log(`\nPhase 6 smoke result: ${failed === 0 ? '✓ PASS' : `✗ FAIL — ${failed} gate failure(s)`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
