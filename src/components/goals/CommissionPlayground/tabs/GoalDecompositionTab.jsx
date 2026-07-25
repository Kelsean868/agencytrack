import React, { useState, useEffect, useMemo } from 'react';
import { History, Info, Check } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { setGoals } from '../../../../services/goalsService';
import {
  getUserPrefs, setCommissionScenarios, COMMISSION_SCENARIO_CAP,
} from '../../../../services/userPrefsService';
import { formatCurrency } from '../../../../utils/formatters';
import SavedScenarioChips from '../components/SavedScenarioChips';
import {
  decomposeFromIncome,
  deriveRatiosFromHistory,
  roundTo10,
  roundToWhole,
  WEEKLY_DIVISOR,
  DEFAULT_DECOMPOSITION_INPUTS,
} from '../../../../utils/goalDecomposition';

const PERIODS = [
  { key: 'annual',    label: 'Annual',  display: 'Annual',  divisor: 1             },
  { key: 'semi',      label: 'Semi',    display: 'Semi',    divisor: 2             },
  { key: 'quarterly', label: 'Quarter', display: 'Quarter', divisor: 4             },
  { key: 'monthly',   label: 'Month',   display: 'Month',   divisor: 10            },
  { key: 'weekly',    label: 'Week',    display: 'Week',    divisor: WEEKLY_DIVISOR },
];

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

  const preTaxIncome = preTaxAlreadyApplied
    ? inputs.incomeGoal
    : (inputs.taxRate < 100 ? inputs.incomeGoal / (1 - inputs.taxRate / 100) : 0);
  const firstYearCommRequired = Math.max(0, preTaxIncome - (inputs.renewalIncome || 0));

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
        <LadderStage label="Income goal"         sublabel="PRE-TAX TARGET"                         value={formatCurrency(roundTo10(inputs.incomeGoal / divisor))}        variant="head" />
        <LadderConnector>{taxConnector}</LadderConnector>
        <LadderStage label="1st-year commission" sublabel="NET NEW NEEDED"                         value={formatCurrency(roundTo10(firstYearCommRequired / divisor))}     variant="plain" />
        <LadderConnector>
          ÷ {inputs.commissionRate}% comm · <span className="text-primary font-bold">× {inputs.settlementRate}% settle</span>
        </LadderConnector>
        <LadderStage label="API to write"        sublabel="ANNUAL PREMIUM"                         value={formatCurrency(roundTo10(computed.apiToWrite / divisor))}       variant="plain" />
        <LadderConnector>÷ {formatCurrency(Math.round(inputs.avgPolicyAPI / 1000) * 1000)} avg policy API</LadderConnector>
        <LadderStage label="Apps"                sublabel={cadenceSuffix}                           value={`~${roundToWhole(computed.applications / divisor).toLocaleString()}`} variant="act" />
        <LadderConnector isActivity>× {inputs.ciToSaleRatio} CI→sale</LadderConnector>
        <LadderStage label="Closing interviews"  sublabel={cadenceSuffix}                           value={`~${roundToWhole(computed.ci / divisor).toLocaleString()}`}         variant="act" />
        <LadderConnector isActivity>
          × {inputs.dialsToCIRatio} calls→CI
          {hasHistory && (
            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-primary/10 text-primary">
              From your history
            </span>
          )}
        </LadderConnector>
        <LadderStage label="Prospecting calls"   sublabel={`${cadenceSuffix} · 4-COMPONENT SUM`}   value={`~${roundToWhole(computed.dials / divisor).toLocaleString()}`}        variant="act" />
        <LadderConnector>× {inputs.prospectRatio} prospect ratio</LadderConnector>
        <LadderStage label="Prospects"           sublabel={cadenceSuffix}                           value={`~${roundToWhole(computed.prospects / divisor).toLocaleString()}`}    variant="act" />
      </div>
    </div>
  );
}

