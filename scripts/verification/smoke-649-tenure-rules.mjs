/**
 * smoke-649-tenure-rules.mjs
 * Live-verify for PR #649 — Firestore write-once rule for tenure fields.
 *
 * Cases (all against prod Firestore after `firebase deploy --only firestore:rules`):
 *   1. owner-set contractStartDate (from '')   → ALLOW
 *   2. change contractStartDate after set       → DENY
 *   3. bundled role write                       → DENY
 *   4. owner-set monthsAtTatil (from absent)    → ALLOW
 *   5. owner-set monthsAtTatil -1 (from absent) → DENY  (>= 0 guard)
 *
 * Run: node scripts/verification/smoke-649-tenure-rules.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require  = createRequire(import.meta.url);
const __dir    = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dir, '..', '..');
const adminPkg = join(ROOT, 'functions', 'node_modules', 'firebase-admin');
const admin    = require(adminPkg);

// ── Env ───────────────────────────────────────────────────────────────────────
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

const PROJECT_ID = 'agencytrack-2a610';
const TENANT_ID  = 'tatillife_south';

// ── Admin SDK ─────────────────────────────────────────────────────────────────
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ── Firebase Auth REST ────────────────────────────────────────────────────────
async function getIdToken(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth REST failed: HTTP ${res.status} — ${body.slice(0, 120)}`);
  }
  const data = await res.json();
  return { idToken: data.idToken, uid: data.localId };
}

// ── Firestore REST PATCH (with field mask = updateDoc semantics) ──────────────
function docRestUrl(docPath) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
}

async function updateFields(idToken, docPath, fsFields) {
  const maskParams = Object.keys(fsFields)
    .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&');
  const url = `${docRestUrl(docPath)}?${maskParams}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: fsFields }),
  });
  return res.status; // 200 = allowed; 403 = denied
}

// ── Admin: reset write-once tenure fields ─────────────────────────────────────
async function adminReset(uid) {
  const ref = db.doc(`tenants/${TENANT_ID}/users/${uid}`);
  await ref.update({
    contractStartDate: '',      // CF-stamped empty state
    monthsAtTatil:    FV.delete(),
    monthsInIndustry: FV.delete(),
  });
}

// ── Harness ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function pass(n, note) { console.log(`  ✓ [${n}] ${note}`); passed++; }
function fail(n, note) { console.error(`  ✗ [${n}] ${note}`); failed++; }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('smoke-649-tenure-rules — live-verify on prod Firestore\n');

  const { idToken: agentToken, uid: agentUid } = await getIdToken(
    E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD,
  );
  console.log(`  agent uid: ${agentUid}`);

  const userPath = `tenants/${TENANT_ID}/users/${agentUid}`;

  // Snapshot for restore
  const origSnap = await db.doc(`tenants/${TENANT_ID}/users/${agentUid}`).get();
  const origData = origSnap.exists ? origSnap.data() : null;

  try {
    // ── Case 1: owner-set contractStartDate (from '') → ALLOW ─────────────────
    console.log('\nCase 1: owner-set contractStartDate (from \'\') → ALLOW');
    await adminReset(agentUid);
    const st1 = await updateFields(agentToken, userPath, {
      contractStartDate: { stringValue: '2024-01-15' },
    });
    if (st1 === 200) pass(1, `owner-set contractStartDate (from '') → ALLOW  [HTTP ${st1}]`);
    else             fail(1, `expected 200, got ${st1}`);

    // ── Case 2: change contractStartDate after set → DENY ─────────────────────
    console.log('\nCase 2: change contractStartDate after set → DENY');
    // contractStartDate is now '2024-01-15' from case 1 — do NOT reset
    const st2 = await updateFields(agentToken, userPath, {
      contractStartDate: { stringValue: '2020-05-01' },
    });
    if (st2 === 403) pass(2, `change contractStartDate after set → DENY  [HTTP ${st2}]`);
    else             fail(2, `expected 403, got ${st2}`);

    // ── Case 3: bundled role write → DENY ─────────────────────────────────────
    console.log('\nCase 3: bundled role write → DENY');
    await adminReset(agentUid);
    const st3 = await updateFields(agentToken, userPath, {
      contractStartDate: { stringValue: '2024-01-15' },
      role:              { stringValue: 'tenant_admin' },
    });
    if (st3 === 403) pass(3, `bundled role write → DENY  [HTTP ${st3}]`);
    else             fail(3, `expected 403, got ${st3}`);

    // ── Case 4: owner-set monthsAtTatil (from absent) → ALLOW ─────────────────
    console.log('\nCase 4: owner-set monthsAtTatil (from absent) → ALLOW');
    await adminReset(agentUid);
    const st4 = await updateFields(agentToken, userPath, {
      monthsAtTatil: { integerValue: '6' },
    });
    if (st4 === 200) pass(4, `owner-set monthsAtTatil (from absent) → ALLOW  [HTTP ${st4}]`);
    else             fail(4, `expected 200, got ${st4}`);

    // ── Case 5: owner-set monthsAtTatil -1 (from absent) → DENY ──────────────
    console.log('\nCase 5: owner-set monthsAtTatil -1 (from absent) → DENY');
    await adminReset(agentUid);
    const st5 = await updateFields(agentToken, userPath, {
      monthsAtTatil: { integerValue: '-1' },
    });
    if (st5 === 403) pass(5, `owner-set monthsAtTatil -1 (from absent) → DENY  [HTTP ${st5}]`);
    else             fail(5, `expected 403, got ${st5}`);

  } finally {
    // Restore original write-once field values
    if (origData) {
      const restore = { contractStartDate: origData.contractStartDate ?? '' };
      if (origData.monthsAtTatil    !== undefined) restore.monthsAtTatil    = origData.monthsAtTatil;
      else restore.monthsAtTatil    = FV.delete();
      if (origData.monthsInIndustry !== undefined) restore.monthsInIndustry = origData.monthsInIndustry;
      else restore.monthsInIndustry = FV.delete();
      await db.doc(`tenants/${TENANT_ID}/users/${agentUid}`).update(restore);
    }
    console.log('\n  Cleanup: write-once fields restored to pre-smoke state.');
    await admin.app().delete();
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
