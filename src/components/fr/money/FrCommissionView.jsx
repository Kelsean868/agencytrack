import React from 'react';
import { Check, History } from 'lucide-react';
import { ChartCard, Columns } from '../charts';
import SwipePager from '../pager/SwipePager';
import IncomeGoalField from '../../goals/CommissionPlayground/components/IncomeGoalField';
import SavedScenarioChips from '../../goals/CommissionPlayground/components/SavedScenarioChips';
import { rebalance } from '../../goals/CommissionPlayground/utils/modeMixBalancer';
import { PLAYGROUND_PERIODS, playgroundPeriod } from '../../../utils/playgroundPeriods';
import { formatCurrency } from '../../../utils/formatters';
import { CARD, FOCUS, Why, WarnIcon } from './moneyParts';
import {
  goalTableRows, requiredApiText, breakdownRows, firstPaymentBars, cashFlowModel, CASH_TABLE_COLUMNS,
} from './commissionModel';

/**
 * FrCommissionView — the FR Commission playground (R2-7, canvas
 * D3M-Commission / M3-Commission). PURE: props only. The containers
 * (FrCommissionPlayground → FrGoalTab / FrModalTab) run the same hooks as the
 * Nexus tabs (useGoalDecomposition / useModalTargeting) and pass their values
 * in, so every input, save, scenario and derivation is the Nexus one.
 *
 * Layout (ONE is rendered, chosen by `layout`):
 *   desktop  results column + a 340px right inspector ("Commission
 *            calculator": the two calculator modes, the inputs, the saves).
 *   tablet   the inspector as a card first, then the results.
 *   phone    the mode switch, a SwipePager of three pages, then the saves
 *            (kept outside the pager so they are reachable from every page).
 *
 * @param {{
 *   layout: 'desktop'|'tablet'|'phone',
 *   tab: 'goal'|'modal',
 *   onTabChange: (tab: 'goal'|'modal') => void,
 *   goal?: object,   // useGoalDecomposition() values + currentGoal
 *   modal?: object,  // useModalTargeting() values + insights: string[]
 * }} props
 */

const H2 = 'font-display text-[17px] font-bold leading-snug text-ink';
const SUB = 'text-[12px] text-ink-muted';
const BTN_PRIMARY = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-fr-accent px-4 text-[13px] font-bold text-fr-on-accent transition-opacity hover:opacity-90 disabled:opacity-60`;
const BTN_QUIET = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-[13px] font-bold text-ink transition-colors hover:bg-fr-sunk disabled:opacity-60`;
const INPUT = 'h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-card px-2.5 text-[14px] font-semibold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-primary/40';

const MODE_TABS = [
  { key: 'modal', label: "This month's target" },
  { key: 'goal', label: 'Goal decomposition' },
];

