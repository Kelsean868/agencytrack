import React from 'react';
import { RotateCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { ytdEarned, runRate, gapToGoal, latestPersistency } from '../../utils/commissionAnchor';
import { getTodayTT } from '../../utils/dateInputs';
import { useCountUp } from '../../hooks/useCountUp';

// §2 count-up — hero/KPI currency figures count up on load. decimals:2
// preserves TTD cents exactly (no rounding drift at the end of the animation).
function CountUpCurrency({ value }) {
  const display = useCountUp(value, { duration: 900, decimals: 2 });
  return <>{formatCurrency(display)}</>;
}

// Persistency % chip — integer percent, no decimals.
function CountUpPercent({ value }) {
  const display = useCountUp(value, { duration: 900, decimals: 0 });
  return <>{display}%</>;
}

function ProvChip({ children, warning }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[--hero-chip-border] bg-[--hero-chip-island] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.04em] text-[--hero-ink-muted-teal]">
      {warning && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--hero-dot-warning]" />}
      {children}
    </span>
  );
}

// card=true  → card-tier tokens (bg-surface-raised, border-border, text-ink / text-ink-muted)
//              Use when the chip renders outside a .glass.hero container (no-goal state).
// card=false  → hero-tier tokens (hero-chip bg, hero-ink text)
//              Only use inside a .glass.hero.teal wrapper (normal state).
function Chip({ label, value, valueClass, dotClass, card }) {
  const containerCls = card
    ? 'flex min-w-[108px] flex-col gap-0.5 rounded-xl border border-border bg-surface-raised px-3.5 py-2.5'
    : 'flex min-w-[108px] flex-col gap-0.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3.5 py-2.5';
  const labelCls = card ? 'text-ink-muted' : 'text-[--hero-ink-muted-teal]';
  const defaultValueCls = card ? 'text-ink' : 'text-[--hero-ink]';
  return (
    <div className={containerCls}>
      <span className={`font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] ${labelCls}`}>
        {label}
      </span>
      <span className={`flex items-center gap-1.5 font-display text-base font-extrabold tracking-tight whitespace-nowrap ${valueClass || defaultValueCls}`}>
        {dotClass && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />}
        {value}
      </span>
    </div>
  );
}

