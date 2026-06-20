/**
 * Phase-0 blast-radius probe — does the submission allow-get denial break
 * client-side daily->weekly aggregation for a FRESH week?
 *
 * Replicates loggingModeService.aggregateCurrentWeekDaily's hot path against
 * prod (tatillife_smoke) as an AGENT (client SDK, subject to rules):
 *   1. saveDailyEntry  -> users/{uid}/dailyActivity/{date}  (fresh week)
 *   2. getDailyEntriesForWeek -> confirms dailies.length > 0
 *   3. getDoc(submissions/{uid}_{weekStarting})  <-- aggregate line 82
 *        For a fresh week this doc does NOT exist. If it throws permission-denied,
 *        the function throws BEFORE its setDoc (line 87) -> NO client-side draft.
 *   4. cleanup: delete the daily entry.
 *
 * A permission-denied at step 3 => YES, client-side aggregation is broken for
 * fresh weeks (functional, not cosmetic) — the weekly draft exists only after
 * the Sunday cron (Admin SDK) runs.
 *
 * Run: node --env-file=.env.local scripts/verification/aggregate-fresh-week-blastradius-probe.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const TENANT = process.env.A11Y_TENANT_ID;
const EMAIL  = process.env.A11Y_AGENT_EMAIL;
const PASS   = process.env.A11Y_AGENT_PASSWORD;

// A Sunday far in the future — guaranteed fresh (no draft, no daily). A daily
// logged ON a Sunday has weekStarting == that Sunday (getSundayOf(Sunday)=self).
const WEEK = '2026-07-05';
const DATE = '2026-07-05';

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
  const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
  const uid = cred.user.uid;
  console.log(`[probe] agent uid=${uid}, fresh week=${WEEK}`);

  const dailyRef = doc(db, `tenants/${TENANT}/users/${uid}/dailyActivity/${DATE}`);
  const subRef   = doc(db, `tenants/${TENANT}/submissions/${uid}_${WEEK}`);

  let brokenClientSide = null;
  try {
    // Step 1 — log a daily for the fresh week (the DCv2 hot-path trigger).
    await setDoc(dailyRef, {
      date: DATE, weekStarting: WEEK, agentId: uid, agentName: 'blastradius-probe',
      coldCalls: 3, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[probe] step1 saveDailyEntry: OK');

    // Step 2 — aggregate reads the week's dailies first.
    const snap = await getDocs(query(
      collection(db, `tenants/${TENANT}/users/${uid}/dailyActivity`),
      where('weekStarting', '==', WEEK),
    ));
    console.log(`[probe] step2 getDailyEntriesForWeek: ${snap.size} entr${snap.size === 1 ? 'y' : 'ies'} (aggregate proceeds since >0)`);

    // Step 3 — aggregate line 82: getDoc on the (non-existent) weekly submission.
    try {
      const existing = await getDoc(subRef);
      brokenClientSide = false;
      console.log(`[probe] step3 getDoc(submission): SUCCEEDED exists=${existing.exists()} -> setDoc WOULD run -> client draft builds. NOT broken.`);
    } catch (e) {
      if (e?.code === 'permission-denied') {
        brokenClientSide = true;
        console.log('[probe] step3 getDoc(submission): permission-denied ✗ -> aggregate THROWS before setDoc -> NO client-side weekly draft built.');
      } else {
        console.log(`[probe] step3 getDoc(submission): unexpected code=${e?.code} msg=${e?.message}`);
      }
    }
  } finally {
    // Cleanup — delete the daily entry (agent owns it; submissions are never
    // created here because step3 throws before setDoc, and agents can't delete
    // submissions anyway: allow delete: if false).
    try { await deleteDoc(dailyRef); console.log('[cleanup] daily entry deleted'); }
    catch (e) { console.log(`[cleanup] daily delete failed: ${e?.code}`); }
  }

  console.log('\n========== BLAST-RADIUS VERDICT ==========');
  if (brokenClientSide === true) {
    console.log('YES — client-side daily->weekly aggregation is BROKEN for a fresh week.');
    console.log('Functional (not cosmetic): weekly draft exists only after the Sunday cron.');
  } else if (brokenClientSide === false) {
    console.log('NO — getDoc on the non-existent submission succeeded; client-side aggregation is intact.');
  } else {
    console.log('INCONCLUSIVE — see step3 output above.');
  }
  console.log('==========================================');
  process.exit(0);
})().catch((e) => { console.error('[probe] fatal', e?.code, e?.message); process.exit(1); });