function ModeTabs({ tab, onTabChange }) {
  // A two-way switch (pressed buttons), not a tablist: on phone the pager
  // below owns the page's tabs, and the two must not be confused.
  return (
    <div role="group" aria-label="Calculator mode" className="grid grid-cols-2 gap-1 rounded-xl bg-fr-sunk p-1">
      {MODE_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={tab === t.key}
          onClick={() => onTabChange(t.key)}
          className={`${FOCUS} min-h-[44px] rounded-[9px] px-2 text-[12.5px] font-bold transition-colors ${
            tab === t.key ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
          data-testid={`fr-commission-tab-${t.key}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const MIX_LABELS = [
  ['annual', 'Annual'],
  ['semiAnnual', 'Semi-Annual'],
  ['quarterly', 'Quarterly'],
  ['monthly', 'Monthly'],
];

/**
 * The mode-mix sliders with a 44px hit area. Same change rule as the Nexus
 * ModeMixSlider: rebalance() keeps the four modes at 100%.
 */
function ModeMix({ modeMix, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      {MIX_LABELS.map(([mode, label]) => {
        const pct = Math.round((modeMix[mode] ?? 0) * 100);
        const id = `fr-cp-mix-${mode}`;
        return (
          <div key={mode} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={id} className="text-[12px] text-ink-muted">{label}</label>
              <span className="font-mono text-[12px] font-bold tabular-nums text-primary">{pct}%</span>
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => onChange(rebalance(modeMix, mode, parseFloat(e.target.value) / 100))}
              className={`${FOCUS} h-11 w-full cursor-pointer accent-primary`}
              aria-label={`${label} mix percentage`}
            />
          </div>
        );
      })}
    </div>
  );
}

/** A labelled number input; the label text is the accessible name. */
function NumInput({ id, label, value, onChange, prefix, step = 1, min = 0, badge }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={id} className="text-[12.5px] font-bold text-ink">{label}</label>
        {badge ? (
          <span className="whitespace-nowrap rounded-full bg-fr-accent-tint px-2 py-0.5 text-[10.5px] font-bold text-primary">{badge}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        {prefix ? <span className="flex-none text-[12px] text-ink-muted">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={INPUT}
        />
      </div>
    </div>
  );
}

function InspectorFrame({ asCard, tab, onTabChange, children }) {
  return (
    <aside
      aria-label="Commission calculator"
      className={`flex min-w-0 flex-col gap-4 ${asCard ? `${CARD} p-4` : 'rounded-[18px] border border-border bg-fr-pane p-5'}`}
      data-testid="fr-commission-inspector"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className={H2}>Commission calculator</h2>
        <p className={SUB}>Change anything — every number on this page updates.</p>
      </div>
      <ModeTabs tab={tab} onTabChange={onTabChange} />
      {children}
    </aside>
  );
}

/* ─────────────────────────── Goal decomposition ─────────────────────────── */

function GoalInputs({ goal, grid }) {
  const { inputs, setField, hasHistory, incomeAmount, incomePeriod, handleIncomeAmountChange, handleIncomePeriodChange } = goal;
  const history = hasHistory ? 'From your history' : undefined;
  return (
    <div className="flex flex-col gap-3.5" data-testid="fr-commission-goal-inputs">
      <IncomeGoalField
        amount={incomeAmount}
        period={incomePeriod}
        onAmountChange={handleIncomeAmountChange}
        onPeriodChange={handleIncomePeriodChange}
      />
      <div className={grid ? 'grid grid-cols-2 gap-3 md:grid-cols-3' : 'flex flex-col gap-3.5'}>
        <NumInput id="fr-cp-tax" label="Tax rate (%)" value={inputs.taxRate} onChange={setField('taxRate')} step={1} min={0} />
        <NumInput id="fr-cp-renewal" label="Renewal income, annual" prefix="TTD" value={inputs.renewalIncome} onChange={setField('renewalIncome')} step={1000} />
        <NumInput id="fr-cp-settlement" label="Settlement rate (%)" value={inputs.settlementRate} onChange={setField('settlementRate')} step={1} min={0} />
        <NumInput id="fr-cp-commission" label="Commission rate (%)" value={inputs.commissionRate} onChange={setField('commissionRate')} step={1} min={1} />
        <NumInput id="fr-cp-avg-api" label="Average policy API" prefix="TTD" value={inputs.avgPolicyAPI} onChange={setField('avgPolicyAPI')} step={500} min={1} />
        <NumInput id="fr-cp-persistency" label="Persistency rate (%)" value={inputs.persistencyRate} onChange={setField('persistencyRate')} step={1} min={1} />
        <NumInput id="fr-cp-ci-sale" label="CIs per sale" value={inputs.ciToSaleRatio} onChange={setField('ciToSaleRatio')} step={0.1} min={0.1} badge={history} />
        <NumInput id="fr-cp-calls-ci" label="Calls per CI" value={inputs.dialsToCIRatio} onChange={setField('dialsToCIRatio')} step={0.1} min={0.1} badge={history} />
        <NumInput id="fr-cp-prospects" label="Prospects per call" value={inputs.prospectRatio} onChange={setField('prospectRatio')} step={0.1} min={0.1} />
      </div>
    </div>
  );
}

function GoalActions({ goal }) {
  const {
    computed, currentGoal, showConfirm, setShowConfirm, saving, savedGoals, savedAssumptions, error,
    handleRequestConfirm, handleConfirmWrite, handleSaveAssumptions,
  } = goal;
  return (
    <div className="flex flex-col gap-3" data-testid="fr-commission-goal-actions">
      {error ? (
        <p role="alert" className="rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger-ink">{error}</p>
      ) : null}
      {showConfirm ? (
        <div className="flex flex-col gap-3 rounded-[14px] bg-fr-accent-tint p-3.5" data-testid="commission-confirm-dialog">
          <p className="text-[13px] font-bold text-ink">Confirm — this replaces your current goal</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Current</span>
              <span className="whitespace-nowrap font-display text-[16px] font-bold tabular-nums text-ink-muted" data-testid="commission-confirm-current">
                {currentGoal && currentGoal > 0 ? formatCurrency(currentGoal) : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">New</span>
              <span className="whitespace-nowrap font-display text-[16px] font-bold tabular-nums text-primary" data-testid="commission-confirm-new">
                {formatCurrency(Math.round(computed.apiToWrite))}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleConfirmWrite} disabled={saving} className={BTN_PRIMARY} data-testid="commission-confirm-btn">
              {saving ? 'Saving…' : 'Set as my goal'}
            </button>
            <button type="button" onClick={() => setShowConfirm(false)} disabled={saving} className={BTN_QUIET} data-testid="commission-confirm-cancel">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRequestConfirm}
          disabled={saving || showConfirm}
          className={BTN_PRIMARY}
          data-testid="commission-save-goal-btn"
        >
          {savedGoals ? <><Check size={14} aria-hidden="true" />Goal saved</> : 'Save as my goals'}
        </button>
        <button type="button" onClick={handleSaveAssumptions} disabled={saving} className={BTN_QUIET} data-testid="commission-save-assumptions-btn">
          {savedAssumptions ? <><Check size={14} aria-hidden="true" />Saved</> : 'Save assumptions'}
        </button>
      </div>
    </div>
  );
}

function HistoryNote({ goal }) {
  if (!goal.hasHistory) return null;
  return (
    <p className="flex items-center gap-2 rounded-[12px] bg-fr-accent-tint px-3 py-2 text-[12px] text-primary" data-testid="fr-commission-history">
      <History size={14} aria-hidden="true" className="flex-none" />
      CI-to-sale and prospecting call-to-CI ratios auto-populated from your last {goal.historyWeeks} weeks of data.
    </p>
  );
}

function Decomposition({ goal }) {
  const { computed, inputs, preTaxAlreadyApplied, freqKey, setFreqKey } = goal;
  const rows = goalTableRows({ computed, inputs, preTaxAlreadyApplied, freqKey });
  const period = playgroundPeriod(freqKey);
  const perLabel = `Per ${period.display.toLowerCase()}`;
  return (
    <section aria-labelledby="fr-cp-decomp-h" className={`${CARD} flex min-w-0 flex-col gap-3 p-4 sm:p-5`} data-testid="fr-commission-decomposition">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="fr-cp-decomp-h" className={H2}>Goal decomposition</h2>
          <p className={SUB}>Your income goal, turned into the inventory of work it needs</p>
        </div>
        <div role="group" aria-label="View cadence" className="flex flex-wrap gap-0.5 rounded-xl bg-fr-sunk p-1">
          {PLAYGROUND_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={freqKey === p.key}
              onClick={() => setFreqKey(p.key)}
              className={`${FOCUS} min-h-[44px] rounded-lg px-2.5 text-[12px] font-bold transition-colors ${
                freqKey === p.key ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {p.display}
            </button>
          ))}
        </div>
      </div>
      <Why>
        Your income goal is grossed up for tax (unless Money needs already did that), less your renewal income; that is the
        first-year commission you need. Divided by your persistency rate and your commission rate, it gives the API to write.
        Divided by your average policy API, that gives applications; your CI, call and prospect ratios then give the activity.
      </Why>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" data-testid="fr-commission-decomposition-table">
          <caption className="sr-only">Goal decomposition, per year{period.divisor === 1 ? '' : ` and ${perLabel.toLowerCase()}`}</caption>
          <thead>
            <tr className="border-b border-border text-[11px] text-ink-muted">
              <th scope="col" className="py-2 pr-2 text-left font-semibold">Step</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Per year</th>
              {period.divisor === 1 ? null : <th scope="col" className="py-2 pl-2 text-right font-semibold">{perLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-b border-border last:border-b-0 ${r.key === 'api' ? 'bg-fr-accent-tint' : ''}`}
                data-testid={`fr-commission-stage-${r.key}`}
              >
                <th scope="row" className={`py-2.5 pr-2 text-left ${r.key === 'api' ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{r.label}</th>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold tabular-nums text-ink">{r.year}</td>
                {r.period === null ? null : (
                  <td className="whitespace-nowrap py-2.5 pl-2 text-right tabular-nums text-ink-muted">{r.period}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] leading-snug text-ink-muted">
        Assumes a 10-month production year. Settlement rate ({inputs.settlementRate}%) reflects the portion of submitted API confirmed by Tatil Life.
      </p>
    </section>
  );
}

function Scenarios({ goal }) {
  return (
    <section aria-label="Saved scenarios" className={`${CARD} min-w-0 p-4`} data-testid="fr-commission-scenarios">
      <SavedScenarioChips
        scenarios={goal.scenarios}
        activeId={goal.activeScenarioId}
        saving={goal.scenarioSaving}
        onApply={goal.handleScenarioApply}
        onSave={goal.handleScenarioSave}
        onDelete={goal.handleScenarioDelete}
      />
    </section>
  );
}

/* ───────────────────────────── This month's target ──────────────────────── */

function ModalInputs({ modal, grid }) {
  return (
    <div className="flex flex-col gap-3.5" data-testid="fr-commission-modal-inputs">
      <div className={grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3.5'}>
        <NumInput id="fr-cp-target" label="I want this much commission this month" prefix="TTD" value={modal.targetCommission} onChange={modal.setTargetCommission} step={100} min={1} />
        <NumInput id="fr-cp-modal-rate" label="Commission rate (%)" value={modal.commissionRate} onChange={modal.setCommissionRate} step={1} min={1} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-ink">Mode mix — always 100%</span>
        <ModeMix modeMix={modal.modeMix} onChange={modal.setModeMix} />
      </div>
    </div>
  );
}

function RequiredApi({ modal }) {
  return (
    <section aria-labelledby="fr-cp-target-h" className={`${CARD} flex min-w-0 flex-col gap-2 p-4 sm:p-5`} data-testid="fr-commission-required">
      <h2 id="fr-cp-target-h" className={H2}>This month&apos;s target: {formatCurrency(modal.targetCommission)} commission</h2>
      <p className={SUB}>Reverse-solved from your mode mix and commission rate</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="whitespace-nowrap font-display text-[34px] font-bold leading-none tabular-nums text-ink sm:text-[42px]" data-testid="fr-commission-required-api">
          {requiredApiText(modal.totalApi)}
        </span>
        <span className="text-[13px] text-ink-muted">Required API this month</span>
      </div>
      <Why>
        Each payment mode pays a different share of its first-year commission this month: annual pays all of it, semi-annual
        half, quarterly a quarter and monthly a twelfth. The API you need is your target divided by your commission rate and
        by that share, weighted by your mode mix.
      </Why>
    </section>
  );
}

function Breakdown({ modal }) {
  const rows = breakdownRows(modal.breakdown);
  return (
    <section aria-labelledby="fr-cp-breakdown-h" className={`${CARD} flex min-w-0 flex-col gap-3 p-4 sm:p-5`} data-testid="fr-commission-breakdown">
      <div>
        <h2 id="fr-cp-breakdown-h" className={H2}>Commission breakdown by mode</h2>
        <p className={SUB}>Required API is split the same way as your mode mix; commission is what lands this month, per mode</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] text-ink-muted">
              <th scope="col" className="py-2 pr-2 text-left font-semibold">Mode</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Mix</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">API required</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border" data-testid={`fr-commission-mode-${r.key}`}>
                <th scope="row" className="py-2.5 pr-2 text-left font-bold text-ink">{r.mode}</th>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted">{r.mix}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink">{r.api}</td>
                <td className="whitespace-nowrap py-2.5 pl-2 text-right font-bold tabular-nums text-ink">{r.commission}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FirstPayment() {
  const bars = firstPaymentBars();
  return (
    <ChartCard
      title="Why monthly-pay policies earn less this month"
      subtitle="Only the first payment counts as this month's commission — annual pays it all now, monthly pays 1/12th and the rest lands over the year."
      table={{
        caption: 'Share of first-year commission paid this month, by payment mode',
        columns: [
          { key: 'label', label: 'Mode', align: 'left' },
          { key: 'value', label: 'Paid this month', format: (v) => `${v}%` },
        ],
        rows: bars,
      }}
    >
      <Columns data={bars} height={96} format={(v) => `${v}%`} emphasis="all" />
    </ChartCard>
  );
}

function CashFlow({ modal }) {
  const cash = cashFlowModel({ totalApi: modal.totalApi, modeMix: modal.modeMix, commissionRate: modal.commissionRate });
  return (
    <ChartCard
      title={`${formatCurrency(cash.yearTotal)} lands over the next 12 months`}
      subtitle="This month's mode mix, spread across the year it actually pays out"
      table={{ caption: '12-month commission cash flow, by payment mode', columns: CASH_TABLE_COLUMNS, rows: cash.rows }}
    >
      <Columns data={cash.bars} height={150} format={(v) => formatCurrency(v)} emphasis="all" />
    </ChartCard>
  );
}

function Insights({ modal }) {
  if (!modal.insights?.length) return null;
  return (
    <section aria-labelledby="fr-cp-insights-h" className="flex min-w-0 flex-col gap-2" data-testid="fr-commission-insights">
      <h2 id="fr-cp-insights-h" className={H2}>Insights</h2>
      <ul className="flex flex-col gap-2">
        {modal.insights.map((text) => (
          <li key={text} className="flex items-start gap-2.5 rounded-[14px] bg-fr-warm-tint px-3.5 py-3 text-[12.5px] leading-snug text-ink">
            <WarnIcon className="mt-0.5" />
            <span className="min-w-0">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────────────── Layout ─────────────────────────────── */

export default function FrCommissionView({ layout, tab, onTabChange, goal, modal }) {
  if (!['desktop', 'tablet', 'phone'].includes(layout)) {
    throw new Error(`FrCommissionView: unknown layout "${layout}"`);
  }
  if (tab === 'goal' && !goal) throw new Error('FrCommissionView: tab "goal" needs `goal`');
  if (tab === 'modal' && !modal) throw new Error('FrCommissionView: tab "modal" needs `modal`');
  if (tab !== 'goal' && tab !== 'modal') throw new Error(`FrCommissionView: unknown tab "${tab}"`);

  const isGoal = tab === 'goal';

  if (layout === 'phone') {
    const pages = isGoal
      ? [
        { id: 'numbers', label: 'Your numbers', content: <div className={`${CARD} p-4`}><GoalInputs goal={goal} /></div> },
        { id: 'breakdown', label: 'Breakdown', content: <div className="flex flex-col gap-3"><HistoryNote goal={goal} /><Decomposition goal={goal} /></div> },
        { id: 'scenarios', label: 'Scenarios', content: <Scenarios goal={goal} /> },
      ]
      : [
        { id: 'target', label: 'Target', content: <div className="flex flex-col gap-3"><div className={`${CARD} p-4`}><ModalInputs modal={modal} /></div><RequiredApi modal={modal} /></div> },
        { id: 'mix', label: 'Payment mix', content: <div className="flex flex-col gap-3"><Breakdown modal={modal} /><FirstPayment /></div> },
        { id: 'cash', label: 'Cash flow', content: <div className="flex flex-col gap-3"><CashFlow modal={modal} /><Insights modal={modal} /></div> },
      ];
    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="fr-commission" data-layout="phone" data-tab={tab}>
        <ModeTabs tab={tab} onTabChange={onTabChange} />
        <SwipePager key={tab} pages={pages} ariaLabel={isGoal ? 'Goal decomposition pages' : "This month's target pages"} />
        {isGoal ? <GoalActions goal={goal} /> : null}
      </div>
    );
  }

  const main = isGoal ? (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <HistoryNote goal={goal} />
      <Decomposition goal={goal} />
      <Scenarios goal={goal} />
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <RequiredApi modal={modal} />
      <Breakdown modal={modal} />
      <FirstPayment />
      <CashFlow modal={modal} />
      {/* Last: it appears and disappears with the mix, and must not push the charts. */}
      <Insights modal={modal} />
    </div>
  );

  const inspectorBody = (asCard) => (isGoal ? (
    <>
      <GoalInputs goal={goal} grid={asCard} />
      <GoalActions goal={goal} />
    </>
  ) : (
    <ModalInputs modal={modal} grid={asCard} />
  ));

  if (layout === 'tablet') {
    return (
      <div className="flex min-w-0 flex-col gap-5" data-testid="fr-commission" data-layout="tablet" data-tab={tab}>
        <InspectorFrame asCard tab={tab} onTabChange={onTabChange}>{inspectorBody(true)}</InspectorFrame>
        {main}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-5" data-testid="fr-commission" data-layout="desktop" data-tab={tab}>
      {main}
      <div className="sticky top-4 w-[340px] flex-none">
        <InspectorFrame tab={tab} onTabChange={onTabChange}>{inspectorBody(false)}</InspectorFrame>
      </div>
    </div>
  );
}
