/**
 * points-source-f2f smoke — POST-MERGE + POST-DEPLOY only.
 *
 * Verifies the live onSubmissionWrite Cloud Function trigger after
 * `firebase deploy --only functions` has completed.
 *
 * What it checks:
 *   1. f2fAttempts now contributes points (1pt each) — was 0 before this PR.
 *   2. All existing weights are unchanged (regression guard on the live trigger).
 *
 * How it works:
 *   - Writes a "smoke" submission directly to Firestore via the Admin SDK.
 *   - Polls the agent's leaderboard/{uid} entry until the trigger's write lands.
 *   - Asserts: (newPoints - prePoints) === expected delta.
 *   - Cleans up the smoke submission regardless of pass/fail.
 *
 * Prerequisites:
 *   - gcloud application-default credentials active on the local machine
 *     (`gcloud auth application-default login`).
 *   - firebase-admin accessible at ../functions/node_modules/firebase-admin
 *     (installed inside functions/, as per CLAUDE.md Admin-script guidance).
 *   - --tenant=<tenantId>  (e.g. --tenant=tatillife-south)
 *   - --agent=<agentUid>   (UID of an existing, non-test-account agent in the tenant)
 *   - --execute            (omit for dry-run — prints what would be written, no Firestore writes)
 *
 * Usage:
 *   node scripts/verification/points-source-f2f-smoke.mjs \
 *     --tenant=tatillife-south \
 *     --agent=<uid> \
 *     --execute
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin   = require('../functions/node_modules/firebase-admin');

// ── Args ──────────────────────────────────────────────────────────────────────

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.length ? rest.join('=') : true];
  })
);

const TENANT_ID = argv.tenant;
const AGENT_UID = argv.agent;
const EXECUTE   = argv.execute === true || argv.execute === 'true';

if (!TENANT_ID || !AGENT_UID) {
  console.error('Usage: node points-source-f2f-smoke.mjs --tenant=<id> --agent=<uid> [--execute]');
  process.exit(1);
}

// ── Smoke submission fixture ───────────────────────────────────────────────────
//
// Values chosen to produce a known point total so we can assert the exact delta.
// These match the REGRESSION_FIXTURE in functions/__tests__/computePoints.test.js
// plus f2fAttempts=3:
//
//   dials (7) * 1  = 7
//   f2f   (3) * 1  = 3   ← the new term; was 0 before this PR
//   ffi   (2) * 5  = 10
//   ci    (1) * 10 = 10
//   apps  (2) * 25 = 50
//   api 5000  / 1k = 5
//   EXPECTED DELTA  = 85

const SMOKE_WEEK   = '2099-01-05'; // Far-future Sunday — won't collide with real submissions.
const F2F_ATTEMPTS = 3;

const SMOKE_SUBMISSION = {
  status:                'submitted',
  agentId:               AGENT_UID,
  agentName:             '__smoke_points_f2f__',
  weekStarting:          SMOKE_WEEK,
  tenantId:              TENANT_ID,
  referralCalls:         3,
  followUpCalls:         2,
  coldCalls:             1,
  seminarTradeshowCalls: 1,
  f2fAttempts:           F2F_ATTEMPTS,
  ffiConducted:          2,
  ciConducted:           1,
  applicationsSold:      2,
  apiSold:               5000,
};

const EXPECTED_DELTA = 85; // Must match computePoints(SMOKE_SUBMISSION) output.

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== points-source-f2f smoke — ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} ===\n`);
  console.log(`  tenant : ${TENANT_ID}`);
  console.log(`  agent  : ${AGENT_UID}`);
  console.log(`  week   : ${SMOKE_WEEK}`);
  console.log(`  f2f    : ${F2F_ATTEMPTS}`);
  console.log(`  expected delta: ${EXPECTED_DELTA} pts\n`);

  if (!EXECUTE) {
    console.log('DRY-RUN — smoke submission fixture:');
    console.log(JSON.stringify(SMOKE_SUBMISSION, null, 2));
    console.log('\nRe-run with --execute to perform live verification.');
    process.exit(0);
  }

  admin.initializeApp();
  const db = admin.firestore();

  const subRef = db.collection(`tenants/${TENANT_ID}/submissions`).doc(`smoke_f2f_${Date.now()}`);
  const lbRef  = db.doc(`tenants/${TENANT_ID}/leaderboard/${AGENT_UID}`);

  // Step 1: read pre-existing leaderboard points.
  const preSnap = await lbRef.get();
  const prePoints = preSnap.exists ? (parseFloat(preSnap.data().points) || 0) : 0;
  console.log(`  pre-smoke points : ${prePoints}`);

  try {
    // Step 2: write smoke submission (triggers onSubmissionWrite).
    await subRef.set(SMOKE_SUBMISSION);
    console.log(`  submission written: ${subRef.id}`);

    // Step 3: poll leaderboard until trigger writes the update (up to 30s).
    const POLL_MS      = 2_000;
    const TIMEOUT_MS   = 30_000;
    const deadline     = Date.now() + TIMEOUT_MS;
    let   newPoints    = prePoints;
    let   pollCount    = 0;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      pollCount++;
      const snap = await lbRef.get();
      if (snap.exists) {
        newPoints = parseFloat(snap.data().points) || 0;
        if (newPoints !== prePoints) break;
      }
      process.stdout.write(`  polling (${pollCount})...\r`);
    }

    const delta = newPoints - prePoints;
    console.log(`\n  post-smoke points: ${newPoints}`);
    console.log(`  delta            : ${delta}`);

    if (delta === EXPECTED_DELTA) {
      console.log(`\n✓ PASS — delta=${delta} matches expected (${EXPECTED_DELTA}). f2fAttempts scores live.\n`);
    } else if (newPoints === prePoints) {
      console.error(`\n✗ FAIL — leaderboard did not update within 30s. CF trigger may not have fired.\n`);
      process.exitCode = 1;
    } else {
      console.error(`\n✗ FAIL — delta=${delta}, expected=${EXPECTED_DELTA}. Weights mismatch.\n`);
      process.exitCode = 1;
    }
  } finally {
    // Step 4: clean up smoke submission regardless of outcome.
    await subRef.delete().catch((e) => console.warn(`  cleanup warn: ${e.message}`));
    console.log(`  smoke submission deleted: ${subRef.id}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
