import React from 'react';
import { AlertTriangle, Check, ChevronRight, ClipboardList, FileText, Plus, RotateCcw } from 'lucide-react';
import { ChartCard, Bullet, Meter, Columns, Sparkline } from '../charts';
import SwipePager from '../pager/SwipePager';
import { useCountUp } from '../../../hooks/useCountUp';

/**
 * FrTodayView — the FR agent "Today" screen (FR-2), PURE: props only, no
 * data fetching, no Firebase. The container (FrToday.jsx) builds `model` with
 * buildTodayModel (src/lib/fr/todayModel.js) and hands the existing Home
 * components in through `slots`, so the harness can pass placeholders.
 *
 * Layout (canvas D3-Today / M3-Home, specs DESKTOP3 · MOTION3 · SWIPE3):
 *   ≥1024  header · "Am I on track" tiles · 12-col grid: left 7 = hero bullet →
 *          Waiting on you → Settled API by month; right 5 = Week N so far →
 *          Coach → campaign → points · bottom: recent + delivery.
 *   768–1023  the same blocks in one column (no pager).
 *   <768   header · SwipePager: Today · Week · Money · Campaign (brief §4 FR-2).
 *          Week also carries the recent-activity list; Money the delivery strip;
 *          Campaign the campaign card(s) and points.
 * ONE layout is rendered, chosen by the `wide` prop (true ≥768px — the
 * container reads it with useMinWidth(768)), so every slot mounts once (one
 * MyPointsCard listener, one RecentCompact id). Tablet vs desktop inside the
 * wide layout is Tailwind (`lg:`). The SwipePager exists only when !wide.
 *
 * FR-D10: a null figure renders "—" (or the block hides) — never a fake 0.
 * Loading = skeletons with aria-busy; ledger error = inline alert + Retry.
 *
 * @param {{
 *   model: object,                          buildTodayModel() output
 *   wide: boolean,                          REQUIRED — true ≥768px: grid layout; false: phone swipe pages
 *   loading?: boolean,                      policy ledger still loading
 *   error?: boolean,                        policy ledger failed
 *   onRetry?: () => void,
 *   onNavigate?: (tabId: string) => void,   stat tiles → existing routes
 *   onAction?: (action: string) => void,    'submit' | 'log-today' | 'ledger-create' | 'standard-details'
 *                                           | 'ledger-confirm' | 'persistency' | 'daily-log' | 'game-plan'
 *   slots?: { banner, nudge, campaign, points, recent, delivery, reconciliation },
 * }} props
 */

const EYEBROW = 'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted';
const CARD = 'rounded-[18px] border border-border bg-card';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const SKELETON = 'rounded-lg bg-fr-sunk motion-safe:animate-pulse';

// LedgerReconciliationNote is written for the solid-teal Nexus hero and reads
// the --hero-* ink tokens. On an FR card those are re-pointed at the FR ink
// tokens (Tailwind arbitrary properties — no inline style, no new CSS).
const HERO_INK_ON_CARD = '[--hero-ink:rgb(var(--text-channels))] [--hero-ink-muted-teal:rgb(var(--text-muted-channels))] [--hero-chip-island:rgb(var(--fr-sunk-channels))] [--hero-chip-border:rgb(var(--border-channels))] [--hero-dot-warning:rgb(var(--fr-warm-channels))] [--hero-dot-success:rgb(var(--fr-accent-channels))]';

const wholeTTD = (n) => `TTD ${Math.round(Number(n) || 0).toLocaleString('en-TT')}`;
const compactNumber = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Math.round(v).toLocaleString('en-TT');
};

function formatTile(value, unit, decimals = 0) {
  if (value == null) return '—';
  return unit === 'pct' ? `${Number(value).toFixed(decimals)}%` : wholeTTD(value);
}

// ── small parts ──────────────────────────────────────────────────────────────

function WarnIcon({ className = '' }) {
  return <AlertTriangle size={14} aria-hidden="true" className={`shrink-0 text-fr-warm ${className}`} />;
}

function Header({ model }) {
  return (
    <header className="flex flex-col gap-1">
      {model.dateLine ? <p className={EYEBROW}>{model.dateLine}</p> : null}
      <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">{model.greeting}</h2>
    </header>
  );
}

