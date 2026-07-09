import { extractTotalProductionCredit } from '../../utils/extractFields';

// Trinidad is UTC-4, no DST
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

// Returns the most-recent Sunday on or before `triniDate` as a Date (UTC midnight)
function triniSundayBefore(triniDate) {
  const d = new Date(triniDate);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * getPeriodBoundaries(period, referenceDate?)
 *
 * period: 'week' | 'mtd' | 'quarter' | 'ytd'
 * referenceDate: Date (default: now)
 * returns { start: Date, end: Date } — both in UTC, representing Trinidad-time boundaries
 *
 * Week: Sunday 00:00 TT → Saturday 23:59:59 TT
 * MTD:  1st of current TT month 00:00 → end of current TT day
 * Quarter: 1st of current TT quarter 00:00 → end of current TT day
 * YTD: Jan 1 of current TT year 00:00 → end of current TT day
 */
export function getPeriodBoundaries(period, referenceDate = new Date()) {
  const triniNow = toTriniDate(referenceDate);
  const year = triniNow.getUTCFullYear();
  const month = triniNow.getUTCMonth(); // 0-indexed
  const day = triniNow.getUTCDate();

  // End of current Trinidad day (23:59:59.999 TT = that UTC time + TRINI_OFFSET_MS)
  const endOfTodayTT = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) + TRINI_OFFSET_MS);

  if (period === 'week') {
    const sunday = triniSundayBefore(triniNow);
    // Sunday 00:00 TT → UTC
    const start = new Date(sunday.getTime() + TRINI_OFFSET_MS);
    // Saturday 23:59:59.999 TT → UTC
    const saturday = new Date(sunday);
    saturday.setUTCDate(sunday.getUTCDate() + 6);
    const end = new Date(saturday.getTime() + TRINI_OFFSET_MS + 23 * 3600000 + 59 * 60000 + 59999);
    return { start, end };
  }

  if (period === 'mtd') {
    // 1st of current TT month 00:00 → UTC
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS);
    return { start, end: endOfTodayTT };
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, or 9
    const start = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS);
    return { start, end: endOfTodayTT };
  }

  if (period === 'ytd') {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) + TRINI_OFFSET_MS);
    return { start, end: endOfTodayTT };
  }

  throw new Error(`Unknown period: ${period}`);
}

/**
 * filterSubmissionsByPeriod(submissions, period, referenceDate?)
 *
 * Returns submissions whose weekStarting (YYYY-MM-DD, always a Sunday) falls
 * within the period boundaries. Boundaries are compared as date strings.
 */
export function filterSubmissionsByPeriod(submissions, period, referenceDate = new Date()) {
  const { start, end } = getPeriodBoundaries(period, referenceDate);
  // Convert boundary UTC times back to Trinidad-local strings for comparison
  const startStr = toDateString(toTriniDate(start));
  const endStr = toDateString(toTriniDate(end));

  return (submissions ?? []).filter((s) => {
    const ws = s.weekStarting;
    if (!ws) return false;
    return ws >= startStr && ws <= endStr;
  });
}

/**
 * computeAgentTotals(submissions)
 *
 * Sums production metrics across submissions using V2-aware extractors.
 * Returns { totalApi, totalCommission, totalApps, nb, ppp, lmps }
 */
export function computeAgentTotals(submissions) {
  const totals = {
    totalApi: 0,
    totalCommission: 0,
    totalApps: 0,
    nb: { api: 0, apps: 0 },
    ppp: { api: 0, apps: 0 },
    lmps: { api: 0 },
  };

  for (const s of (submissions ?? [])) {
    totals.totalApi += extractTotalProductionCredit(s);
    totals.totalCommission += Number(s.totalCommission) || 0;

    if (s.version === 2 || s.newBusiness !== undefined) {
      totals.nb.api   += Number(s.newBusiness?.api) || 0;
      totals.nb.apps  += Number(s.newBusiness?.apps) || 0;
      totals.ppp.api  += Number(s.pppIncreases?.apiIncrease) || 0;
      totals.ppp.apps += Number(s.pppIncreases?.apps) || 0;
      totals.lmps.api += Number(s.lumpsums?.apiCredit) || 0;
    } else {
      // V1: all production credited as NB
      const v1Api = Number(s.apiSold) || Number(s.api) || Number(s.annualPremium) || 0;
      const v1Apps = Number(s.applicationsSold) || Number(s.appsSold) || 0;
      totals.nb.api  += v1Api;
      totals.nb.apps += v1Apps;
    }

    totals.totalApps += totals.nb.apps > 0
      ? 0 // already accumulated inside nb.apps above
      : (Number(s.applicationsSold) || Number(s.appsSold) || 0);
  }

  // totalApps = NB apps + PPP apps (LMPS has no distinct app count)
  totals.totalApps = totals.nb.apps + totals.ppp.apps;

  return totals;
}

/**
 * rankAgentsByApi(agentTotalsArray)
 *
 * input: [{ agentId, agentName, unitId, totals }]
 * returns: same array sorted descending by totalApi, with `rank`, `rankWithinUnit` fields.
 * Tie-breaker: apps count desc, then alphabetical name asc.
 */
