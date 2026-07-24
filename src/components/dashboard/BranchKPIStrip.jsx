import React from 'react';
import KPICard from './KPICard';

const BRANCH_KPIS = [
  // Compliance Rate is a 0–100 percentage — isPercent renders the "%" suffix
  // (was rendering a bare "13"). The others are counts / currency.
  { key: 'compliance', label: 'Compliance Rate', isCurrency: false, isPercent: true },
  { key: 'api',        label: 'Weekly API',       isCurrency: true  },
  { key: 'apps',       label: 'Weekly Apps',      isCurrency: false },
  { key: 'ffi',        label: 'Weekly FFI',       isCurrency: false },
];

export default function BranchKPIStrip({ kpiData, loading, activeAgentCount }) {
  if (loading) {
    return (
      <div className="mb-6">
        <div className="h-3 w-48 rounded bg-border/30 animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[140px] rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const weeks = kpiData?.compliance?.length ?? 0;

  // Active Agents is a current-roster snapshot, not a weekly time series —
  // there is no per-week historical headcount to trend against. A single-
  // element values array gives KPICard's existing "No prior data" / no-
  // sparkline fallback honestly, without fabricating a fake trend.
  const hasActiveAgentCount = Number.isFinite(activeAgentCount);

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
        Team Activity — Last {weeks} Week{weeks !== 1 ? 's' : ''}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
        {BRANCH_KPIS.map((kpi) => (
          <KPICard
            key={kpi.key}
            label={kpi.label}
            values={kpiData?.[kpi.key] ?? []}
            isCurrency={kpi.isCurrency}
            isPercent={kpi.isPercent ?? false}
          />
        ))}
        <KPICard
          label="Active Agents"
          values={hasActiveAgentCount ? [activeAgentCount] : []}
          isCurrency={false}
        />
      </div>

      {weeks >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {BRANCH_KPIS.map((kpi) => {
            const vals  = kpiData?.[kpi.key] ?? [];
            const cur   = vals[vals.length - 1] ?? 0;
            const prev  = vals[vals.length - 2] ?? 0;
            const delta = cur - prev;
            const colorClass =
              delta > 0 ? 'bg-success/10 text-success-ink border-success/20' :
              delta < 0 ? 'bg-danger/10 text-danger-ink border-danger/20' :
                          'bg-surface text-ink-muted border-border';
            const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
            return (
              <span
                key={kpi.key}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold ${colorClass}`}
              >
                {kpi.label} {arrow}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
