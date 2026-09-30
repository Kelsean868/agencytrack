import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ChartCard, Donut } from '../charts';
import SwipePager from '../pager/SwipePager';
import { formatCurrency } from '../../../utils/formatters';
import { CARD, EYEBROW, FOCUS } from './moneyParts';

/**
 * FrMoneyNeedsView — the FR Money needs worksheet (R2-9, canvas
 * D3M-MoneyNeeds / M3-MoneyNeeds). PURE: props only (plus the "Why?"
 * disclosure's open state). The container is MoneyNeedsPanel (look="fr"): it
 * keeps every read, save, sub-calculator modal and hand-off, and passes the
 * five expense groups, the PAYE refresh banner, the share toggle and the
 * commission allocation (legacy targets panel or merged allocator) in as
 * slots, so the harness can pass placeholders (FR-D4).
 *
 * Layout (ONE is rendered, chosen by `layout`, so each slot mounts once):
 *   desktop  main column (intro → worksheet → sub-calculators → where the
 *            money goes + allocation) and a 340px right inspector: "What you
 *            need to earn", the share toggle, "Use this in my game plan".
 *   tablet   the same blocks in one column, the inspector after the worksheet.
 *   phone    intro · SwipePager of the five group pages · then the inspector,
 *            where the money goes, allocation and sub-calculators.
 *
 * @param {{
 *   layout: 'desktop'|'tablet'|'phone',
 *   model: { year:number, years:number[], tally:string, worksheetTotal:string,
 *            ladder: {empty:boolean, rows:object[]}, donut: object|null, subCalcs: object[] },
 *   groups: Array<{ key:string, label:string, short:string, node:React.ReactNode }>,
 *   slots?: { refreshBanner?:React.ReactNode, visibility?:React.ReactNode, allocation?:React.ReactNode },
 *   onYearChange: (year:number) => void,
 *   onOpenCalc: (key:string) => void,
 *   onOpenGamePlan?: () => void,
 * }} props
 */

