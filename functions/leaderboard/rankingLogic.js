'use strict';

// Mirrors src/lib/productionReport/computations.js (+ rankForLeaderboard composition)
// — sync if either changes; guarded by the cross-check test
// (src/lib/productionReport/__tests__/cross-check-cjs.test.js).
//
// Foundation for the P1b leaderboard-aggregate Cloud Function. Pure logic —
// zero firebase-admin / Firestore deps so it can be unit-tested under Jest
// (functions/__tests__) AND cross-checked under vitest (src/.../__tests__).
//
// Subset mirrored from the src ESM source:
//   - getPeriodBoundaries(period, referenceDate)
//   - filterSubmissionsByPeriod(submissions, period, referenceDate)
//   - computeAgentTotals(submissions)
//   - rankAgentsByApi(agentTotalsArray)
//   - extractTotalProductionCredit(submission)
//
// Plus the composition (not yet on main as ESM — re-authored here CJS-side):
//   - rankForLeaderboard(allSubmissions, allUsers, period, referenceDate)
//     => array of { agentId, name, unitId, periodApi, apps, rank, rankWithinUnit }
//
// SYNC DISCIPLINE: any edit to the src functions must be mirrored here AND
// vice-versa. The vitest cross-check test runs shared fixtures through both
// modules and asserts identical output — CI-fails on drift.

// ── Date helpers (TT = UTC-4, no DST) ────────────────────────────────────────

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function toTriniDate(utcDate) {
  return new Date(utcDate.getTime() - TRINI_OFFSET_MS);
}

function toDateString(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function triniSundayBefore(triniDate) {
  const d = new Date(triniDate);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── extractTotalProductionCredit — mirrors src/utils/extractFields.js ────────

function extractTotalProductionCredit(submission) {
  if (!submission) return 0;
  if (submission.totalProductionCredit !== undefined) {
    return Number(submission.totalProductionCredit) || 0;
  }
  if (submission.newBusiness !== undefined) {
    const nb   = Number(submission.newBusiness && submission.newBusiness.api) || 0;
    const ppp  = Number(submission.pppIncreases && submission.pppIncreases.apiIncrease) || 0;
    const lmps = Number(submission.lumpsums && submission.lumpsums.apiCredit) || 0;
    return nb + ppp + lmps;
  }
  return (
    Number(submission.apiSold) ||
    Number(submission.api) ||
    Number(submission.annualPremium) ||
    0
  );
}

// ── getPeriodBoundaries ──────────────────────────────────────────────────────

function getPeriodBoundaries(period, referenceDate = new Date()) {
  const triniNow = toTriniDate(referenceDate);
  const year = triniNow.getUTCFullYear();
  const month = triniNow.getUTCMonth(); // 0-indexed
  const day = triniNow.getUTCDate();

  const endOfTodayTT = new Date(
    Date.UTC(year, month, day, 23, 59, 59, 999) + TRINI_OFFSET_MS
  );

  if (period === 'week') {
    const sunday = triniSundayBefore(triniNow);
    const start = new Date(sunday.getTime() + TRINI_OFFSET_MS);
    const saturday = new Date(sunday);
    saturday.setUTCDate(sunday.getUTCDate() + 6);
    const end = new Date(
      saturday.getTime() + TRINI_OFFSET_MS + 23 * 3600000 + 59 * 60000 + 59999
    );
    return { start, end };
  }

  if (period === 'mtd') {
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS);
    return { start, end: endOfTodayTT };
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, or 9
    const start = new Date(
      Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS
    );
    return { start, end: endOfTodayTT };
  }

  if (period === 'ytd') {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS);
    return { start, end: endOfTodayTT };
  }

  throw new Error(`Unknown period: ${period}`);
}

// ── filterSubmissionsByPeriod ────────────────────────────────────────────────

function filterSubmissionsByPeriod(submissions, period, referenceDate = new Date()) {
  const { start, end } = getPeriodBoundaries(period, referenceDate);
  const startStr = toDateString(toTriniDate(start));
  const endStr = toDateString(toTriniDate(end));

  return (submissions || []).filter((s) => {
    const ws = s.weekStarting;
    if (!ws) return false;
    return ws >= startStr && ws <= endStr;
  });
}

// ── computeAgentTotals ───────────────────────────────────────────────────────

