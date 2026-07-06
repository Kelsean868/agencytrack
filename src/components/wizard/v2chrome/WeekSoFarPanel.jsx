import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import {
  totalProductionAPI,
  totalApps,
  ciConv,
  totalCalls,
  refFupCold,
  totalNames,
  estCommission,
  deriveLastWeek,
  buildApiSparkline,
} from '../../../lib/schema/wizardLive.computations';
import MiniSparkline from './MiniSparkline';

/**
 * "Your week so far" — persistent live panel mounted on every step of the
 * v2 wizard. Two variants:
 *   - `desktop` (default): right rail, ~300px, full hero + 2×2 scorecards
 *     + sparkline + still-to-enter hint.
 *   - `mobile`: collapsed bottom strip above the bottom nav, hero metric
 *     only + a 4-up scorecard mini row. (Expand-to-sheet not built — banked
 *     as a LOW FU.)
 *
 * All numbers derive from the live `formData` via the compute lib's pure
 * functions. The lastWeek delta chips, sparkline series, and "still to
 * enter" hint are computed from props; nothing in this component does
 * Firestore I/O.
 *
 * Nexus tokens only; 44px tap-targets where applicable; motion-reduce safe.
 */
export default function WeekSoFarPanel({
  formData,
  commissionRate = 0,
  lastWeekData = null,
  recentSubmissions = [],
  currentStep = 1,
  totalSteps = 12,
  variant = 'desktop',
}) {
  const liveAPI    = totalProductionAPI(formData);
  const liveApps   = totalApps(formData);
  const liveConv   = ciConv(formData);
  const liveCalls  = totalCalls(formData);
  const liveNames  = totalNames(formData);
  const liveComm   = estCommission(formData, commissionRate);

  const lastWeek = useMemo(() => deriveLastWeek(lastWeekData), [lastWeekData]);
  const sparklineSeries = useMemo(
    () => buildApiSparkline(recentSubmissions),
    [recentSubmissions]
  );

  // Steps still to enter = totalSteps - currentStep. Negative-clamped.
  const stillToEnter = Math.max(0, totalSteps - currentStep);

  const delta = (live, last) => {
    if (last == null || last === 0) return null;
    const d = (Number(live) || 0) - (Number(last) || 0);
    if (d === 0) return null;
    return { value: d, sign: d > 0 ? '+' : '' };
  };

  if (variant === 'mobile') {
    return (
      <MobileStrip
        liveAPI={liveAPI}
        liveApps={liveApps}
        liveConv={liveConv}
        liveCalls={liveCalls}
        liveNames={liveNames}
        lastWeekAPI={lastWeek?.api ?? null}
      />
    );
  }

  return (
    <aside
      data-testid="wizard-v2-week-so-far"
      aria-label="Your week so far"
      className="flex flex-col gap-3 w-[304px] shrink-0"
    >
      {/* Eyebrow strip */}
      <div className="flex items-baseline justify-between">
        <p
          data-testid="wizard-v2-week-so-far-eyebrow"
          className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted"
        >
          Your week so far
        </p>
        <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          Live
        </span>
      </div>

      {/* Hero card */}
      <section
        className="relative overflow-hidden rounded-2xl bg-card border border-border/60 p-4 shadow-sm"
        aria-label="Production API hero"
      >
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary">
          Production API
        </p>
        <p
          data-testid="wizard-v2-week-so-far-api"
          className="text-3xl font-display font-bold text-ink mt-2 leading-none"
          style={{ letterSpacing: '-0.024em' }}
        >
          {formatCurrency(liveAPI)}
        </p>
        <DeltaRow live={liveAPI} last={lastWeek?.api ?? null} currency />

        {/* Sparkline + Est. Comm caption */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <MiniSparkline
            values={sparklineSeries}
            currentLive={liveAPI}
            width={148}
            height={36}
          />
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
              Est. Comm
            </p>
            <p
              data-testid="wizard-v2-week-so-far-comm"
              className="text-base font-display font-bold text-primary mt-1 leading-none"
              style={{ letterSpacing: '-0.012em' }}
            >
              {formatCurrency(liveComm)}
            </p>
            <p className="text-[10px] font-mono text-ink-muted mt-1">
              {commissionRate}% rate
            </p>
          </div>
        </div>
      </section>

      {/* 2×2 scorecards */}
      <div className="grid grid-cols-2 gap-2" data-testid="wizard-v2-week-so-far-scorecards">
        <Scorecard
          eyebrow="APPS"
          tone="gold"
          value={liveApps}
          sub={
            `${formData?.newBusiness?.apps ?? 0} NB · ${formData?.pppIncreases?.apps ?? 0} PPP`
          }
          delta={delta(liveApps, lastWeek?.apps ?? null)}
          testid="wizard-v2-week-so-far-card-apps"
        />
        <Scorecard
          eyebrow="CONV."
          tone="teal"
          value={`${liveConv}%`}
          sub={`${formData?.newBusiness?.apps ?? 0} of ${formData?.ciConducted ?? 0} CIs`}
          delta={delta(liveConv, lastWeek?.ciConv ?? null)}
          deltaSuffix="pp"
          testid="wizard-v2-week-so-far-card-conv"
        />
        <Scorecard
          eyebrow="CALLS"
          tone="ink"
          value={liveCalls}
          sub={`Ref · F-up · Cold (${refFupCold(formData)})`}
          delta={delta(liveCalls, lastWeek?.calls ?? null)}
          testid="wizard-v2-week-so-far-card-calls"
        />
        <Scorecard
          eyebrow="NAMES"
          tone="ink"
          value={liveNames}
          sub="New prospects"
          delta={delta(liveNames, lastWeek?.names ?? null)}
          testid="wizard-v2-week-so-far-card-names"
        />
      </div>

      {/* Still-to-enter hint */}
      <div
        data-testid="wizard-v2-week-so-far-still-to-enter"
        className="flex items-center gap-2 rounded-xl bg-surface-raised border border-dashed border-border/60 px-3 py-2"
      >
        <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" aria-hidden="true" />
        <p className="text-[10.5px] text-ink-muted leading-snug">
          {stillToEnter > 0 ? (
            <>
              Hours, ratings, and next-week goals coming up in{' '}
              <span className="font-bold text-ink">
                {stillToEnter} more step{stillToEnter === 1 ? '' : 's'}
              </span>
              .
            </>
          ) : (
            <span className="font-bold text-ink">Ready to submit.</span>
          )}
        </p>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function DeltaRow({ live, last, currency = false }) {
  if (last == null || last === 0) return null;
  const d = (Number(live) || 0) - (Number(last) || 0);
  if (d === 0) return null;
  const positive = d > 0;
  const arrow = positive ? '▲' : '▼';
  const abs = Math.abs(d);
  return (
    <div className="inline-flex items-center gap-1 mt-2">
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wide ${
          positive ? 'bg-success-tint text-success-ink' : 'bg-warning-tint text-warning-ink'
        }`}
      >
        {arrow} {currency ? formatCurrency(abs) : abs}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-wide text-ink-muted">
        vs last wk
      </span>
    </div>
  );
}

function Scorecard({ eyebrow, tone, value, sub, delta, deltaSuffix = '', testid }) {
  const accent =
    tone === 'gold' ? 'text-gold-ink' : tone === 'teal' ? 'text-primary' : 'text-ink';
  const positive = delta && delta.value > 0;
  const negative = delta && delta.value < 0;
  return (
    <div
      data-testid={testid}
      className="rounded-xl bg-card border border-border/60 px-3 py-2.5 flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[9px] font-bold font-mono uppercase tracking-widest ${accent}`}
        >
          {eyebrow}
        </span>
        {delta && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[8.5px] font-bold font-mono uppercase tracking-wide ${
              positive
                ? 'bg-success-tint text-success-ink'
                : negative
                  ? 'bg-warning-tint text-warning-ink'
                  : 'bg-surface-raised text-ink-muted'
            }`}
            data-testid={`${testid}-delta`}
          >
            {delta.sign}
            {delta.value}
            {deltaSuffix}
          </span>
        )}
      </div>
      <p
        data-testid={`${testid}-value`}
        className="text-xl font-display font-bold text-ink leading-none"
        style={{ letterSpacing: '-0.022em' }}
      >
        {value}
      </p>
      <p className="text-[10px] text-ink-muted leading-snug">{sub}</p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Mobile collapsed strip — above bottom nav.
//
// Expand-to-sheet variant intentionally NOT built (LOW FU banked). The strip
// shows the hero metric + delta chip + four micro-tiles in one compact row
// so the agent always sees the live totals on small viewports.

function MobileStrip({
  liveAPI,
  liveApps,
  liveConv,
  liveCalls,
  liveNames,
  lastWeekAPI,
}) {
  const delta = lastWeekAPI != null && lastWeekAPI > 0 ? liveAPI - lastWeekAPI : null;
  return (
    <div
      data-testid="wizard-v2-week-so-far-mobile"
      aria-label="Your week so far (live strip)"
      className="lg:hidden flex flex-col gap-1.5 rounded-xl bg-card border border-border/60 px-3 py-2 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary shrink-0">
            Production API · Live
          </span>
          {delta != null && delta !== 0 && (
            <span
              data-testid="wizard-v2-week-so-far-mobile-delta"
              className={`text-[9.5px] font-bold font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
                delta > 0 ? 'bg-success-tint text-success-ink' : 'bg-warning-tint text-warning-ink'
              }`}
            >
              {delta > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
            </span>
          )}
        </div>
        <p
          data-testid="wizard-v2-week-so-far-mobile-api"
          className="text-lg font-display font-bold text-ink leading-none shrink-0"
          style={{ letterSpacing: '-0.022em' }}
        >
          {formatCurrency(liveAPI)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <MobileTile eyebrow="APPS" value={liveApps} tone="gold" />
        <MobileTile eyebrow="CONV." value={`${liveConv}%`} tone="teal" />
        <MobileTile eyebrow="CALLS" value={liveCalls} />
        <MobileTile eyebrow="NAMES" value={liveNames} />
      </div>
    </div>
  );
}

function MobileTile({ eyebrow, value, tone }) {
  const accent =
    tone === 'gold' ? 'text-gold-ink' : tone === 'teal' ? 'text-primary' : 'text-ink-muted';
  return (
    <div className="flex flex-col items-start min-w-0">
      <span
        className={`text-[8.5px] font-bold font-mono uppercase tracking-widest ${accent}`}
      >
        {eyebrow}
      </span>
      <span className="text-sm font-display font-bold text-ink leading-none">
        {value}
      </span>
    </div>
  );
}