export function rankAgentsByApi(agentTotalsArray) {
  if (!agentTotalsArray || agentTotalsArray.length === 0) return [];

  const sorted = [...agentTotalsArray].sort((a, b) => {
    const apiDiff = b.totals.totalApi - a.totals.totalApi;
    if (apiDiff !== 0) return apiDiff;
    const appsDiff = b.totals.totalApps - a.totals.totalApps;
    if (appsDiff !== 0) return appsDiff;
    return a.agentName.localeCompare(b.agentName);
  });

  // Assign overall rank
  const ranked = sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));

  // Assign rank within each unit
  const unitGroups = {};
  for (const entry of ranked) {
    const uid = (entry.unitId && entry.unitId !== '__branch_direct__') ? entry.unitId : 'none';
    if (!unitGroups[uid]) unitGroups[uid] = [];
    unitGroups[uid].push(entry);
  }
  // unitGroups are already in sorted (desc API) order
  for (const group of Object.values(unitGroups)) {
    group.forEach((entry, i) => { entry.rankWithinUnit = i + 1; });
  }

  return ranked;
}

/**
 * computeUnitAggregates(unitId, allSubmissions, allAgents)
 *
 * Returns aggregate metrics for agents in the unit.
 * agentCount excludes agents with provisioning: true (already filtered by getTenantUsers).
 */
export function computeUnitAggregates(unitId, allSubmissions, allAgents) {
  const unitAgents = allAgents.filter(
    (a) => a.unitId === unitId && a.provisioning !== true
  );
  const agentIds = new Set(unitAgents.map((a) => a.id));
  const unitSubs = allSubmissions.filter((s) => agentIds.has(s.agentId ?? s.userId ?? ''));
  const totals = computeAgentTotals(unitSubs);
  const agentCount = unitAgents.length;
  const avgApiPerAgent = agentCount > 0 ? totals.totalApi / agentCount : 0;

  return {
    unitId,
    totalApi: totals.totalApi,
    totalCommission: totals.totalCommission,
    totalApps: totals.totalApps,
    nb: totals.nb,
    ppp: totals.ppp,
    lmps: totals.lmps,
    agentCount,
    avgApiPerAgent,
  };
}

/**
 * computeBranchAggregates(allSubmissions, allAgents, allUnitIds)
 *
 * Returns branch-level totals + per-unit breakdown sorted by avgApiPerAgent desc.
 */
export function computeBranchAggregates(allSubmissions, allAgents, allUnitIds) {
  const activeAgents = allAgents.filter((a) => a.provisioning !== true);
  const totals = computeAgentTotals(allSubmissions);
  const agentCount = activeAgents.length;
  const unitCount = allUnitIds.length;

  const unitBreakdown = allUnitIds.map((uid) =>
    computeUnitAggregates(uid, allSubmissions, allAgents)
  ).sort((a, b) => b.avgApiPerAgent - a.avgApiPerAgent);

  return {
    totalApi: totals.totalApi,
    totalCommission: totals.totalCommission,
    totalApps: totals.totalApps,
    nb: totals.nb,
    ppp: totals.ppp,
    lmps: totals.lmps,
    unitCount,
    agentCount,
    avgApiPerAgent: agentCount > 0 ? totals.totalApi / agentCount : 0,
    unitBreakdown,
  };
}

/**
 * rankAgentsByApps(agentTotalsArray)
 *
 * Same input shape as rankAgentsByApi. Sorts descending by totalApps.
 * Tie-breaker: API desc, then name asc.
 */
export function rankAgentsByApps(agentTotalsArray) {
  if (!agentTotalsArray || agentTotalsArray.length === 0) return [];
  const sorted = [...agentTotalsArray].sort((a, b) => {
    const appsDiff = b.totals.totalApps - a.totals.totalApps;
    if (appsDiff !== 0) return appsDiff;
    const apiDiff = b.totals.totalApi - a.totals.totalApi;
    if (apiDiff !== 0) return apiDiff;
    return a.agentName.localeCompare(b.agentName);
  });
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * computeComplianceStats(submissions, agentRoster, weekStarting)
 *
 * Returns { submitted, total, percent } for the given week.
 * total = active agents in roster (provisioning excluded — caller passes filtered roster).
 */
/**
 * deriveProductionDataSource({ settlements })
 *
 * Honest data-source signal for the production-report views' DataSourceBadge.
 * Returns 'confirmed' when the view's rows are backed by confirmed settlement
 * records, 'estimated' otherwise (rows derived from submitted weekly reports).
 *
 * The three production-report views (Agent / Unit / Branch) currently load
 * submissions + users only — they never fetch settlements (read-light rule) —
 * so this resolves to 'estimated' for all of them today. Wiring the badge
 * through this derivation (rather than a hardcoded string) makes it honest and
 * ready to flip to 'confirmed' the moment a view actually loads settlement rows.
 * The per-period settled-state UPGRADE (SETTLED when a specific period's rows
 * come from confirmed settlements) is intentionally deferred — it would require
 * a per-period settlements fetch these views avoid.
 */
export function deriveProductionDataSource({ settlements } = {}) {
  return Array.isArray(settlements) && settlements.length > 0
    ? 'confirmed'
    : 'estimated';
}

export function computeComplianceStats(submissions, agentRoster, weekStarting) {
  const submitted = new Set(
    (submissions ?? [])
      .filter((s) => s.weekStarting === weekStarting && s.status === 'submitted')
      .map((s) => s.agentId ?? s.userId ?? '')
  ).size;

  const total = (agentRoster ?? []).filter((a) => a.provisioning !== true).length;
  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return { submitted, total, percent };
}
