import React, { useMemo, useState } from 'react';
import ProgressDonut from '../dashboard/ProgressDonut';
import { formatCompact, formatAppsRange } from '../../lib/campaignPace';
import { whatIfProjection, clampToWhatIfStep, WHAT_IF_MIN, WHAT_IF_MAX, WHAT_IF_STEP } from '../../lib/campaignWhatIf';
import { outlookDateLabel, outlookMonthShortLabel } from '../persistency/outlookLabels';
import { formatOutlookPct } from '../../lib/persistency/persistencyOutlook';
import { formatCurrency } from '../../utils/formatters';

/** "70,000" — `formatCurrency` minus its "TTD " prefix, for a column that
 * already states its currency in a header (tier ladder, R2 block 4 — the
 * mockup's cash column has no per-row "TTD" and wraps to two lines at 390px
 * when one is added). The full value stays in a `title`/aria-label. */
function formatCashOnly(n) {
  return formatCurrency(n).replace(/^TTD\s*/, '');
}

/** "1 app" / "3 apps" — plain English pluralization, no library needed for one word. */
function pluralApps(n) {
  return `${n} app${n === 1 ? '' : 's'}`;
}

/**
 * CampaignScreenBlocks — the six blocks of the Campaign screen (R2,
 * docs/briefs/home-campaign-redesign.md § R2). Presentational only: every
 * figure arrives already derived by CampaignHeroCard's `variant="screen"`
 * branch, which reuses the SAME `derivePolicyLens` + persistency-outlook reads
 * as the compact card (R1) and the full ledger panel — this file computes
 * nothing about the campaign itself.
 *
 * Mobile order = declaration order below. Desktop 8/4 split is the caller's
 * grid (CampaignHeroCard), not this file's concern.
 */

// ── Block 1 — Progress ───────────────────────────────────────────────────────

function ProgressRow({ label, value, target, unit, valueLine, toGoLabel, tone = 'teal', tick = null, centerLabel, ariaLabel, testId, note }) {
  return (
    <div
      className="flex items-center gap-3.5 py-3 border-b border-border last:border-b-0 lg:flex-col lg:items-center lg:gap-2.5 lg:border-b-0 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-[18px] lg:text-center"
      data-testid={testId}
    >
      <ProgressDonut
        value={value ?? 0}
        max={target ?? value ?? 1}
        tone={tone}
        tick={tick}
        centerLabel={centerLabel}
        ariaLabel={ariaLabel}
        className="h-[68px] w-[68px] shrink-0 lg:h-[104px] lg:w-[104px]"
      />
      <div className="flex min-w-0 flex-col gap-0.5 lg:items-center">
        <span className="text-sm font-bold text-ink">{label}</span>
        {/* `valueLine` is a caller-formatted string (e.g. "86.0%") for a row
            whose value isn't a plain TTD/count pair — the persistency row
            below. Without it, a raw unrounded float (86.0377446303493) was
            rendered here directly; every row that HAS a real unit still goes
            through the value/target branch, unaffected. */}
        <span className="text-[15px] font-semibold text-ink">
          {valueLine != null ? valueLine : (
            <>
              {unit === 'TTD' ? formatCompact(value) : value}
              {target != null && (
                <span className="font-medium text-ink-muted"> of {unit === 'TTD' ? formatCompact(target) : target}</span>
              )}
            </>
          )}
        </span>
        <span className="text-xs text-ink-muted">{toGoLabel}</span>
        {note && <span className="text-xs text-ink-muted">{note}</span>}
      </div>
    </div>
  );
}

