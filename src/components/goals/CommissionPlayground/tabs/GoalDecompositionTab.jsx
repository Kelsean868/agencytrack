import { useState, useEffect, useMemo } from 'react';
import { History, Info, Check } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { setGoals } from '../../../../services/goalsService';
import { formatCurrency } from '../../../../utils/formatters';

// Local helpers — only used by this tab.
const roundTo10    = (v) => Math.round(parseFloat(v) / 10) * 10;
const roundToWhole = (v) => Math.round(parseFloat(v));

const PERIODS = [
  { key: 'annual',    label: 'Annual',      divisor: 1   },
  { key: 'semi',      label: 'Semi-Annual', divisor: 2   },
  { key: 'quarterly', label: 'Quarterly',   divisor: 4   },
  { key: 'monthly',   label: 'Monthly',     divisor: 10  },
  { key: 'weekly',    label: 'Weekly',      divisor: 43  },
  { key: 'daily',     label: 'Daily',       divisor: 215 },
];

const DEFAULT_INPUTS = {
  incomeGoal:      300000,
  taxRate:         25,
  renewalIncome:   0,
  settlementRate:  90,
  commissionRate:  35,
  avgPolicyAPI:    12000,
  persistencyRate: 90,
  ciToSaleRatio:   2,
  dialsToCIRatio:  2.5,
  prospectRatio:   2,
};

