import React from 'react';
import { PiggyBank, TrendingUp, CalendarDays, Info, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';

// §2 count-up — derived-income KPI figures count up on load. decimals:2
// preserves TTD cents exactly (no rounding drift at the end of the animation).
function CountUpCurrency({ value }) {
  const display = useCountUp(value, { duration: 900, decimals: 2 });
  return <>{formatCurrency(display)}</>;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="card" data-testid="derived-income-loading">
      <div className="flex flex-col gap-3">
        <div className="h-5 w-1/3 rounded-lg bg-surface-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-surface-muted animate-pulse" />
        <div className="h-16 w-2/3 rounded-xl bg-surface-muted animate-pulse" />
        <div className="h-10 rounded-lg bg-surface-muted animate-pulse" />
      </div>
    </div>
  );
}

// ── No committed goal yet ─────────────────────────────────────────────────────
function NoGoalState() {
  return (
    <div className="card text-center" data-testid="derived-income-no-goal">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-tint flex items-center justify-center mb-4">
        <PiggyBank size={22} className="text-primary" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-ink mb-1">Commit a goal to see what it earns</p>
      <p className="text-xs text-ink-muted mb-4">
        Set a committed API goal in your Game Plan to unlock income estimates.
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="text-xs font-bold text-primary border border-primary/40 rounded-lg px-4 py-2 opacity-60 cursor-default"
      >
        Go to Game Plan →
      </button>
    </div>
  );
}

// ── Rate not on file ──────────────────────────────────────────────────────────
function RateUnsetState() {
  return (
    <div className="card" data-testid="derived-income-rate-unset">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-warning-ink" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">Rate not on file</p>
          <p className="text-xs text-ink-muted leading-relaxed">
            Income can't be derived without a blended commission rate. Contact your manager to set
            your commission rate, then return here to see your income estimate.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Assumptions disclaimer ────────────────────────────────────────────────────
function AssumptionsNote() {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-raised border border-border">
      <Info size={13} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-[11px] text-ink-muted leading-relaxed">
        An estimate, not a guarantee. Income derived as{' '}
        <span className="font-mono">committed API × blended rate</span> — a single rate across all
        product lines. Shown on a first-year basis; renewals and persistency clawbacks not modelled.
      </p>
    </div>
  );
}

// ── Main populated layout ─────────────────────────────────────────────────────
export default function DerivedIncomePanel({ hierarchy, ytdTotals, commissionRate, loading }) {
  if (loading) return <LoadingSkeleton />;

  const committedAPI = hierarchy?.personal?.api ?? null;
  if (!committedAPI) return <NoGoalState />;
  if (!commissionRate) return <RateUnsetState />;

  const annualIncome = committedAPI * (commissionRate / 100);
  const perMonth     = annualIncome / 12;
  const ytdAPI       = ytdTotals?.api ?? 0;
  const ytdEarned    = ytdAPI * (commissionRate / 100);
  const ytdPct       = committedAPI > 0
    ? Math.min(100, Math.round((ytdAPI / committedAPI) * 100))
    : null;
  const year         = new Date().getFullYear();

  return (
    <div className="card flex flex-col gap-5" data-testid="derived-income-panel">

      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-tint flex items-center justify-center shrink-0">
          <PiggyBank size={18} className="text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink">What your goal earns</p>
          <p className="text-xs text-ink-muted">Income derived from your committed production goal</p>
        </div>
        <span className="text-[10px] font-bold tracking-widest font-mono uppercase text-ink-muted bg-surface-muted px-2 py-1 rounded-lg border border-border whitespace-nowrap">
          Derived · display only
        </span>
      </div>

      {/* Income equation — stacks vertically on mobile, row on sm+ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">

        <div className="flex-1 flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-surface-raised">
          <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">
            Committed goal
          </p>
          <p
            className="text-lg font-bold text-ink leading-none"
            style={{ fontFamily: '"Cabinet Grotesk", system-ui' }}
          >
            {formatCurrency(committedAPI)}
          </p>
        </div>

        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised self-center shrink-0">
          <span className="text-sm font-bold text-ink-muted" aria-hidden="true">×</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-surface-raised">
          <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">
            Blended rate
          </p>
          <p
            className="text-lg font-bold text-primary leading-none"
            style={{ fontFamily: '"Cabinet Grotesk", system-ui' }}
          >
            {commissionRate}%
          </p>
        </div>

        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised self-center shrink-0">
          <span className="text-sm font-bold text-primary" aria-hidden="true">=</span>
        </div>

        {/* Annual income pane — teal tint */}
        <div className="flex-[1.4] flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-primary-tint border border-primary/40">
          <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">
            Est. annual income · {year}
          </p>
          <p
            className="text-2xl font-bold text-primary-dark dark:text-ink leading-none"
            style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.02em' }}
            data-testid="derived-annual-income"
          >
            <CountUpCurrency value={annualIncome} />
          </p>
          <p className="text-[10px] text-ink-muted">/year</p>
        </div>
      </div>

      {/* Side cards: per-month + YTD */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 p-3 rounded-xl border border-border" data-testid="derived-per-month">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={12} className="text-ink-muted shrink-0" aria-hidden="true" />
            <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">
              Per month avg
            </p>
          </div>
          <p className="text-xl font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui' }}>
            <CountUpCurrency value={perMonth} />
          </p>
          <p className="text-[10px] text-ink-muted">/mo</p>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-xl border border-border" data-testid="derived-ytd-earned">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-ink-muted shrink-0" aria-hidden="true" />
            <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">
              Earned YTD est.
            </p>
          </div>
          <p className="text-xl font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui' }}>
            <CountUpCurrency value={ytdEarned} />
          </p>
          {ytdPct !== null && (
            <p className="text-[10px] text-ink-muted">{ytdPct}% of annual</p>
          )}
        </div>
      </div>

      <AssumptionsNote />
    </div>
  );
}