function TileValue({ value, unit, decimals }) {
  // Hooks run unconditionally; a null value renders "—" and never counts.
  const animated = useCountUp(value ?? 0, { duration: 420, decimals });
  const final = formatTile(value, unit, decimals);
  if (value == null) return <span className="text-ink-muted">—</span>;
  // A figure never wraps (v3 rule 8): "TTD" is a small prefix inside the same
  // no-wrap run, so "TTD 135,146" cannot break across two lines on a phone
  // tile and push everything below it down mid-glide.
  const shown = unit === 'pct' ? formatTile(animated, unit, decimals) : Math.round(Number(animated) || 0).toLocaleString('en-TT');
  return (
    <>
      <span aria-hidden="true" className="whitespace-nowrap">
        {unit === 'pct' ? null : <span className="mr-1 font-sans text-[13px] font-semibold text-ink-muted">TTD</span>}
        {shown}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

function StatTile({ tile, loading, onNavigate }) {
  const pendingValue = loading && tile.value == null && tile.id !== 'persistency';
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(tile.target)}
      className={`${CARD} ${FOCUS} flex min-h-[44px] min-w-0 flex-col gap-1.5 p-4 text-left transition-colors hover:border-ink-dim`}
      data-testid={`today-tile-${tile.id}`}
    >
      <span className="truncate text-[13px] font-medium text-ink-muted" title={tile.label}>{tile.label}</span>
      {pendingValue ? (
        <span className={`h-8 w-28 ${SKELETON}`} aria-hidden="true" />
      ) : (
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="whitespace-nowrap font-display text-[22px] font-bold leading-none tabular-nums text-ink sm:text-[26px] lg:text-[28px]" data-testid={`today-tile-${tile.id}-value`}>
            <TileValue value={tile.value} unit={tile.unit} decimals={tile.decimals} />
          </span>
          {tile.qualifier && tile.value != null ? <span className="text-[13px] text-ink-muted">{tile.qualifier}</span> : null}
        </span>
      )}
      {tile.note ? (
        <span className={`flex min-w-0 items-start gap-1.5 text-[12px] leading-snug ${tile.tone === 'warm' ? 'font-semibold text-fr-warm' : 'text-ink-muted'}`}>
          {tile.tone === 'warm' ? <WarnIcon className="mt-px" /> : null}
          <span className="min-w-0">{tile.note}</span>
        </span>
      ) : null}
      {tile.spark ? (
        <span className="mt-auto pt-1">
          <Sparkline values={tile.spark.values} label={tile.spark.label} width={120} height={26} format={wholeTTD} />
        </span>
      ) : null}
    </button>
  );
}