export function ProgressBlock({ lens, threshold, persistencyDisplayPct, persistencyLabel, persistencyBelow, gateMonthShort }) {
  const apiToGo = lens.api.target != null ? Math.max(0, lens.api.target - lens.api.current) : null;
  const appsToGo = lens.apps.target != null ? Math.max(0, lens.apps.target - lens.apps.current) : null;
  const apiPct = lens.api.target > 0 ? Math.min(999, Math.round((lens.api.current / lens.api.target) * 100)) : 100;

  return (
    <section
      aria-label="Your progress"
      className="rounded-2xl border border-border bg-card px-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0"
      data-testid="campaign-screen-progress"
    >
      <ProgressRow
        label="API"
        value={lens.api.current}
        target={lens.api.target}
        unit="TTD"
        centerLabel={`${apiPct}%`}
        toGoLabel={apiToGo != null ? `${formatCompact(apiToGo)} to go` : 'Target met'}
        ariaLabel={`API ${apiPct} percent of target`}
        testId="campaign-screen-progress-api"
      />
      <ProgressRow
        label="Applications"
        value={lens.apps.current}
        target={lens.apps.target}
        unit="count"
        centerLabel={String(lens.apps.current)}
        toGoLabel={appsToGo != null ? (appsToGo > 0 ? `${appsToGo} to go` : 'Target met') : 'Target met'}
        ariaLabel={`${lens.apps.current} applications of ${lens.apps.target ?? lens.apps.current} target`}
        testId="campaign-screen-progress-apps"
      />
      <ProgressRow
        label="Persistency"
        value={persistencyDisplayPct ?? 0}
        target={100}
        unit="count"
        tone={persistencyBelow ? 'warning' : 'teal'}
        tick={threshold != null ? threshold / 100 : null}
        centerLabel={persistencyDisplayPct != null ? persistencyLabel : '—'}
        valueLine={persistencyDisplayPct != null ? persistencyLabel : '—'}
        toGoLabel={persistencyDisplayPct != null
          ? (threshold != null ? `need ${threshold}%${gateMonthShort ? ` in ${gateMonthShort}` : ''}` : '')
          : 'Not yet known'}
        note={persistencyBelow ? 'Below the gate' : null}
        ariaLabel={persistencyDisplayPct != null
          ? `Persistency ${persistencyLabel}${threshold != null ? `, gate ${threshold} percent` : ''}`
          : 'Persistency not yet known'}
        testId="campaign-screen-progress-persistency"
      />
    </section>
  );
}

// ── Block 2 — What it takes ──────────────────────────────────────────────────

function TakesRow({ figure, tone, text, testId }) {
  return (
    <div
      className="flex items-center gap-3 py-3.5 border-b border-border last:border-b-0 lg:flex-col lg:items-start lg:gap-1 lg:border-b-0 lg:border-r lg:border-border lg:p-[18px] lg:last:border-r-0"
      data-testid={testId}
    >
      <span
        className={`w-[76px] shrink-0 font-display text-xl font-bold lg:w-auto lg:text-[28px] ${tone === 'warning' ? 'text-warning-ink' : 'text-ink'}`}
      >
        {figure}
      </span>
      <span className="text-sm text-ink-muted leading-snug">{text}</span>
    </div>
  );
}

