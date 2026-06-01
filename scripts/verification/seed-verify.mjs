/**
 * One-shot verification harness for the seed-leaderboard-test-data live run.
 *
 * Sequence:
 *   1. Auth as tenant_admin → invoke recomputeLeaderboardOnDemand.
 *   2. Read tenants/tatillife_south/leaderboards/tatil_south — assert populated
 *      current-week podium AND real ▲/▼ across the prior week's previousRank
 *      vs current week's rank.
 *   3. Read tenants/tatillife_south/weeklyChampions/{priorWeekStarting} —
 *      assert non-null topAPI / topApps / topActivity.
 *   4. Read back each of the 12 seeded submission docs — assert
 *      seededTestData:true.
 *   5. Print the cleanup query result count (the deterministic-ID cleanup
 *      candidates) — proves the runbook's cleanup deletes EXACTLY these 12.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

const TENANT_ID = 'tatillife_south';
const BRANCH_ID = 'tatil_south';
const PRIOR_WK   = '2026-05-24';
const CURRENT_WK = '2026-05-31';

const TA_EMAIL = process.env.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASS  = process.env.A11Y_TENANT_ADMIN_PASSWORD;
if (!TA_EMAIL || !TA_PASS) { console.error('Missing A11Y_TENANT_ADMIN_*'); process.exit(1); }

const SEEDED_UIDS = [
  'SIdMIRqVTYbOIE8zuCnIXliywU93', // Kegan
  'J0j4uBqzTPcfm1IlGCPyDzo27RP2', // Kelsean (test agent)
  '6AUDnVBcdmM9pj8g6ZyIi1j1i0r2', // Letitia
  '41QngAdnslddnvSsa3dzydJLoU33', // PR-D
  '5P00quqxhrPbvfjV2wMBNr1hURJ3', // PR4b
  'C94hjdd6GXfdim9EfgPYAAIbDOJ2', // Test Agent (ranked-$0)
];
const SEEDED_DOC_IDS = SEEDED_UIDS.flatMap((uid) => [
  `${uid}_${PRIOR_WK}`,
  `${uid}_${CURRENT_WK}`,
]);

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

let failures = 0;
const ok   = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };

(async () => {
  console.log('\n=== seed verification (live) ===\n');

  // Step 1 — recompute as TA
  console.log('Step 1: TA → recomputeLeaderboardOnDemand');
  await signInWithEmailAndPassword(auth, TA_EMAIL, TA_PASS);
  ok('TA signed in');
  const recompute = httpsCallable(fns, 'recomputeLeaderboardOnDemand');
  const res = await recompute({});
  console.log(`  · response: ${JSON.stringify(res.data)}`);
  ok(`recompute ok=${res.data.ok} branches=${res.data.branchCount} totalSubs=${res.data.totalSubmissions} priorWeekStarting=${res.data.priorWeekStarting}`);
  if (res.data.priorWeekStarting !== PRIOR_WK) {
    fail(`priorWeekStarting from CF (${res.data.priorWeekStarting}) != script PRIOR_WK (${PRIOR_WK}) — TT-clock drift?`);
  }

  // Step 2 — read leaderboards/tatil_south, assert populated podium + real ▲/▼
  console.log('\nStep 2: read leaderboards/tatil_south');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, TA_EMAIL, TA_PASS); // TA reads as TA
  const lbSnap = await getDoc(doc(db, `tenants/${TENANT_ID}/leaderboards/${BRANCH_ID}`));
  if (!lbSnap.exists()) { fail('leaderboards/tatil_south does NOT exist'); process.exit(1); }
  const lb = lbSnap.data();
  ok('leaderboards/tatil_south doc exists');

  const week = lb.week ?? [];
  console.log(`  · WEEK entries (rank, agentId, name, periodApi, previousRank):`);
  for (const e of week.slice(0, 8)) {
    console.log(`    rank=${e.rank} ${e.agentId} "${e.name}" periodApi=${e.periodApi} previousRank=${e.previousRank}`);
  }

  // Assert populated podium
  const rank1 = week[0];
  if (!rank1 || rank1.periodApi <= 0) { fail(`rank-1 has periodApi=${rank1?.periodApi} — podium NOT populated`); }
  else { ok(`current-week podium populated: rank 1 = "${rank1.name}" @ ${rank1.periodApi} API`); }

  // Assert real ▲/▼ — at least one entry where previousRank ≠ rank with a real delta
  const movers = week.filter((e) => e.previousRank != null && e.previousRank !== e.rank);
  if (movers.length < 2) { fail(`only ${movers.length} agent(s) show movement; expected ≥4 (▲2/▲2/▼2/▼2)`); }
  else {
    ok(`${movers.length} agent(s) show real movement vs prior week:`);
    for (const m of movers) {
      const delta = m.previousRank - m.rank;
      const symbol = delta > 0 ? `▲${delta}` : `▼${-delta}`;
      console.log(`    "${m.name}": prev=${m.previousRank} → curr=${m.rank} (${symbol})`);
    }
  }

  // Step 3 — weeklyChampions/{priorWeekStarting}
  console.log(`\nStep 3: read weeklyChampions/${PRIOR_WK}`);
  const champSnap = await getDoc(doc(db, `tenants/${TENANT_ID}/weeklyChampions/${PRIOR_WK}`));
  if (!champSnap.exists()) { fail(`weeklyChampions/${PRIOR_WK} does not exist`); }
  else {
    const champ = champSnap.data();
    ok(`weeklyChampions/${PRIOR_WK} exists`);
    console.log(`  · topAPI:      ${champ.topAPI      ? `{ ${champ.topAPI.agentName} : ${champ.topAPI.value} }`      : 'null'}`);
    console.log(`  · topApps:     ${champ.topApps     ? `{ ${champ.topApps.agentName} : ${champ.topApps.value} }`     : 'null'}`);
    console.log(`  · topActivity: ${champ.topActivity ? `{ ${champ.topActivity.agentName} : ${champ.topActivity.value} }` : 'null'}`);
    if (!champ.topAPI || !champ.topApps || !champ.topActivity) {
      fail('one or more top-* is null (champions doc should be FULLY populated now)');
    } else {
      ok('topAPI / topApps / topActivity all NON-NULL');
    }
  }

  // Step 4 — read back each of the 12 seeded submission docs; assert seededTestData:true
  console.log('\nStep 4: read back 12 seeded submission docs');
  let foundSeeded = 0;
  for (const id of SEEDED_DOC_IDS) {
    const subSnap = await getDoc(doc(db, `tenants/${TENANT_ID}/submissions/${id}`));
    if (!subSnap.exists()) { fail(`submission ${id} does not exist`); continue; }
    const data = subSnap.data();
    if (data.seededTestData !== true) { fail(`submission ${id} missing seededTestData:true (got ${JSON.stringify(data.seededTestData)})`); continue; }
    foundSeeded++;
  }
  if (foundSeeded === SEEDED_DOC_IDS.length) {
    ok(`all ${foundSeeded}/${SEEDED_DOC_IDS.length} seeded submission docs exist + carry seededTestData:true`);
  } else {
    fail(`only ${foundSeeded}/${SEEDED_DOC_IDS.length} seeded docs verified`);
  }

  // Step 5 — confirm runbook cleanup would delete EXACTLY these 12
  console.log('\nStep 5: cleanup query — seededTestData == true on submissions');
  const seededQ = query(
    collection(db, `tenants/${TENANT_ID}/submissions`),
    where('seededTestData', '==', true)
  );
  const seededSnap = await getDocs(seededQ);
  const ids = seededSnap.docs.map((d) => d.id).sort();
  const expected = [...SEEDED_DOC_IDS].sort();
  console.log(`  · seededTestData == true count: ${ids.length}`);
  if (ids.length !== SEEDED_DOC_IDS.length) {
    fail(`cleanup count ${ids.length} != expected ${SEEDED_DOC_IDS.length}`);
  } else if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    fail(`cleanup query ids do not match SEEDED_DOC_IDS exactly`);
  } else {
    ok(`cleanup query matches EXACTLY the 12 seeded doc IDs`);
  }

  await signOut(auth);

  console.log(`\n=== seed verification: ${failures === 0 ? '✓ PASS' : `✗ FAIL — ${failures} gate(s)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => { console.error('Unhandled:', err); process.exit(1); });
