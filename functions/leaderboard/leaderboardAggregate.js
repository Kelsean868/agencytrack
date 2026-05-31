'use strict';

// Leaderboard-aggregate Cloud Function (Track J P1b).
//
// Computes per-branch, per-period (WK/MTD/QTD/YTD) production rankings by
// composing functions/leaderboard/rankingLogic.js, and writes them to an
// agent-readable `tenants/{tenantId}/leaderboards/{branchId}` doc via the
// Admin SDK (bypasses rules). Reads: submissions + users for the active tenant.
//
// Two triggers (this module exports the handlers; index.js wires both):
//   - scheduled `recomputeLeaderboardScheduled` — hourly, model sendSundayNudge
//   - admin-only callable `recomputeLeaderboardOnDemand` — initial backfill +
//     deterministic smoke triggering (platform_admin / tenant_admin only)
//
// Tenant scope: hardcoded `tatillife_south` per SEC-9c (scheduled-function
// isolation deferred; matches the existing single-tenant scheduled CFs).
//
// Loop-guard: writes are idempotent — Firestore replaces the doc each run.
// We deliberately do NOT use an onWrite trigger; this is a recompute CF.
// On-write-trigger optimization → FU.
//
// Source: submissions pipeline (D1). Reconciled-production migration is FU-2;
// the leaderboard fetch swap happens at the `loadInputs` call inside the
// computeAndWrite function.

const admin     = require('firebase-admin');
const functions = require('firebase-functions');
const {
  rankForLeaderboard,
} = require('./rankingLogic');

const TENANT_ID = 'tatillife_south'; // SEC-9c, mirrors index.js scheduled CFs
const PERIODS = ['week', 'mtd', 'quarter', 'ytd'];
const PERIOD_KEYS = { week: 'week', mtd: 'mtd', quarter: 'qtd', ytd: 'ytd' };

// ── Inputs: load tenant submissions (calendar YTD) + tenant users ────────────

async function loadInputs(tenantId, year) {
  const db = admin.firestore();

  const [subsSnap, usersSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/submissions`)
      .where('weekStarting', '>=', `${year}-01-01`)
      .where('weekStarting', '<=', `${year}-12-31`)
      .where('status', '==', 'submitted')
      .get(),
    db.collection(`tenants/${tenantId}/users`)
      .get(),
  ]);

  const submissions = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const users       = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { submissions, users };
}

// ── Branch grouping via agentId → branchId join on user docs ─────────────────
//
// Submissions carry only `unitId`; no `branchId` field, no `units` collection
// mapping unitId → branchId. The CF reads ALL user docs and uses each agent's
// own `branchId` field to group their submissions.

function groupByBranch(submissions, users) {
  // agentId → branchId map (from user docs)
  const branchByAgent = new Map();
  for (const u of users) {
    if (u.role === 'agent' && u.provisioning !== true && u.branchId) {
      branchByAgent.set(u.id, u.branchId);
    }
  }

  // branchId → { subs[], users[] }
  const byBranch = new Map();
  const ensure = (b) => {
    if (!byBranch.has(b)) byBranch.set(b, { subs: [], users: [] });
    return byBranch.get(b);
  };

  // Bucket each active agent into its branch (so empty-production agents still appear)
  for (const u of users) {
    if (u.role === 'agent' && u.provisioning !== true && u.branchId) {
      ensure(u.branchId).users.push(u);
    } else if (u.role === 'unit_manager' && u.branchId) {
      // UMs only included so rankForLeaderboard's unit-name resolution works
      ensure(u.branchId).users.push(u);
    }
  }

  // Bucket each submission into its agent's branch
  for (const s of submissions) {
    const agentId = s.agentId || s.userId;
    if (!agentId) continue;
    const branchId = branchByAgent.get(agentId);
    if (!branchId) continue; // submissions from agents without branchId are dropped
    ensure(branchId).subs.push(s);
  }

  return byBranch;
}

// ── Per-branch×period composition + map to leaderboard entry shape ───────────

function buildLeaderboardDoc(branchSubs, branchUsers, referenceDate) {
  const doc = { computedAt: admin.firestore.FieldValue.serverTimestamp() };

  // Resolve unit name once for the whole branch (rankForLeaderboard returns
  // unitId only; we look up display name from the in-scope UM docs).
  const unitNameByMgrUid = {};
  for (const u of branchUsers) {
    if (u.role === 'unit_manager') {
      const name = u.unitName?.trim()
        || (u.name ? `${u.name}'s Unit` : 'Unit');
      unitNameByMgrUid[u.id] = name;
    }
  }

  for (const period of PERIODS) {
    const ranked = rankForLeaderboard(branchSubs, branchUsers, period, referenceDate);
    doc[PERIOD_KEYS[period]] = ranked.map((entry) => ({
      agentId:        entry.agentId,
      name:           entry.name,
      unitName:       entry.unitId ? (unitNameByMgrUid[entry.unitId] || null) : null,
      periodApi:      entry.periodApi,
      apps:           entry.apps,
      rank:           entry.rank,
      rankWithinUnit: entry.rankWithinUnit,
    }));
  }

  return doc;
}

