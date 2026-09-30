import React from 'react';
import { History, Info, Check } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import SavedScenarioChips from '../components/SavedScenarioChips';
import IncomeGoalField from '../components/IncomeGoalField';
import { PLAYGROUND_PERIODS } from '../../../../utils/playgroundPeriods';
import useGoalDecomposition from './useGoalDecomposition';
import { ladderFigures, formatLadderFigure } from '../utils/decompositionStages';

// The view-cadence chips and the income-goal period select share ONE table
// (utils/playgroundPeriods.js) — R2-3 moved it there so the two cannot drift.
const PERIODS = PLAYGROUND_PERIODS;

function NumField({ label, value, onChange, prefix, step = 1, min = 0, badge }) {
  const id = `gdt-${label.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-xs text-ink-muted">{label}</label>
        {badge && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center h-9 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
        {prefix && <span className="text-xs text-ink-muted pl-2 pr-1 shrink-0">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 h-full px-2 text-sm text-ink focus:outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

function LadderStage({ label, sublabel, value, variant = 'plain' }) {
  const styles = {
    head:  'border-gold/30 bg-gold-tint dark:bg-gold/10',
    plain: 'border-border bg-card-raised',
    act:   'border-primary/20 bg-primary/5',
  };
  const valueStyles = {
    head:  'text-gold-ink',
    plain: 'text-ink',
    act:   'text-primary',
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${styles[variant]}`}
      data-testid="commission-ladder-stage"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink leading-tight">{label}</p>
        <p className="mt-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          {sublabel}
        </p>
      </div>
      <span className={`shrink-0 font-display text-xl font-extrabold tabular-nums tracking-tight ${valueStyles[variant]}`}>
        {value}
      </span>
    </div>
  );
}

function LadderConnector({ children, isActivity }) {
  return (
    <div className="flex items-center gap-2 pl-5 py-0.5">
      <div className="flex flex-col items-center self-stretch gap-0">
        <div className="w-0.5 flex-1 bg-border rounded-full mx-auto" />
        <span className="text-[9px] text-ink-muted py-0.5">↓</span>
        <div className="w-0.5 flex-1 bg-border rounded-full mx-auto" />
      </div>
      <span className={`font-mono text-[9.5px] border rounded-md px-2 py-0.5 leading-none whitespace-nowrap ${
        isActivity
          ? 'text-primary font-bold bg-card border-primary/30'
          : 'text-ink-muted bg-card border-border'
      }`}>
        {children}
      </span>
    </div>
  );
}

