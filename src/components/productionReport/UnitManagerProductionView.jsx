import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import { useAuth } from '../../context/AuthContext';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { formatCurrency, getUnitDisplayName } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { generateUnitPDF } from '../../services/exportService';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  computeUnitAggregates,
  rankAgentsByApi,
  computeComplianceStats,
  deriveProductionDataSource,
} from '../../lib/productionReport/computations';
import TimePeriodToggle from './TimePeriodToggle';
import DataSourceBadge from './DataSourceBadge';
import ProductionTable from './ProductionTable';

const PERIOD_LABEL = {
  week: 'This week', mtd: 'Month to date', quarter: 'Quarter to date', ytd: 'Year to date',
};

export default function UnitManagerProductionView() {
  const { userProfile, tenantId } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(false);
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

  const unitId = userProfile?.unitId;
  const currentWeek = useMemo(() => getMostRecentSunday(), []);

  const initials = useMemo(() => {
    const name = userProfile?.name ?? '';
    return name.split(' ').filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?';
  }, [userProfile?.name]);

  const loadProduction = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    setSubmissionsError(false);
    setUsersError(false);
    Promise.all([
      getAllYTDSubmissions(tenantId).catch((e) => {
        console.error('[UnitManagerProductionView] submissions failed:', e);
        setSubmissionsError(true);
        return [];
      }),
      getTenantUsers(tenantId).catch((e) => {
        console.error('[UnitManagerProductionView] users failed:', e);
        setUsersError(true);
        return [];
      }),
    ]).then(([subs, users]) => {
      setAllSubmissions(subs);
      setAllUsers(users);
    }).catch(setError).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { loadProduction(); }, [loadProduction]);

  const unitAgents = useMemo(
    () => allUsers.filter((u) => u.role === 'agent' && u.unitId === unitId && u.provisioning !== true),
    [allUsers, unitId]
  );
  const unitAgentIds = useMemo(() => new Set(unitAgents.map((u) => u.id)), [unitAgents]);

  const unitSubs = useMemo(
    () => allSubmissions.filter((s) => unitAgentIds.has(s.agentId ?? s.userId ?? '')),
    [allSubmissions, unitAgentIds]
  );

  const periodSubs = useMemo(
    () => filterSubmissionsByPeriod(unitSubs, period),
    [unitSubs, period]
  );

  const aggregate = useMemo(
    () => computeUnitAggregates(unitId, periodSubs, unitAgents.map((u) => ({ ...u, unitId }))),
    [unitId, periodSubs, unitAgents]
  );

  const compliance = useMemo(
    () => computeComplianceStats(allSubmissions, unitAgents, currentWeek),
    [allSubmissions, unitAgents, currentWeek]
  );

  const rankedAgents = useMemo(() => {
    const agentTotals = unitAgents.map((u) => {
      const agentPeriodSubs = filterSubmissionsByPeriod(
        allSubmissions.filter((s) => (s.agentId ?? s.userId) === u.id),
        period
      );
      return {
        agentId: u.id,
        agentName: u.name ?? u.email ?? u.id,
        unitId,
        totals: computeAgentTotals(agentPeriodSubs),
      };
    });
    return rankAgentsByApi(agentTotals);
  }, [unitAgents, allSubmissions, period, unitId]);

  // Unit rank among all branch units
  const allUnits = useMemo(() => [...new Set(allUsers.filter((u) => u.unitId).map((u) => u.unitId))], [allUsers]);
  const { unitRank, unitCount } = useMemo(() => {
    const unitAggs = allUnits.map((uid) => {
      const uAgents = allUsers.filter((u) => u.unitId === uid && u.provisioning !== true);
      const uSubs = filterSubmissionsByPeriod(
        allSubmissions.filter((s) => uAgents.some((a) => a.id === (s.agentId ?? s.userId))),
        period
      );
      const agg = computeUnitAggregates(uid, uSubs, uAgents.map((u) => ({ ...u, unitId: uid })));
      return { unitId: uid, avgApiPerAgent: agg.avgApiPerAgent };
    }).sort((a, b) => b.avgApiPerAgent - a.avgApiPerAgent);

    const rank = unitAggs.findIndex((u) => u.unitId === unitId) + 1;
    return { unitRank: rank > 0 ? rank : null, unitCount: allUnits.length };
  }, [allUnits, allUsers, allSubmissions, period, unitId]);

  const tableRows = rankedAgents.map((entry) => ({
    label: entry.agentName,
    rank: entry.rank,
    nb: entry.totals.nb,
    ppp: { apiIncrease: entry.totals.ppp.api },
    lmps: entry.totals.lmps,
    total: entry.totals.totalApi,
  }));

  // Honest data-source signal — this view loads submissions only (no settlement
  // fetch, read-light rule) → 'estimated', derived not hardcoded.
  const dataSource = deriveProductionDataSource({ settlements: [] });

  // Unit PDF export. Feeds the already-derived rows into generateUnitPDF — no
  // refetch, no second math path (same computations utils as the surface).
  const handleDownloadPDF = useCallback(async () => {
    setPdfError(false);
    setGenerating(true);
    try {
      await generateUnitPDF({
        orgLabel: getUnitDisplayName(userProfile) ?? 'Unit',
        managerName: userProfile?.name ?? null,
        period,
        periodLabel: PERIOD_LABEL[period] ?? 'Year to date',
        totals: {
          totalApi: aggregate.totalApi,
          totalApps: aggregate.totalApps,
          agentCount: aggregate.agentCount,
          avgApiPerAgent: aggregate.avgApiPerAgent,
        },
        roster: rankedAgents.map((r) => ({
          rank: r.rank,
          name: r.agentName,
          totalApi: r.totals.totalApi,
          totalApps: r.totals.totalApps,
        })),
        compliance,
        unitRank,
        unitCount,
      });
    } catch (e) {
      console.error('[UnitManagerProductionView] PDF failed:', e);
      setPdfError(true);
    } finally {
      setGenerating(false);
    }
  }, [userProfile, period, aggregate, rankedAgents, compliance, unitRank, unitCount]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="unit-production-loading">
        <PanelSkeleton variant="metric-row" count={4} label="Loading production data…" />
        <PanelSkeleton variant="table" count={6} columns={5} />
      </div>
    );
  }
  if (error || (submissionsError && usersError)) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="unit-production-error"
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

  return (
    <div className="flex flex-col gap-6 stagger">
      {(submissionsError || usersError) && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-center justify-between gap-3 flex-wrap"
          data-testid="unit-production-partial"
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
        <div className="flex items-center gap-2 flex-wrap">
          <DataSourceBadge source={dataSource} />
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={generating}
            data-testid="unit-production-download"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-60"
          >
            {generating
              ? (<><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Generating…</>)
              : (<><Download size={15} aria-hidden="true" /> Download report</>)}
          </button>
          <TimePeriodToggle selected={period} onChange={setPeriod} />
        </div>
      </div>

      {pdfError && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center gap-2"
          data-testid="unit-production-pdf-error"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Couldn&apos;t generate the report — please try again.</span>
        </div>
      )}

      {/* @@hero-pane-start */}
      {/* Unit aggregate — hero parity with the BM sibling (BranchManagerProductionView) */}
      <div className="glass hero teal p-6">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full bg-[--hero-chip-island] border border-[--hero-chip-border] text-[--hero-ink] flex items-center justify-center font-bold text-base font-display shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold font-display text-[--hero-ink] leading-tight truncate">
              {userProfile?.name ?? 'Unit Manager'}
            </p>
            <p className="text-xs text-[--hero-ink-muted-teal] mt-0.5">
              {getUnitDisplayName(userProfile) ?? 'Unit'} · {PERIOD_LABEL[period]}
            </p>
          </div>

          {/* Unit rank in branch — moved in from the bottom-of-screen card (§2.3).
              Same unitRank/unitCount computation, same conditional gate; only the
              render location changed. */}
          {unitRank && (
            <div
              data-testid="unit-production-rank-pill"
              data-rank={unitRank}
              data-total={unitCount}
              className="shrink-0 text-right"
            >
              <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">
                Unit rank
              </p>
              <p className="text-2xl font-bold font-display text-[--hero-ink] tabular-nums leading-none mt-0.5">
                {unitRank}
                <span className="text-sm text-[--hero-ink-muted-teal] font-normal">
                  {' / '}{unitCount || '—'}
                </span>
              </p>
            </div>
          )}
        </div>

        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal] mb-4 mt-5">Unit Aggregate</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[130px]">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">Total API</p>
            <p className="text-2xl font-bold font-display text-[--hero-ink] tabular-nums">{formatCurrency(aggregate.totalApi)}</p>
          </div>
          <div className="flex-1 min-w-[80px]">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">Apps</p>
            <p className="text-2xl font-bold font-display text-[--hero-ink] tabular-nums">{aggregate.totalApps}</p>
          </div>
          <div className="flex-1 min-w-[130px]">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">Avg API / Agent</p>
            <p className="text-2xl font-bold font-display text-[--hero-ink] tabular-nums">{formatCurrency(aggregate.avgApiPerAgent)}</p>
          </div>
          <div className="flex-1 min-w-[100px]">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">Agents</p>
            <p className="text-2xl font-bold font-display text-[--hero-ink] tabular-nums">{aggregate.agentCount}</p>
          </div>
        </div>
      </div>
      {/* @@hero-pane-end */}

      {/* Compliance */}
      <div className="card">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-2">Compliance (this week)</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-ink tabular-nums">
            {compliance.submitted} of {compliance.total}
          </span>
          <span className="text-sm text-ink-muted">agents submitted</span>
          <span className={`ml-auto text-sm font-semibold ${compliance.percent >= 80 ? 'text-success-ink' : compliance.percent >= 60 ? 'text-warning-ink' : 'text-danger-ink'}`}>
            {compliance.percent}%
          </span>
        </div>
        <div className="w-full bg-surface rounded-full h-1.5 mt-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${compliance.percent >= 80 ? 'bg-success' : compliance.percent >= 60 ? 'bg-warning' : 'bg-danger'}`}
            style={{ width: `${compliance.percent}%` }}
          />
        </div>
      </div>

      {/* Unit leaderboard */}
      <div className="card">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-3">Unit Leaderboard</p>
        <ProductionTable rows={tableRows} showRankColumn period={period} />
      </div>
    </div>
  );
}
