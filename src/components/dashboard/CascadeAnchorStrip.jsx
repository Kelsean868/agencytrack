// CascadeAnchorStrip — the manager overview "anchor" (Fable 1.5, ported from
// docs/design-system/screens-v2 manager-v2-shared.jsx AnchorStrip).
//
// "Your reality first": branch/unit YTD vs the goal cascade (with the rolled-up
// company-floor marker), the weekly pulse (API / apps / FFI), and the live
// on-pace / need-attention split — BEFORE the exception list and the stats.
//
// Every number arrives pre-derived from useBranchOverview (teamYTDAPI,
// teamAnnualGoal, companyFloorTotal, weeklyPulse, onPaceCount, needAttentionCount).
// The hero numeral counts up (§2 motion); the attention pulse dot is
// reduced-motion-safe.
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';
import PanelSkeleton from '../ui/PanelSkeleton';

function ScopeChip({ scopeLabel }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wider bg-primary/10 text-primary border border-primary/30"
      data-testid="cascade-scope-chip"
    >
      {scopeLabel}
    </span>
  );
}

export default function CascadeAnchorStrip({
  scopeLabel = 'Branch',
  teamYTDAPI = 0,
  teamAnnualGoal = 0,
  goalSet = false,
  companyFloorTotal = 0,
  weeklyPulse = { api: 0, apps: 0, ffi: 0 },
  onPaceCount = 0,
  needAttentionCount = 0,
  inScopeAgentCount = 0,
  weeksLeft = 0,
  loading = false,
}) {
  const displayApi = useCountUp(teamYTDAPI, { duration: 1000, decimals: 0 });

  if (loading) {
    return (
      <div className="card mb-4" data-testid="cascade-anchor-loading">
        <PanelSkeleton variant="metric-row" count={3} label="Loading branch anchor…" />
      </div>
    );
  }

  const pct = teamAnnualGoal > 0 ? Math.min(100, Math.round((teamYTDAPI / teamAnnualGoal) * 100)) : 0;
  const floorPct = teamAnnualGoal > 0 ? Math.min(100, (companyFloorTotal / teamAnnualGoal) * 100) : 0;

  const pulse = [
    { k: 'API', v: formatCurrency(weeklyPulse.api ?? 0) },
    { k: 'APPS', v: String(weeklyPulse.apps ?? 0) },
    { k: 'FFI', v: String(weeklyPulse.ffi ?? 0) },
  ];

  return (
    <div
      className="card mb-4 flex flex-col lg:flex-row lg:items-stretch gap-5 lg:gap-0"
      data-testid="cascade-anchor-strip"
    >
      {/* Left — YTD anchor + cascade bar */}
      <div className="flex-1 min-w-0 lg:pr-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary">
            {scopeLabel} · YTD API
          </p>
          {weeksLeft > 0 && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
              {weeksLeft}w left
            </p>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap mt-1.5">
          <p
            className="font-display text-4xl font-extrabold text-ink tracking-tight leading-none tabular-nums"
            data-testid="cascade-ytd-api"
          >
            {formatCurrency(displayApi)}
          </p>
          {teamAnnualGoal > 0 && (
            <p className="text-xs text-ink-muted pb-1">
              {pct}% of {formatCurrency(teamAnnualGoal)} {scopeLabel.toLowerCase()} goal
            </p>
          )}
        </div>

        {/* Cascade progress bar with the rolled-up company-floor marker */}
        <div className="mt-4 max-w-xl">
          <div className="relative w-full bg-surface-muted rounded-full h-2 overflow-visible">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
            {floorPct > 0 && floorPct < 100 && (
              <div
                className="absolute -top-1 h-4 w-0.5 rounded-full bg-warning"
                style={{ left: `${floorPct}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono uppercase tracking-wide text-ink-muted">
            <span>TTD 0</span>
            {companyFloorTotal > 0 && (
              <span className="text-warning-ink">Floor · {formatCurrency(companyFloorTotal)}</span>
            )}
            {teamAnnualGoal > 0 && <span>Goal · {formatCurrency(teamAnnualGoal)}</span>}
          </div>
          {!goalSet && teamAnnualGoal > 0 && (
            <p className="text-[11px] text-ink-muted mt-2">
              Using company-floor estimate — set a {scopeLabel.toLowerCase()} goal in the Goals tab.
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px bg-border" aria-hidden="true" />

      {/* Right — weekly pulse + on-pace / attention split */}
      <div className="flex flex-col lg:w-72 lg:pl-6 gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
            This week
          </p>
          <ScopeChip scopeLabel={scopeLabel} />
        </div>

        <div className="flex gap-5">
          {pulse.map((m) => (
            <div key={m.k}>
              <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{m.k}</p>
              <p className="font-display text-lg font-bold text-ink tracking-tight mt-1 tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 mt-auto">
          <div className="flex-1 rounded-xl border border-success/30 bg-success/10 p-2.5" data-testid="cascade-onpace">
            <p className="font-display text-lg font-bold text-success-ink tracking-tight tabular-nums">
              {onPaceCount}
              <span className="text-xs font-semibold text-ink-muted"> / {inScopeAgentCount}</span>
            </p>
            <p className="text-[10px] text-ink-muted mt-0.5">on pace</p>
          </div>
          <div
            className="flex-1 rounded-xl border border-warning/30 bg-warning/10 p-2.5 flex items-center gap-2.5"
            data-testid="cascade-attention"
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card border border-warning/40">
              {needAttentionCount > 0 && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-warning/30 motion-safe:animate-ping" aria-hidden="true" />
              )}
              <AlertTriangle size={13} className="relative text-warning-ink" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-warning-ink tracking-tight leading-none tabular-nums">
                {needAttentionCount}
              </p>
              <p className="text-[10px] text-ink-muted mt-1">need attention</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
