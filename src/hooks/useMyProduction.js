import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMostRecentSunday } from '../utils/dateHelpers';
import { getAgentSubmissions } from '../services/submissionService';
import { getGoals, getCompanyMinimums, getGoalHierarchy, getSalesManagerUid } from '../services/goalsService';
import { getMergedAwardsRuleset } from '../services/awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';
import { getAgentHistory } from '../services/persistencyService';
import { getSettlements } from '../services/settlementService';
import { getOwnPolicies } from '../services/policiesService';
import { excludeImported } from '../lib/portfolioImport/excludeImported';
import { deriveYearProduction } from '../lib/ledgerProduction';
import { extractFields } from '../utils/extractFields';

// Data hook for the "My Production" section in ManagerDashboard.
// Mirrors AgentDashboard's loadCoreData/hierarchy/policies pattern scoped to
// the producing manager's own uid. Pass null tenantId/uid to disable all reads
// (used for non-producing manager roles).
export function useMyProduction(tenantId, uid, userProfile) {
  const thisYear = new Date().getFullYear();
  const currentWeek = useMemo(() => getMostRecentSunday(), []);

  const [allSubmissions, setAllSubmissions] = useState([]);
  const [goals, setGoals] = useState(null);
  const [companyMinimums, setCompanyMinimums] = useState(null);
  const [persistency, setPersistency] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [awardsRuleset, setAwardsRuleset] = useState(DEFAULT_RULESET_2026);
  const [loading, setLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState(null);
  const [policies, setPolicies] = useState(null);
  // Same fetch, unfiltered — production is decided by date, not origin (H1 · R5).
  const [policiesAll, setPoliciesAll] = useState(null);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState(false);
  // §1 silent-swallow fix: surfaces a failure of the primary submissions read
  // (the rest of the section — ytdTotals, GapAnalysisPanel, HistoryTab,
  // CommissionPlayground — all derive from allSubmissions, so a silent []
  // fallback here reads as "no production" instead of "couldn't load").
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    if (!uid || !tenantId) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getAgentSubmissions(tenantId, uid).catch((err) => { setLoadError(true); throw err; }),
      getGoals(tenantId, uid).catch(() => null),
      getAgentHistory(tenantId, uid, 12).catch(() => []),
      getSettlements(tenantId, uid, thisYear).catch(() => []),
      getCompanyMinimums(tenantId).catch(() => null),
      getMergedAwardsRuleset(tenantId, thisYear).catch(() => DEFAULT_RULESET_2026),
    ]).then(([subs, agentGoals, pers, setts, mins, ruleset]) => {
      setAllSubmissions(subs);
      setGoals(agentGoals);
      setPersistency(pers);
      setSettlements(setts);
      setCompanyMinimums(mins);
      setAwardsRuleset(ruleset);
    }).catch(console.error).finally(() => setLoading(false));
  }, [uid, tenantId, thisYear]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!uid || !tenantId) return;
    let active = true;
    setHierarchyLoading(true);
    setHierarchyError(null);
    getSalesManagerUid(tenantId)
      .catch(() => null)
      .then((smUid) => {
        if (!active) return null;
        return getGoalHierarchy(tenantId, userProfile?.unitId ?? null, thisYear, uid, smUid);
      })
      .then((res) => { if (active) setHierarchy(res); })
      .catch((e) => {
        if (!active) return;
        console.error(e);
        setHierarchyError('Failed to load goal hierarchy.');
      })
      .finally(() => { if (active) setHierarchyLoading(false); });
    return () => { active = false; };
  }, [uid, tenantId, userProfile?.unitId, thisYear]);

  const loadPolicies = useCallback(async () => {
    if (!uid || !tenantId || policies !== null || policiesLoading) return;
    setPoliciesLoading(true);
    setPoliciesError(false);
    try {
      // `policies` feeds the commission strip, where imported docs were earned
      // outside this system (ruling 5e). `policiesAll` feeds only
      // deriveYearProduction below, which applies the date test (H1 · R5).
      const own = await getOwnPolicies(tenantId, uid);
      setPoliciesAll(own);
      setPolicies(excludeImported(own));
    } catch {
      setPoliciesError(true);
    } finally {
      setPoliciesLoading(false);
    }
  }, [uid, tenantId, policies, policiesLoading]);

  // Production from the LEDGER, same derivation as the agent view (H1).
  const ledgerProduction = useMemo(
    () => (policiesAll
      ? deriveYearProduction(policiesAll, { year: thisYear, weekStarting: currentWeek, submissions: allSubmissions })
      : null),
    [policiesAll, thisYear, currentWeek, allSubmissions],
  );
  const ledgerPending = Boolean(uid && tenantId) && policiesAll === null && !policiesError;

  // Weekly reports are activity; `api` / `apps` are the ledger's settled figures.
  const ytdTotals = useMemo(() => {
    const yearSubs = allSubmissions.filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const activity = yearSubs.reduce((acc, s) => {
      const f = extractFields(s);
      acc.activityApps += parseFloat(f.applicationsSold) || 0;
      acc.ffiConducted += parseFloat(f.ffiConducted)     || 0;
      acc.ciConducted  += parseFloat(f.ciConducted)      || 0;
      acc.dials        += parseFloat(f.totalTelAttempts)  || 0;
      return acc;
    }, { activityApps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 });
    return {
      ...activity,
      api:  ledgerProduction?.settled.api ?? 0,
      apps: ledgerProduction?.settled.apps ?? 0,
    };
  }, [allSubmissions, thisYear, ledgerProduction]);

  const ytdPersistency = useMemo(
    () => persistency[persistency.length - 1]?.persistency ?? null,
    [persistency]
  );

  return {
    allSubmissions, goals, companyMinimums, persistency, settlements, awardsRuleset,
    loading, loadError, hierarchy, hierarchyLoading, hierarchyError,
    policies, policiesLoading, policiesError, loadPolicies,
    ledgerProduction, ledgerPending,
    ytdTotals, ytdPersistency,
    reload: load,
    currentWeek,
  };
}
