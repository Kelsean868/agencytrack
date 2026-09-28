import React, { useState } from 'react';
import { Bullet } from '../charts';
import { CARD, EYEBROW, FOCUS, SKELETON, WarnIcon } from '../money/moneyParts';

/**
 * FrPipelineView — FR "Pipeline" (FR-4). PURE: props only.
 *   Funnel  the selling ladder for this week or this year: each stage's count,
 *           its conversion from the stage before, the company minimum for the
 *           period as a target tick, and how many short. From the daily log /
 *           weekly reports (the same actuals as the Standard drawer).
 *   Board   own policies in the ledger's own stages (PIPELINE_STAGES), each
 *           column with its count and API; Closed collapsed.
 *
 * @param {{
 *   view: 'funnel'|'board', onView: (v) => void,
 *   period: 'week'|'year', onPeriod: (p) => void,
 *   funnel: object[]|null, periodNote?: string, board: object[]|null,
 * }} props
 */
const money = (n) => `TTD ${Number(n || 0).toLocaleString('en-TT', { maximumFractionDigits: 0 })}`;

function Segmented({ label, value, options, onChange, testPrefix }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-fr-sunk p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          data-testid={`${testPrefix}-${o.id}`}
          className={`${FOCUS} min-h-[44px] flex-1 rounded-full px-4 text-[14px] font-semibold transition-colors ${value === o.id ? 'bg-fr-accent text-fr-on-accent' : 'text-ink-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Funnel({ stages, periodNote }) {
  if (!stages) return <div className={`${CARD} p-5`} aria-busy="true"><div className={`h-48 ${SKELETON}`} /></div>;
  const shortOnes = stages.filter((s) => s.short > 0);
  const title = stages.every((s) => s.count == null)
    ? 'No activity logged for this period yet'
    : shortOnes.length === 0
      ? 'Every stage is at or above the company minimum'
      : `${shortOnes.length} of ${stages.length} stages short of the company minimum`;
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`} aria-label="Selling funnel" data-testid="pipeline-funnel">
      <header>
        <h3 className="font-display text-[18px] font-bold leading-tight text-ink">{title}</h3>
        {periodNote ? <p className="mt-1 text-[13px] text-ink-muted">{periodNote}</p> : null}
      </header>
      <ol className="flex flex-col gap-4">
        {stages.map((s, i) => (
          <li key={s.key} data-testid={`funnel-${s.key}`}>
            <Bullet
              value={s.count}
              target={s.target ?? undefined}
              label={s.label}
              valueText={s.count == null ? '—' : s.count.toLocaleString('en-TT')}
              targetText={s.target ? `min ${s.target.toLocaleString('en-TT')}` : undefined}
              tone={s.short > 0 ? 'warm' : 'accent'}
              height={10}
            />
            <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-ink-muted">
              {i > 0 ? <span>{s.conversion == null ? 'Conversion —' : `${s.conversion.toFixed(1)}% of ${stages[i - 1].label.toLowerCase()}`}</span> : null}
              {s.short > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-fr-warm"><WarnIcon />{s.short.toLocaleString('en-TT')} short</span>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Board({ cols }) {
  const [showClosed, setShowClosed] = useState(false);
  if (!cols) return <div className={`${CARD} p-5`} aria-busy="true"><div className={`h-48 ${SKELETON}`} /></div>;
  const shown = cols.filter((c) => c.key !== 'closed' || showClosed);
  const closed = cols.find((c) => c.key === 'closed');
  return (
    <section aria-label="Policy board" className="flex min-w-0 flex-col gap-3" data-testid="pipeline-board">
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex w-max gap-3 md:grid md:w-auto md:grid-cols-3 lg:grid-cols-5">
          {shown.map((c) => (
            <section key={c.key} className={`${CARD} flex w-[260px] min-w-0 flex-col gap-2 p-4 md:w-auto`} aria-label={c.label} data-testid={`board-col-${c.key}`}>
              <header className="flex items-baseline justify-between gap-2">
                <h3 className="truncate font-display text-[16px] font-bold text-ink" title={c.label}>{c.label}</h3>
                <span className="flex-none text-[12px] tabular-nums text-ink-muted">{c.cards.length}</span>
              </header>
              <p className="text-[12px] tabular-nums text-ink-muted">{money(c.api)}</p>
              {c.cards.length ? (
                <ul className="flex flex-col gap-1.5">
                  {c.cards.slice(0, 8).map((card) => (
                    <li key={card.id} className="rounded-lg bg-fr-sunk px-3 py-2">
                      <span className="block truncate text-[13px] font-semibold text-ink" title={card.name ?? card.policyNumber ?? ''}>{card.name ?? card.policyNumber ?? 'Policy'}</span>
                      <span className="flex justify-between gap-2 text-[12px] tabular-nums text-ink-muted">
                        <span className="whitespace-nowrap">{money(card.api)}</span>
                        <span className="whitespace-nowrap">{card.ageDays == null ? '' : `${card.ageDays} d`}</span>
                      </span>
                    </li>
                  ))}
                  {c.cards.length > 8 ? <li className="text-[12px] text-ink-muted">+ {c.cards.length - 8} more in the ledger</li> : null}
                </ul>
              ) : (
                <p className="text-[12px] text-ink-muted">None</p>
              )}
            </section>
          ))}
        </div>
      </div>
      {closed ? (
        <button
          type="button"
          aria-expanded={showClosed}
          onClick={() => setShowClosed((v) => !v)}
          className={`${FOCUS} inline-flex min-h-[44px] items-center self-start rounded-lg px-1 text-[13px] font-bold text-primary`}
        >
          {showClosed ? 'Hide closed and lapsed' : `Show closed and lapsed (${closed.cards.length})`}
        </button>
      ) : null}
    </section>
  );
}

export default function FrPipelineView({ view = 'funnel', onView, period = 'week', onPeriod, funnel, periodNote, board }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-pipeline">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={EYEBROW}>Work · Pipeline</p>
          <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">Where your business is</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Segmented label="Pipeline view" value={view} onChange={onView} testPrefix="pipeline-view" options={[{ id: 'funnel', label: 'Funnel' }, { id: 'board', label: 'Board' }]} />
          {view === 'funnel' ? (
            <Segmented label="Period" value={period} onChange={onPeriod} testPrefix="pipeline-period" options={[{ id: 'week', label: 'This week' }, { id: 'year', label: 'This year' }]} />
          ) : null}
        </div>
      </header>
      {view === 'funnel' ? <Funnel stages={funnel} periodNote={periodNote} /> : <Board cols={board} />}
    </div>
  );
}