function Tiles({ model, loading, onNavigate, className = '' }) {
  return (
    <section aria-label="Am I on track" className={className}>
      <h2 className="sr-only">Am I on track</h2>
      <div className={`grid grid-cols-2 gap-3 ${model.tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {model.tiles.map((t) => (
          <StatTile key={t.id} tile={t} loading={loading} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

function Figure({ label, value, marker, testId }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <span className="text-[12px] leading-tight text-ink-muted">{label}</span>
      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink sm:text-[17px]">{value ?? '—'}</span>
      {marker ? <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">{marker}</span> : null}
    </div>
  );
}

function HeroCard({ model, loading, error, onRetry, onAction, reconciliation }) {
  const { hero } = model;
  const heading = hero.year ? `Your ${hero.year} production` : 'Your production';
  let body;
  if (loading) {
    body = (
      <div className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Loading your policy ledger" data-testid="today-hero-loading">
        <span className={`h-5 w-2/3 ${SKELETON}`} />
        <span className={`h-3 w-full ${SKELETON}`} />
        <span className={`h-10 w-1/2 ${SKELETON}`} />
      </div>
    );
  } else if (error) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 p-5" data-testid="today-hero-error">
        <WarnIcon />
        <p className="text-[14px] font-semibold text-ink">Couldn&apos;t load your policy ledger. Your production figures show once it loads.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className={`inline-flex min-h-[44px] items-center rounded-lg px-2 text-[14px] font-bold text-primary underline underline-offset-2 ${FOCUS}`}>
            Retry
          </button>
        ) : null}
      </div>
    );
  } else if (hero.settled == null) {
    body = <p className="p-5 text-[14px] text-ink-muted">No production figures yet.</p>;
  } else {
    const subtitle = hero.met
      ? `${hero.goalLabel} · ${hero.weeksLeft} weeks to year-end`
      : `${hero.weeksLeft} ${hero.weeksLeft === 1 ? 'week' : 'weeks'} to year-end${hero.perWeekNeeded != null ? ` · ${wholeTTD(hero.perWeekNeeded)} a week needed` : ''}`;
    const table = {
      caption: `${hero.year} production from your policy ledger`,
      columns: [
        { key: 'label', label: 'Figure' },
        { key: 'value', label: 'Value', align: 'right' },
      ],
      rows: [
        { key: 'settled', label: 'Settled API', value: wholeTTD(hero.settled) },
        { key: 'waiting', label: 'Submitted, waiting to settle', value: hero.pending == null ? '—' : wholeTTD(hero.pending) },
        { key: 'goal', label: hero.isMdrt ? 'MDRT threshold' : 'Your goal', value: wholeTTD(hero.goal) },
        { key: 'apps', label: 'Settled apps', value: hero.settledApps ?? '—' },
        { key: 'sub', label: 'Submitted API', value: hero.submittedApi == null ? '—' : wholeTTD(hero.submittedApi) },
        { key: 'subapps', label: 'Submitted apps', value: hero.submittedApps ?? '—' },
      ],
    };
    body = (
      <>
        <ChartCard title={hero.title} subtitle={subtitle} table={table} className="!rounded-none !border-0 !bg-transparent">
          <Bullet
            value={hero.settled}
            ghostValue={hero.pending ?? 0}
            target={hero.goal}
            label={`Settled API ${hero.year}`}
            valueText={wholeTTD(hero.settled)}
            targetText={hero.goalLabel}
            height={14}
          />
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-fr-accent" />Settled — counts toward {hero.isMdrt ? 'MDRT' : 'your goal'}</span>
            {hero.pending > 0 ? (
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-fr-ghost" />Submitted, waiting to settle · {wholeTTD(hero.pending)}</span>
            ) : null}
          </p>
        </ChartCard>
        <div className="flex flex-col gap-3 border-t border-border px-5 pb-5 pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-3" data-testid="today-hero-figures">
            <Figure label="Settled apps" value={hero.settledApps} testId="today-hero-settled-apps" />
            <Figure
              label="Submitted API"
              value={hero.submittedApi == null ? null : wholeTTD(hero.submittedApi)}
              marker={hero.datedByIssue ? 'Dated by issue' : null}
              testId="today-hero-submitted-api"
            />
            <Figure label="Submitted apps" value={hero.submittedApps} testId="today-hero-submitted-apps" />
          </div>
          {hero.provenance ? (
            <p className="flex items-center gap-2 text-[12px] text-ink-muted" data-testid="today-hero-provenance">
              <Check size={14} aria-hidden="true" className="shrink-0 text-primary" />
              {hero.provenance}
            </p>
          ) : null}
          {reconciliation ? <div className={`${HERO_INK_ON_CARD} [&>div]:mt-0`}>{reconciliation}</div> : null}
          <div>
            <button
              type="button"
              onClick={() => onAction?.('ledger-create')}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-[13px] font-bold text-primary ${FOCUS}`}
            >
              <Plus size={14} aria-hidden="true" />
              Log a policy
            </button>
          </div>
        </div>
      </>
    );
  }
  return (
    <section aria-label={heading} className={`${CARD} overflow-hidden`} data-testid="today-hero">
      <h2 className="sr-only">{heading}</h2>
      {body}
    </section>
  );
}

const WAIT_ICONS = { submit: FileText, confirm: Check, winback: RotateCcw, standard: ClipboardList };
const WAIT_TONE = {
  teal: 'bg-fr-accent-tint text-primary',
  warning: 'bg-fr-warm-tint text-fr-warm',
  neutral: 'bg-fr-sunk text-ink',
};

