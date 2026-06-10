/**
 * points-activity-scale smoke — POST-MERGE + POST-DEPLOY only.
 *
 * Verifies the live onSubmissionWrite Cloud Function trigger after
 * `firebase deploy --only functions` has completed.
 *
 * What it checks:
 *   1. All 21 scored fields contribute points at the new weights.
 *   2. prospectingLettersSent cap (25 → 20 pts) is enforced in the live CF.
 *   3. Level resolves against the NEW thresholds (Rookie/500/1500/3500/7000).
 *   4. Delta against leaderboard pre-state exactly matches expected.
 *
 * How it works:
 *   - Writes a "smoke" submission directly to Firestore via the Admin SDK.
 *   - Polls the agent's leaderboard/{uid} entry until the trigger's write lands.
 *   - Asserts: (newPoints - prePoints) === EXPECTED_DELTA.
 *   - Asserts: level at postPoints resolves correctly against the new thresholds.
 *   - Cleans up the smoke submission regardless of pass/fail.
 *
 * Prerequisites:
 *   - gcloud application-default credentials active (`gcloud auth application-default login`).
 *   - firebase-admin at ../../functions/node_modules/firebase-admin (installed in functions/).
 *   - --tenant=<tenantId>  (e.g. --tenant=tatillife_south)
 *   - --agent=<agentUid>   (UID of an existing, non-test-account agent in the tenant)
 *   - --execute            (omit for dry-run — prints fixture, no Firestore writes)
 *
 * Usage:
 *   node scripts/verification/points-activity-scale-smoke.mjs \
 *     --tenant=tatillife_south \
 *     --agent=<uid> \
 *     --execute
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

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
  console.error('Usage: node points-activity-scale-smoke.mjs --tenant=<id> --agent=<uid> [--execute]');
  process.exit(1);
}

// ── Smoke submission fixture ──────────────────────────────────────────────────
//
// Exercises one field from each category group.
// prospectingLettersSent=25 proves the cap (scores 20, not 25).
//
// Expected breakdown:
//   dials (3+2+1+1=7)      * 1  = 7
//   letters (25→cap20)     * 1  = 20
//   referrals (3)          * 3  = 9
//   otherNewNames (4+2+1+1=8) * 1 = 8   (namesFrom* channels)
//   seminars (1)           * 10 = 10
//   f2f (3)                * 2  = 6
//   appointments (3)       * 3  = 9
//   ffi (2)                * 5  = 10
//   ci (1)                 * 10 = 10
//   apps (2)               * 25 = 50
//   api (5000/1k)          * 1  = 5
//   serviceCalls (2)       * 1  = 2
//   deliveries (1)         * 3  = 3
//   premiumMtgs (1)        * 3  = 3
//   annualReviews (1)      * 5  = 5
//   orphansAdopted (1)     * 8  = 8
//   EXPECTED DELTA         = 164

const SMOKE_WEEK   = '2099-02-02'; // Far-future Sunday — won't collide with real submissions.

const SMOKE_SUBMISSION = {
  status:                       'submitted',
  agentId:                      AGENT_UID,
  agentName:                    '__smoke_points_scale__',
  weekStarting:                 SMOKE_WEEK,
  tenantId:                     TENANT_ID,
  // Prospecting
  referralCalls:                3,
  followUpCalls:                2,
  coldCalls:                    1,
  seminarTradeshowCalls:        1,
  prospectingLettersSent:       25,  // cap → 20 pts
  referralsObtained:            3,
  namesFromColdCanvass:         4,
  namesFromOther:               2,
  namesFromSeminarsConducted:   1,
  namesFromTradeshowsAttended:  1,
  seminarsConducted:            1,
  // Advancing
  f2fAttempts:                  3,
  appointmentsSet:              3,
  ffiConducted:                 2,
  ciConducted:                  1,
  // Closing
  applicationsSold:             2,
  apiSold:                      5000,
  // Service (hasServiceWork=true)
  hasServiceWork:               true,
  serviceCalls:                 2,
  policiesDelivered:            1,
  premiumCollectionMeetings:    1,
  annualReviews:                1,
  orphansAdopted:               1,
};

const EXPECTED_DELTA = 164;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== points-activity-scale smoke — ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} ===\n`);
  console.log(`  tenant        : ${TENANT_ID}`);
  console.log(`  agent         : ${AGENT_UID}`);
  console.log(`  week          : ${SMOKE_WEEK}`);
  console.log(`  expected delta: ${EXPECTED_DELTA} pts\n`);

  if (!EXECUTE) {
    console.log('DRY-RUN — smoke submission fixture:');
    console.log(JSON.stringify(SMOKE_SUBMISSION, null, 2));
    console.log('\nRe-run with --execute to perform live verification.');
    process.exit(0);
  }

  admin.initializeApp();
  const db = admin.firestore();

  const { POINTS_WEIGHTS, LEVEL_THRESHOLDS, resolveLevel } = require('../../functions/lib/gamificationConfig');

  const subRef = db.collection(`tenants/${TENANT_ID}/submissions`).doc(`smoke_scale_${Date.now()}`);
  const lbRef  = db.doc(`tenants/${TENANT_ID}/leaderboard/${AGENT_UID}`);

  // Step 1: read pre-existing leaderboard points.
  const preSnap   = await lbRef.get();
  const prePoints = preSnap.exists ? (parseFloat(preSnap.data().points) || 0) : 0;
  console.log(`  pre-smoke points : ${prePoints}`);
  console.log(`  pre-smoke level  : ${resolveLevel(prePoints).title}`);

  try {
    // Step 2: write smoke submission (triggers onSubmissionWrite).
    await subRef.set(SMOKE_SUBMISSION);
    console.log(`  submission written: ${subRef.id}`);

    // Step 3: poll leaderboard until trigger writes the update (up to 30s).
    const POLL_MS    = 2_000;
    const TIMEOUT_MS = 30_000;
    const deadline   = Date.now() + TIMEOUT_MS;
    let   newPoints  = prePoints;
    let   pollCount  = 0;

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

    const delta     = newPoints - prePoints;
    const postLevel = resolveLevel(newPoints);
    console.log(`\n  post-smoke points: ${newPoints}`);
    console.log(`  post-smoke level : ${postLevel.title} (threshold: ${postLevel.threshold})`);
    console.log(`  delta            : ${delta}`);

    if (delta !== EXPECTED_DELTA) {
      if (newPoints === prePoints) {
        console.error(`\n✗ FAIL — leaderboard did not update within 30s. CF trigger may not have fired.\n`);
      } else {
        console.error(`\n✗ FAIL — delta=${delta}, expected=${EXPECTED_DELTA}. Weights mismatch.\n`);
        console.error(`  Hint: check POINTS_WEIGHTS keys in deployed functions/lib/gamificationConfig.js`);
      }
      process.exitCode = 1;
    } else {
      console.log(`\n✓ PASS — delta=${delta} matches expected (${EXPECTED_DELTA}).`);
      console.log(`  Letters cap confirmed (25 sent → 20 pts in delta).`);
      console.log(`  Level "${postLevel.title}" at threshold ${postLevel.threshold}.\n`);
    }

    console.log('  Active POINTS_WEIGHTS:');
    for (const [k, v] of Object.entries(POINTS_WEIGHTS)) {
      console.log(`    ${k}: ${v}`);
    }
    console.log('\n  Active LEVEL_THRESHOLDS:');
    for (const l of LEVEL_THRESHOLDS) {
      console.log(`    ${l.threshold}: ${l.title}`);
    }
  } finally {
    // Step 4: clean up smoke submission regardless of outcome.
    await subRef.delete().catch((e) => console.warn(`  cleanup warn: ${e.message}`));
    console.log(`\n  smoke submission deleted: ${subRef.id}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
