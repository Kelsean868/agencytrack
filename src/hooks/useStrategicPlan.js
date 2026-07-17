import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTenantUsers, getAllYTDSubmissions } from '../services/managerService';
import { getPoliciesForManager } from '../services/policiesService';
import { getBranchGoals, getGoalsForAgents } from '../services/goalsService';
import { getPersistencyForAgentIds } from '../services/persistencyService';
import { getCandidatesForBoard } from '../services/recruitingService';
import { getBranch } from '../services/branchService';
import { producingRoster } from '../lib/strategicPlan/unitGrouping';
import { periodSettlementByAgent } from '../lib/strategicPlan/settledTwinRun';
import { yearWindow, defaultPeriod } from '../lib/strategicPlan/periodModel';
import {
  assembleAgentTrackerRows, assembleProductionSummary, assemblePeriodMetrics,
  assembleOrgStructure, assembleRecruitment,
} from '../lib/strategicPlan/assembleModel';

// Track K — Strategic Plan data hook. THE single math path: fetches branch-scoped
// data once, then every section model is assembled by the pure lib/strategicPlan
// functions. Dashboard, presentation mode, and PDF all consume this — numbers can
// never disagree across render targets.
//
// Scoping: branch_manager fetchers auto-scope to the caller's own branch;
// SM/TA/PA fetchers return tenant-wide, so every dataset is additionally
// client-filtered to `branchId`. Client-only — no rules/schema/functions change.
//
// Period granularity affects ONLY assembly (quarter/half windowing) — all fetches
// are annual + branch-scoped, so toggling the period re-assembles with no refetch.
export function useStrategicPlan(branchId, period) {
  const { user, userProfile, role, tenantId } = useAuth();
  const effPeriod = period ?? defaultPeriod();
  const year = effPeriod.year;

  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sectionErr, setSectionErr] = useState({});

  const load = useCallback(async () => {
    // No branch to plan (cross-branch role with no active branches, or before a
    // branch is picked): resolve to a not-loading empty state, not a stuck spinner.
    if (!tenantId || !branchId || !user?.uid) { setRaw(null); setError(false); setLoading(false); return; }
    setLoading(true);
    setError(false);
    setSectionErr({});
    const errs = {};

    try {
      // Phase 1 — branch-level datasets (all annual / branch-scoped).
      const [users, submissions, policies, branchGoals, candidates, branchDoc] = await Promise.all([
        getTenantUsers(tenantId),
        getAllYTDSubmissions(tenantId).catch(() => { errs.production = true; return []; }),
        getPoliciesForManager(tenantId, { role, uid: user.uid, branchId }).catch(() => { errs.production = true; return []; }),
        getBranchGoals(tenantId, year).catch(() => null),
        getCandidatesForBoard({ tenantId, role, branchId, ownerUid: user.uid }).catch(() => { errs.recruitment = true; return []; }),
        getBranch(tenantId, branchId).catch(() => null),
      ]);

      // Client-side branch narrowing (no-op for BM; scopes the tenant-wide reads
      // for SM/TA/PA to the selected branch).
      const branchUsers = users.filter((u) => u.branchId === branchId);
      const branchSubs = submissions.filter((s) => s.branchId === branchId);
      const branchPolicies = policies.filter((p) => p.branchId === branchId);
      const branchCandidates = candidates.filter((c) => c.branchId === branchId);

      const roster = producingRoster(branchUsers);
      const rosterIds = roster.map((u) => u.id);

      // Phase 2 — roster-scoped reads (persistency incl. producing UMs; per-agent goals).
      const [persistencyByAgent, goalsByAgent] = await Promise.all([
        getPersistencyForAgentIds(tenantId, year, rosterIds).catch(() => { errs.persistency = true; return {}; }),
        getGoalsForAgents(tenantId, rosterIds).catch(() => ({})),
      ]);

      const branchName = branchDoc?.name
        ?? (branchUsers.find((u) => u.role === 'branch_manager')?.branchId)
        ?? branchId;
      const author = branchUsers.find((u) => u.role === 'branch_manager');
      const authorName = author?.name ?? author?.displayName ?? userProfile?.name ?? 'Branch Manager';

      setRaw({
        branchUsers, branchSubs, branchPolicies, branchGoals, branchCandidates,
        roster, persistencyByAgent, goalsByAgent, branchName, authorName,
      });
      setSectionErr(errs);
    } catch (e) {
      console.error('[useStrategicPlan] load failed', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tenantId, branchId, user?.uid, role, userProfile?.name, year]);

  useEffect(() => { load(); }, [load]);

  const model = useMemo(() => {
    if (!raw) return null;
    const {
      branchUsers, branchSubs, branchPolicies, branchGoals, branchCandidates,
      roster, persistencyByAgent, goalsByAgent, branchName, authorName,
    } = raw;

    const fy = yearWindow(year);
    const settledByAgent = periodSettlementByAgent(branchPolicies, fy);

    const rows = assembleAgentTrackerRows({
      roster, ytdSubmissions: branchSubs, settledByAgent, persistencyByAgent, goalsByAgent, year,
    });
    const production = assembleProductionSummary({
      ytdSubmissions: branchSubs, policies: branchPolicies, branchGoals, persistencyByAgent, year,
    });
    const periodMetrics = assemblePeriodMetrics({
      ytdSubmissions: branchSubs, policies: branchPolicies, branchGoals, roster, period: effPeriod,
    });
    const orgStructure = assembleOrgStructure({
      branchUsers, ytdSubmissions: branchSubs, policies: branchPolicies, year,
    });
    const recruitment = assembleRecruitment({ candidates: branchCandidates });

    return {
      meta: { branchId, branchName, authorName, period: effPeriod, generatedAt: new Date().toISOString() },
      agents: { rows, empty: rows.length === 0, error: !!sectionErr.production },
      production: { ...production, error: !!sectionErr.production },
      periodMetrics: { ...periodMetrics, error: !!sectionErr.production },
      orgStructure: { ...orgStructure, error: false },
      recruitment: { ...recruitment, error: !!sectionErr.recruitment },
      emptyPlan: roster.length === 0,
    };
  }, [raw, year, effPeriod, branchId, sectionErr]);

  return {
    meta: model?.meta ?? null,
    agents: model?.agents ?? { rows: [], empty: true, error: false },
    production: model?.production ?? null,
    periodMetrics: model?.periodMetrics ?? null,
    orgStructure: model?.orgStructure ?? null,
    recruitment: model?.recruitment ?? null,
    loading,
    error,
    empty: !!model?.emptyPlan,
    reload: load,
  };
}
