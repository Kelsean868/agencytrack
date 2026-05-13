import { useState, useEffect, useMemo } from 'react';
import { getAllYTDSubmissions, getTenantUsers } from '../services/managerService';
import { getBranchGoals, getUnitGoals, getCompanyMinimums } from '../services/goalsService';
import { extractFields, extractTotalProductionCredit } from '../utils/extractFields';
import { buildManagerActivityEvents } from '../utils/buildManagerActivityEvents';
import { computeEarnedBadges, BADGE_KEY_ORDER } from '../components/gamification/BadgeGrid';

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

  const year   = new Date().getFullYear();
  const unitId = userProfile?.unitId ?? null;

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
  }, [tenantId, role, unitId, year]);

  // In-scope agent IDs
  const inScopeAgentIds = useMemo(() => {
    const agents = users.filter((u) => u.role === 'agent');
    if (role === 'unit_manager' && unitId) {
      return new Set(agents.filter((u) => u.unitId === unitId).map((u) => u.id));
    }
    return new Set(agents.map((u) => u.id));
  }, [users, role, unitId]);

  const inScopeAgentCount = inScopeAgentIds.size;

  // agentId → display name
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u.name ?? u.displayName ?? u.email ?? null; });
    return map;
  }, [users]);

  // Submissions for in-scope agents only
  const scopedSubs = useMemo(
    () => ytdSubs.filter((s) => inScopeAgentIds.has(s.agentId ?? s.userId ?? '')),
    [ytdSubs, inScopeAgentIds]
  );

  // Team YTD API
  const teamYTDAPI = useMemo(
    () => scopedSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0),
    [scopedSubs]
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
    const weeks = [...new Set(scopedSubs.map((s) => s.weekStarting).filter(Boolean))];
    return weeks.sort((a, b) => b.localeCompare(a)).slice(0, 4).reverse();
  }, [scopedSubs]);

  // KPI 4-element arrays: compliance (%), api (TTD), apps (count), ffi (count)
  const kpiData = useMemo(() => {
    const compliance = [];
    const api        = [];
    const apps       = [];
    const ffi        = [];
    const denom      = inScopeAgentCount || 1;

    last4Weeks.forEach((week) => {
      const weekSubs      = scopedSubs.filter((s) => s.weekStarting === week);
      const submittedIds  = new Set(weekSubs.map((s) => s.agentId ?? s.userId ?? ''));
      compliance.push(Math.round((submittedIds.size / denom) * 100));
      api.push(weekSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0));
      apps.push(weekSubs.reduce((sum, s) => sum + (parseFloat(extractFields(s).applicationsSold) || 0), 0));
      ffi.push(weekSubs.reduce((sum, s) => sum + (parseFloat(extractFields(s).ffiConducted) || 0), 0));
    });

    return { compliance, api, apps, ffi };
  }, [scopedSubs, last4Weeks, inScopeAgentCount]);

  // Activity feed events (last 14 days)
  const activityEvents = useMemo(
    () => buildManagerActivityEvents(scopedSubs, userMap, new Date()),
    [scopedSubs, userMap]
  );

  // Team badge counts: { key, count } sorted by count desc, top 8
  const badgeCounts = useMemo(() => {
    if (scopedSubs.length === 0) return [];

    const byAgent = {};
    scopedSubs.forEach((s) => {
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
  }, [scopedSubs]);

  return {
    loading,
    error,
    teamYTDAPI,
    teamAnnualGoal,
    goalSet,
    inScopeAgentCount,
    kpiData,
    activityEvents,
    badgeCounts,
  };
}