// ── Core compute-and-write ───────────────────────────────────────────────────

async function computeAndWriteLeaderboards(tenantId, referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const { submissions, users } = await loadInputs(tenantId, year);

  const byBranch = groupByBranch(submissions, users);
  const db = admin.firestore();
  const batch = db.batch();

  let branchCount = 0;
  for (const [branchId, { subs, users: branchUsers }] of byBranch.entries()) {
    const doc = buildLeaderboardDoc(subs, branchUsers, referenceDate);
    const ref = db.doc(`tenants/${tenantId}/leaderboards/${branchId}`);
    batch.set(ref, doc); // full replace — idempotent
    branchCount++;
  }

  await batch.commit();
  return { branchCount, totalSubmissions: submissions.length, totalUsers: users.length };
}

// ── Triggers ─────────────────────────────────────────────────────────────────

// Scheduled — hourly. The cron runs in UTC; the CF reads ref=now() and the
// twin handles TT-offset internally for period boundaries.
exports.recomputeLeaderboardScheduled = functions.pubsub
  .schedule('0 * * * *')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      const result = await computeAndWriteLeaderboards(TENANT_ID);
      console.log(`[recomputeLeaderboardScheduled] tenant=${TENANT_ID} branches=${result.branchCount} subs=${result.totalSubmissions} users=${result.totalUsers}`);
    } catch (err) {
      console.error('[recomputeLeaderboardScheduled]', err);
    }
  });

// Admin-only callable — initial backfill + deterministic smoke triggering.
// Only platform_admin / tenant_admin may invoke; agents/managers get permission-denied.
exports.recomputeLeaderboardOnDemand = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign-in required.');
  }
  const callerRole = context.auth.token.role;
  const callerTenant = context.auth.token.tenantId;
  if (!['platform_admin', 'tenant_admin'].includes(callerRole)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only platform_admin or tenant_admin may invoke recomputeLeaderboardOnDemand.'
    );
  }

  // platform_admin may target any tenant via data.tenantId; tenant_admin always
  // targets their own.
  let targetTenant = TENANT_ID;
  if (callerRole === 'tenant_admin') {
    if (!callerTenant) {
      throw new functions.https.HttpsError('failed-precondition', 'Caller has no tenantId claim.');
    }
    targetTenant = callerTenant;
  } else if (data?.tenantId) {
    targetTenant = data.tenantId;
  }

  try {
    const result = await computeAndWriteLeaderboards(targetTenant);
    return {
      ok: true,
      tenantId: targetTenant,
      branchCount: result.branchCount,
      totalSubmissions: result.totalSubmissions,
      totalUsers: result.totalUsers,
    };
  } catch (err) {
    console.error('[recomputeLeaderboardOnDemand]', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// Pure logic exports for unit tests (no firebase-admin in test path)
exports._internals = {
  groupByBranch,
  buildLeaderboardDoc,
  computeAndWriteLeaderboards,
};