export default function CommissionAnchorStrip({
  policies,
  loading,
  error,
  onRetry,
  persistencyHistory,
  committedAnnualAPI,
  commissionRate,
  onScrollToPlayground,
}) {
  const todayTT = getTodayTT(); // 'YYYY-MM-DD' in TT timezone — correct at year boundary
  const year = parseInt(todayTT.split('-')[0], 10);

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-2xl border border-gold/20 bg-card p-5"
        aria-busy="true"
        aria-label="Loading your commission summary"
        data-testid="commission-anchor-strip-loading"
      >
        <div className="h-4 w-48 rounded-lg bg-surface-raised" />
        <div className="mt-3 h-7 w-72 rounded-lg bg-surface-raised" />
        <div className="mt-2 h-3 w-56 rounded-lg bg-surface-raised" />
        <div className="mt-4 flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 w-28 rounded-xl bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-card px-5 py-8 text-center"
        data-testid="commission-anchor-strip-error"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 font-display text-lg font-extrabold text-danger-ink">
          !
        </div>
        <div>
          <p className="font-semibold text-ink">Couldn&apos;t load your commission</p>
          <p className="mt-1 text-xs text-ink-muted">
            The calculator below still works; retry to reload your YTD + run-rate.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RotateCw size={14} aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }

  // Derived values
  const today = new Date();
  const earned = ytdEarned(policies || [], year);
  const rate = runRate(policies || [], today);
  const persResult = latestPersistency(persistencyHistory || []);
  const ratios = { commissionRate: commissionRate || 35 };
  const gapResult = gapToGoal(committedAnnualAPI, rate.value, ratios);

  // State 2 — no committed goal (shows YTD + run-rate; suppresses gap)
  // @@card-context-start — renders on bg-card, NOT inside .glass.hero; Chips must use card=true
  if (!committedAnnualAPI) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-5"
        data-testid="commission-anchor-strip-no-goal"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Your reality · no goal set yet
            </p>
            <p className="mt-1.5 max-w-xs text-xs text-ink-muted">
              Set a goal to unlock the gap tracker. Your activity data is already live.
            </p>
          </div>
          <button
            type="button"
            onClick={onScrollToPlayground}
            className="shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-primary-dark"
          >
            Set as my goal →
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Chip label="YTD Earned"  value={earned > 0 ? formatCurrency(earned)      : '—'} card />
          <Chip label="On Pace For" value={rate.value > 0 ? formatCurrency(rate.value) : '—'} card />
        </div>
      </div>
    );
  }
  // @@card-context-end

  // State 1 — normal (with run-rate or fallback)
  const projected = rate.value;
  const goalComm = gapResult?.goalAsCommission ?? 0;
  const gap = gapResult?.gap ?? 0;
  const behind = gap < 0;

  const weeksLeft = Math.max(
    0,
    Math.round(
      (new Date(`${year}-12-31T04:00:00Z`).getTime() - today.getTime()) / (7 * 86400000),
    ),
  );

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-5 glass hero teal"
      data-testid="commission-anchor-strip"
      aria-label="Commission summary"
    >
      <div className="relative flex flex-wrap items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[--hero-ink-muted-teal]">
            Your reality · {weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} left in {year}
          </div>

          <h2 className="mt-1.5 max-w-lg font-display text-2xl font-extrabold leading-tight tracking-tight text-[--hero-ink]">
            On pace for{' '}
            <span className="text-[--hero-accent]"><CountUpCurrency value={projected} /></span>{' '}
            in commission this year
          </h2>

          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[--hero-ink-muted-teal]">
            <span>{formatCurrency(earned)} earned YTD</span>
            <ProvChip>← policies.earnedCommission · settled</ProvChip>
            {rate.weekCount > 0 && (
              <>
                <span>· projected from</span>
                {rate.isLinear ? (
                  <>
                    <strong className="text-[--hero-ink]">linear YTD</strong>
                    <ProvChip warning>{rate.window.toUpperCase()}</ProvChip>
                  </>
                ) : (
                  <>
                    <strong className="text-[--hero-ink]">{rate.weekCount}-wk trailing run-rate</strong>
                    <ProvChip>{rate.window.toUpperCase()}</ProvChip>
                  </>
                )}
              </>
            )}
          </p>

          {rate.isLinear && rate.weekCount > 0 && rate.weekCount < 8 && (
            <p className="mt-2 max-w-sm text-[11px] text-[--hero-ink-muted-teal]">
              Too few settled weeks for a trailing run-rate — projecting linearly from YTD.
              Firms up at 8 settled weeks.
            </p>
          )}
        </div>

        <div className="shrink-0 inline-flex flex-col items-end gap-0.5 rounded-xl border border-[--hero-chip-border] bg-[--hero-chip-island] px-3 py-2.5 text-right">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[--hero-ink-muted-teal]">
            Gap to goal
          </div>
          <div className="font-display text-2xl font-extrabold leading-none tracking-tight text-[--hero-ink]">
            {behind ? '−' : '+'} <CountUpCurrency value={Math.abs(gap)} />
          </div>
          <div className="font-mono text-[9px] text-[--hero-ink-muted-teal]">
            vs your committed goal
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-3">
        <Chip label="YTD Earned" value={<CountUpCurrency value={earned} />} />
        <Chip label="Projected" value={<CountUpCurrency value={projected} />} />
        <Chip label="Goal" value={<CountUpCurrency value={goalComm} />} />
        {persResult && (
          <Chip
            label="Persistency · latest month"
            value={<CountUpPercent value={Math.round(persResult.decimal * 100)} />}
            dotClass="bg-[--hero-dot-success]"
          />
        )}
      </div>
    </section>
  );
}
