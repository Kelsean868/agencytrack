/**
 * producing-mgr-cf-gate-smoke.mjs
 *
 * Post-deploy smoke for PR #633 — Producing-manager Slice 2.0 (CF gamification gate).
 * Verifies the isParticipant gate in onSubmissionWrite against real production Firestore.
 *
 * Five legs:
 *   1. SM/TA submission → NO leaderboard/{uid} write; any pre-existing doc deleted
 *   2. Agent submission → leaderboard/{uid} IS written
 *   3. Opted-in BM submission → leaderboard/{uid} IS written
 *   4. Non-opted-in BM submission → NO write; pre-existing doc deleted
 *   5. Deleted-user submission (no user doc) → pre-existing leaderboard doc deleted
 *
 * Strategy: uses temporary user docs (smoke-scoped UIDs) so no real account passwords
 * are needed for the CF trigger path. The CF reads the user doc by UID — we control
 * that doc. Finally-block cleans up all created docs.
 *
 * Usage:
 *   node scripts/verification/producing-mgr-cf-gate-smoke.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const admin   = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('../../functions/service-account-key.json')
    ),
  });
}
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID   = 'tatillife_south';
const SMOKE_TAG   = 'smoke_s20_';          // prefix for all temp UIDs
const SMOKE_WEEK  = '2026-06-08';          // past Sunday — safe to write

// Temp UIDs — one per leg
const UIDS = {
  sm:         SMOKE_TAG + 'sm',
  ta:         SMOKE_TAG + 'ta',
  agent:      SMOKE_TAG + 'agent',
  bm_opt:     SMOKE_TAG + 'bm_opt',
  bm_noopt:   SMOKE_TAG + 'bm_noopt',
  deleted:    SMOKE_TAG + 'deleted',   // no user doc — Gemini case
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function stamp() {
  return new Date().toISOString().slice(11, 19);
}

const RESULTS = [];
function pass(leg, detail) {
  const line = `  [${stamp()}] ✓ ${leg}` + (detail ? `\n    ${detail}` : '');
  console.log(line);
  RESULTS.push({ leg, passed: true, detail: detail ?? '' });
}
function fail(leg, detail) {
  const line = `  [${stamp()}] ✗ ${leg}` + (detail ? `\n    ${detail}` : '');
  console.error(line);
  RESULTS.push({ leg, passed: false, detail: detail ?? '' });
}

// Write a minimal submission doc that triggers onSubmissionWrite.
async function writeSubmission(uid) {
  const subId = `${uid}_${SMOKE_WEEK}`;
  await db.doc(`tenants/${TENANT_ID}/submissions/${subId}`).set({
    status:       'submitted',
    agentId:      uid,
    agentName:    `Smoke ${uid}`,
    weekStarting: SMOKE_WEEK,
    tenantId:     TENANT_ID,
    // Numeric fields expected by computePoints — all zero is fine
    newApplications:    0,
    newPoliciesPlaced:  0,
    apiThisWeek:        0,
    ffInterviews:       0,
    closingInterviews:  0,
    referralsObtained:  0,
    coldCalls:          0,
    referralCalls:      0,
    followUpCalls:      0,
    serviceCalls:       0,
    f2fAttempts:        0,
  });
  return subId;
}

// Poll leaderboard/{uid} until expected state or timeout.
async function pollLeaderboard(uid, expectExists, timeoutMs = 18_000) {
  const ref     = db.doc(`tenants/${TENANT_ID}/leaderboard/${uid}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await ref.get();
    if (expectExists && snap.exists)  return { exists: true,  data: snap.data() };
    if (!expectExists && !snap.exists) return { exists: false };
    await new Promise((r) => setTimeout(r, 1200));
  }
  const snap = await ref.get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null, timedOut: true };
}

// Create a user doc in Firestore with the given fields.
async function seedUserDoc(uid, fields) {
  await db.doc(`tenants/${TENANT_ID}/users/${uid}`).set({
    uid,
    tenantId: TENANT_ID,
    email:    `${uid}@smoke.test`,
    ...fields,
  });
}

// Pre-seed a leaderboard doc so we can verify the delete path fires.
async function seedLeaderboardDoc(uid) {
  await db.doc(`tenants/${TENANT_ID}/leaderboard/${uid}`).set({
    uid,
    tenantId: TENANT_ID,
    points:   0,
    level:    'Newcomer',
    smokeSeeded: true,
  });
}

// Delete docs created during the smoke.
async function cleanup(subIds) {
  const batch = db.batch();
  for (const uid of Object.values(UIDS)) {
    batch.delete(db.doc(`tenants/${TENANT_ID}/users/${uid}`));
    batch.delete(db.doc(`tenants/${TENANT_ID}/leaderboard/${uid}`));
  }
  for (const subId of subIds) {
    batch.delete(db.doc(`tenants/${TENANT_ID}/submissions/${subId}`));
  }
  await batch.commit();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nproducing-mgr-cf-gate-smoke — onSubmissionWrite isParticipant gate');
  console.log('─'.repeat(60));
  console.log(`Tenant: ${TENANT_ID}  |  Week: ${SMOKE_WEEK}\n`);

  const createdSubIds = [];

  try {

    // ── SETUP: seed user docs + pre-seed leaderboard docs for delete-path legs ──
    console.log(`[${stamp()}] Seeding temp user docs...`);
    await Promise.all([
      seedUserDoc(UIDS.sm,       { role: 'sales_manager' }),
      seedUserDoc(UIDS.ta,       { role: 'tenant_admin'  }),
      seedUserDoc(UIDS.agent,    { role: 'agent'         }),
      seedUserDoc(UIDS.bm_opt,   { role: 'branch_manager', appearOnLeaderboard: true  }),
      seedUserDoc(UIDS.bm_noopt, { role: 'branch_manager', appearOnLeaderboard: false }),
      // UIDS.deleted intentionally has NO user doc
    ]);

    console.log(`[${stamp()}] Pre-seeding leaderboard docs for delete-path legs (SM, TA, non-opted BM, deleted user)...`);
    await Promise.all([
      seedLeaderboardDoc(UIDS.sm),
      seedLeaderboardDoc(UIDS.ta),
      seedLeaderboardDoc(UIDS.bm_noopt),
      seedLeaderboardDoc(UIDS.deleted),
    ]);

    // ── LEG 1a: SM submission → leaderboard doc deleted ──────────────────────
    console.log(`\n[${stamp()}] Leg 1a — SM submission → no leaderboard write; pre-seeded doc deleted...`);
    try {
      const subId = await writeSubmission(UIDS.sm);
      createdSubIds.push(subId);
      const result = await pollLeaderboard(UIDS.sm, false);
      if (result.timedOut) {
        fail('leg1a-sm-no-write', `Timed out — leaderboard doc still exists for SM uid=${UIDS.sm}`);
      } else {
        pass('leg1a-sm-no-write', `sales_manager: pre-seeded doc deleted by CF ✓`);
      }
    } catch (err) {
      fail('leg1a-sm-no-write', err.message);
    }

    // ── LEG 1b: TA submission → leaderboard doc deleted ──────────────────────
    console.log(`\n[${stamp()}] Leg 1b — TA submission → no leaderboard write; pre-seeded doc deleted...`);
    try {
      const subId = await writeSubmission(UIDS.ta);
      createdSubIds.push(subId);
      const result = await pollLeaderboard(UIDS.ta, false);
      if (result.timedOut) {
        fail('leg1b-ta-no-write', `Timed out — leaderboard doc still exists for TA uid=${UIDS.ta}`);
      } else {
        pass('leg1b-ta-no-write', `tenant_admin: pre-seeded doc deleted by CF ✓`);
      }
    } catch (err) {
      fail('leg1b-ta-no-write', err.message);
    }

    // ── LEG 2: Agent submission → leaderboard doc written ────────────────────
    console.log(`\n[${stamp()}] Leg 2 — Agent submission → leaderboard doc written...`);
    try {
      const subId = await writeSubmission(UIDS.agent);
      createdSubIds.push(subId);
      const result = await pollLeaderboard(UIDS.agent, true);
      if (!result.exists) {
        fail('leg2-agent-writes', `Timed out — no leaderboard doc for agent uid=${UIDS.agent}`);
      } else {
        pass('leg2-agent-writes', `agent: leaderboard/${UIDS.agent} written ✓  points=${result.data?.points ?? '?'}`);
      }
    } catch (err) {
      fail('leg2-agent-writes', err.message);
    }

    // ── LEG 3: Opted-in BM submission → leaderboard doc written ──────────────
    console.log(`\n[${stamp()}] Leg 3 — Opted-in BM submission → leaderboard doc written...`);
    try {
      const subId = await writeSubmission(UIDS.bm_opt);
      createdSubIds.push(subId);
      const result = await pollLeaderboard(UIDS.bm_opt, true);
      if (!result.exists) {
        fail('leg3-bm-opt-writes', `Timed out — no leaderboard doc for opted-in BM uid=${UIDS.bm_opt}`);
      } else {
        pass('leg3-bm-opt-writes', `branch_manager appearOnLeaderboard:true: leaderboard/${UIDS.bm_opt} written ✓  points=${result.data?.points ?? '?'}`);
      }
    } catch (err) {
      fail('leg3-bm-opt-writes', err.message);
    }

    // ── LEG 4: Non-opted-in BM submission → pre-seeded doc deleted ───────────
    console.log(`\n[${stamp()}] Leg 4 — Non-opted-in BM submission → no leaderboard write; pre-seeded doc deleted...`);
    try {
      const subId = await writeSubmission(UIDS.bm_noopt);
      createdSubIds.push(subId);
      const result = await pollLeaderboard(UIDS.bm_noopt, false);
      if (result.timedOut) {
        fail('leg4-bm-noopt-no-write', `Timed out — leaderboard doc still exists for non-opted BM uid=${UIDS.bm_noopt}`);
      } else {
        pass('leg4-bm-noopt-no-write', `branch_manager appearOnLeaderboard:false: pre-seeded doc deleted by CF ✓`);
      }
    } catch (err) {
      fail('leg4-bm-noopt-no-write', err.message);
    }

    // ── LEG 5: Deleted user (no user doc) → pre-seeded leaderboard doc deleted
    console.log(`\n[${stamp()}] Leg 5 — Deleted-user submission (no user doc) → pre-seeded leaderboard doc deleted...`);
    try {
      // Confirm no user doc exists
      const userSnap = await db.doc(`tenants/${TENANT_ID}/users/${UIDS.deleted}`).get();
      if (userSnap.exists) {
        fail('leg5-deleted-user', `Unexpected: user doc exists for uid=${UIDS.deleted} — test setup error`);
      } else {
        const subId = await writeSubmission(UIDS.deleted);
        createdSubIds.push(subId);
        const result = await pollLeaderboard(UIDS.deleted, false);
        if (result.timedOut) {
          fail('leg5-deleted-user', `Timed out — leaderboard doc still exists for deleted-user uid=${UIDS.deleted} (Gemini case: userSnap.exists guard)`);
        } else {
          pass('leg5-deleted-user', `No user doc → userRole='unknown' → CF deleted pre-seeded leaderboard doc ✓ (Gemini case proven)`);
        }
      }
    } catch (err) {
      fail('leg5-deleted-user', err.message);
    }

  } finally {
    console.log(`\n[${stamp()}] Cleaning up temp docs...`);
    try {
      await cleanup(createdSubIds);
      console.log(`  ✓ Cleanup complete (${Object.keys(UIDS).length} user docs + ${createdSubIds.length} sub docs + leaderboard docs)`);
    } catch (cleanErr) {
      console.error(`  ✗ CLEANUP FAILED: ${cleanErr.message} — manual cleanup needed`);
      console.error(`  UIDs to delete: ${Object.values(UIDS).join(', ')}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total  = RESULTS.length;
  const passed = RESULTS.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n' + '═'.repeat(60));
  console.log(`RESULT: ${passed}/${total} legs passed${failed > 0 ? ` — ${failed} FAILED` : ' — ALL PASS'}`);
  console.log('─'.repeat(60));
  for (const r of RESULTS) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.leg}${r.detail ? ': ' + r.detail.split('\n')[0] : ''}`);
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke crashed:', err.message);
  process.exit(1);
});
