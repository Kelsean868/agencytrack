/**
 * Current-week draft readiness check (read-only by default).
 *
 * Tomorrow's (Sun 2026-06-21 TT) daytime confirm walk shows the week that just
 * completed: Sun 2026-06-14 – Sat 2026-06-20 → weekStarting '2026-06-14'. After
 * the #701 rules fix, client-side aggregation builds that draft — but only for
 * dailies saved AFTER the deploy. If the agent's Fri/Sat dailies were logged
 * pre-deploy, aggregateCurrentWeekDaily threw at the getDoc and the weekly draft
 * was never built → it would still be empty now.
 *
 * This signs in as the WALK's agent (A11Y_AGENT_EMAIL — the account the
 * exploration walk authenticates as) and reports, read-only:
 *   - how many daily entries exist for the current week
 *   - whether the weekly submission doc exists, its status, and whether its
 *     aggregated fields are populated (non-zero)
 *
 * Run: node --env-file=.env.local scripts/verification/current-week-draft-readiness.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, collection, query, where, getDocs,
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
const WEEK   = '2026-06-14'; // Sunday of the current TT week (Jun 14–20)

// Fields that indicate a real aggregated rollup (any non-zero ⇒ populated).
const SIGNAL_FIELDS = [
  'coldCalls', 'apiSold', 'applicationsSold', 'api', 'apps', 'telContacts',
  'referrals', 'closingInterviews', 'factFindingInterviews', 'seen', 'sales',
];

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
  const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
  const uid = cred.user.uid;
  console.log(`[readiness] signed in as ${EMAIL}`);
  console.log(`[readiness] uid=${uid}  tenant=${TENANT}  week=${WEEK}`);

  // 1) Dailies for the current week.
  const dailySnap = await getDocs(query(
    collection(db, `tenants/${TENANT}/users/${uid}/dailyActivity`),
    where('weekStarting', '==', WEEK),
  ));
  console.log(`\n[dailies] ${dailySnap.size} entr${dailySnap.size === 1 ? 'y' : 'ies'} for week ${WEEK}`);
  dailySnap.docs.forEach((d) => {
    const x = d.data();
    const nonZero = SIGNAL_FIELDS.filter((f) => Number(x[f]) > 0).map((f) => `${f}=${x[f]}`);
    console.log(`  - ${d.id}: ${nonZero.length ? nonZero.join(' ') : '(all-zero / no signal fields)'}`);
  });

  // 2) Weekly submission draft for the current week.
  const subRef = doc(db, `tenants/${TENANT}/submissions/${uid}_${WEEK}`);
  let subSnap;
  try {
    subSnap = await getDoc(subRef);
  } catch (e) {
    console.log(`\n[draft] getDoc threw: code=${e?.code} — (if permission-denied, the rules fix is NOT live for this path)`);
    process.exit(2);
  }

  console.log(`\n[draft] submissions/${uid}_${WEEK}`);
  if (!subSnap.exists()) {
    console.log('  EXISTS: NO — weekly draft has NOT been built for the current week.');
    console.log('\n========== READINESS VERDICT ==========');
    console.log('NOT READY — no current-week draft. Tomorrow\'s confirm view would be EMPTY.');
    console.log('ACTION: re-save a current-week daily via the app (DCv2) so aggregateCurrentWeekDaily rebuilds it.');
    console.log('=======================================');
    process.exit(0);
  }

  const data = subSnap.data();
  const status = data.status ?? '(none)';
  const populated = SIGNAL_FIELDS.filter((f) => Number(data[f]) > 0).map((f) => `${f}=${data[f]}`);
  console.log(`  EXISTS: YES  status=${status}`);
  console.log(`  populated signal fields: ${populated.length ? populated.join(' ') : '(NONE — all zero)'}`);

  console.log('\n========== READINESS VERDICT ==========');
  if (populated.length > 0) {
    console.log(`READY — current-week draft exists (status=${status}) and is populated. Tomorrow's confirm view will show real data.`);
  } else {
    console.log(`NOT READY — draft exists (status=${status}) but all aggregated fields are zero. Tomorrow's confirm view would look empty.`);
    console.log('ACTION: re-save a current-week daily via the app (DCv2) so aggregateCurrentWeekDaily repopulates it.');
  }
  console.log('=======================================');
  process.exit(0);
})().catch((e) => { console.error('[readiness] fatal', e?.code, e?.message); process.exit(1); });
