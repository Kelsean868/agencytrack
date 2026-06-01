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
  filterSubmissionsByPeriod,
  getPeriodBoundaries,
} = require('./rankingLogic');

const TENANT_ID = 'tatillife_south'; // SEC-9c, mirrors index.js scheduled CFs
const PERIODS = ['week', 'mtd', 'quarter', 'ytd'];
const PERIOD_KEYS = { week: 'week', mtd: 'mtd', quarter: 'qtd', ytd: 'ytd' };

// ── Inputs: load tenant submissions (calendar YTD + 14-day cushion) + users ──
//
// P5-prep widens the lower bound by 14 days into the prior calendar year. The
// CF now needs the most-recently-completed week (`prevSunday`) for
// `previousRank` + `weeklyChampions/{weekStarting}`. If `referenceDate` falls
// in the first week of January, `prevSunday` is in late December of the prior
// year — outside the original `${year}-01-01` lower bound. The 14-day cushion
// guarantees prior-week data is present without a second query.

function padDateString(yyyy, mm, dd) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function dateMinusDays(refDate, days) {
  const d = new Date(refDate.getTime() - days * 24 * 3600 * 1000);
  return padDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

async function loadInputs(tenantId, referenceDate) {
  const db = admin.firestore();
  const year = referenceDate.getFullYear();

  // Cushion lower bound by 14 days so the prior-week submissions (needed for
  // previousRank + weeklyChampions) are guaranteed to be in the loaded set
  // even when referenceDate falls in the first week of January.
  const lowerBound = dateMinusDays(new Date(Date.UTC(year, 0, 1)), 14);

  const [subsSnap, usersSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/submissions`)
      .where('weekStarting', '>=', lowerBound)
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

// ── Champions field extractors (P5-prep) ─────────────────────────────────────
//
// Mirrors `src/utils/extractFields.js` for the THREE fields the retired
// WeeklyChampionsBanner used (applicationsSold + ffiConducted + ciConducted),
// handling nested schema (s.step1...) and flat (current wizard) + v2.
// PPP apps are NOT counted in `topApps` to match the retired banner's
// `parseFloat(f.applicationsSold)` semantic (NB only).

function num(v) { return Number(v) || 0; }

function extractApplicationsSold(s) {
  if (!s) return 0;
  // Nested schema (step1..step9)
  if (s.step1 !== undefined) {
    const s4 = s.step4 || {};
    return num(s4.applicationsSold);
  }
  // Flat v2 — NB.apps only (matches retired banner)
  if (s.version === 2 || s.newBusiness !== undefined) {
    return num(s.newBusiness && s.newBusiness.apps);
  }
  // Flat v1
  return num(s.applicationsSold) || num(s.appsSold);
}

function extractFFIConducted(s) {
  if (!s) return 0;
  if (s.step1 !== undefined) {
    const s3 = s.step1.ffiConducted !== undefined ? s.step1 : (s.step3 || {});
    return num(s3.ffiConducted);
  }
  return num(s.ffiConducted);
}

function extractCIConducted(s) {
  if (!s) return 0;
  if (s.step1 !== undefined) {
    const s4 = s.step4 || {};
    return num(s4.ciConducted);
  }
  return num(s.ciConducted);
}

function extractActivity(s) {
  return extractFFIConducted(s) + extractCIConducted(s) + extractApplicationsSold(s);
}

// ── Champions extraction (P5-prep) ───────────────────────────────────────────
//
// Tenant-wide top-1 per category from the prior week's submissions. Matches
// the retired banner's semantics (top-1, ties broken by agentName, null when
// no agent posted a positive value). Tenant-wide scope (NOT per-branch).
// Uses extractTotalProductionCredit (in rankingLogic.js) for API.

function computeWeeklyChampions(priorWeekSubs, users, weekStarting) {
  if (!Array.isArray(priorWeekSubs) || priorWeekSubs.length === 0) {
    return { topAPI: null, topApps: null, topActivity: null, weekStarting };
  }

  const nameByAgent = new Map();
  for (const u of users) {
    if (u && u.id) nameByAgent.set(u.id, u.name || u.email || u.id);
  }

  // Per-agent totals for the prior week.
  const byAgent = new Map();
  const { extractTotalProductionCredit } = require('./rankingLogic');
  for (const s of priorWeekSubs) {
    const agentId = s.agentId == null ? s.userId : s.agentId;
    if (!agentId) continue;
    // Skip submissions from non-agent uids (UMs etc.) — defensive, mirrors
    // groupByBranch + rankForLeaderboard agent-only filtering.
    const u = users.find((x) => x.id === agentId);
    if (!u || u.role !== 'agent' || u.provisioning === true) continue;

    const cur = byAgent.get(agentId) || { api: 0, apps: 0, activity: 0 };
    cur.api      += num(extractTotalProductionCredit(s));
    cur.apps     += extractApplicationsSold(s);
    cur.activity += extractActivity(s);
    byAgent.set(agentId, cur);
  }

  function pickTop(metric) {
    let best = null;
    for (const [agentId, totals] of byAgent.entries()) {
      const value = totals[metric];
      if (!(value > 0)) continue;
      const agentName = nameByAgent.get(agentId) || agentId;
      if (
        best === null
        || value > best.value
        || (value === best.value && agentName.localeCompare(best.agentName) < 0)
      ) {
        best = { agentId, agentName, value };
      }
    }
    return best;
  }

  return {
    topAPI:      pickTop('api'),
    topApps:     pickTop('apps'),
    topActivity: pickTop('activity'),
    weekStarting,
  };
}

// ── previousRank helper (P5-prep) ────────────────────────────────────────────
//
// Computes the prior-week branch ranking for every branch in `byBranch` and
// returns a Map<agentId, priorRank>. The map is tenant-wide; ranks are scoped
// to each agent's own branch (branch-scoped previousRank, matching current
// branch rank).
//
// Implementation: filter `submissions` to the prior week via
// filterSubmissionsByPeriod, then groupByBranch the prior-week subset (same
// grouping function), then call rankForLeaderboard per branch.

function computePriorRankByAgent(submissions, users, referenceDate, groupByBranchFn) {
  const priorRef = priorWeekReferenceDate(referenceDate);
  const priorWeekSubs = filterSubmissionsByPeriod(submissions, 'week', priorRef);
  const { byBranch: priorByBranch } = groupByBranchFn(priorWeekSubs, users);

  const priorRankByAgent = new Map();
  for (const [/* branchId */, { subs, users: branchUsers }] of priorByBranch.entries()) {
    const ranked = rankForLeaderboard(subs, branchUsers, 'week', priorRef);
    // Record every agent in the prior-week ranking — INCLUDING those with
    // periodApi=0 ("ranked-$0" agents tied at the bottom). The current-week
    // ranking treats $0 agents the same way (they appear in the doc's entry
    // list at the bottom), so previousRank must too — otherwise low
    // performers lose movement data and the chip semantics drift from
    // current-week. The `?? null` fallback in buildLeaderboardDoc handles
    // the genuinely-absent case (agent's branchId is missing → excluded from
    // groupByBranch in BOTH prior- and current-week, so they don't appear in
    // the leaderboard doc at all, so previousRank-null never surfaces).
    for (const entry of ranked) {
      priorRankByAgent.set(entry.agentId, entry.rank);
    }
  }
  return { priorRankByAgent, priorWeekSubs };
}

// ── Branch grouping via agentId → branchId join on user docs ─────────────────
//
// Submissions carry only `unitId`; no `branchId` field, no `units` collection
// mapping unitId → branchId. The CF reads ALL user docs and uses each agent's
// own `branchId` field to group their submissions.

// ATTRIBUTION SEMANTICS — current-branch attribution:
//   A submission is bucketed to the agent's CURRENT branchId (read from the
//   live user doc at compute time). Mid-year movers' historical production
//   follows them to their current branch. This matches BranchManagerProductionView
//   and is the natural default; an FU would be needed to support
//   historical-branch attribution (submission carries denormalized branchId at
//   write time).
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

// ── Per-branch×period composition + map to leaderboard entry shape ───────────
//
// P5-prep additions to the entry shape:
//   - `unitId` (all periods) — passthrough from rankForLeaderboard, was being
//     dropped before. Enables client-side unit-scoping (P5a).
//   - `previousRank` (WEEK only; null for MTD/QTD/YTD) — branch-scoped
//     prior-WAR-week rank. Enables the week-over-week movement chip.

function buildLeaderboardDoc(branchSubs, branchUsers, referenceDate, priorRankByAgent) {
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

  const priorRanks = priorRankByAgent instanceof Map ? priorRankByAgent : new Map();

  for (const period of PERIODS) {
    const ranked = rankForLeaderboard(branchSubs, branchUsers, period, referenceDate);
    const isWeek = period === 'week';
    doc[PERIOD_KEYS[period]] = ranked.map((entry) => ({
      agentId:        entry.agentId,
      name:           entry.name,
      unitId:         entry.unitId == null ? null : entry.unitId,
      unitName:       entry.unitId ? (unitNameByMgrUid[entry.unitId] || null) : null,
      periodApi:      entry.periodApi,
      apps:           entry.apps,
      rank:           entry.rank,
      rankWithinUnit: entry.rankWithinUnit,
      previousRank:   isWeek ? (priorRanks.get(entry.agentId) ?? null) : null,
    }));
  }

  return doc;
}

// ── Core compute-and-write ───────────────────────────────────────────────────

async function computeAndWriteLeaderboards(tenantId, referenceDate = new Date()) {
  const { submissions, users } = await loadInputs(tenantId, referenceDate);

  const { byBranch, skippedNoBranch } = groupByBranch(submissions, users);

  // Surface the skip count in CF logs. Migration gaps in agent branchId are
  // not safety-critical (a buggy CF writes a doc nothing reads until P3),
  // but they're worth flagging so they don't accumulate silently.
  if (skippedNoBranch.count > 0) {
    console.warn(
      `[recomputeLeaderboard] tenant=${tenantId} skippedNoBranch=${skippedNoBranch.count} agentIds=${JSON.stringify(skippedNoBranch.agentIds)}`
    );
  }

  // P5-prep: ONE prior-week computation feeds BOTH previousRank (per-branch
  // ranking, used by the WEEK entries) AND the tenant-wide champions doc.
  // Filter the already-loaded submissions to the prior WAR week, then derive
  // both outputs from the same subset.
  const { priorRankByAgent, priorWeekSubs } = computePriorRankByAgent(
    submissions, users, referenceDate, groupByBranch
  );
  const priorWeekStarting = priorWeekStartingString(referenceDate);
  const championsDoc = computeWeeklyChampions(priorWeekSubs, users, priorWeekStarting);

  const db = admin.firestore();
  const batch = db.batch();

  let branchCount = 0;
  for (const [branchId, { subs, users: branchUsers }] of byBranch.entries()) {
    const doc = buildLeaderboardDoc(subs, branchUsers, referenceDate, priorRankByAgent);
    // Doc-level metadata: skippedNoBranch is tenant-wide (not per-branch);
    // we write it onto every per-branch doc so any reader can spot it without
    // a separate tenant-level metadata fetch.
    doc.skippedNoBranch = skippedNoBranch;
    const ref = db.doc(`tenants/${tenantId}/leaderboards/${branchId}`);
    batch.set(ref, doc); // full replace — idempotent
    branchCount++;
  }

  // P5-prep: tenant-wide weeklyChampions/{weekStarting} doc. Agent-readable
  // (rules in firestore.rules); write-only via the Admin SDK (bypasses rules).
  // Doc-id is the prior-week's Sunday (matches the retired banner's
  // `weekStarting` semantic + the doc lookup the re-homed banner will do).
  const championsRef = db.doc(`tenants/${tenantId}/weeklyChampions/${priorWeekStarting}`);
  batch.set(championsRef, {
    ...championsDoc,
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return {
    branchCount,
    totalSubmissions: submissions.length,
    totalUsers: users.length,
    skippedNoBranch,
    priorWeekStarting,
    championsPriorWeekAgents: priorWeekSubs.length,
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
      priorWeekStarting: result.priorWeekStarting,
      championsPriorWeekAgents: result.championsPriorWeekAgents,
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
  // P5-prep additions
  computeWeeklyChampions,
  computePriorRankByAgent,
  priorWeekReferenceDate,
  priorWeekStartingString,
  extractApplicationsSold,
  extractFFIConducted,
  extractCIConducted,
  extractActivity,
};
