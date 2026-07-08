import { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllYTDSubmissions, getTenantUsers } from '../services/managerService';
import { getBranchGoals, getUnitGoals, getCompanyMinimums } from '../services/goalsService';
import { extractFields, extractTotalProductionCredit } from '../utils/extractFields';
import { buildManagerActivityEvents } from '../utils/buildManagerActivityEvents';
import { computeEarnedBadges, BADGE_KEY_ORDER } from '../components/gamification/BadgeGrid';
import { UM_MANDATORY_FILING_CUTOFF } from '../utils/complianceDerive';

/**
 * useBranchOverview — composing hook for the M2 Manager Overview hero.
 *
 * Fires 3 parallel Firestore reads on mount, applies role-based scope,
 * and returns all derived data for the 4 hero sections. Single fetch per
 * dashboard mount; all aggregations are memoized.
 *
 * Role scoping:
 *   unit_manager  → agents where agent.unitId === userProfile.unitId
 *   branch_manager / sales_manager → all agents in tenant
 */
export function useBranchOverview(role, userProfile, tenantId) {
  const [ytdSubs, setYtdSubs]       = useState([]);
  const [users, setUsers]           = useState([]);
  const [teamGoalDoc, setTeamGoalDoc] = useState(null);
  const [companyMins, setCompanyMins] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  // Bumped by reload() to force the effect below to re-run on demand (§1
  // states contract — the error card's Retry button needs a real re-fetch).
  const [reloadToken, setReloadToken] = useState(0);

  const year   = new Date().getFullYear();
  const unitId = userProfile?.unitId ?? null;

  // Stable "now" for the activityEvents memo so its identity doesn't churn each
  // render (EFF-009). `year` above stays a plain number — primitives don't churn.
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);

    const goalRead =
      role === 'unit_manager' && unitId
        ? getUnitGoals(tenantId, unitId, year).catch(() => null)
        : getBranchGoals(tenantId, year).catch(() => null);

    Promise.all([
      getAllYTDSubmissions(tenantId).catch(() => []),
      getTenantUsers(tenantId).catch(() => []),
      goalRead,
      getCompanyMinimums(tenantId).catch(() => null),
    ])
      .then(([subs, userList, goalDoc, mins]) => {
        setYtdSubs(subs);
        setUsers(userList);
        setTeamGoalDoc(goalDoc);
        setCompanyMins(mins);
      })
      .catch((err) => {
        console.error('useBranchOverview fetch failed:', err);
        setError('Failed to load team overview.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, role, unitId, year, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // Compliance scope: agents only — drives inScopeAgentCount (goal fallback) and
  // the pre-cutoff denominator. Never includes UMs or BMs.
  const complianceScopeIds = useMemo(() => {
    const agents = users.filter((u) => u.role === 'agent');
    if (role === 'unit_manager' && unitId) {
      return new Set(agents.filter((u) => u.unitId === unitId).map((u) => u.id));
    }
    return new Set(agents.map((u) => u.id));
  }, [users, role, unitId]);

  const inScopeAgentCount = complianceScopeIds.size;

  // UMs who become mandatory filers at the cutoff. Role-scoped same as agents.
  const umComplianceScopeIds = useMemo(() => {
    const ums = users.filter((u) => u.role === 'unit_manager');
    if (role === 'unit_manager' && unitId) {
      return new Set(ums.filter((u) => u.unitId === unitId).map((u) => u.id));
    }
    return new Set(ums.map((u) => u.id));
  }, [users, role, unitId]);

  // Production scope: agents + unit managers + branch managers — drives teamYTDAPI and sparklines.
  // BMs added in Slice 2.1b: BM personal production rolls into branch totals (sentinel unitId).
  const productionScopeIds = useMemo(() => {
    const producers = users.filter(
      (u) => u.role === 'agent' || u.role === 'unit_manager' || u.role === 'branch_manager'
    );
    if (role === 'unit_manager' && unitId) {
      return new Set(producers.filter((u) => u.unitId === unitId).map((u) => u.id));
    }
    return new Set(producers.map((u) => u.id));
  }, [users, role, unitId]);

  // agentId → display name
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u.name ?? u.displayName ?? u.email ?? null; });
    return map;
  }, [users]);

  // Production submissions (agents + UMs) — drives teamYTDAPI and production sparklines
  const productionScopedSubs = useMemo(
    () => ytdSubs.filter((s) => productionScopeIds.has(s.agentId ?? s.userId ?? '')),
    [ytdSubs, productionScopeIds]
  );

  // Compliance submissions (agents + UMs) — kpiData loop filters per-week by cutoff.
  const complianceScopedSubs = useMemo(() => {
    const allIds = new Set([...complianceScopeIds, ...umComplianceScopeIds]);
    return ytdSubs.filter((s) => allIds.has(s.agentId ?? s.userId ?? ''));
  }, [ytdSubs, complianceScopeIds, umComplianceScopeIds]);

  // Team YTD API — includes UM personal production
  const teamYTDAPI = useMemo(
    () => productionScopedSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0),
    [productionScopedSubs]
  );

  // Team Annual Goal — branch/unit goal, fallback to company floor × agent count
  const { teamAnnualGoal, goalSet } = useMemo(() => {
    const goalAPI = parseFloat(teamGoalDoc?.api) > 0 ? parseFloat(teamGoalDoc.api) : null;
    if (goalAPI) return { teamAnnualGoal: goalAPI, goalSet: true };
    const fallback =
      companyMins?.annualAPI > 0 && inScopeAgentCount > 0
        ? companyMins.annualAPI * inScopeAgentCount
        : 0;
    return { teamAnnualGoal: fallback, goalSet: false };
  }, [teamGoalDoc, companyMins, inScopeAgentCount]);

  // Last 4 unique submission weeks (oldest → newest) for KPI sparklines
  const last4Weeks = useMemo(() => {
    const weeks = [...new Set(productionScopedSubs.map((s) => s.weekStarting).filter(Boolean))];
    return weeks.sort((a, b) => b.localeCompare(a)).slice(0, 4).reverse();
  }, [productionScopedSubs]);

  // KPI 4-element arrays: compliance (%), api (TTD), apps (count), ffi (count)
  const kpiData = useMemo(() => {
    const compliance = [];
    const api        = [];
    const apps       = [];
    const ffi        = [];

    // Pre-compute merged set for post-cutoff weeks (agents + UMs).
    const allComplianceIds = new Set([...complianceScopeIds, ...umComplianceScopeIds]);
    const umCount = umComplianceScopeIds.size;

    last4Weeks.forEach((week) => {
      const prodWeekSubs = productionScopedSubs.filter((s) => s.weekStarting === week);
      const compWeekSubs = complianceScopedSubs.filter((s) => s.weekStarting === week);

      // Per-week scope: agents always + UMs iff week >= cutoff (historical preserved).
      const umInScope = week >= UM_MANDATORY_FILING_CUTOFF;
      const weekScope = umInScope ? allComplianceIds : complianceScopeIds;
      const denom = (inScopeAgentCount + (umInScope ? umCount : 0)) || 1;

      const submittedIds = new Set(
        compWeekSubs
          .filter((s) => weekScope.has(s.agentId ?? s.userId ?? ''))
          .map((s) => s.agentId ?? s.userId ?? '')
      );
      compliance.push(Math.round((submittedIds.size / denom) * 100));
      api.push(prodWeekSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0));
      apps.push(prodWeekSubs.reduce((sum, s) => sum + (parseFloat(extractFields(s).applicationsSold) || 0), 0));
      ffi.push(prodWeekSubs.reduce((sum, s) => sum + (parseFloat(extractFields(s).ffiConducted) || 0), 0));
    });

    return { compliance, api, apps, ffi };
  }, [productionScopedSubs, complianceScopedSubs, last4Weeks, inScopeAgentCount, complianceScopeIds, umComplianceScopeIds]);

  // Activity feed events (last 14 days)
  const activityEvents = useMemo(
    () => buildManagerActivityEvents(productionScopedSubs, userMap, now),
    [productionScopedSubs, userMap, now]
  );

  // Team badge counts: { key, count } sorted by count desc, top 8
  const badgeCounts = useMemo(() => {
    if (productionScopedSubs.length === 0) return [];

    const byAgent = {};
    productionScopedSubs.forEach((s) => {
      const aid = s.agentId ?? s.userId ?? '';
      if (!aid) return;
      (byAgent[aid] = byAgent[aid] ?? []).push(s);
    });

    const counts = {};
    Object.values(byAgent).forEach((agentSubs) => {
      computeEarnedBadges(agentSubs).forEach((key) => {
        counts[key] = (counts[key] ?? 0) + 1;
      });
    });

    return BADGE_KEY_ORDER
      .filter((key) => (counts[key] ?? 0) > 0)
      .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
      .slice(0, 8)
      .map((key) => ({ key, count: counts[key] }));
  }, [productionScopedSubs]);

  return {
    loading,
    error,
    reload,
    teamYTDAPI,
    teamAnnualGoal,
    goalSet,
    inScopeAgentCount,
    kpiData,
    activityEvents,
    badgeCounts,
  };
}
