import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ChartCard, Line, Bullet } from '../charts';
import SwipePager from '../pager/SwipePager';
import { CARD, EYEBROW, FOCUS, FrCheckbox, SKELETON, WarnIcon, Why } from './moneyParts';
import { whatIf, wholeTTD, wholeTTDUp, monthLabel } from '../../../lib/fr/moneyModel';
import { formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';

/**
 * FrMoneyView — the FR Money hub's Overview (FR-3, canvas D3M-Overview /
 * M3-Money). PURE: props only. The container (FrMoney.jsx) builds `model`
 * from data the dashboard already loads plus two existing-service reads
 * (money-needs worksheet, financing terms), all read-only.
 *
 * ≥768 (`wide`): pace chart + persistency + campaign, then the six calculator
 * cards, then What if. <768: swipe pages Overview · Calculators · What if.
 *
 * FR-D10: nothing is invented. The canvas's "projected take-home change" and
 * "Christmas prize band" What-if outputs are omitted — there is no derivation
 * for them from data the app holds without a per-agent commission schedule
 * and a campaign prize table the app does not store.
 *
 * @param {{
 *   model: {
 *     pace: object|null, plan: object|null, cards: object[],
 *     settled: number|null, goal: number, isMdrt: boolean, avgApi: number,
 *     year: number,
 *   },
 *   wide: boolean,
 *   loading?: boolean, error?: boolean, onRetry?: () => void,
 *   onNavigate?: (tabId: string) => void,
 *   slots?: { campaign?: React.ReactNode },
 * }} props
 */

function paceTable(pace) {
  return {
    caption: 'Settled API running total by month against an even pace',
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'settled', label: 'Settled (running total)', align: 'right' },
      { key: 'pace', label: 'Even pace', align: 'right' },
    ],
    rows: pace.labels.map((m, i) => ({
      key: m,
      month: m,
      settled: pace.series[0].values[i] == null ? '—' : `TTD ${wholeTTD(pace.series[0].values[i])}`,
      pace: `TTD ${wholeTTD(pace.series[1].values[i])}`,
    })),
  };
}

function PaceCard({ model, loading, error, onRetry }) {
  if (loading) {
    return (
      <section className={`${CARD} p-5`} aria-busy="true" aria-label="Settled API pace">
        <div className={`h-5 w-2/3 ${SKELETON}`} />
        <div className={`mt-4 h-44 w-full ${SKELETON}`} />
      </section>
    );
  }
  if (error) {
    return (
      <section className={`${CARD} p-5`} aria-label="Settled API pace">
        <p role="alert" className="text-[14px] font-semibold text-ink">Your policy ledger did not load.</p>
        <button type="button" onClick={onRetry} className={`mt-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-[14px] font-bold text-primary underline underline-offset-2 ${FOCUS}`}>Retry</button>
      </section>
    );
  }
  const { pace } = model;
  if (!pace) {
    return (
      <section className={`${CARD} p-5`} aria-label="Settled API pace">
        <h3 className="font-display text-[18px] font-bold text-ink">No production figures yet</h3>
      </section>
    );
  }
  return (
    <ChartCard
      title={pace.title}
      subtitle={`Settled API ${model.year}, running total by issue month, against an even pace to ${pace.goalLabel}`}
      table={paceTable(pace)}
    >
      {/* No separate target line: the even-pace line ENDS on the goal in Dec,
          and a target label there collided with its end label. */}
      <Line
        series={pace.series}
        labels={pace.labels}
        format={(v) => `TTD ${wholeTTD(v)}`}
        height={200}
      />
      <p className="mt-2 text-[12px] text-ink-muted">Even pace by now: TTD {wholeTTD(pace.paceToDate)}.</p>
      <Why>
        Even pace = {pace.goalLabel} × months gone ÷ 12. Settled counts a policy in the month it was issued, the same list as your Today hero.
      </Why>
    </ChartCard>
  );
}

function PersistencyCard({ plan, onNavigate }) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`} aria-label="Persistency" data-testid="money-persistency-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[18px] font-bold text-ink">Persistency</h3>
        {plan ? <span className={EYEBROW}>{monthLabel(plan.monthKey)}</span> : null}
      </div>
      {plan ? (
        <>
          <Bullet
            value={plan.currentPct}
            target={plan.threshold}
            max={100}
            label="24-month persistency"
            valueText={formatPersistencyPct(plan.currentPct)}
            targetText={`Gate ${plan.threshold}%`}
            tone={plan.meets ? 'accent' : 'warm'}
            height={12}
          />
          <p className={`flex items-start gap-1.5 text-[13px] ${plan.meets ? 'text-ink-muted' : 'font-semibold text-fr-warm'}`}>
            {plan.meets ? null : <WarnIcon className="mt-0.5" />}
            {plan.meets
              ? `At or above the ${plan.threshold}% gate`
              : `TTD ${wholeTTDUp(plan.need)} reinstated clears ${plan.threshold}%`}
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('persistency')}
            className={`inline-flex min-h-[44px] items-center gap-1 self-start rounded-lg px-1 text-[13px] font-bold text-primary ${FOCUS}`}
          >
            {plan.meets ? 'See persistency' : 'Plan the win-back'}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">No persistency figure yet.</p>
      )}
    </section>
  );
}

function Cards({ cards, onNavigate }) {
  return (
    <section aria-label="Every calculator, at a glance" className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-[18px] font-bold text-ink">Every calculator, at a glance</h3>
        <p className="text-[13px] text-ink-muted">Each card is one tab’s headline. Open a card to go to that tab.</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onNavigate?.(c.tabId)}
              className={`${CARD} ${FOCUS} flex min-h-[44px] w-full min-w-0 flex-col gap-1 p-4 text-left transition-colors hover:border-ink-dim`}
              data-testid={`money-card-${c.id}`}
            >
              <span className={EYEBROW}>{c.eyebrow}</span>
              <span className="whitespace-nowrap font-display text-[20px] font-bold tabular-nums text-ink">{c.headline}</span>
              <span className={`flex items-start gap-1.5 text-[12px] leading-snug ${c.warm ? 'font-semibold text-fr-warm' : 'text-ink-muted'}`}>
                {c.warm ? <WarnIcon className="mt-px" /> : null}
                <span className="min-w-0">{c.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NumberField({ id, label, value, onChange, min = 0, max, step = 1, hint }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-[15px] tabular-nums text-ink ${FOCUS}`}
      />
      {hint ? <span className="text-[12px] text-ink-muted">{hint}</span> : null}
    </div>
  );
}

