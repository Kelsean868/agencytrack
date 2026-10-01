import React from 'react';
import { ArrowRight, Check, Pencil } from 'lucide-react';
import { ChartCard, Columns } from '../charts';
import SwipePager from '../pager/SwipePager';
import { CARD, EYEBROW, FOCUS } from './moneyParts';

/**
 * FrGamePlanView — the FR Game plan (R2-8, canvas D3M-GamePlan / M3-GamePlan),
 * PURE: props only. The container is the existing Game plan hub
 * (dashboard/GamePlanV2/index.jsx): it keeps every read, every derivation and
 * every write, builds `model` with gamePlanModel(), and passes the existing
 * weekly planner and manager-suggestions cards in through `slots`, so the
 * harness can pass placeholders (FR-D4).
 *
 * Layout:
 *   ≥1024  header · main column (steps → commitment strip → Step 2 monthly
 *          plan → suggested week → from your manager) + a 340px right panel
 *          (the canvas inspector) holding Step 3 "Review and commit".
 *   768–1023  the same blocks in one column.
 *   <768   header · SwipePager: Steps · Monthly plan · This week · Commit
 *          (canvas M3-GamePlan; SWIPE3.md).
 * ONE layout is rendered, chosen by `wide`, so each slot mounts once.
 *
 * Every action is the hub's existing handler: Money Needs → the Money Needs
 * route; Monthly plan → the existing Monthly plan modal (its own save path);
 * Review and commit → the existing Review & commit modal (the one commit
 * write). No input, figure or write lives here.
 *
 * @param {{
 *   model: object,                       gamePlanModel() output
 *   wide: boolean,                       REQUIRED — true ≥768px
 *   onOpenMoneyNeeds?: () => void,
 *   onOpenMonthlyPlan?: () => void,      undefined when the plan loop is off
 *   onOpenReviewCommit?: () => void,     undefined when the plan loop is off
 *   slots?: { suggestedWeek?: React.ReactNode, suggestions?: React.ReactNode },
 * }} props
 */

const H2 = 'font-display text-[17px] font-bold leading-snug text-ink';
const BTN_PRIMARY = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-fr-accent px-4 text-[14px] font-bold text-fr-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`;
const BTN_QUIET = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-[14px] font-bold text-ink transition-colors hover:bg-fr-sunk`;

function StepCard({ step, onClick }) {
  const clickable = step.active && typeof onClick === 'function';
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
            step.done ? 'bg-fr-accent text-fr-on-accent' : 'bg-fr-sunk text-ink-muted'
          }`}
        >
          {step.done ? <Check size={13} strokeWidth={3} /> : step.n}
        </span>
        <span className="min-w-0 truncate text-[13px] font-bold text-ink" title={step.title}>{step.title}</span>
        <span className={`ml-auto flex-none font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${step.done ? 'text-primary' : 'text-ink-muted'}`}>
          {step.kicker}
        </span>
      </span>
      <span className="font-display text-[16px] font-bold leading-tight tracking-tight text-ink">{step.value}</span>
      <span className="text-[12px] leading-snug text-ink-muted">{step.sub}</span>
      <span className={`mt-auto inline-flex items-center gap-1 text-[12px] font-bold ${clickable ? 'text-primary' : 'text-ink-muted'}`}>
        {step.actionLabel}
        {clickable ? <ArrowRight size={13} aria-hidden="true" /> : null}
      </span>
    </>
  );
  const base = `${CARD} flex min-h-[112px] min-w-0 flex-col gap-1.5 p-3.5 text-left`;
  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${FOCUS} transition-colors hover:border-fr-accent`}
        data-testid={`fr-gp-step-${step.id}`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={base} aria-disabled="true" data-testid={`fr-gp-step-${step.id}`}>
      {inner}
    </div>
  );
}

function Steps({ model, onOpenMoneyNeeds, onOpenMonthlyPlan, onOpenReviewCommit }) {
  const handlers = { 'money-needs': onOpenMoneyNeeds, monthly: onOpenMonthlyPlan, review: onOpenReviewCommit };
  return (
    <section aria-label="Your three steps" className="@container min-w-0">
      <h2 className="sr-only">Your three steps</h2>
      <div className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-3">
        {model.steps.map((s) => (
          <StepCard key={s.id} step={s} onClick={handlers[s.id]} />
        ))}
      </div>
    </section>
  );
}