const H2 = 'font-display text-[17px] font-bold leading-snug text-ink';
const BTN_QUIET = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-[13px] font-bold text-ink transition-colors hover:bg-fr-sunk`;

function Intro({ model, onYearChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 max-w-[620px] flex-1 text-[13px] leading-relaxed text-ink-muted">
        What your household and business need to cover. Every line here feeds your income goal.
      </p>
      <div className="flex flex-none flex-wrap items-center gap-2">
        <span
          className="inline-flex min-h-[30px] items-center whitespace-nowrap rounded-full bg-fr-accent-tint px-3 text-[12px] font-bold text-primary"
          data-testid="fr-mn-tally"
        >
          {model.tally}
        </span>
        <select
          value={model.year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Select year"
          className={`${FOCUS} h-11 rounded-[10px] border border-border bg-card px-2.5 text-[13px] font-semibold text-ink`}
        >
          {model.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

function Worksheet({ model, groups }) {
  return (
    <section aria-labelledby="fr-mn-worksheet-h" className={`${CARD} flex min-w-0 flex-col gap-1 p-4`} data-testid="fr-mn-worksheet">
      <h2 id="fr-mn-worksheet-h" className={H2}>The worksheet</h2>
      <p className="mb-1 text-[12px] text-ink-muted">
        New worksheets start with the seeded lines already in place — never a blank checklist. Add a line if something&apos;s missing.
      </p>
      {groups.map((g) => (
        <div key={g.key} className="border-t border-border pt-2">{g.node}</div>
      ))}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3" data-testid="fr-mn-worksheet-total">
        <span className="text-[13px] font-bold text-ink">Worksheet total · after tax</span>
        <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">{model.worksheetTotal} a year</span>
      </div>
    </section>
  );
}

function SubCalcCard({ card, onOpenCalc }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col gap-1.5 p-4`} data-testid={`fr-mn-subcalc-${card.key}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[14px] font-bold text-ink" title={card.title}>{card.title}</h3>
        <span className="flex-none whitespace-nowrap text-[11px] text-ink-muted">{card.filled} of {card.total}</span>
      </div>
      {card.split ? (
        <dl className="flex flex-col gap-1">
          {card.split.map((s) => (
            <div key={s.key} className="flex items-baseline justify-between gap-2">
              <dt className="text-[12px] text-ink-muted">{s.label}</dt>
              <dd className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span className="whitespace-nowrap font-display text-[18px] font-bold tabular-nums text-ink">{card.value}</span>
      )}
      <span className="text-[12px] leading-snug text-ink-muted">{card.feeds}</span>
      <button type="button" onClick={() => onOpenCalc(card.key)} className={`${BTN_QUIET} mt-auto`}>
        Adjust amounts
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function SubCalcs({ model, onOpenCalc }) {
  return (
    <section aria-labelledby="fr-mn-subcalcs-h" className="flex min-w-0 flex-col gap-2.5" data-testid="fr-mn-subcalcs">
      <div>
        <h2 id="fr-mn-subcalcs-h" className={H2}>Sub-calculators</h2>
        <p className="text-[12px] text-ink-muted">
          Each one feeds straight into a worksheet line above. If one was never set up, its seeded lines come back automatically — never an empty list. Override the fed line any time by typing over it.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {model.subCalcs.map((c) => <SubCalcCard key={c.key} card={c} onOpenCalc={onOpenCalc} />)}
      </div>
    </section>
  );
}

function WhereItGoes({ model, compact = false }) {
  const d = model.donut;
  if (!d) {
    return (
      <section className={`${CARD} p-5`} aria-label="Where the money goes" data-testid="fr-mn-donut">
        <h3 className="font-display text-[17px] font-bold text-ink">Nothing to split yet</h3>
        <p className="mt-1 text-[13px] text-ink-muted">Fill in the worksheet to see how your year splits across the groups.</p>
      </section>
    );
  }
  return (
    <div data-testid="fr-mn-donut" className="min-w-0">
      <ChartCard title={d.title} subtitle="Yearly expenses by group, after tax" table={d.table}>
        {/* Phone: the legend takes a full row under the ring, so every group
            name, value and share stays readable at 390px. */}
        <div className={compact ? '[&_ul]:basis-full' : undefined}>
          <Donut parts={d.parts} size={150} thickness={16} centerValue={d.totalLabel} centerLabel="a year" format={formatCurrency} />
        </div>
      </ChartCard>
    </div>
  );
}

function Ladder({ ladder }) {
  const [why, setWhy] = useState({});
  if (ladder.empty) {
    return <p className="text-[13px] text-ink-muted">Fill in the worksheet to see what you need to earn.</p>;
  }
  return (
    <ul className="flex flex-col" data-testid="fr-mn-ladder">
      {ladder.rows.map((r) => (
        <li
          key={r.id}
          className={`flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0 ${r.hero ? 'rounded-[12px] border-b-0 bg-fr-accent-tint px-3' : ''}`}
          data-testid={`fr-mn-ladder-${r.id}`}
        >
          <span className="flex items-start justify-between gap-2">
            <span className={`min-w-0 text-[12px] leading-snug ${r.hero ? 'font-bold text-ink' : 'text-ink-muted'}`}>{r.label}</span>
            {r.why ? (
              <button
                type="button"
                aria-expanded={Boolean(why[r.id])}
                onClick={() => setWhy((w) => ({ ...w, [r.id]: !w[r.id] }))}
                className={`${FOCUS} -my-2 inline-flex min-h-[44px] flex-none items-center rounded-lg px-2 text-[12px] font-bold text-primary`}
              >
                {why[r.id] ? 'Hide' : 'Why?'}
              </button>
            ) : null}
          </span>
          <span className={`whitespace-nowrap font-display font-bold tabular-nums text-ink ${r.hero ? 'text-[22px]' : 'text-[17px]'}`}>{r.value}</span>
          {r.note ? <span className="text-[11px] text-ink-muted">{r.note}</span> : null}
          {r.why && why[r.id] ? <span className="text-[12px] leading-snug text-ink-muted">{r.why}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Inspector({ model, slots, onOpenGamePlan, asCard }) {
  return (
    <aside
      aria-label="Your money needs roll-up"
      className={`flex min-w-0 flex-col gap-3.5 ${asCard ? `${CARD} p-4` : 'rounded-[18px] border border-border bg-fr-pane p-5'}`}
      data-testid="fr-mn-inspector"
    >
      <div>
        <span className={EYEBROW}>Your calculator</span>
        <h2 className="font-display text-[18px] font-bold leading-snug text-ink">What you need to earn</h2>
      </div>
      <Ladder ladder={model.ladder} />
      {slots?.visibility ?? null}
      {typeof onOpenGamePlan === 'function' ? (
        <button
          type="button"
          onClick={onOpenGamePlan}
          className={`${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-fr-accent px-4 text-[14px] font-bold text-fr-on-accent transition-opacity hover:opacity-90`}
          data-testid="fr-mn-to-game-plan"
        >
          Use this in my game plan
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  );
}

function Allocation({ slots }) {
  if (!slots?.allocation) return null;
  return (
    <section aria-label="Allocate your commission across product lines" className="flex min-w-0 flex-col gap-2" data-testid="fr-mn-allocation">
      <h3 className="font-display text-[15px] font-bold text-ink">Allocate your commission across product lines</h3>
      {slots.allocation}
    </section>
  );
}

export default function FrMoneyNeedsView({ layout, model, groups, slots, onYearChange, onOpenCalc, onOpenGamePlan }) {
  if (!['desktop', 'tablet', 'phone'].includes(layout)) {
    if (import.meta.env.DEV) throw new Error(`FrMoneyNeedsView: unknown layout "${layout}"`);
  }

  if (layout === 'phone') {
    const pages = groups.map((g) => ({ id: g.key, label: g.short, content: <div className="px-0.5 pb-1">{g.node}</div> }));
    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="fr-money-needs" data-layout="phone">
        <Intro model={model} onYearChange={onYearChange} />
        {slots?.refreshBanner ?? null}
        <SwipePager pages={pages} ariaLabel="Money needs groups" />
        <div className="flex items-baseline justify-between gap-2 rounded-[14px] bg-fr-sunk px-3 py-2.5" data-testid="fr-mn-worksheet-total">
          <span className="text-[12px] font-bold text-ink">Worksheet total · after tax</span>
          <span className="whitespace-nowrap text-[14px] font-bold tabular-nums text-ink">{model.worksheetTotal} a year</span>
        </div>
        <Inspector model={model} slots={slots} onOpenGamePlan={onOpenGamePlan} asCard />
        <WhereItGoes model={model} compact />
        <Allocation slots={slots} />
        <SubCalcs model={model} onOpenCalc={onOpenCalc} />
      </div>
    );
  }

  const main = (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <Intro model={model} onYearChange={onYearChange} />
      {slots?.refreshBanner ?? null}
      <Worksheet model={model} groups={groups} />
      {layout === 'tablet' ? <Inspector model={model} slots={slots} onOpenGamePlan={onOpenGamePlan} asCard /> : null}
      <SubCalcs model={model} onOpenCalc={onOpenCalc} />
      <section aria-label="Where the money goes" className="flex min-w-0 flex-col gap-2.5">
        <h2 className={H2}>Where the money goes</h2>
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 2xl:items-start">
          <WhereItGoes model={model} />
          <Allocation slots={slots} />
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex min-w-0 items-start gap-5" data-testid="fr-money-needs" data-layout={layout}>
      {main}
      {layout === 'desktop' ? (
        <div className="sticky top-4 w-[340px] flex-none">
          <Inspector model={model} slots={slots} onOpenGamePlan={onOpenGamePlan} />
        </div>
      ) : null}
    </div>
  );
}
