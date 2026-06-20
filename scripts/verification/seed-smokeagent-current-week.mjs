/**
 * Seed the smokeagent's current-week dailies via the CLIENT path (test tenant).
 *
 * Tomorrow's (Sun 2026-06-21 TT) daytime Sunday-confirm walk shows the week that
 * just completed (Sun 2026-06-14 – Sat 2026-06-20 → weekStarting '2026-06-14').
 * The smokeagent (A11Y_AGENT_EMAIL, tatillife_smoke, hybrid mode) has no dailies
 * for that week, so the weekly draft is empty.
 *
 * This faithfully replicates the real DCv2 hot path AS THE AGENT (client SDK,
 * subject to rules — NOT Admin SDK):
 *   saveDailyEntry()  → users/{uid}/dailyActivity/{date}
 *   aggregateCurrentWeekDaily():
 *     getDailyEntriesForWeek → aggregateDailyToWeekly (REAL helper) →
 *     getDoc(submission)  ← #701 client-rule path, end-to-end re-confirm →
 *     setDoc(draft, {merge:true})  ← agent update rule (branchId == token.branchId)
 *
 * Uses the production aggregator so the rollup is byte-for-byte what a real
 * agent's save would produce (incl. aggregatedFromDaily:true).
 *
 * Run: node --env-file=.env.local scripts/verification/seed-smokeagent-current-week.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

// REAL production helpers (firebase-free pure modules).
import { aggregateDailyToWeekly } from '../../src/lib/schema/dailyActivity.aggregator.js';
import { getSundayOf } from '../../src/lib/schema/dailyActivity.js';
import { getTodayTT } from '../../src/utils/dateInputs.js';

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

const EXPECTED_WEEK = '2026-06-14'; // safety guard — current TT week's Sunday

// Minimal nonzero activity (a few dials, an appointment, an FFI), across 2 days.
const DAILIES = [
  { date: '2026-06-18', entry: { dials: 8,  telContacts: 4, appointmentsSet: 1, ffiConducted: 1 } },
  { date: '2026-06-19', entry: { dials: 5,  telContacts: 3, qualifiedApproaches: 2, ffiConducted: 1 } },
];

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

// Faithful saveDailyEntry (src/services/dailyActivityService.js).
async function saveDailyEntry(uid, agentName, date, entry) {
  const ref = doc(db, `tenants/${TENANT}/users/${uid}/dailyActivity/${date}`);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...entry,
    date,
    weekStarting: getSundayOf(date),
    agentId: uid,
    agentName,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

// Faithful aggregateCurrentWeekDaily (src/services/loggingModeService.js).
async function aggregateCurrentWeekDaily(uid, agentName, commissionRate, unitId, branchId) {
  const weekStarting = getSundayOf(getTodayTT());
  const snap = await getDocs(query(
    collection(db, `tenants/${TENANT}/users/${uid}/dailyActivity`),
    where('weekStarting', '==', weekStarting),
  ));
  const dailies = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (dailies.length === 0) return { aggregated: false, count: 0, weekStarting };

  const rollup = aggregateDailyToWeekly(dailies, commissionRate);
  const ref = doc(db, `tenants/${TENANT}/submissions/${uid}_${weekStarting}`);
  const existing = await getDoc(ref); // ← #701 client-rule path (was permission-denied for absent docs)
  if (existing.exists() && existing.data().status === 'submitted') {
    return { aggregated: false, count: dailies.length, weekStarting, alreadySubmitted: true };
  }
  await setDoc(ref, {
    ...rollup,
    userId: uid, agentId: uid, agentName, unitId, branchId, weekStarting,
    status: 'draft',
    aggregatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { aggregated: true, count: dailies.length, weekStarting };
}

(async () => {
  const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
  const uid = cred.user.uid;
  const tok = await cred.user.getIdTokenResult();
  const branchId = tok.claims.branchId;
  const userSnap = await getDoc(doc(db, `tenants/${TENANT}/users/${uid}`));
  const u = userSnap.data() || {};
  const agentName = u.name || 'Smoke Agent';
  const unitId = u.unitId ?? null;
  const commissionRate = u.commissionRate ?? 0;

  console.log(`[seed] ${EMAIL} uid=${uid} tenant=${TENANT}`);
  console.log(`[seed] branchId(claim)=${branchId} unitId=${unitId} commissionRate=${commissionRate}`);

  const week = getSundayOf(getTodayTT());
  console.log(`[seed] current TT week = ${week}`);
  if (week !== EXPECTED_WEEK) {
    console.error(`[seed] ABORT — computed week ${week} != expected ${EXPECTED_WEEK}. Re-check the date before seeding.`);
    process.exit(2);
  }

  // 1) Save dailies (client path).
  for (const { date, entry } of DAILIES) {
    await saveDailyEntry(uid, agentName, date, entry);
    console.log(`[seed] saveDailyEntry ${date}: ${JSON.stringify(entry)}`);
  }

  // 2) Aggregate (client path — exercises #701).
  const res = await aggregateCurrentWeekDaily(uid, agentName, commissionRate, unitId, branchId);
  console.log(`[seed] aggregateCurrentWeekDaily: ${JSON.stringify(res)}`);

  // 3) Re-read the draft and confirm populated + aggregatedFromDaily.
  const draft = (await getDoc(doc(db, `tenants/${TENANT}/submissions/${uid}_${week}`))).data() || {};
  const signals = ['dials', 'telContacts', 'appointmentsSet', 'ffiConducted', 'qualifiedApproaches', 'api', 'apps']
    .filter((f) => Number(draft[f]) > 0).map((f) => `${f}=${draft[f]}`);
  console.log('\n========== DRAFT STATE (post-seed) ==========');
  console.log(`status: ${draft.status}`);
  console.log(`aggregatedFromDaily: ${draft.aggregatedFromDaily}`);
  console.log(`populated signal fields: ${signals.length ? signals.join(' ') : '(NONE)'}`);
  const ok = draft.status === 'draft' && draft.aggregatedFromDaily === true && signals.length > 0;
  console.log(`VERDICT: ${ok ? 'READY — current-week draft populated via client aggregation' : 'NOT READY — see above'}`);
  console.log('=============================================');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('[seed] fatal', e?.code, e?.message); process.exit(1); });
