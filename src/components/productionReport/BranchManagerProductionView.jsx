import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { formatCurrency, getUnitDisplayName } from '../../utils/formatters';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  computeBranchAggregates,
  rankAgentsByApi,
} from '../../lib/productionReport/computations';
import TimePeriodToggle from './TimePeriodToggle';
import DataSourceBadge from './DataSourceBadge';
import ProductionTable from './ProductionTable';
import RankedLeaderboard from './RankedLeaderboard';

const TOP_N_DEFAULT = 10;

export default function BranchManagerProductionView() {
  const { tenantId } = useAuth();
  const [period, setPeriod] = useState('week');
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Per-source failure tracking — a sub-fetch failing no longer silently
  // degrades to an empty array with no trace (§1 states contract). Both
  // failed → full error card; one failed → partial-failure banner naming
  // the count, with the other source's real data still shown.
  const [submissionsError, setSubmissionsError] = useState(false);
  const [usersError, setUsersError] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(false);

  const loadProduction = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    setSubmissionsError(false);
    setUsersError(false);
    Promise.all([
      getAllYTDSubmissions(tenantId).catch((e) => {
        console.error('[BranchManagerProductionView] submissions failed:', e);
        setSubmissionsError(true);
        return [];
      }),
      getTenantUsers(tenantId).catch((e) => {
        console.error('[BranchManagerProductionView] users failed:', e);
        setUsersError(true);
        return [];
      }),
    ]).then(([subs, users]) => {
      setAllSubmissions(subs);
      setAllUsers(users);
    }).catch(setError).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { loadProduction(); }, [loadProduction]);

  const activeAgents = useMemo(
    () => allUsers.filter((u) => u.role === 'agent' && u.provisioning !== true),
    [allUsers]
  );
  const allUnitIds = useMemo(
    () => [...new Set(activeAgents.filter((u) => u.unitId).map((u) => u.unitId))],
    [activeAgents]
  );

  const periodSubs = useMemo(
    () => filterSubmissionsByPeriod(allSubmissions, period),
    [allSubmissions, period]
  );

  const branchAggregate = useMemo(
    () => computeBranchAggregates(periodSubs, allUsers, allUnitIds),
    [periodSubs, allUsers, allUnitIds]
  );

  const rankedAgents = useMemo(() => {
    const agentTotals = activeAgents.map((u) => {
      const subs = filterSubmissionsByPeriod(
        allSubmissions.filter((s) => (s.agentId ?? s.userId) === u.id),
        period
      );
      return {
        agentId: u.id,
        agentName: u.name ?? u.email ?? u.id,
        unitId: u.unitId,
        totals: computeAgentTotals(subs),
      };
    });
    return rankAgentsByApi(agentTotals);
  }, [activeAgents, allSubmissions, period]);

  const unitsMap = useMemo(
    () => allUsers
      .filter((u) => u.role === 'unit_manager')
      .reduce((map, manager) => {
        map[manager.id] = getUnitDisplayName(manager);
        return map;
      }, {}),
    [allUsers]
  );

  const unitLeaderboardEntries = useMemo(
    () => branchAggregate.unitBreakdown.map((u, i) => ({
      id: u.unitId,
      rank: i + 1,
      name: unitsMap[u.unitId] ?? 'Unknown Unit',
      value: u.avgApiPerAgent,
      secondaryValue: u.agentCount,
    })),
    [branchAggregate.unitBreakdown, unitsMap]
  );

  const agentLeaderboardEntries = useMemo(
    () => rankedAgents.map((r) => ({
      id: r.agentId,
      rank: r.rank,
      name: r.agentName,
      value: r.totals.totalApi,
      secondaryValue: r.totals.totalApps,
    })),
    [rankedAgents]
  );

  const branchTotalRow = [{
    label: 'Branch Total',
    nb: branchAggregate.nb,
    ppp: { apiIncrease: branchAggregate.ppp?.api ?? 0 },
    lmps: branchAggregate.lmps,
    total: branchAggregate.totalApi,
    highlight: true,
  }];

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-muted text-sm">Loading production data…</div>;
  }
  if (error || (submissionsError && usersError)) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="branch-production-error"
      >
        <AlertTriangle size={28} className="text-danger-ink" aria-hidden="true" />
        <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load production data — check your connection and try again.</p>
        <button
          type="button"
          onClick={loadProduction}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const visibleAgentCount = showAllAgents ? undefined : TOP_N_DEFAULT;

  return (
    <div className="flex flex-col gap-6 stagger">
      {(submissionsError || usersError) && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-center justify-between gap-3 flex-wrap"
          data-testid="branch-production-partial"
        >
          <span>1 of 2 data sources failed to load — showing what&apos;s available.</span>
          <button
            type="button"
            onClick={loadProduction}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-ink">Production Report</h2>
        <div className="flex items-center gap-2">
          <DataSourceBadge source="estimated" />
          <TimePeriodToggle selected={period} onChange={setPeriod} />
        </div>
      </div>

      {/* @@hero-pane-start */}
      {/* Branch aggregate */}
      <div className="glass hero teal p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[--hero-ink-muted-teal] mb-4">Branch Aggregate</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[130px]">
            <p className="text-xs text-[--hero-ink-muted-teal]">Total API</p>
            <p className="text-2xl font-bold text-[--hero-ink] tabular-nums">{formatCurrency(branchAggregate.totalApi)}</p>
          </div>
          <div className="flex-1 min-w-[80px]">
            <p className="text-xs text-[--hero-ink-muted-teal]">Apps</p>
            <p className="text-2xl font-bold text-[--hero-ink] tabular-nums">{branchAggregate.totalApps}</p>
          </div>
          <div className="flex-1 min-w-[130px]">
            <p className="text-xs text-[--hero-ink-muted-teal]">Avg API / Agent</p>
            <p className="text-2xl font-bold text-[--hero-ink] tabular-nums">{formatCurrency(branchAggregate.avgApiPerAgent)}</p>
          </div>
          <div className="flex-1 min-w-[100px]">
            <p className="text-xs text-[--hero-ink-muted-teal]">Agents</p>
            <p className="text-2xl font-bold text-[--hero-ink] tabular-nums">{branchAggregate.agentCount}</p>
          </div>
        </div>
      </div>
      {/* @@hero-pane-end */}

      {/* Unit leaderboard (by avg API per agent) */}
      {unitLeaderboardEntries.length > 0 && (
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
            Unit Leaderboard <span className="normal-case font-normal">(by avg API per agent)</span>
          </p>
          <RankedLeaderboard
            entries={unitLeaderboardEntries}
            valueLabel="Avg API"
            secondaryLabel="agents"
            isCurrency
          />
        </div>
      )}

      {/* Top N agents across branch */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {showAllAgents ? 'All Agents' : `Top ${Math.min(TOP_N_DEFAULT, rankedAgents.length)} Agents`}
          </p>
          {rankedAgents.length > TOP_N_DEFAULT && (
            <button
              type="button"
              onClick={() => setShowAllAgents((v) => !v)}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {showAllAgents ? 'Show fewer' : `+ View all ${rankedAgents.length} agents`}
            </button>
          )}
        </div>
        <RankedLeaderboard
          entries={agentLeaderboardEntries}
          valueLabel="API"
          secondaryLabel="apps"
          topN={visibleAgentCount}
          isCurrency
        />
      </div>

      {/* Branch grand total (whiteboard format) */}
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Branch Total</p>
        <ProductionTable rows={branchTotalRow} period={period} />
      </div>
    </div>
  );
}
