/**
 * daily-capture-v2-1b-aggregator-smoke.mjs
 *
 * Phase 3 smoke for Daily Capture v2 Phase 1b (aggregator extension).
 * No UI — pure Firebase Web SDK in Node to:
 *   1. Sign in as the A11Y agent.
 *   2. Write 2 daily docs for this week with well-known v2-1b field values.
 *   3. Run aggregateDailyToWeekly (the ESM aggregator) on those docs.
 *   4. Write the rollup to the weekly submissions path (replicating aggregateCurrentWeekDaily).
 *   5. Read back the submission draft and assert each new field summed correctly.
 *   6. Re-run the aggregation (idempotency: same docs → same sums, merge:true is safe).
 *   7. Clean up (delete daily docs + the draft submission).
 */

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { getSundayOf } from '../../src/lib/schema/dailyActivity.js';
import { aggregateDailyToWeekly } from '../../src/lib/schema/dailyActivity.aggregator.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };

function assertVal(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass(label, String(actual));
  else fail(label, `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

// Compute current-week Sunday (TT-safe: UTC-4 offset)
function currentSunday() {
  const nowUTC = new Date();
  // Shift to TT (UTC-4)
  const ttMs = nowUTC.getTime() - 4 * 3600 * 1000;
  const tt = new Date(ttMs);
  const dow = tt.getUTCDay(); // 0=Sun
  const sunMs = ttMs - dow * 86400000;
  const sun = new Date(sunMs);
  const y = sun.getUTCFullYear();
  const m = String(sun.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sun.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Build a YYYY-MM-DD offset N days from a Sunday string
function addDays(sunday, n) {
  const [y, mo, d] = sunday.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

async function main() {
  const RUN_TS = new Date().toISOString().slice(0, 19);
  console.log(`\n=== daily-capture-v2-1b-aggregator-smoke ${RUN_TS} ===`);

  const fb = initializeApp({
    apiKey:            E.VITE_FIREBASE_API_KEY,
    authDomain:        E.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         E.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     E.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: E.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             E.VITE_FIREBASE_APP_ID,
  }, 'dcv2-1b-aggregator-smoke');
  const auth = getAuth(fb);
  const db   = getFirestore(fb);

  const WEEK_START = currentSunday();
  const DAY1 = addDays(WEEK_START, 1); // Monday
  const DAY2 = addDays(WEEK_START, 2); // Tuesday

  let uid = null;
  let tenantId = null;
  const dayRefs = [];
  let subRef = null;

  try {
    // ── 1. Sign in ──────────────────────────────────────────────────────────
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = cred.user.uid;
    const tok = await cred.user.getIdTokenResult(true);
    tenantId = tok.claims?.tenantId ?? null;
    const branchId = tok.claims?.branchId ?? null;
    const unitId   = tok.claims?.unitId   ?? null;
    if (!tenantId) throw new Error('tenantId missing from claims — A11Y agent not set up');
    pass('sdk-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}… week=${WEEK_START}`);

    subRef = doc(db, `tenants/${tenantId}/submissions/${uid}_${WEEK_START}`);

    // ── 2. Write 2 daily docs with well-known values ──────────────────────
    // Day 1: Mon
    const day1Payload = {
      version: 1, weeklyReportVersion: 2,
      date: DAY1, weekStarting: WEEK_START,
      agentId: uid, agentName: 'Aggregator Smoke Agent',
      // v2-1a daily fields
      prospectingLettersSent: 2, seminarsConducted: 1,
      dials: 15, telContacts: 5,
      f2fAttempts: 3,
      socialPostsTotal: 2, socialEngagementTotal: 10, socialInboxEnquiries: 3, namesFromSocial: 1,
      socialPlatformBreakdown: { facebook: 4, instagram: 3, whatsapp: 2, linkedin: 1 },
      livesSold: 1, policiesDelivered: 0,
      officeHours: 4.0, fieldHours: 2.5,
      // existing fields
      qualifiedApproaches: 4, appointmentsSet: 2, ffiConducted: 1, ciConducted: 1,
      newBusiness: { apps: 1, api: 5000 }, pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums: { grossAmount: 0 }, newNamesAdded: 3,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    // Day 2: Tue
    const day2Payload = {
      version: 1, weeklyReportVersion: 2,
      date: DAY2, weekStarting: WEEK_START,
      agentId: uid, agentName: 'Aggregator Smoke Agent',
      prospectingLettersSent: 1, seminarsConducted: 0,
      dials: 10, telContacts: 4,
      f2fAttempts: 2,
      socialPostsTotal: 1, socialEngagementTotal: 5, socialInboxEnquiries: 1, namesFromSocial: 0,
      socialPlatformBreakdown: { facebook: 2, instagram: 1, whatsapp: 1, linkedin: 1 },
      livesSold: 0, policiesDelivered: 1,
      officeHours: 3.5, fieldHours: 1.5,
      qualifiedApproaches: 3, appointmentsSet: 1, ffiConducted: 2, ciConducted: 0,
      newBusiness: { apps: 0, api: 0 }, pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums: { grossAmount: 0 }, newNamesAdded: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };

    const ref1 = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${DAY1}`);
    const ref2 = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${DAY2}`);
    dayRefs.push(ref1, ref2);

    await setDoc(ref1, day1Payload);
    await setDoc(ref2, day2Payload);
    pass('write-daily-docs', `${DAY1} + ${DAY2}`);

    // ── 3. Replicate aggregateCurrentWeekDaily: fetch → aggregate → write ─
    // Fetch via a direct query (mirrors getDailyEntriesForWeek)
    const dailyColl = collection(db, `tenants/${tenantId}/users/${uid}/dailyActivity`);
    const snap = await getDocs(query(dailyColl, where('weekStarting', '==', WEEK_START)));
    const dailies = snap.docs.map((d) => d.data());
    pass('fetch-daily-docs', `found ${dailies.length} for week ${WEEK_START}`);
    if (dailies.length < 2) {
      fail('daily-count', `expected ≥2, got ${dailies.length}`);
    }

    // Compute rollup using the real ESM aggregator
    const rollup = aggregateDailyToWeekly(dailies, 0);

    // Write to weekly draft (mirrors loggingModeService write; branchId required by create rule)
    const draftPayload = {
      ...rollup,
      userId: uid, agentId: uid, agentName: 'Aggregator Smoke Agent',
      unitId, branchId,
      weekStarting: WEEK_START, status: 'draft',
      aggregatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await setDoc(subRef, draftPayload, { merge: true });
    pass('write-weekly-draft', `${uid}_${WEEK_START}`);

    // ── 4. Read back and assert new field sums ─────────────────────────────
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      fail('draft-exists', 'weekly draft not found after aggregation write');
      return;
    }
    const draft = subSnap.data();
    pass('draft-read-back', `${Object.keys(draft).length} fields`);

    console.log('\n  — v2-1b new field assertions (Day1 + Day2 sums) —');
    // prospectingLettersSent: 2 + 1 = 3
    assertVal('prospectingLettersSent', draft.prospectingLettersSent, 3);
    // seminarsConducted: 1 + 0 = 1
    assertVal('seminarsConducted', draft.seminarsConducted, 1);
    // dials: 15 + 10 = 25
    assertVal('dials', draft.dials, 25);
    // telContacts: 5 + 4 = 9
    assertVal('telContacts', draft.telContacts, 9);
    // f2fAttempts: 3 + 2 = 5
    assertVal('f2fAttempts', draft.f2fAttempts, 5);
    // socialPostsTotal: 2 + 1 = 3
    assertVal('socialPostsTotal', draft.socialPostsTotal, 3);
    // socialEngagementTotal: 10 + 5 = 15
    assertVal('socialEngagementTotal', draft.socialEngagementTotal, 15);
    // socialInboxEnquiries: 3 + 1 = 4
    assertVal('socialInboxEnquiries', draft.socialInboxEnquiries, 4);
    // namesFromSocial: 1 + 0 = 1
    assertVal('namesFromSocial', draft.namesFromSocial, 1);
    // socialPlatformBreakdown sums
    assertVal('socialPlatformBreakdown.facebook',  draft.socialPlatformBreakdown?.facebook,  6);
    assertVal('socialPlatformBreakdown.instagram', draft.socialPlatformBreakdown?.instagram, 4);
    assertVal('socialPlatformBreakdown.whatsapp',  draft.socialPlatformBreakdown?.whatsapp,  3);
    assertVal('socialPlatformBreakdown.linkedin',  draft.socialPlatformBreakdown?.linkedin,  2);
    // livesSold: 1 + 0 = 1
    assertVal('livesSold', draft.livesSold, 1);
    // policiesDelivered: 0 + 1 = 1
    assertVal('policiesDelivered', draft.policiesDelivered, 1);
    // officeHours: 4.0 + 3.5 = 7.5
    assertVal('officeHours', draft.officeHours, 7.5);
    // fieldHours: 2.5 + 1.5 = 4.0
    assertVal('fieldHours', draft.fieldHours, 4.0);

    // ── 5. Idempotency: re-run the aggregation, values must not change ─────
    console.log('\n  — idempotency check (re-run aggregation) —');
    const rollup2 = aggregateDailyToWeekly(dailies, 0);
    await setDoc(
      subRef,
      { ...rollup2, userId: uid, agentId: uid, agentName: 'Aggregator Smoke Agent',
        unitId, branchId, weekStarting: WEEK_START, status: 'draft',
        aggregatedAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    );
    const sub2Snap = await getDoc(subRef);
    const draft2 = sub2Snap.data();
    // Check a sample of new fields remain the same
    const idempotent = (
      draft2.telContacts        === draft.telContacts &&
      draft2.dials              === draft.dials &&
      draft2.prospectingLettersSent === draft.prospectingLettersSent &&
      draft2.officeHours        === draft.officeHours &&
      draft2.socialPostsTotal   === draft.socialPostsTotal
    );
    if (idempotent) pass('idempotent-recompute', 'same values after second write');
    else fail('idempotent-recompute', `telContacts ${draft2.telContacts}≠${draft.telContacts} or dials ${draft2.dials}≠${draft.dials}`);

    // ── 6. Regression: existing fields present ────────────────────────────
    console.log('\n  — regression: existing aggregated fields —');
    // qualifiedApproaches: 4 + 3 = 7
    assertVal('qualifiedApproaches', draft.qualifiedApproaches, 7);
    // ffiConducted: 1 + 2 = 3
    assertVal('ffiConducted', draft.ffiConducted, 3);
    // ciConducted: 1 + 0 = 1
    assertVal('ciConducted', draft.ciConducted, 1);
    // newBusiness.apps: 1 + 0 = 1
    assertVal('newBusiness.apps', draft.newBusiness?.apps, 1);

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 400));
    console.error(err);
  } finally {
    console.log('\n  — cleanup —');
    for (const ref of dayRefs) {
      try { await deleteDoc(ref); pass('cleanup-daily', ref.id); }
      catch (e) { fail('cleanup-daily', `${ref.id}: ${String(e?.message ?? e).slice(0, 80)}`); }
    }
    // Submissions are delete-protected by rules (allow delete: if false).
    // The draft is left in Firestore — harmless for the test account and will
    // be overwritten by the next real aggregation or submission.
    if (subRef) {
      pass('cleanup-submission-skipped', 'delete blocked by rules (expected) — draft left in place');
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const ok = failed === 0;
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${failed} failed — ${ok ? 'OK ✓' : 'FAILED ✗'} ===\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err?.stack ?? err);
  process.exit(1);
});