function Waiting({ model, onAction, onRetry }) {
  return (
    <section aria-label="Waiting on you" className={`${CARD} p-5`} data-testid="today-waiting">
      <h2 className="font-display text-[20px] font-bold text-ink">Waiting on you</h2>
      {model.waitingLoading ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true" aria-label="Loading what is waiting on you" data-testid="today-waiting-loading">
          <span className={`h-14 ${SKELETON}`} />
          <span className={`h-14 ${SKELETON}`} />
        </div>
      ) : (
        <>
          {model.waiting.length > 0 ? (
            <ul className="mt-2 divide-y divide-border">
              {model.waiting.map((w) => {
                const Icon = WAIT_ICONS[w.id] ?? ClipboardList;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onAction?.(w.target)}
                      className={`flex min-h-[60px] w-full items-center gap-3 rounded-lg py-2 text-left transition-colors hover:bg-fr-sunk/60 ${FOCUS}`}
                      data-testid={`today-waiting-${w.id}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${WAIT_TONE[w.tone] ?? WAIT_TONE.neutral}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-bold text-ink">{w.title}</span>
                        <span className="text-[13px] text-ink-muted">{w.sub}</span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {model.waitingIncomplete ? (
            <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 text-[13px] text-ink" data-testid="today-waiting-incomplete">
              <WarnIcon />
              <span>Some checks need your policy ledger, which didn&apos;t load.</span>
              {onRetry ? (
                <button type="button" onClick={onRetry} className={`inline-flex min-h-[44px] items-center font-bold text-primary underline underline-offset-2 ${FOCUS}`}>
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {model.waiting.length === 0 && !model.waitingIncomplete ? (
            <p className="mt-2 text-[14px] text-ink-muted" data-testid="today-waiting-clear">Nothing is waiting on you. You&apos;re on track.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Monthly({ model, loading }) {
  if (loading) {
    return (
      <section aria-label="Settled API by month" className={`${CARD} p-5`} aria-busy="true" data-testid="today-monthly-loading">
        <h2 className="sr-only">Settled API by month</h2>
        <span className={`block h-5 w-1/2 ${SKELETON}`} />
        <span className={`mt-4 block h-40 ${SKELETON}`} />
      </section>
    );
  }
  if (!model.monthly) return null;
  const { monthly } = model;
  const table = {
    caption: `Settled API by issue month, ${monthly.year}`,
    columns: [
      { key: 'label', label: `Month (${monthly.year})` },
      { key: 'value', label: 'Settled API (TTD)', align: 'right', format: (v) => Math.round(v).toLocaleString('en-TT') },
    ],
    rows: monthly.data.map((d) => ({ key: d.key, label: d.label, value: d.value })),
  };
  return (
    <section aria-label="Settled API by month" data-testid="today-monthly">
      <h2 className="sr-only">Settled API by month</h2>
      <ChartCard title={monthly.title} subtitle="Settled API by issue month, TTD" table={table}>
        <Columns data={monthly.data} format={compactNumber} height={150} />
      </ChartCard>
    </section>
  );
}

function UnknownMeter({ label, target }) {
  return (
    <div className="py-1.5" title="Not captured yet — shows once your daily log or weekly report has it">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-ink">{label}</span>
        <span className="flex flex-none items-center gap-1 text-[13px] tabular-nums text-ink">
          <span className="font-semibold text-ink-muted">—</span>
          <span className="text-ink-muted">/ {target}</span>
          <span className="sr-only">, not captured yet</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-fr-sunk" aria-hidden="true" />
    </div>
  );
}

function Week({ model, onAction }) {
  const sub = model.weekSource === 'final'
    ? 'From your submitted weekly report'
    : 'From your daily logs so far. A dash means not captured yet.';
  return (
    <section aria-label={model.weekTitle} className={`${CARD} p-5`} data-testid="today-week">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 className="font-display text-[20px] font-bold text-ink">{model.weekTitle}</h2>
        {!model.weekLoading && !model.weekError ? (
          <button
            type="button"
            onClick={() => onAction?.('standard-details')}
            className={`inline-flex min-h-[44px] items-center rounded-lg px-2 text-[13px] font-bold text-primary ${FOCUS}`}
          >
            Details
          </button>
        ) : null}
      </div>
      {model.weekLoading ? (
        <div className="mt-3 flex flex-col gap-3" aria-busy="true" aria-label="Loading this week's activity" data-testid="today-week-loading">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-7 ${SKELETON}`} />)}
        </div>
      ) : model.weekError ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-ink" data-testid="today-week-error">
          <WarnIcon className="mt-0.5" />
          Couldn&apos;t load this week&apos;s activity. Pull down to refresh.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-[12px] text-ink-muted">{sub}</p>
          <ul className="mt-2 divide-y divide-border" data-testid="today-meters">
            {model.meters.map((m) => (
              // Fixed row height, bottom-aligned: a Meter's label line grows ~2px
              // when its check / "Behind" icon appears, which would jump every
              // row below it instead of letting the bars glide (MOTION3 rule 7).
              <li key={m.key} className="flex min-h-[50px] flex-col justify-end" data-testid={`today-meter-${m.key}`}>
                {m.value == null
                  ? <UnknownMeter label={m.label} target={m.target} />
                  : <Meter label={m.label} value={m.value} target={m.target} tone={m.behind ? 'warm' : undefined} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Coach({ model, onAction }) {
  return (
    <section aria-label="Coach" className={`${CARD} p-5`} data-testid="today-coach">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-display text-[20px] font-bold text-ink">Coach</h2>
        <span className={EYEBROW}>From your numbers only</span>
      </div>
      {model.coach.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink-muted" data-testid="today-coach-empty">Nothing to flag right now.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {model.coach.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-2.5" data-testid={`today-coach-${c.id}`}>
              <p className="flex items-start gap-2 text-[14px] leading-snug text-ink">
                {c.tone === 'warm' ? <WarnIcon className="mt-0.5" /> : null}
                <span className="min-w-0">{c.text}</span>
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => onAction?.(c.action.target)}
                  className={`inline-flex min-h-[44px] items-center rounded-lg px-1 text-[13px] font-bold text-primary ${FOCUS}`}
                >
                  {c.action.label}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionRow({ model, onAction, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`} data-testid="today-actions">
      <button
        type="button"
        onClick={() => onAction?.('submit')}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-fr-accent px-3 text-[14px] font-bold text-fr-on-accent ${FOCUS}`}
      >
        <FileText size={16} aria-hidden="true" />
        {model.reportSubmitted ? 'Review report' : 'Submit report'}
      </button>
      <button
        type="button"
        onClick={() => onAction?.('log-today')}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-[14px] font-bold text-ink ${FOCUS}`}
      >
        <Plus size={16} aria-hidden="true" />
        Log today
      </button>
    </div>
  );
}

function Slot({ node, name, className = '' }) {
  if (!node) return null;
  return <div className={className} data-slot={name}>{node}</div>;
}

// ── the screen ───────────────────────────────────────────────────────────────

export default function FrTodayView({ model, wide, loading = false, error = false, onRetry, onNavigate, onAction, slots = {} }) {
  if (import.meta.env.DEV && typeof wide !== 'boolean') {
    // CLAUDE.md v3 rule 11 — a missing layout flag must not silently pick one.
    console.warn('FrTodayView: `wide` (boolean) is required; rendering the phone layout.');
  }
  const s = slots ?? {};
  const hero = (
    <HeroCard model={model} loading={loading} error={error} onRetry={onRetry} onAction={onAction} reconciliation={s.reconciliation} />
  );

  const pages = [
    {
      id: 'today',
      label: 'Today',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <Tiles model={model} loading={loading} onNavigate={onNavigate} />
          {hero}
          <ActionRow model={model} onAction={onAction} />
          <Waiting model={model} onAction={onAction} onRetry={onRetry} />
        </div>
      ),
    },
    {
      id: 'week',
      label: 'Week',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <Week model={model} onAction={onAction} />
          <Coach model={model} onAction={onAction} />
          <Slot node={s.recent} name="recent" />
        </div>
      ),
    },
    {
      id: 'money',
      label: 'Money',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <Monthly model={model} loading={loading} />
          <Slot node={s.delivery} name="delivery" />
        </div>
      ),
    },
    {
      id: 'campaign',
      label: 'Campaign',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <Slot node={s.campaign} name="campaign" className="flex flex-col gap-3" />
          <Slot node={s.points} name="points" />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-today">
      <Header model={model} />
      <Slot node={s.banner} name="banner" />
      <Slot node={s.nudge} name="nudge" />

      {wide ? (
        // Tablet (768–1023) one column · desktop (≥1024) 12-column grid.
        <div className="flex flex-col gap-5" data-testid="fr-today-desktop">
          <ActionRow model={model} onAction={onAction} className="lg:hidden" />
          <Tiles model={model} loading={loading} onNavigate={onNavigate} />
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start">
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
              {hero}
              <Waiting model={model} onAction={onAction} onRetry={onRetry} />
              <Monthly model={model} loading={loading} />
            </div>
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
              <Week model={model} onAction={onAction} />
              <Coach model={model} onAction={onAction} />
              <Slot node={s.campaign} name="campaign" className="flex flex-col gap-3" />
              <Slot node={s.points} name="points" />
            </div>
          </div>
          {s.recent || s.delivery ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Slot node={s.recent} name="recent" className="min-w-0 lg:col-span-7" />
              <Slot node={s.delivery} name="delivery" className="min-w-0 lg:col-span-5" />
            </div>
          ) : null}
        </div>
      ) : (
        // Phone (<768): named swipe pages.
        <div data-testid="fr-today-phone">
          <SwipePager pages={pages} ariaLabel="Today pages" />
        </div>
      )}
    </div>
  );
}