export default function GoalDecompositionTab({ submissions = [], agentId, tenantId, currentGoal = null, onGoalSaved }) {
  const { user, userProfile } = useAuth();
  const [inputs, setInputs]                     = useState(DEFAULT_DECOMPOSITION_INPUTS);
  const [freqKey, setFreqKey]                   = useState('annual');
  const [saving, setSaving]                     = useState(false);
  const [savedGoals, setSavedGoals]             = useState(false);
  const [savedAssumptions, setSavedAssumptions] = useState(false);
  const [error, setError]                       = useState('');
  const [showConfirm, setShowConfirm]           = useState(false);
  const [preTaxAlreadyApplied, setPtaFlag]      = useState(false);

  // ── R-06: saved scenario chips (agent-private, own-write) ──────────────────
  // Persisted on the shared `users/{uid}/prefs/app` doc via userPrefsService
  // (merge-write). That rules arm is `request.auth.uid == uid` for read AND
  // write with NO manager arm, so scenarios are private by construction — no
  // firestore.rules change, no index, no shared/manager visibility to leak.
  const [scenarios, setScenarios]     = useState([]);
  const [scenarioSaving, setScenSaving] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    let alive = true;
    getUserPrefs(tenantId, user.uid)
      .then((prefs) => { if (alive) setScenarios(Array.isArray(prefs?.commissionScenarios) ? prefs.commissionScenarios : []); })
      // Degrade silently to "no scenarios" — never block the playground on a
      // prefs read (same contract as the nav-prefs consumers).
      .catch(() => { /* no-op */ });
    return () => { alive = false; };
  }, [tenantId, user?.uid]);

  const persistScenarios = async (next) => {
    setScenarios(next);           // optimistic — the chip row is a preference, not money
    setScenSaving(true);
    try {
      await setCommissionScenarios(tenantId, user.uid, next);
    } catch {
      setError('Could not save the scenario — check your connection and try again.');
    } finally {
      setScenSaving(false);
    }
  };

  const handleScenarioSave = (label) => {
    const entry = {
      id: `sc-${Date.now()}`,
      label,
      savedAt: new Date().toISOString(),   // client ISO — never a serverTimestamp inside an array
      inputs: { ...inputs },
      freqKey,
    };
    setActiveScenarioId(entry.id);
    persistScenarios([...scenarios, entry].slice(0, COMMISSION_SCENARIO_CAP));
  };

  const handleScenarioApply = (s) => {
    // Merge over the defaults so a scenario saved before a new input key was
    // added still applies cleanly (missing key → default, never undefined).
    setInputs({ ...DEFAULT_DECOMPOSITION_INPUTS, ...(s.inputs || {}) });
    if (s.freqKey) setFreqKey(s.freqKey);
    setActiveScenarioId(s.id);
  };

  const handleScenarioDelete = (id) => {
    if (activeScenarioId === id) setActiveScenarioId(null);
    persistScenarios(scenarios.filter((s) => s.id !== id));
  };

  useEffect(() => {
    const stored = localStorage.getItem('agencytrack-playground-income-goal');
    if (stored) {
      const parsed = JSON.parse(stored);
      const isObj = parsed !== null && typeof parsed === 'object';
      const val = isObj ? parseFloat(parsed.value) : parseFloat(parsed);
      const flag = isObj && parsed.preTaxAlreadyApplied === true;
      if (val > 0) {
        setInputs((prev) => ({ ...prev, incomeGoal: val }));
        setPtaFlag(flag);
      }
    }
  }, []);

  const { autoCiToSale, autoDialsToCI, hasHistory } = useMemo(
    () => deriveRatiosFromHistory(submissions),
    [submissions],
  );

  useEffect(() => {
    if (hasHistory) {
      setInputs((prev) => ({
        ...prev,
        ciToSaleRatio:  parseFloat(autoCiToSale.toFixed(2)),
        dialsToCIRatio: parseFloat(autoDialsToCI.toFixed(2)),
      }));
    }
  }, [hasHistory, autoCiToSale, autoDialsToCI]);

  const setField = (key) => (value) => {
    if (key === 'incomeGoal' || key === 'taxRate') setPtaFlag(false);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const computed = useMemo(
    () => decomposeFromIncome({ ...inputs, preTaxAlreadyApplied }),
    [inputs, preTaxAlreadyApplied],
  );

  const handleRequestConfirm = () => {
    const api = computed.apiToWrite;
    if (!api || api <= 0 || !isFinite(api)) return;
    setError('');
    setShowConfirm(true);
  };

  const handleConfirmWrite = async () => {
    // Defensive guard — handleRequestConfirm already validates, but protect
    // against any state race between the confirm dialog opening and submission.
    const api = computed.apiToWrite;
    if (!api || api <= 0 || !isFinite(api)) { setShowConfirm(false); return; }
    setSaving(true);
    setError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, agentId, {
        personalAnnualAPI:  computed.apiToWrite,
        personalAnnualApps: computed.applications,
      }, user.uid, name);
      setShowConfirm(false);
      setSavedGoals(true);
      onGoalSaved?.();
      setTimeout(() => setSavedGoals(false), 2500);
    } catch (e) {
      setError(e.message ?? 'Failed to save goals.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssumptions = async () => {
    setSaving(true);
    setError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, agentId, {
        playgroundIncomeGoal:      inputs.incomeGoal,
        playgroundTaxRate:         inputs.taxRate,
        playgroundRenewalIncome:   inputs.renewalIncome,
        playgroundSettlementRate:  inputs.settlementRate,
        playgroundCommissionRate:  inputs.commissionRate,
        playgroundAvgPolicyAPI:    inputs.avgPolicyAPI,
        playgroundPersistencyRate: inputs.persistencyRate,
        playgroundCiToSaleRatio:   inputs.ciToSaleRatio,
        playgroundDialsToCIRatio:  inputs.dialsToCIRatio,
        playgroundProspectRatio:   inputs.prospectRatio,
      }, user.uid, name);
      setSavedAssumptions(true);
      setTimeout(() => setSavedAssumptions(false), 2500);
    } catch (e) {
      setError(e.message ?? 'Failed to save assumptions.');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="Income Goal (TTD)"    value={inputs.incomeGoal}     onChange={setField('incomeGoal')}     prefix="TTD" step={5000} />
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
            badge={hasHistory ? 'From your history' : undefined}
          />
          <NumField
            label="Calls per CI"
            value={inputs.dialsToCIRatio}
            onChange={setField('dialsToCIRatio')}
            step={0.1}
            min={0.1}
            badge={hasHistory ? 'From your history' : undefined}
          />
          <NumField label="Prospects per Call" value={inputs.prospectRatio} onChange={setField('prospectRatio')} step={0.1} min={0.1} />
        </div>
      </div>

      <DecompositionLadder
        computed={computed}
        inputs={inputs}
        freqKey={freqKey}
        onFreqChange={setFreqKey}
        hasHistory={hasHistory}
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