function Output({ label, value, note, testId }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="whitespace-nowrap font-display text-[20px] font-bold tabular-nums text-ink">{value}</span>
      {note ? <span className="text-[12px] text-ink-muted">{note}</span> : null}
    </div>
  );
}

function WhatIf({ model }) {
  const idBase = useId();
  const [extraApps, setExtraApps] = useState('0');
  const [avgApi, setAvgApi] = useState(String(Math.round(model.avgApi)));
  const [reinstate, setReinstate] = useState(false);
  const w = whatIf({
    settled: model.settled,
    goal: model.goal,
    extraApps: Number(extraApps),
    avgApi: Number(avgApi),
    plan: model.plan,
    reinstate,
  });
  const set = model.plan?.suggestion;
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`} aria-label="What if" data-testid="money-what-if">
      <div>
        <h3 className="font-display text-[18px] font-bold text-ink">What if</h3>
        <p className="text-[13px] text-ink-muted">Try a scenario. Nothing is saved.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField id={`${idBase}-apps`} label="Extra applications that settle this year" value={extraApps} onChange={setExtraApps} max={200} />
        <NumberField id={`${idBase}-avg`} label="Average API per application (TTD)" value={avgApi} onChange={setAvgApi} step={500} hint="From your game plan when set" />
      </div>
      {set ? (
        <label className="relative flex min-h-[44px] cursor-pointer items-start gap-3 py-2.5 pl-3 text-[14px] text-ink" htmlFor={`${idBase}-reinstate`}>
          <FrCheckbox id={`${idBase}-reinstate`} checked={reinstate} onChange={(e) => setReinstate(e.target.checked)} />
          <span>Reinstate the least-money set ({set.items.length} {set.items.length === 1 ? 'policy' : 'policies'}, TTD {wholeTTD(set.total)})</span>
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-3" aria-live="polite">
        <Output
          label="Projected settled API"
          value={w.projectedSettled == null ? '—' : `TTD ${wholeTTD(w.projectedSettled)}`}
          note={w.added > 0 ? `+TTD ${wholeTTD(w.added)}` : null}
          testId="what-if-settled"
        />
        <Output label={model.isMdrt ? '% of MDRT' : '% of your goal'} value={w.pctOfGoal == null ? '—' : `${w.pctOfGoal.toFixed(1)}%`} testId="what-if-goal" />
        <Output label="Persistency" value={formatPersistencyPct(w.persistencyPct)} note={model.plan ? `${monthLabel(model.plan.monthKey)} · 24-month model` : null} testId="what-if-persistency" />
      </div>
      <Why>
        Extra applications × average API are added to settled API, and to both sides of the persistency fraction (new business placed inside the window).
        {' '}Reinstating adds the set’s API to Net Settled. Take-home pay and campaign prize bands are not estimated here.
      </Why>
    </section>
  );
}

export default function FrMoneyView({ model, wide, loading = false, error = false, onRetry, onNavigate, slots = {} }) {
  if (import.meta.env.DEV && typeof wide !== 'boolean') {
    // CLAUDE.md v3 rule 11 — a missing layout flag must not silently pick one.
    console.warn('FrMoneyView: `wide` (boolean) is required; rendering the phone layout.');
  }
  const campaign = slots?.campaign ? <div data-slot="campaign" className="flex flex-col gap-3">{slots.campaign}</div> : null;
  const top = (
    <>
      <PaceCard model={model} loading={loading} error={error} onRetry={onRetry} />
      <PersistencyCard plan={model.plan} onNavigate={onNavigate} />
    </>
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-money">
      <header className="flex flex-col gap-1">
        <p className={EYEBROW}>Money · Overview</p>
        <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">Your money, at a glance</h2>
      </header>
      {wide ? (
        <div className="flex flex-col gap-5" data-testid="fr-money-wide">
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 lg:col-span-8"><PaceCard model={model} loading={loading} error={error} onRetry={onRetry} /></div>
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-4">
              <PersistencyCard plan={model.plan} onNavigate={onNavigate} />
              {campaign}
            </div>
          </div>
          <Cards cards={model.cards} onNavigate={onNavigate} />
          <WhatIf model={model} />
        </div>
      ) : (
        <div data-testid="fr-money-phone">
          <SwipePager
            ariaLabel="Money pages"
            pages={[
              { id: 'overview', label: 'Overview', content: <div className="flex flex-col gap-4 pb-2">{top}{campaign}</div> },
              { id: 'calculators', label: 'Calculators', content: <div className="pb-2"><Cards cards={model.cards} onNavigate={onNavigate} /></div> },
              { id: 'whatif', label: 'What if', content: <div className="pb-2"><WhatIf model={model} /></div> },
            ]}
          />
        </div>
      )}
    </div>
  );
}
