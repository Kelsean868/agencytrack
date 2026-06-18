/**
 * daily-capture-v2-1a-schema-smoke.mjs
 *
 * Phase 3 smoke for Daily Capture v2 Phase 1a (schema extension).
 * No UI yet — smoke uses the Firebase Web SDK in Node to:
 *   1. Sign in as the A11Y agent.
 *   2. Write a dailyActivity doc with ALL 13 new v2-1a fields populated.
 *   3. Read it back via getDoc (passes through real Firestore rules).
 *   4. Assert every new field persisted with the correct value.
 *   5. Regression: assert existing fields are unaffected.
 *   6. Clean up (delete the test doc).
 *
 * No aggregation assertions — that is Phase 1b.
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
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { getSundayOf, normalizeDailyEntry } from '../../src/lib/schema/dailyActivity.js';

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

function assertField(doc, key, expected, label) {
  const actual = key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], doc) : doc[key];
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass(`field:${label ?? key}`, `${JSON.stringify(actual)}`);
  } else {
    fail(`field:${label ?? key}`, `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const RUN_TS = new Date().toISOString().slice(0, 19);
  console.log(`\n=== daily-capture-v2-1a-schema-smoke ${RUN_TS} ===`);

  const fb = initializeApp({
    apiKey:            E.VITE_FIREBASE_API_KEY,
    authDomain:        E.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         E.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     E.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: E.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             E.VITE_FIREBASE_APP_ID,
  }, 'dcv2-1a-schema-smoke');
  const auth = getAuth(fb);
  const db   = getFirestore(fb);

  const TEST_DATE = '2026-06-13'; // Friday in a recent week; will be cleaned up
  let uid = null;
  let tenantId = null;
  let docRef = null;

  try {
    // ── 1. Sign in ──────────────────────────────────────────────────────────
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = cred.user.uid;
    const tok = await cred.user.getIdTokenResult(true);
    tenantId = tok.claims?.tenantId ?? null;
    if (!tenantId) throw new Error('tenantId missing from claims — A11Y agent not set up');
    pass('sdk-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    docRef = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${TEST_DATE}`);

    // ── 2. Write doc with all 13 new v2-1a fields + representative existing fields
    const testPayload = {
      // identity / meta
      version: 1,
      weeklyReportVersion: 2,
      date: TEST_DATE,
      weekStarting: getSundayOf(TEST_DATE),
      agentId: uid,
      agentName: 'Schema Smoke Agent',
      // ── NEW v2-1a fields ─────────────────────────────────────────────
      prospectingLettersSent: 3,
      seminarsConducted: 1,
      dials: 42,
      telContacts: 10,
      f2fAttempts: 5,
      socialPostsTotal: 4,
      socialEngagementTotal: 28,
      socialInboxEnquiries: 7,
      namesFromSocial: 2,
      socialPlatformBreakdown: { facebook: 10, instagram: 8, whatsapp: 6, linkedin: 4 },
      livesSold: 2,
      policiesDelivered: 1,
      officeHours: 4.5,
      fieldHours: 3.5,
      // ── EXISTING fields (regression) ─────────────────────────────────
      qualifiedApproaches: 8,
      appointmentsSet: 3,
      ffiConducted: 2,
      ciConducted: 1,
      newBusiness:  { apps: 1, api: 5000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0 },
      newNamesAdded: 4,
      oldNamesWorked: 2,
      serviceContacts: 1,
      hoursWorked: null,
      wins: '',
      blockers: '',
      notes: '',
      isCatchUp: false,
      catchUpStartDate: null,
      catchUpEndDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, testPayload);
    pass('write-new-fields-doc', `tenants/${tenantId}/users/${uid}/dailyActivity/${TEST_DATE}`);

    // ── 3. Read back via getDoc (real Firestore rules) ──────────────────────
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      fail('doc-exists', 'doc not found after write');
      return;
    }
    const saved = snap.data();
    pass('doc-read-back', `${Object.keys(saved).length} fields`);

    // ── 4. Assert each new v2-1a field ──────────────────────────────────────
    console.log('\n  — new field assertions —');
    assertField(saved, 'prospectingLettersSent', 3);
    assertField(saved, 'seminarsConducted',      1);
    assertField(saved, 'dials',                 42);
    assertField(saved, 'telContacts',           10);
    assertField(saved, 'f2fAttempts',            5);
    assertField(saved, 'socialPostsTotal',       4);
    assertField(saved, 'socialEngagementTotal', 28);
    assertField(saved, 'socialInboxEnquiries',   7);
    assertField(saved, 'namesFromSocial',        2);
    assertField(saved, 'socialPlatformBreakdown',
      { facebook: 10, instagram: 8, whatsapp: 6, linkedin: 4 });
    assertField(saved, 'livesSold',   2);
    assertField(saved, 'policiesDelivered', 1);
    assertField(saved, 'officeHours', 4.5);
    assertField(saved, 'fieldHours',  3.5);

    // ── 5. Regression: existing fields unaffected ───────────────────────────
    console.log('\n  — regression assertions —');
    assertField(saved, 'qualifiedApproaches', 8);
    assertField(saved, 'appointmentsSet',     3);
    assertField(saved, 'ffiConducted',        2);
    assertField(saved, 'ciConducted',         1);
    assertField(saved, 'newBusiness',  { apps: 1, api: 5000 });
    assertField(saved, 'newNamesAdded',       4);
    assertField(saved, 'serviceContacts',     1);

    // ── 6. normalizeDailyEntry round-trip ───────────────────────────────────
    console.log('\n  — normalizeDailyEntry round-trip —');
    const normed = normalizeDailyEntry(saved);
    const roundTripOk = (
      normed.dials        === 42  &&
      normed.telContacts  === 10  &&
      normed.officeHours  === 4.5 &&
      normed.fieldHours   === 3.5 &&
      normed.livesSold    === 2   &&
      normed.socialPlatformBreakdown?.facebook === 10
    );
    if (roundTripOk) pass('normalize-round-trip', 'dials/telContacts/hours/social correct');
    else fail('normalize-round-trip', JSON.stringify({
      dials: normed.dials, telContacts: normed.telContacts,
      officeHours: normed.officeHours, fieldHours: normed.fieldHours,
    }));

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 300));
  } finally {
    // Cleanup
    if (docRef) {
      try {
        await deleteDoc(docRef);
        pass('cleanup', `deleted ${TEST_DATE}`);
      } catch (e) {
        fail('cleanup', String(e?.message ?? e).slice(0, 120));
      }
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
