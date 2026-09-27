import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { MDRT_THRESHOLDS_2026 } from '../../../config/mdrtThresholds/2026';
import { useCountUp } from '../../../hooks/useCountUp';
import ProgressDonut, { RingLegend } from '../ProgressDonut';
import { formatCompact } from '../../../lib/campaignPace';
import LedgerReconciliationNote from './LedgerReconciliationNote';
import { heroGoal, provenanceLine } from './homeDerivations';

const MDRT = MDRT_THRESHOLDS_2026.mdrt;

/** Whole-number TTD figure without the currency prefix: 87146.28 → "87,146". */
function wholeNumber(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-TT');
}

/** Weeks left in the calendar year (the sub-line's secondary copy). */
function weeksToYearEnd(now = new Date()) {
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  return Math.max(0, Math.ceil((yearEnd - now) / (1000 * 60 * 60 * 24 * 7)));
}

/** One of the three secondary ledger figures under the big number. */
function LedgerFigure({ label, shortLabel, value, title, marker, testId }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-[--hero-ink-muted-teal]">
        {shortLabel ? (
          <>
            <span className="lg:hidden">{shortLabel}</span>
            <span className="hidden lg:inline">{label}</span>
          </>
        ) : label}
      </p>
      <p className="text-lg font-bold tabular-nums text-[--hero-ink] lg:text-xl" title={title}>{value}</p>
      {marker && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-[--hero-ink-muted-teal]" data-testid="dated-by-issue">
          {marker}
        </p>
      )}
    </div>
  );
}

/**
 * HeroCard — Home redesign R1, block 2 (C1-Home / C3-Home-Desktop mockups).
 *
 * One donut + one big number. The donut is settled API ÷ goal (personal annual
 * API goal if set, else MDRT); when the goal is above MDRT, the MDRT point is a
 * tick on the ring. The big number is the ledger's settled API from
 * `deriveYearProduction` (whole TTD; the full value is in the aria-label).
 * Beneath: Settled apps · Submitted API (with "Dated by issue") · Submitted
 * apps, the provenance line, and the unchanged R4 reconciliation note.
 *
 * `production` is null while the ledger loads (`pending`) or after it fails
 * (`error`) — the figures are never shown as a confident zero in either state.
 *
 * The submit button lives here below 1024 px only; at ≥ 1024 px it moves to
 * the page header (AgentDashboard's topbar action). It keeps the certified
 * hero outline treatment rather than the mockup's white fill: teal text on a
 * white fill fails AA in dark mode, where the text teal is the lifted one.
 *
 * Layout: a two-column grid. Mobile stacks eyebrow / donut+number / figures /
 * provenance / note / button; at lg the donut spans every row on the left.
 */