function CommitmentStrip({ model }) {
  const c = model.commitment;
  return (
    <section className={`${CARD} @container flex flex-col gap-3 p-4`} aria-label="Personal commitment" data-testid="fr-gp-commitment">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <span className={EYEBROW}>Personal commitment</span>
          <span className="whitespace-nowrap font-display text-[20px] font-bold leading-tight text-ink">{c.apiLabel}</span>
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-fr-sunk" aria-hidden="true">
            <div className="h-full rounded-full bg-fr-accent fr-glide-w" style={{ width: `${c.progressPct}%` }} />
          </div>
          <span className="text-[12px] text-ink-muted">{c.progressLabel} · {c.progressPct}%</span>
        </div>
        <span
          className={`inline-flex min-h-[26px] flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-bold ${
            c.committed ? 'bg-fr-accent-tint text-primary' : 'bg-fr-sunk text-ink-muted'
          }`}
          data-testid="fr-gp-commit-tag"
        >
          {c.tag}
        </span>
      </div>
      {model.chain ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 @[28rem]:grid-cols-4" data-testid="fr-gp-chain">
          {model.chain.map((f) => (
            <div key={f.key} className="flex min-w-0 flex-col">
              <dt className="text-[12px] text-ink-muted">{f.label}</dt>
              <dd className="whitespace-nowrap font-display text-[15px] font-bold text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="border-t border-border pt-3 text-[13px] text-ink-muted">
          Start with Money needs to see what you need to earn this year.
        </p>
      )}
    </section>
  );
}

function ByLine({ yearPlan }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3 p-4`} aria-label="Year plan by line" data-testid="fr-gp-by-line">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-bold text-ink">By line</h3>
        <span className="whitespace-nowrap text-[12px] text-ink-muted">{yearPlan.filled ? `${yearPlan.totalLabel} planned` : 'Not allocated yet'}</span>
      </div>
      {yearPlan.byLine.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {yearPlan.byLine.map((b) => (
            <li key={b.key} className="flex flex-col gap-1" data-testid={`fr-gp-line-${b.key}`}>
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-semibold text-ink">{b.label}</span>
                <span className="whitespace-nowrap font-bold tabular-nums text-ink">{b.amount} · {b.pct}%</span>
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-fr-sunk" aria-hidden="true">
                <span className={`block h-full rounded-full fr-glide-w ${b.fill}`} style={{ width: `${b.width}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-muted">Allocate your year in Money needs to see the split.</p>
      )}
    </section>
  );
}

