'use strict';

// Leaderboard-aggregate Cloud Function (Track J P1b; FR Leaderboard L-1).
//
// Computes per-branch, per-period (WK/MTD/QTD/YTD) board metrics and writes
// them to an agent-readable `tenants/{tenantId}/leaderboards/{branchId}` doc via
// the Admin SDK (bypasses rules). One doc, three metrics (L-1 D1):
//
//   periodApi — settled API from the policy ledger      (D2, D4)
//   apps      — applications from the policy ledger      (D3, D4)
//   points    — points from logged activity              (D5 dispatcher ruling)
//
// The metric math and the ranker live in ./boardMetrics.js (pure). This module
// loads the inputs (users, submitted reports, policies, daily entries) and
// writes the docs. Reads: users + submissions (status 'submitted') + policies +
// each participant's dailyActivity for weeks WITHOUT a submitted report only.
// Drafts are never read (D5 ruling).
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

const admin     = require('firebase-admin');
const functions = require('firebase-functions/v1');
const { getPeriodBoundaries } = require('./rankingLogic');
const {
  periodWindow,
  sundaysBetween,
  ledgerCreditsByAgent,
  submittedWeeksByAgent,
  weekPointsByAgent,
  priorRanksForBranch,
  periodEntries,
  isChampionCandidate,
  weeklyChampions,
} = require('./boardMetrics');
const { withAppCheckMonitor } = require('../lib/appCheckMonitor');

const TENANT_ID = 'tatillife_south'; // SEC-9c, mirrors index.js scheduled CFs
const PERIODS = ['week', 'mtd', 'quarter', 'ytd'];
const PERIOD_KEYS = { week: 'week', mtd: 'mtd', quarter: 'qtd', ytd: 'ytd' };
const SOURCES = Object.freeze({ api: 'ledger', apps: 'ledger', points: 'activity' });

// Firestore caps an `in` filter at 30 values.
const IN_FILTER_MAX = 30;

// ── Inputs ───────────────────────────────────────────────────────────────────
//
// Submissions and daily entries cover calendar YTD + a 14-day cushion into the
// prior year, so the most-recently-completed week (`prevSunday`, needed for
// previousRanks + weeklyChampions) is present even when referenceDate falls in
// the first week of January.