export default function HeroCard({
  personalAnnualAPI, onSubmit,
  production = null, pending = false, error = false, onRetry, onOpenLedgerCreate,
}) {
  const settledApi = production?.settled?.api ?? 0;
  const pendingApi = production?.pending?.api ?? 0;
  // §2 count-up — gated by prefers-reduced-motion inside the hook.
  const displayApi = useCountUp(Math.round(settledApi), { duration: 1000, decimals: 0 });
  const { goal, isMdrt } = heroGoal(personalAnnualAPI);
  const pct = goal > 0 ? Math.round((settledApi / goal) * 100) : 0;
  const tick = !isMdrt && goal > MDRT ? MDRT / goal : null;
  const goalWord = isMdrt ? 'MDRT' : 'goal';
  const weeksLeft = weeksToYearEnd();
  const provenance = production ? provenanceLine(production.settled) : null;
  const year = production?.year ?? new Date().getFullYear();

  const rowSpan = 'col-span-2 lg:col-span-1 lg:col-start-2';

  return (
    <section
      aria-label={`Your ${year} production`}
      className="glass hero teal relative grid lg:h-full lg:content-center grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3.5 overflow-hidden rounded-2xl p-[18px] lg:gap-x-6 lg:p-6"
      data-testid="home-hero"
    >
      <p className={`${rowSpan} font-mono text-[11px] font-semibold uppercase tracking-widest text-[--hero-ink-muted-teal] lg:row-start-1`}>
        {year} · Settled API
      </p>

      {/* Donut — row 2 on mobile; spans the whole left column at lg. */}
      <div className="row-start-2 lg:row-span-5 lg:row-start-1 lg:self-center">
        {pending || error || !production ? (
          <div className="h-[104px] w-[104px] rounded-full border-[10px] border-[--hero-chip-island] lg:h-[150px] lg:w-[150px]" aria-hidden="true" />
        ) : (
          <ProgressDonut
            value={settledApi}
            max={goal}
            pending={pendingApi}
            tone="onHero"
            tick={tick}
            centerLabel={`${pct}%`}
            subLabel={isMdrt ? 'OF MDRT' : 'OF GOAL'}
            ariaLabel={`${pct} percent of your ${isMdrt ? 'MDRT threshold' : 'annual goal'}${tick != null ? `; MDRT is marked at ${Math.round(tick * 100)} percent` : ''}${pendingApi > 0 ? `; ${formatCurrency(pendingApi)} submitted, waiting to settle` : ''}`}
            className="h-[104px] w-[104px] lg:h-[150px] lg:w-[150px]"
            testId="hero-donut"
          />
        )}
      </div>

      <div className="col-start-2 row-start-2 flex min-w-0 flex-col gap-1">
        {pending ? (
          <div className="h-10 w-40 rounded-lg bg-[--hero-chip-island] motion-safe:animate-pulse" aria-busy="true" aria-label="Loading your ledger" data-testid="hero-ledger-pending" />
        ) : error ? (
          <div role="alert" data-testid="hero-ledger-error">
            <p className="text-sm font-semibold text-[--hero-ink]">Couldn&apos;t load your policy ledger.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-[44px] items-center rounded text-sm font-semibold text-[--hero-ink] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Retry
              </button>
            )}
          </div>
        ) : production ? (
          <p
            className="flex items-baseline gap-1.5 text-[--hero-ink]"
            data-testid="hero-settled-api"
            aria-label={`Settled API ${formatCurrency(settledApi)}`}
          >
            <span className="text-[13px] font-semibold text-[--hero-ink-muted-teal] lg:text-base" aria-hidden="true">TTD</span>
            <span className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums lg:text-[52px]" aria-hidden="true">
              {wholeNumber(displayApi)}
            </span>
          </p>
        ) : null}
        <p className="text-[13px] leading-snug text-[--hero-ink-muted-teal] lg:text-sm" data-testid="hero-subline">
          of {wholeNumber(goal)} {goalWord}
          <span aria-hidden="true"> · </span>
          <span className="whitespace-nowrap">{weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} to year-end</span>
        </p>
        {pendingApi > 0 && (
          <p className="text-[13px] font-semibold text-[--hero-ink] lg:text-sm" data-testid="hero-pending-subline">
            +{formatCompact(pendingApi)} submitted
          </p>
        )}
      </div>

      {production && (
        <div
          className={`${rowSpan} grid grid-cols-3 gap-2 border-t border-white/20 pt-3 lg:gap-3`}
          data-testid="hero-ledger-figures"
        >
          <LedgerFigure label="Settled apps" value={production.settled.apps} testId="hero-settled-apps" />
          <LedgerFigure
            label="Submitted API"
            shortLabel="Submitted"
            value={wholeNumber(production.submitted.api)}
            title={formatCurrency(production.submitted.api)}
            marker={production.submitted.datedByIssue ? 'Dated by issue' : null}
            testId="hero-submitted-api"
          />
          <LedgerFigure label="Submitted apps" shortLabel="Sub. apps" value={production.submitted.apps} testId="hero-submitted-apps" />
        </div>
      )}

      <RingLegend
        show={pendingApi > 0}
        tone="onHero"
        className={rowSpan}
        values={production ? { settled: settledApi, submitted: production.submitted.api } : null}
      />

      {provenance && (
        <p className={`${rowSpan} flex items-center gap-2 text-xs text-[--hero-ink-muted-teal]`} data-testid="hero-provenance">
          <Check size={14} aria-hidden="true" className="shrink-0" />
          {provenance}
        </p>
      )}

      {production && (
        <div className={rowSpan}>
          <LedgerReconciliationNote production={production} onOpenLedgerCreate={onOpenLedgerCreate} />
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        className="col-span-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-white/70 text-[15px] font-bold text-[--hero-ink] transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 lg:hidden"
      >
        Submit weekly report
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