function DecompositionLadder({ computed, inputs, freqKey, onFreqChange, hasHistory, preTaxAlreadyApplied }) {
  const period = PERIODS.find((p) => p.key === freqKey) ?? PERIODS[0];
  const { divisor } = period;
  const cadenceSuffix = freqKey === 'annual' ? 'ANNUAL' : `/ ${period.display.toUpperCase()}`;

  const [income, firstYear, api, apps, ci, calls, prospects] = ladderFigures({ computed, inputs, preTaxAlreadyApplied });
  const fmt = (figure) => formatLadderFigure(figure, divisor);

  const taxConnector = inputs.taxRate > 0
    ? `− ${inputs.taxRate}% tax${inputs.renewalIncome > 0 ? ` · − ${formatCurrency(Math.round(inputs.renewalIncome / 1000) * 1000)} renewals` : ''}`
    : inputs.renewalIncome > 0 ? `− ${formatCurrency(Math.round(inputs.renewalIncome / 1000) * 1000)} renewals` : 'no tax / renewal adjustment';

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What it takes — working back from your goal</p>
        <div role="group" aria-label="View cadence" className="flex gap-0.5 p-0.5 rounded-xl bg-card-raised border border-border">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onFreqChange(p.key)}
              aria-pressed={freqKey === p.key}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                freqKey === p.key
                  ? 'bg-card border border-primary/30 text-primary shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {p.display}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <LadderStage label="Income goal"         sublabel="PRE-TAX TARGET"                         value={fmt(income)}        variant="head" />
        <LadderConnector>{taxConnector}</LadderConnector>
        <LadderStage label="1st-year commission" sublabel="NET NEW NEEDED"                         value={fmt(firstYear)}     variant="plain" />
        <LadderConnector>
          ÷ {inputs.commissionRate}% comm · <span className="text-primary font-bold">× {inputs.settlementRate}% settle</span>
        </LadderConnector>
        <LadderStage label="API to write"        sublabel="ANNUAL PREMIUM"                         value={fmt(api)}       variant="plain" />
        <LadderConnector>÷ {formatCurrency(Math.round(inputs.avgPolicyAPI / 1000) * 1000)} avg policy API</LadderConnector>
        <LadderStage label="Apps"                sublabel={cadenceSuffix}                           value={fmt(apps)} variant="act" />
        <LadderConnector isActivity>× {inputs.ciToSaleRatio} CI→sale</LadderConnector>
        <LadderStage label="Closing interviews"  sublabel={cadenceSuffix}                           value={fmt(ci)}         variant="act" />
        <LadderConnector isActivity>
          × {inputs.dialsToCIRatio} calls→CI
          {hasHistory && (
            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-primary/10 text-primary">
              From your history
            </span>
          )}
        </LadderConnector>
        <LadderStage label="Prospecting calls"   sublabel={`${cadenceSuffix} · 4-COMPONENT SUM`}   value={fmt(calls)}        variant="act" />
        <LadderConnector>× {inputs.prospectRatio} prospect ratio</LadderConnector>
        <LadderStage label="Prospects"           sublabel={cadenceSuffix}                           value={fmt(prospects)}    variant="act" />
      </div>
    </div>
  );
}

