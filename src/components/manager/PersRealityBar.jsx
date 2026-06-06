import React from 'react';

function formatCurrencyCompact(amount) {
  const n = parseFloat(amount ?? 0);
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `TTD ${Math.round(n / 1_000)}K`;
  return `TTD ${Math.round(n)}`;
}

function formatPercent(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function aggregateDotClass(p) {
  if (p == null || !Number.isFinite(p)) return 'bg-[--hero-dot-warning]';
  if (p >= 0.90) return 'bg-[--hero-dot-success]';
  if (p >= 0.80) return 'bg-[--hero-dot-warning]';
  return 'bg-[--hero-dot-danger]';
}

function SparkBar({ value, isCurrent }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="w-1.5 rounded-t-sm bg-border/40" style={{ height: '15%' }} />;
  }
  const pct = Math.min(Math.max(value * 100, 5), 100);
  const colorClass = value >= 0.90 ? 'bg-success/70'
    : value >= 0.80 ? 'bg-warning/70'
    : 'bg-danger/70';
  return (
    <div
      className={`w-1.5 rounded-t-sm transition-all ${colorClass} ${isCurrent ? 'opacity-100' : 'opacity-55'}`}
      style={{ height: `${pct}%` }}
    />
  );
}

export default function PersRealityBar({
  monthKey,
  monthKeys,
  onMonthChange,
  scope,
  showScopeToggle,
  onScopeChange,
  scopeLabel,
  aggregate,
  barStats,
  totalAgents,
  sparkData,
  loading,
}) {
  const unresolvedCount = totalAgents - (barStats?.resolvedCount ?? 0);
  const ap = aggregate?.aggregatedPersistency;

  if (loading) {
    return (
      <div className="card flex flex-wrap items-center gap-4 py-4 px-5" data-testid="pers-reality-bar">
        <div className="h-8 w-32 rounded-lg bg-border/40 animate-pulse" />
        <div className="h-8 w-28 rounded-full bg-border/40 animate-pulse" />
        <div className="ml-4 h-9 w-20 rounded-lg bg-border/40 animate-pulse" />
        <div className="ml-auto flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-end gap-1">
              <div className="h-3 w-16 rounded bg-border/40 animate-pulse" />
              <div className="h-6 w-10 rounded bg-border/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass hero teal rounded-xl flex flex-wrap items-center gap-x-4 gap-y-3 py-3 px-4"
      data-testid="pers-reality-bar"
    >
      {/* Month picker */}
      <select
        aria-label="Month"
        data-testid="pers-month-selector"
        value={monthKey ?? ''}
        onChange={(e) => onMonthChange(e.target.value)}
        className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {monthKeys.length === 0 && <option value="">—</option>}
        {monthKeys.map((mk) => (
          <option key={mk} value={mk}>{mk}</option>
        ))}
      </select>

      {/* Scope toggle (BM only) */}
      {showScopeToggle && (
        <div
          className="flex gap-0.5 p-0.5 bg-card-raised border border-border rounded-lg"
          role="group"
          aria-label="Scope"
          data-testid="pers-scope-toggle"
        >
          {['unit', 'branch'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onScopeChange(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                scope === s
                  ? 'bg-primary dark:bg-primary-dark text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
              data-testid={`pers-scope-${s}`}
            >
              {s === 'unit' ? 'Unit' : 'Branch'}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="hidden sm:block w-px h-8 bg-border" />

      {/* Aggregate + spark */}
      <div className="flex items-center gap-3" data-testid="pers-bar-aggregate">
        <div className="flex flex-col gap-1.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3.5 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[--hero-ink-muted-teal] leading-tight">
            {scopeLabel} persistency
          </p>
          <div className="flex items-baseline gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full ${aggregateDotClass(ap)}`} aria-hidden="true" />
            <p className="font-display font-extrabold text-3xl leading-none tracking-tight text-[--hero-ink]">
              {barStats?.resolvedCount === 0 ? '—' : formatPercent(ap)}
            </p>
          </div>
          {unresolvedCount > 0 && (
            <p
              className="flex items-center gap-1 text-[10px] text-[--hero-ink-muted-teal] font-semibold"
              data-testid="pers-bar-unresolved-chip"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--hero-dot-warning]" aria-hidden="true" />
              {unresolvedCount} unresolved
            </p>
          )}
        </div>

        {/* 6-month sparkline */}
        {sparkData.length > 0 && (
          <div
            className="flex items-end gap-0.5 h-7 ml-1"
            role="img"
            aria-label="6-month trend"
            data-testid="pers-bar-spark"
          >
            {sparkData.map((pt) => (
              <SparkBar
                key={pt.monthKey}
                value={pt.aggregatedPersistency}
                isCurrent={pt.monthKey === monthKey}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats (push to right) */}
      <div className="ml-auto flex gap-2 sm:gap-3" data-testid="pers-bar-stats">
        <div className="flex flex-col gap-0.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3 py-2 text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[--hero-ink-muted-teal]">Below floor</p>
          <div className="flex items-baseline justify-end gap-1.5">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--hero-dot-danger]" aria-hidden="true" />
            <p
              className="font-display font-extrabold text-xl text-[--hero-ink] leading-none"
              data-testid="pers-bar-below-floor"
            >
              {barStats?.belowFloor ?? '—'}
            </p>
          </div>
          <p className="text-[9px] text-[--hero-ink-muted-teal]">&lt; 80%</p>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3 py-2 text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[--hero-ink-muted-teal]">Award-eligible</p>
          <div className="flex items-baseline justify-end gap-1.5">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--hero-dot-success]" aria-hidden="true" />
            <p
              className="font-display font-extrabold text-xl text-[--hero-ink] leading-none"
              data-testid="pers-bar-eligible"
            >
              {barStats?.awardEligible ?? '—'}
            </p>
          </div>
          <p className="text-[9px] text-[--hero-ink-muted-teal]">≥ 90%</p>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3 py-2 text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[--hero-ink-muted-teal]">Lapses · mth</p>
          <p
            className="font-display font-extrabold text-xl text-[--hero-ink] leading-none mt-0.5"
            data-testid="pers-bar-lapses"
          >
            {barStats?.resolvedCount > 0
              ? formatCurrencyCompact(barStats.sumLapses)
              : '—'}
          </p>
          <p className="text-[9px] text-[--hero-ink-muted-teal]">TTD</p>
        </div>
      </div>
    </div>
  );
}