function computeAgentTotals(submissions) {
  const totals = {
    totalApi: 0,
    totalCommission: 0,
    totalApps: 0,
    nb: { api: 0, apps: 0 },
    ppp: { api: 0, apps: 0 },
    lmps: { api: 0 },
  };

  for (const s of submissions || []) {
    totals.totalApi += extractTotalProductionCredit(s);
    totals.totalCommission += Number(s.totalCommission) || 0;

    if (s.version === 2 || s.newBusiness !== undefined) {
      totals.nb.api   += Number(s.newBusiness && s.newBusiness.api) || 0;
      totals.nb.apps  += Number(s.newBusiness && s.newBusiness.apps) || 0;
      totals.ppp.api  += Number(s.pppIncreases && s.pppIncreases.apiIncrease) || 0;
      totals.ppp.apps += Number(s.pppIncreases && s.pppIncreases.apps) || 0;
      totals.lmps.api += Number(s.lumpsums && s.lumpsums.apiCredit) || 0;
    } else {
      const v1Api = Number(s.apiSold) || Number(s.api) || Number(s.annualPremium) || 0;
      const v1Apps = Number(s.applicationsSold) || Number(s.appsSold) || 0;
      totals.nb.api  += v1Api;
      totals.nb.apps += v1Apps;
    }

    totals.totalApps += totals.nb.apps > 0
      ? 0
      : (Number(s.applicationsSold) || Number(s.appsSold) || 0);
  }

  totals.totalApps = totals.nb.apps + totals.ppp.apps;

  return totals;
}

// ── rankAgentsByApi ──────────────────────────────────────────────────────────

function rankAgentsByApi(agentTotalsArray) {
  if (!agentTotalsArray || agentTotalsArray.length === 0) return [];

  const sorted = [...agentTotalsArray].sort((a, b) => {
    const apiDiff = b.totals.totalApi - a.totals.totalApi;
    if (apiDiff !== 0) return apiDiff;
    const appsDiff = b.totals.totalApps - a.totals.totalApps;
    if (appsDiff !== 0) return appsDiff;
    return a.agentName.localeCompare(b.agentName);
  });

  const ranked = sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));

  const unitGroups = {};
  for (const entry of ranked) {
    const uid = entry.unitId == null ? 'none' : entry.unitId;
    if (!unitGroups[uid]) unitGroups[uid] = [];
    unitGroups[uid].push(entry);
  }
  for (const group of Object.values(unitGroups)) {
    group.forEach((entry, i) => { entry.rankWithinUnit = i + 1; });
  }

  return ranked;
}

// ── rankForLeaderboard — composition (server-side) ───────────────────────────
//
// Server-side analogue of the (draft, not yet on main) src/.../rankForLeaderboard.js
// selector. Returns a stable consumer shape for the leaderboard aggregate doc.
//
// Branch scope: caller of this fn is responsible for narrowing `allSubmissions`
// + `allUsers` to a single branch before invocation. This fn does NOT filter
// by branchId — the P1b CF groups by branch via the user-doc join and calls
// this once per branch with already-narrowed inputs.

function rankForLeaderboard(allSubmissions, allUsers, period, referenceDate) {
  const submissions = allSubmissions || [];
  const users       = allUsers || [];

  // Active agents only (excludes managers, provisioning stubs).
  const agents = users.filter(
    (u) => u.role === 'agent' && u.provisioning !== true
  );

  const agentTotals = agents.map((u) => {
    const ownSubs = submissions.filter(
      (s) => (s.agentId == null ? s.userId : s.agentId) === u.id
    );
    const periodSubs = filterSubmissionsByPeriod(ownSubs, period, referenceDate);
    return {
      agentId:   u.id,
      agentName: u.name || u.email || u.id,
      unitId:    u.unitId == null ? null : u.unitId,
      totals:    computeAgentTotals(periodSubs),
    };
  });

  const rawRanked = rankAgentsByApi(agentTotals);

  return rawRanked.map((entry) => ({
    agentId:        entry.agentId,
    name:           entry.agentName,
    unitId:         entry.unitId,
    periodApi:      entry.totals.totalApi,
    apps:           entry.totals.totalApps,
    rank:           entry.rank,
    rankWithinUnit: entry.rankWithinUnit,
  }));
}

module.exports = {
  // Period
  getPeriodBoundaries,
  filterSubmissionsByPeriod,
  // Totals
  extractTotalProductionCredit,
  computeAgentTotals,
  // Rank
  rankAgentsByApi,
  rankForLeaderboard,
};