export function WhatItTakesBlock({ pace, weeksLeft, reinstateNeeded, gateThreshold, atOrAboveGate }) {
  const weeksLabel = Number.isFinite(weeksLeft) ? Math.max(1, Math.round(weeksLeft)) : null;
  const showReinstate = !atOrAboveGate && reinstateNeeded > 0;
  return (
    <section aria-label="What it takes" className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg font-bold text-ink">What it takes</h2>
      <div className={`rounded-[18px] border border-border bg-card px-3.5 lg:px-0 lg:grid ${showReinstate ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <TakesRow
          figure={pace ? formatCompact(pace.apiPerWeek) : '—'}
          text={weeksLabel ? `API a week for the next ${weeksLabel} week${weeksLabel === 1 ? '' : 's'}.` : 'API a week.'}
          testId="campaign-screen-takes-api"
        />
        <TakesRow
          figure={pace ? formatAppsRange(pace.appsPerWeekLow, pace.appsPerWeekHigh) : '—'}
          text="applications a week."
          testId="campaign-screen-takes-apps"
        />
        {showReinstate && (
          <TakesRow
            figure={formatCompact(reinstateNeeded)}
            tone="warning"
            text={`TTD of lapsed premium reinstated lifts persistency to ${gateThreshold}%.`}
            testId="campaign-screen-takes-reinstate"
          />
        )}
      </div>
    </section>
  );
}

// ── Block 3 — Persistency gate bar ───────────────────────────────────────────
//
// The 80–95% scale is this block's own display convention (mockup C2/C4): it
// is not a business rule, only where the bar draws its ruler. Values outside
// the range clamp to the nearest end so the bar never draws off its own track.

const GATE_BAR_MIN = 80;
const GATE_BAR_MAX = 95;

function gateBarPct(value) {
  if (value == null) return null;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  return Math.min(100, Math.max(0, ((v - GATE_BAR_MIN) / (GATE_BAR_MAX - GATE_BAR_MIN)) * 100));
}

function MonthColumn({ label, value, tone, note, testId }) {
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`text-base font-bold ${tone === 'warning' ? 'text-warning-ink' : 'text-ink'}`}>{value}</span>
      <span className="text-[11px] text-ink-muted">{note}</span>
    </div>
  );
}

/**
 * The month-history row (R2 block 3 / mockup C2 / C4): last derived month
 * ("From HO", "· Confirm" appended only when #971's own `confirmable` flag
 * says so — never re-derived here), current month ("Estimate"), gate month
 * ("Projected"). Every figure and every flag comes straight off `outlook`
 * (`buildPersistencyOutlook`'s return, computed once in CampaignHeroCard) —
 * this component formats, it does not compute.
 *
 * "Confirm" renders as inert text, not a control: the self-confirm write
 * path is P2d, explicitly out of scope for R2 (docs/briefs/home-campaign-
 * redesign.md § Out of scope). Wiring a real confirm action here would be
 * exactly the kind of "how to solve" decision Rule 1 reserves for a brief.
 */
function MonthHistoryRow({ outlook, threshold }) {
  const { derived, estimateToday, gateMonth } = outlook ?? {};
  if (!derived && !estimateToday && !gateMonth) return null;

  return (
    <div className="grid grid-cols-3 gap-2" data-testid="campaign-screen-gate-month-history">
      {derived && (
        <MonthColumn
          label={outlookMonthShortLabel(derived.monthKey)}
          value={formatOutlookPct(derived.persistency)}
          note={derived.confirmable ? 'From HO · Confirm' : 'From HO'}
          testId="campaign-screen-gate-month-derived"
        />
      )}
      {estimateToday && (
        <MonthColumn
          label={outlookMonthShortLabel(estimateToday.monthKey)}
          value={formatOutlookPct(estimateToday.persistency)}
          note="Estimate"
          testId="campaign-screen-gate-month-estimate"
        />
      )}
      {gateMonth && (
        <MonthColumn
          label={outlookMonthShortLabel(gateMonth.monthKey)}
          value={formatOutlookPct(gateMonth.persistency)}
          tone={Number.isFinite(threshold) && gateMonth.persistency * 100 < threshold ? 'warning' : undefined}
          note="Projected"
          testId="campaign-screen-gate-month-projected"
        />
      )}
    </div>
  );
}

export function PersistencyGateBarBlock({ projectedPct, threshold, judgedLabel, outlook }) {
  const fillPct = gateBarPct(projectedPct);
  const tickPct = gateBarPct(threshold);
  const belowGate = Number.isFinite(projectedPct) && Number.isFinite(threshold) && projectedPct < threshold;

  return (
    <section
      aria-label="Persistency gate"
      className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4"
      data-testid="campaign-screen-gate-bar-section"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold text-ink">Persistency gate</span>
        {judgedLabel && <span className="text-xs font-bold text-warning-ink">{judgedLabel}</span>}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="lg:min-w-0 lg:flex-1">
          {/* A div-based bar has no Tailwind way to place a fill/tick at a
              RUNTIME percentage without an inline `style` (Tailwind's
              arbitrary values are resolved at build time, not from a JS
              variable). SVG geometry attributes draw the same runtime
              position without one — the same reason ProgressDonut uses them
              for its ring. `preserveAspectRatio="none"` lets the bar fill its
              column at any width — the default "meet" scaling was
              letterboxing it (300×54's own aspect ratio) into a narrow bar
              centred in a wide desktop card. */}
          <svg
            viewBox="0 0 300 54" preserveAspectRatio="none" className="h-[46px] w-full" role="img"
            aria-label={`Persistency gate, ${GATE_BAR_MIN} to ${GATE_BAR_MAX} percent, gate at ${threshold} percent${projectedPct != null ? `, projected ${projectedPct.toFixed(1)} percent` : ''}`}
            data-testid="campaign-screen-gate-bar"
          >
            <rect x="0" y="16" width="300" height="10" rx="5" className="fill-surface-muted" />
            {fillPct != null && (
              <rect
                x="0" y="16" width={(fillPct / 100) * 300} height="10" rx="5"
                className={belowGate ? 'fill-warning' : 'fill-success'}
                data-testid="campaign-screen-gate-bar-fill"
              />
            )}
            {tickPct != null && (
              <line
                x1={(tickPct / 100) * 300} x2={(tickPct / 100) * 300} y1="6" y2="36"
                strokeWidth="3" strokeLinecap="round" className="stroke-ink"
                data-testid="campaign-screen-gate-bar-tick"
              />
            )}
            <text x="0" y="50" fontSize="10" fontFamily="inherit" textAnchor="start" className="fill-ink-muted font-mono">{GATE_BAR_MIN}%</text>
            <text x="300" y="50" fontSize="10" fontFamily="inherit" textAnchor="end" className="fill-ink-muted font-mono">{GATE_BAR_MAX}%</text>
            {fillPct != null && (
              <text
                x={(fillPct / 100) * 300} y="50" fontSize="10" fontWeight="700" textAnchor="middle"
                className={`font-mono ${belowGate ? 'fill-warning-ink' : 'fill-success-ink'}`}
                data-testid="campaign-screen-gate-bar-value"
              >
                {projectedPct.toFixed(1)}
              </text>
            )}
            {tickPct != null && (
              <text x={(tickPct / 100) * 300} y="50" fontSize="10" fontWeight="700" textAnchor="middle" className="fill-ink font-mono">
                GATE {threshold}
              </text>
            )}
          </svg>
        </div>
        <div className="lg:w-[260px] lg:shrink-0 lg:border-l lg:border-border lg:pl-5">
          <MonthHistoryRow outlook={outlook} threshold={threshold} />
        </div>
      </div>
    </section>
  );
}

// ── Block 4 — Tier ladder ────────────────────────────────────────────────────

function TierRow({ tier, isNext, isYou, appsUnit }) {
  if (isYou) {
    return (
      <div className="flex items-center gap-2.5 py-2.5" data-testid="campaign-screen-you-row">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">You</span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold text-ink">{tier.youLabel}</span>
          <span className="text-xs text-ink-muted">{tier.progressLabel}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-2.5 -mx-2.5 py-2.5 ${isNext ? 'bg-gold-tint' : ''}`}
      data-testid={`campaign-screen-tier-row-${tier.name}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] ${isNext ? 'font-bold text-ink' : 'font-semibold text-ink-muted'}`}>{tier.name}</span>
        {isNext && <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gold-ink" data-testid="campaign-screen-tier-next-badge">Next tier</span>}
      </div>
      <span className="text-xs text-ink-muted">{formatCompact(tier.api)}{appsUnit ? ` · ${pluralApps(tier.apps)}` : ''}</span>
      <span
        className={`w-[74px] text-right text-sm ${isNext ? 'font-bold text-ink' : 'font-semibold text-ink-muted'}`}
        title={formatCurrency(tier.cash ?? 0)}
      >
        {formatCashOnly(tier.cash ?? 0)}
      </span>
    </div>
  );
}

/**
 * `tiers` — every tier of the campaign, HIGHEST first (this block sorts).
 * `tierNextName` — which tier name is "NEXT TIER" (lens.tierNext?.name).
 */
export function TierLadderBlock({ tiers, tierNextName, apiCurrent, appsCurrent, appsPerTier }) {
  const ordered = useMemo(
    () => (Array.isArray(tiers) ? [...tiers].sort((a, b) => (Number(b.api) || 0) - (Number(a.api) || 0)) : []),
    [tiers],
  );
  if (ordered.length === 0) return null;

  const nextTier = ordered.find((t) => t.name === tierNextName) ?? null;
  const progressPct = nextTier?.api > 0 ? Math.min(100, Math.round((apiCurrent / nextTier.api) * 100)) : null;

  return (
    <section aria-label="Tier ladder" className="flex flex-col gap-2.5" data-testid="campaign-screen-tier-ladder">
      <h2 className="font-display text-lg font-bold text-ink">
        Tiers{appsPerTier != null && <span className="ml-1.5 text-[13px] font-medium text-ink-muted">· {appsPerTier} apps each · cash in TTD</span>}
      </h2>
      <div className="rounded-2xl border border-border bg-card px-4">
        {ordered.map((t) => (
          <TierRow key={t.name} tier={t} isNext={t.name === tierNextName} isYou={false} />
        ))}
        {nextTier && (
          <TierRow
            tier={{
              youLabel: `${formatCurrency(apiCurrent)} · ${pluralApps(appsCurrent)}`,
              progressLabel: progressPct != null ? `${progressPct}% of the way to ${nextTier.name}` : `Toward ${nextTier.name}`,
            }}
            isYou
          />
        )}
      </div>
    </section>
  );
}

// ── Block 5 — What if ────────────────────────────────────────────────────────

function tierLine(tier, notReached, endDateLabel) {
  if (tier) return `${tier.name} around ${outlookDateLabel(tier.date)}.`;
  if (notReached) return `${notReached.name} not reached by ${endDateLabel} at this pace.`;
  return null;
}

export function WhatIfBlock({ apiCurrent, tiers, today, endDate, initialRate }) {
  const [rate, setRate] = useState(() => clampToWhatIfStep(initialRate));
  const projection = useMemo(
    () => whatIfProjection({ apiCurrent, tiers, weeklyRate: rate, today, endDate }),
    [apiCurrent, tiers, rate, today, endDate],
  );
  const endDateLabel = endDate ? outlookDateLabel(endDate) : 'the campaign end';
  const [firstLine, secondLine] = [
    tierLine(projection.reaches[0] ?? null, projection.reaches[0] ? null : projection.notReachedTier, endDateLabel),
    tierLine(projection.reaches[1] ?? null, projection.reaches[1] ? null : (projection.reaches[0] ? projection.notReachedTier : null), endDateLabel),
  ];

  return (
    <section
      aria-label="What if"
      // CLAUDE.md D6 — white text on `bg-primary` needs `dark:bg-primary-dark`:
      // dark mode's `--color-primary` LIFTS to a bright, lower-contrast teal
      // for use as text on a surface, not as a fill; `--color-primary-dark`
      // in dark mode resolves to the SAME token value the light theme already
      // uses for `bg-primary` (see src/index.css's own documented contrast
      // ratio beside this exact pairing). Same reason the slider track/thumb
      // (`accent-white`) now sits on a fill that is teal, never bright, in
      // both themes.
      className="flex flex-col gap-2.5 rounded-[18px] bg-primary dark:bg-primary-dark p-4 text-white"
      data-testid="campaign-screen-whatif"
    >
      <label htmlFor="campaign-whatif-pace" className="text-[15px] font-bold">
        What if I write TTD {formatCompact(rate)} a week?
      </label>
      <input
        id="campaign-whatif-pace"
        type="range"
        min={WHAT_IF_MIN}
        max={WHAT_IF_MAX}
        step={WHAT_IF_STEP}
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        className="h-7 w-full accent-white"
        data-testid="campaign-screen-whatif-slider"
      />
      <div className="flex flex-col gap-1" data-testid="campaign-screen-whatif-result">
        {firstLine && <span className="text-sm text-white/85">You reach {firstLine}</span>}
        {!firstLine && <span className="text-sm text-white/85">Not reached by {endDateLabel} at this pace.</span>}
        {secondLine && <span className="text-sm text-white/85">{secondLine}</span>}
      </div>
      <span className="text-[11px] text-white/70">API only. You still need the applications and persistency targets.</span>
    </section>
  );
}

// ── Block 6 — Footer ────────────────────────────────────────────────────────

export function ScreenFooter() {
  return (
    <p className="px-1 text-xs text-ink-muted" data-testid="campaign-screen-footer">
      An indication only. Executive Business Development decides.
    </p>
  );
}