function padDateString(yyyy, mm, dd) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function dateMinusDays(refDate, days) {
  const d = new Date(refDate.getTime() - days * 24 * 3600 * 1000);
  return padDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// Board participants (D8): agents + UMs always; BMs only when
// appearOnLeaderboard === true (self opt-in); SM/TA/PA never. Provisioning
// stubs, test accounts, deactivated users (`active === false`) and users with
// no branchId are left out.
function isParticipant(u) {
  return !!u
    && (u.role === 'agent' ||
        u.role === 'unit_manager' ||
        (u.role === 'branch_manager' && u.appearOnLeaderboard === true))
    && u.provisioning !== true
    && u.isTestAccount !== true
    && u.active !== false
    && !!u.branchId;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// D5 ruling: read an agent's daily entries ONLY for the weeks in range that
// have no submitted report from that agent.
async function loadDailies(db, tenantId, readers, submissions, weeks) {
  const submitted = submittedWeeksByAgent(submissions);
  const dailiesByAgent = new Map();
  let queries = 0;
  await Promise.all(readers.map(async (u) => {
    const reported = submitted.get(u.id) || new Set();
    const missing = weeks.filter((w) => !reported.has(w));
    const days = [];
    for (const part of chunk(missing, IN_FILTER_MAX)) {
      queries += 1;
      const snap = await db.collection(`tenants/${tenantId}/users/${u.id}/dailyActivity`)
        .where('weekStarting', 'in', part)
        .get();
      for (const d of snap.docs) days.push(d.data());
    }
    if (days.length) dailiesByAgent.set(u.id, days);
  }));
  return { dailiesByAgent, dailyQueries: queries };
}

async function loadInputs(tenantId, referenceDate) {
  const db = admin.firestore();
  const year = referenceDate.getFullYear();
  const lowerBound = dateMinusDays(new Date(Date.UTC(year, 0, 1)), 14);

  const [subsSnap, usersSnap, policiesSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/submissions`)
      .where('weekStarting', '>=', lowerBound)
      .where('weekStarting', '<=', `${year}-12-31`)
      .where('status', '==', 'submitted')
      .get(),
    db.collection(`tenants/${tenantId}/users`)
      .get(),
    // Whole collection: `dateIssued` is a string on imports and a Timestamp on
    // app writes, so no single range query can select by date. Filtered in
    // memory by the ledger's own settled/date rule.
    db.collection(`tenants/${tenantId}/policies`)
      .get(),
  ]);

  const submissions = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const users       = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const policies    = policiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const currentSunday = periodWindow('week', referenceDate).from;
  const weeks = sundaysBetween(lowerBound, currentSunday);
  const readers = users.filter((u) => isParticipant(u) || isChampionCandidate(u));
  const { dailiesByAgent, dailyQueries } =
    await loadDailies(db, tenantId, readers, submissions, weeks);

  return { submissions, users, policies, dailiesByAgent, dailyQueries };
}

// ── Prior-week helpers (P5-prep) ─────────────────────────────────────────────
//
// "Most-recently-completed week" = the WAR week BEFORE the current week.
// computed by shifting referenceDate back 7 days and snapping to the resulting
// week's boundaries via the existing TT-aware getPeriodBoundaries('week', ...).

function priorWeekReferenceDate(referenceDate) {
  return new Date(referenceDate.getTime() - 7 * 24 * 3600 * 1000);
}

// Returns the YYYY-MM-DD Sunday of the prior week (in TT). Used as the
// weeklyChampions doc id.
function priorWeekStartingString(referenceDate) {
  const priorRef = priorWeekReferenceDate(referenceDate);
  const { start } = getPeriodBoundaries('week', priorRef);
  // `start` is the Trinidad-local Sunday 00:00 expressed as a UTC Date.
  // Shift back to TT-local to read the YYYY-MM-DD components correctly.
  const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;
  const tt = new Date(start.getTime() - TRINI_OFFSET_MS);
  return padDateString(tt.getUTCFullYear(), tt.getUTCMonth() + 1, tt.getUTCDate());
}

// ── Branch grouping via agentId → branchId join on user docs ─────────────────
//
// Submissions carry only `unitId`; no `branchId` field, no `units` collection
// mapping unitId → branchId. The CF reads ALL user docs and uses each agent's
// own `branchId` field to group their submissions.

// ATTRIBUTION SEMANTICS — current-branch attribution:
//   A submission (and a policy) is credited to the agent's CURRENT branchId
//   (read from the live user doc at compute time). Mid-year movers' historical
//   production follows them to their current branch. This matches
//   BranchManagerProductionView and is the natural default.
//
// SKIP SEMANTICS — silent drop + observable counters:
//   Submissions whose agent has no branchId (migration gap or non-agent
//   author) cannot be bucketed without inventing a branch. They are dropped,
//   but the counts + agentIds are surfaced via console.warn AND written to
//   the leaderboard doc as `skippedNoBranch` metadata so any drift is visible
//   in both logs and Firestore.
function groupByBranch(submissions, users) {
  // agentId → branchId map (built from the SINGLE already-loaded users array;
  // no per-agent get() — see loadInputs).
  const branchByAgent = new Map();
  for (const u of users) {
    if (isParticipant(u)) {
      branchByAgent.set(u.id, u.branchId);
    }
  }

  // branchId → { subs[], users[] }
  const byBranch = new Map();
  const ensure = (b) => {
    if (!byBranch.has(b)) byBranch.set(b, { subs: [], users: [] });
    return byBranch.get(b);
  };

  // Bucket all visible users into their branch using the same participant filter.
  for (const u of users) {
    if (isParticipant(u)) {
      ensure(u.branchId).users.push(u);
    }
  }

  // Bucket each submission into its agent's branch. Track skipped (no branchId)
  // by agent so the count can be surfaced via console.warn + leaderboard doc
  // metadata.
  const skippedAgentIds = new Set();
  let skippedCount = 0;
  for (const s of submissions) {
    const agentId = s.agentId || s.userId;
    if (!agentId) {
      // Submission with neither agentId nor userId — counted as skipped.
      skippedCount += 1;
      continue;
    }
    const branchId = branchByAgent.get(agentId);
    if (!branchId) {
      skippedCount += 1;
      skippedAgentIds.add(agentId);
      continue;
    }
    ensure(branchId).subs.push(s);
  }

  return {
    byBranch,
    skippedNoBranch: {
      count: skippedCount,
      agentIds: [...skippedAgentIds].sort(),
    },
  };
}

// ── Per-branch doc ───────────────────────────────────────────────────────────
//
// Entry shape (every period): agentId, name, unitId, unitName, periodApi, apps,
// points, rank, rankWithinUnit, previousRank, previousRanks.
//   - rank / rankWithinUnit — API board order (Nexus surface keeps working, D7)
//   - previousRanks { activity, api, apps } — WEEK only (null otherwise), the
//     prior week's branch rank on each board; previousRank === previousRanks.api

function buildLeaderboardDoc(branchUsers, referenceDate, ctx) {
  const doc = { computedAt: admin.firestore.FieldValue.serverTimestamp(), sources: SOURCES };

  // Resolve unit names once for the whole branch from the in-scope UM docs.
  const unitNameByMgrUid = {};
  for (const u of branchUsers) {
    if (u.role === 'unit_manager') {
      const name = u.unitName?.trim()
        || (u.name ? `${u.name}'s Unit` : 'Unit');
      unitNameByMgrUid[u.id] = name;
    }
  }

  const priorRanks = priorRanksForBranch(branchUsers, priorWeekReferenceDate(referenceDate), ctx);
  for (const period of PERIODS) {
    doc[PERIOD_KEYS[period]] =
      periodEntries(branchUsers, period, referenceDate, ctx, unitNameByMgrUid, priorRanks);
  }
  return doc;
}

// ── Core compute (pure over loaded inputs) ───────────────────────────────────

function computeLeaderboards(inputs, referenceDate) {
  const { submissions, users, policies, dailiesByAgent } = inputs;
  const ctx = {
    creditsByAgent: ledgerCreditsByAgent(policies),
    weekPointsByAgent: weekPointsByAgent(submissions, dailiesByAgent),
  };

  const { byBranch, skippedNoBranch } = groupByBranch(submissions, users);

  const docs = new Map();
  for (const [branchId, { users: branchUsers }] of byBranch.entries()) {
    const doc = buildLeaderboardDoc(branchUsers, referenceDate, ctx);
    // skippedNoBranch is tenant-wide; written onto every branch doc so any
    // reader can spot it without a separate tenant-level fetch.
    doc.skippedNoBranch = skippedNoBranch;
    docs.set(branchId, doc);
  }

  const priorWeekStarting = priorWeekStartingString(referenceDate);
  const championsDoc = weeklyChampions(users, priorWeekReferenceDate(referenceDate), ctx, priorWeekStarting);

  return { docs, championsDoc, priorWeekStarting, skippedNoBranch };
}

async function computeAndWriteLeaderboards(tenantId, referenceDate = new Date()) {
  const inputs = await loadInputs(tenantId, referenceDate);
  const { docs, championsDoc, priorWeekStarting, skippedNoBranch } =
    computeLeaderboards(inputs, referenceDate);

  if (skippedNoBranch.count > 0) {
    console.warn(
      `[recomputeLeaderboard] tenant=${tenantId} skippedNoBranch=${skippedNoBranch.count} agentIds=${JSON.stringify(skippedNoBranch.agentIds)}`
    );
  }

  const db = admin.firestore();
  const batch = db.batch();
  for (const [branchId, doc] of docs.entries()) {
    batch.set(db.doc(`tenants/${tenantId}/leaderboards/${branchId}`), doc); // full replace — idempotent
  }

  // Tenant-wide weeklyChampions/{weekStarting} doc. Agent-readable (rules in
  // firestore.rules); write-only via the Admin SDK. Doc-id is the prior week's Sunday.
  batch.set(db.doc(`tenants/${tenantId}/weeklyChampions/${priorWeekStarting}`), {
    ...championsDoc,
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return {
    branchCount: docs.size,
    totalSubmissions: inputs.submissions.length,
    totalUsers: inputs.users.length,
    totalPolicies: inputs.policies.length,
    dailyQueries: inputs.dailyQueries,
    skippedNoBranch,
    priorWeekStarting,
  };
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
      console.log(`[recomputeLeaderboardScheduled] tenant=${TENANT_ID} branches=${result.branchCount} subs=${result.totalSubmissions} users=${result.totalUsers} policies=${result.totalPolicies} dailyQueries=${result.dailyQueries}`);
    } catch (err) {
      console.error('[recomputeLeaderboardScheduled]', err);
    }
  });

// Admin-only callable — initial backfill + deterministic smoke triggering.
// Only platform_admin / tenant_admin may invoke; agents/managers get permission-denied.
exports.recomputeLeaderboardOnDemand = functions.https.onCall(withAppCheckMonitor('recomputeLeaderboardOnDemand', async (data, context) => {
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
      totalPolicies: result.totalPolicies,
      priorWeekStarting: result.priorWeekStarting,
    };
  } catch (err) {
    console.error('[recomputeLeaderboardOnDemand]', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
}));

// Pure logic + loaders exported for unit tests and the staging dry-run script.
exports._internals = {
  isParticipant,
  groupByBranch,
  buildLeaderboardDoc,
  loadInputs,
  computeLeaderboards,
  computeAndWriteLeaderboards,
  priorWeekReferenceDate,
  priorWeekStartingString,
};