function NumField({ label, value, onChange, prefix, step = 1, min = 0, badge }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-ink-muted">{label}</label>
        {badge && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center h-9 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
        {prefix && <span className="text-xs text-ink-muted pl-2 pr-1 shrink-0">{prefix}</span>}
        <input
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

function OutputTable({ computed, freqKey, onFreqChange }) {
  const period = PERIODS.find((p) => p.key === freqKey) ?? PERIODS[0];
  const { divisor } = period;

  const rows = [
    { label: 'Income Goal',        value: roundTo10(computed.incomeGoal  / divisor), fmt: formatCurrency },
    { label: 'API to Write',       value: roundTo10(computed.apiToWrite  / divisor), fmt: formatCurrency },
    { label: 'API to Settle',      value: roundTo10(computed.apiToSettle / divisor), fmt: formatCurrency },
    { label: 'Applications',       value: roundToWhole(computed.applications / divisor), fmt: (v) => v.toLocaleString() },
    { label: 'Closing Interviews', value: roundToWhole(computed.ci          / divisor), fmt: (v) => v.toLocaleString() },
    { label: 'Dials',              value: roundToWhole(computed.dials        / divisor), fmt: (v) => v.toLocaleString() },
    { label: 'Prospects',          value: roundToWhole(computed.prospects    / divisor), fmt: (v) => v.toLocaleString() },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="commission-frequency" className="text-xs font-semibold text-ink-muted">View as:</label>
        <select
          id="commission-frequency"
          value={freqKey}
          onChange={(e) => onFreqChange(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-2 py-2 text-ink-muted font-semibold">Metric</th>
              <th className="text-right px-2 py-2 text-ink-muted font-semibold">{period.label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-card-raised' : 'bg-card'}>
                <td className="px-2 py-2 font-medium text-ink">{row.label}</td>
                <td className="px-2 py-2 text-right text-ink tabular-nums">{row.fmt(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GoalDecompositionTab({ submissions = [], agentId, tenantId }) {
  const { user, userProfile } = useAuth();
  const [inputs, setInputs]                     = useState(DEFAULT_INPUTS);
  const [freqKey, setFreqKey]                   = useState('annual');
  const [saving, setSaving]                     = useState(false);
  const [savedGoals, setSavedGoals]             = useState(false);
  const [savedAssumptions, setSavedAssumptions] = useState(false);
  const [error, setError]                       = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('agencytrack-playground-income-goal');
    if (stored) {
      const val = parseFloat(JSON.parse(stored));
      if (val > 0) setInputs((prev) => ({ ...prev, incomeGoal: val }));
    }
  }, []);

  const { autoCiToSale, autoDialsToCI, hasHistory } = useMemo(() => {
    const submitted = (submissions ?? [])
      .filter((s) => s.status === 'submitted')
      .slice(0, 12);

    if (submitted.length < 8) return { autoCiToSale: null, autoDialsToCI: null, hasHistory: false };

    const totalCI    = submitted.reduce((sum, s) => sum + (parseFloat(s.ciConducted) || 0), 0);
    const totalApps  = submitted.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);
    const totalDials = submitted.reduce(
      (sum, s) =>
        sum +
        (parseFloat(s.referralCalls) || 0) +
        (parseFloat(s.followUpCalls) || 0) +
        (parseFloat(s.coldCalls) || 0) +
        (parseFloat(s.seminarTradeshowCalls) || 0),
      0,
    );

    const autoCiToSale  = totalApps > 0 ? totalCI / totalApps : null;
    const autoDialsToCI = totalCI   > 0 ? totalDials / totalCI : null;
    return {
      autoCiToSale,
      autoDialsToCI,
      hasHistory: autoCiToSale !== null && autoDialsToCI !== null,
    };
  }, [submissions]);

  useEffect(() => {
    if (hasHistory) {
      setInputs((prev) => ({
        ...prev,
        ciToSaleRatio:  parseFloat(autoCiToSale.toFixed(2)),
        dialsToCIRatio: parseFloat(autoDialsToCI.toFixed(2)),
      }));
    }
  }, [hasHistory, autoCiToSale, autoDialsToCI]);

  const setField = (key) => (value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const computed = useMemo(() => {
    const {
      incomeGoal, taxRate, renewalIncome, settlementRate,
      commissionRate, avgPolicyAPI, persistencyRate,
      ciToSaleRatio, dialsToCIRatio, prospectRatio,
    } = inputs;

    const preTaxIncome           = taxRate < 100 ? incomeGoal / (1 - taxRate / 100) : 0;
    const firstYearCommRequired  = Math.max(0, preTaxIncome - renewalIncome);
    const adjustedForPersistency = persistencyRate > 0 ? firstYearCommRequired / (persistencyRate / 100) : 0;
    const apiToWrite             = commissionRate > 0 ? adjustedForPersistency / (commissionRate / 100) : 0;
    const apiToSettle            = apiToWrite * (settlementRate / 100);
    const applications           = avgPolicyAPI > 0 ? apiToWrite / avgPolicyAPI : 0;
    const ci                     = applications * ciToSaleRatio;
    const dials                  = ci * dialsToCIRatio;
    const prospects              = dials * prospectRatio;

    return { incomeGoal, apiToWrite, apiToSettle, applications, ci, dials, prospects };
  }, [inputs]);

  const handleSaveGoals = async () => {
    setSaving(true);
    setError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, agentId, {
        personalAnnualAPI:  computed.apiToWrite,
        personalAnnualApps: computed.applications,
      }, user.uid, name);
      setSavedGoals(true);
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
            CI-to-sale and dials-to-CI ratios auto-populated from your last{' '}
            {Math.min((submissions ?? []).filter((s) => s.status === 'submitted').length, 12)} weeks of data.
          </p>
        </div>
      )}

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
            label="Dials per CI"
            value={inputs.dialsToCIRatio}
            onChange={setField('dialsToCIRatio')}
            step={0.1}
            min={0.1}
            badge={hasHistory ? 'From your history' : undefined}
          />
          <NumField label="Prospects per Dial" value={inputs.prospectRatio} onChange={setField('prospectRatio')} step={0.1} min={0.1} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Activity Required</p>
        <OutputTable computed={computed} freqKey={freqKey} onFreqChange={setFreqKey} />
        <div className="flex items-start gap-1.5 mt-2">
          <Info size={16} className="text-ink-muted shrink-0 mt-0.5" />
          <p className="text-xs text-ink-muted leading-snug">
            Calculations assume a 10-month production year. API to Settle reflects a 90% settlement rate — meaning 90% of submitted API is expected to be confirmed by Tatil Life. Adjust the Settlement Rate field above to model different scenarios.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <button
          onClick={handleSaveGoals}
          disabled={saving}
          className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
            savedGoals
              ? 'bg-success/15 text-success'
              : 'bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark dark:hover:bg-primary'
          }`}
        >
          {savedGoals ? <><Check size={13} className="inline mr-1" />Goals Saved</> : 'Save as My Goals'}
        </button>
        <button
          onClick={handleSaveAssumptions}
          disabled={saving}
          className={`h-9 px-4 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-60 ${
            savedAssumptions
              ? 'border-success/40 text-success bg-success/10'
              : 'border-border text-ink-muted hover:text-ink'
          }`}
        >
          {savedAssumptions ? <><Check size={13} className="inline mr-1" />Saved</> : 'Save Assumptions'}
        </button>
      </div>
    </div>
  );
}