function MonthlyPlan({ model, onOpenMonthlyPlan }) {
  const m = model.monthly;
  const canEdit = m.enabled && typeof onOpenMonthlyPlan === 'function';
  const tableRows = m.months.map((row) => ({
    key: row.key,
    month: row.label,
    plan: `TTD ${Math.round(row.plan).toLocaleString('en-TT')}`,
    actual: row.actual == null ? '—' : `TTD ${Math.round(row.actual).toLocaleString('en-TT')}`,
  }));
  return (
    <section aria-labelledby="fr-gp-months-h" className="@container flex min-w-0 flex-col gap-3" data-testid="fr-gp-monthly">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="fr-gp-months-h" className={H2}>Step 2 · Monthly plan</h2>
          <p className="text-[13px] text-ink-muted">
            {m.enabled
              ? `Jan – Dec ${model.year}${m.filled ? ` · ${m.totalLabel} a year, ${m.perMonthLabel} a month on average` : ''}`
              : 'Broken into 12 months — coming soon'}
          </p>
        </div>
        {canEdit ? (
          <button type="button" onClick={onOpenMonthlyPlan} className={BTN_QUIET} data-testid="fr-gp-edit-months">
            <Pencil size={14} aria-hidden="true" />
            {m.filled ? 'Edit monthly plan' : 'Open monthly plan'}
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4 @[36rem]:grid @[36rem]:grid-cols-[minmax(0,1fr)_240px] @[36rem]:items-start">
        {m.filled ? (
          <ChartCard
            className="min-w-0"
            title={m.ytdTitle}
            subtitle={`Planned API by month · ${m.currentLabel} highlighted · the table adds what your weekly reports show`}
            table={{
              caption: 'Planned and reported API by month',
              columns: [
                { key: 'month', label: 'Month' },
                { key: 'plan', label: 'Plan', align: 'right' },
                { key: 'actual', label: 'Reported', align: 'right' },
              ],
              rows: tableRows,
            }}
          >
            <Columns
              data={m.months.map((row) => ({ key: row.key, label: row.label, value: row.plan, highlight: row.current }))}
              format={(v) => `TTD ${Math.round(v).toLocaleString('en-TT')}`}
              height={150}
            />
          </ChartCard>
        ) : (
          <div className={`${CARD} flex min-w-0 flex-col items-start gap-2 p-5`} data-testid="fr-gp-months-empty">
            <p className="text-[14px] font-semibold text-ink">
              {m.enabled ? 'Split your year into 12 months' : 'Monthly plans are coming soon'}
            </p>
            <p className="text-[13px] text-ink-muted">
              {m.enabled
                ? 'Your monthly plan shows here once you have split your year plan into months.'
                : 'Your year plan stays in Money needs until then.'}
            </p>
          </div>
        )}
        <ByLine yearPlan={model.yearPlan} />
      </div>
    </section>
  );
}

function SuggestedWeek({ node }) {
  if (!node) return null;
  return (
    <section aria-labelledby="fr-gp-week-h" className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 id="fr-gp-week-h" className={H2}>Suggested week</h2>
        <p className="text-[13px] text-ink-muted">Your committed API, worked backward to one week of activity.</p>
      </div>
      {node}
    </section>
  );
}

function CommitPanel({ model, onOpenReviewCommit }) {
  const c = model.commit;
  if (!c.enabled) return null;
  return (
    <section
      aria-labelledby="fr-gp-commit-h"
      className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-border bg-fr-pane p-5"
      data-testid="fr-gp-commit"
    >
      <div className="flex flex-col gap-1">
        <span className={EYEBROW}>Step 3 · Review and commit</span>
        <h2 id="fr-gp-commit-h" className="font-display text-[18px] font-bold leading-snug text-ink">{c.title}</h2>
        <p className="text-[13px] leading-snug text-ink-muted">{c.sub}</p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold text-ink">Before you commit</span>
        <ul className="flex flex-col" data-testid="fr-gp-checklist">
          {c.checklist.map((item) => (
            <li key={item.key} className="flex min-h-[32px] items-center gap-2.5" data-testid={`fr-gp-check-${item.key}`} data-done={item.done ? 'true' : 'false'}>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-[5px] ${
                  item.done ? 'bg-fr-accent text-fr-on-accent' : 'border-2 border-ink-dim bg-card'
                }`}
              >
                {item.done ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className={`text-[13px] ${item.done ? 'text-ink-muted line-through' : 'font-semibold text-ink'}`}>{item.label}</span>
              <span className="sr-only">{item.done ? 'done' : 'not done'}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onOpenReviewCommit}
        disabled={typeof onOpenReviewCommit !== 'function'}
        className={BTN_PRIMARY}
        data-testid="fr-gp-commit-cta"
      >
        {c.ctaLabel}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
      {c.hint ? <p className="text-center text-[12px] text-ink-muted">{c.hint}</p> : null}
      {c.apiLine ? <p className="text-center text-[12px] text-ink-muted" data-testid="fr-gp-commit-api">{c.apiLine}</p> : null}
    </section>
  );
}

function Header({ model }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={EYEBROW}>Your game plan · {model.year}</span>
        <span
          className={`inline-flex min-h-[26px] items-center rounded-full px-2.5 text-[11px] font-bold ${
            model.badge.complete ? 'bg-fr-accent-tint text-primary' : 'bg-fr-sunk text-ink-muted'
          }`}
          data-testid="fr-gp-badge"
        >
          {model.badge.label}
        </span>
      </div>
      <p className="text-[13px] text-ink-muted">Your year and monthly plans are visible to your managers.</p>
    </header>
  );
}

export default function FrGamePlanView({
  model,
  wide,
  onOpenMoneyNeeds,
  onOpenMonthlyPlan,
  onOpenReviewCommit,
  slots = {},
}) {
  const stepsProps = { model, onOpenMoneyNeeds, onOpenMonthlyPlan, onOpenReviewCommit };

  if (wide) {
    return (
      // fr-fit-any-width: every grid here splits by the width its region HAS
      // (beside the sidebar), not the window. Thresholds keep the ≥1280 layout.
      <div className="@container/gp flex flex-col gap-5" data-testid="fr-game-plan">
        <Header model={model} />
        <div className="flex flex-col gap-5 @[60rem]/gp:grid @[60rem]/gp:grid-cols-[minmax(0,1fr)_340px] @[60rem]/gp:items-start" data-testid="fr-game-plan-wide">
          <div className="flex min-w-0 flex-col gap-5">
            <Steps {...stepsProps} />
            <CommitmentStrip model={model} />
            <MonthlyPlan model={model} onOpenMonthlyPlan={onOpenMonthlyPlan} />
            <SuggestedWeek node={slots.suggestedWeek} />
            {slots.suggestions ?? null}
          </div>
          {model.commit.enabled ? (
            <aside aria-label="Review and commit" className="min-w-0 @[60rem]/gp:sticky @[60rem]/gp:top-4">
              <CommitPanel model={model} onOpenReviewCommit={onOpenReviewCommit} />
            </aside>
          ) : null}
        </div>
      </div>
    );
  }

  const pages = [
    {
      id: 'steps',
      label: 'Steps',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <Steps {...stepsProps} />
          <CommitmentStrip model={model} />
        </div>
      ),
    },
    {
      id: 'months',
      label: 'Monthly plan',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <MonthlyPlan model={model} onOpenMonthlyPlan={onOpenMonthlyPlan} />
        </div>
      ),
    },
    {
      id: 'week',
      label: 'This week',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <SuggestedWeek node={slots.suggestedWeek} />
          {slots.suggestions ?? null}
        </div>
      ),
    },
  ];
  if (model.commit.enabled) {
    pages.push({
      id: 'commit',
      label: 'Commit',
      content: (
        <div className="flex flex-col gap-4 pb-2">
          <CommitPanel model={model} onOpenReviewCommit={onOpenReviewCommit} />
        </div>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="fr-game-plan">
      <Header model={model} />
      <div data-testid="fr-game-plan-phone">
        <SwipePager pages={pages} ariaLabel="Game plan pages" />
      </div>
    </div>
  );
}