export default function GoalDecompositionTab({ submissions = [], agentId, tenantId, currentGoal = null, onGoalSaved }) {
  const {
    inputs, freqKey, setFreqKey, saving, savedGoals, savedAssumptions, error,
    showConfirm, setShowConfirm, preTaxAlreadyApplied, incomeAmount, incomePeriod,
    scenarios, scenarioSaving, activeScenarioId,
    handleScenarioSave, handleScenarioApply, handleScenarioDelete,
    hasHistory, fromHistory, settingsLoading, setField, handleIncomeAmountChange, handleIncomePeriodChange,
    computed, handleRequestConfirm, handleConfirmWrite, handleSaveAssumptions,
  } = useGoalDecomposition({ submissions, agentId, tenantId, onGoalSaved });

  if (settingsLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" data-testid="commission-settings-loading">
        <p className="text-xs text-ink-muted">Loading your saved assumptions…</p>
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-card-raised animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hasHistory && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <History size={14} className="text-primary shrink-0" />
          <p className="text-xs text-primary">
            CI-to-sale and prospecting call-to-CI ratios auto-populated from your last{' '}
            {Math.min((submissions ?? []).filter((s) => s.status === 'submitted').length, 12)} weeks of data.
          </p>
        </div>
      )}

      {/* R-06 saved-scenario chips — sit above the inputs they restore. */}
      <SavedScenarioChips
        scenarios={scenarios}
        activeId={activeScenarioId}
        saving={scenarioSaving}
        onApply={handleScenarioApply}
        onSave={handleScenarioSave}
        onDelete={handleScenarioDelete}
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Income Assumptions</p>
        <div className="mb-3 sm:max-w-md">
          <IncomeGoalField
            amount={incomeAmount}
            period={incomePeriod}
            onAmountChange={handleIncomeAmountChange}
            onPeriodChange={handleIncomePeriodChange}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField label="Tax Rate (%)"          value={inputs.taxRate}         onChange={setField('taxRate')}         step={1}     min={0} />
          <NumField label="Renewal Income (TTD)" value={inputs.renewalIncome}  onChange={setField('renewalIncome')}  prefix="TTD" step={1000} />
          <NumField label="Settlement Rate (%)"  value={inputs.settlementRate} onChange={setField('settlementRate')} step={1}     min={0} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Production Assumptions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField label="Commission Rate (%)"  value={inputs.commissionRate}  onChange={setField('commissionRate')}  step={1}   min={1} />
          <NumField label="Avg Policy API (TTD)" value={inputs.avgPolicyAPI}   onChange={setField('avgPolicyAPI')}   prefix="TTD" step={500} min={1} />
          <NumField label="Persistency Rate (%)" value={inputs.persistencyRate} onChange={setField('persistencyRate')} step={1}   min={1} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Activity Ratios</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField
            label="CIs per Sale"
            value={inputs.ciToSaleRatio}
            onChange={setField('ciToSaleRatio')}
            step={0.1}
            min={0.1}
            badge={fromHistory('ciToSaleRatio') ? 'From your history' : undefined}
          />
          <NumField
            label="Calls per CI"
            value={inputs.dialsToCIRatio}
            onChange={setField('dialsToCIRatio')}
            step={0.1}
            min={0.1}
            badge={fromHistory('dialsToCIRatio') ? 'From your history' : undefined}
          />
          <NumField label="Prospects per Call" value={inputs.prospectRatio} onChange={setField('prospectRatio')} step={0.1} min={0.1} />
        </div>
      </div>

      <DecompositionLadder
        computed={computed}
        inputs={inputs}
        freqKey={freqKey}
        onFreqChange={setFreqKey}
        hasHistory={fromHistory('dialsToCIRatio')}
        preTaxAlreadyApplied={preTaxAlreadyApplied}
      />

      <div className="flex items-start gap-1.5">
        <Info size={16} className="text-ink-muted shrink-0 mt-0.5" />
        <p className="text-xs text-ink-muted leading-snug">
          Assumes a 10-month production year. Settlement rate ({inputs.settlementRate}%) reflects the portion of submitted API confirmed by Tatil Life.
        </p>
      </div>

      {error && (
        <p className="text-xs text-danger-ink bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {showConfirm && (
        <div
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3"
          data-testid="commission-confirm-dialog"
        >
          <p className="text-sm font-semibold text-ink">Confirm — this replaces your current goal</p>
          <div className="flex gap-6 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">Current</span>
              <span className="font-display text-base font-extrabold text-ink-muted" data-testid="commission-confirm-current">
                {currentGoal && currentGoal > 0 ? formatCurrency(currentGoal) : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-primary">New</span>
              <span className="font-display text-base font-extrabold text-primary" data-testid="commission-confirm-new">
                {formatCurrency(Math.round(computed.apiToWrite))}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmWrite}
              disabled={saving}
              className="h-9 px-4 rounded-lg text-sm font-semibold bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-60"
              data-testid="commission-confirm-btn"
            >
              {saving ? 'Saving…' : 'Set as my goal'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={saving}
              className="h-9 px-4 rounded-lg text-sm font-semibold border border-border text-ink-muted hover:text-ink transition-colors disabled:opacity-60"
              data-testid="commission-confirm-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <button
          type="button"
          onClick={handleRequestConfirm}
          disabled={saving || showConfirm}
          className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
            savedGoals
              ? 'bg-success/15 text-success-ink'
              : 'bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark dark:hover:bg-primary'
          }`}
          data-testid="commission-save-goal-btn"
        >
          {savedGoals ? <><Check size={13} className="inline mr-1" />Goal Saved</> : 'Save as My Goals'}
        </button>
        <button
          onClick={handleSaveAssumptions}
          disabled={saving}
          className={`h-9 px-4 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-60 ${
            savedAssumptions
              ? 'border-success/40 text-success-ink bg-success/10'
              : 'border-border text-ink-muted hover:text-ink'
          }`}
        >
          {savedAssumptions ? <><Check size={13} className="inline mr-1" />Saved</> : 'Save Assumptions'}
        </button>
      </div>
    </div>
  );
}
