import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, ChevronDown, Loader2, AlertCircle, Plus, Trash2, Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createMoneyNeeds, getMoneyNeeds,
  updateExpenseGroup, annualizeAmount, computeGroupTotal,
  updateSubCalculator, updateCommissionTargets, refreshPAYECalculation,
  updateVisibility,
  PLAYGROUND_INCOME_GOAL_KEY, PAYE_BRACKETS_VERSION,
} from '../../services/moneyNeedsService';
import { formatCurrency } from '../../utils/formatters';

// Checklist restyle (Game Plan v2 Slice 1): each group leads with a colored
// dot, mirroring the build annotation's group key. Presentation only — no
// data-model change.
const EXPENSE_GROUPS = [
  { key: 'fixedExpenses',       label: 'Fixed Expenses',         dot: 'bg-primary'    },
  { key: 'livingExpenses',      label: 'Living Expenses',        dot: 'bg-ink-muted'  },
  { key: 'businessExpenses',    label: 'Business Expenses',      dot: 'bg-gold'       },
  { key: 'savingsAccumulation', label: 'Savings & Accumulation', dot: 'bg-success'    },
  { key: 'miscellaneous',       label: 'Miscellaneous',          dot: 'bg-ink-faint'  },
];

const FREQUENCY_OPTIONS = [
  { value: 'M', label: 'Monthly'    },
  { value: 'Q', label: 'Quarterly'  },
  { value: 'S', label: 'Semi-Annual'},
  { value: 'A', label: 'Annual'     },
];

const CURRENT_YEAR = new Date().getFullYear();

function makeItemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function LineItemRow({ item, onChange, onDelete, onBlur }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
      <input
        type="text"
        value={item.label}
        onChange={(e) => onChange(item.id, 'label', e.target.value)}
        onBlur={onBlur}
        placeholder="Description"
        aria-label="Expense description"
        className="flex-1 min-w-0 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        type="number"
        value={item.amount === 0 ? '' : item.amount}
        onChange={(e) => onChange(item.id, 'amount', e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        min={0}
        aria-label="Expense amount"
        className="w-24 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <select
        value={item.frequency}
        onChange={(e) => onChange(item.id, 'frequency', e.target.value, true)}
        aria-label="Frequency"
        className="h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {FREQUENCY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="w-28 text-right text-xs text-ink-muted tabular-nums shrink-0">
        {formatCurrency(annualizeAmount(item.amount, item.frequency))} / yr
      </span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label="Delete expense"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors min-h-[44px] min-w-[32px]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ExpenseGroupAccordion({ groupKey, label, dot, group, worksheetDoc, onGroupSaved }) {
  const { tenantId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [localItems, setLocalItems] = useState(() => group?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalItems(group?.lineItems ?? []);
  }, [group]);

  async function saveGroup(items) {
    setSaving(true);
    setSaveError('');
    try {
      const processedItems = items.map((item) => {
        const amount = parseFloat(item.amount) || 0;
        return {
          ...item,
          amount,
          annualizedAmount: annualizeAmount(amount, item.frequency),
        };
      });
      const groupAnnualTotal = computeGroupTotal({
        lineItems: processedItems,
        subCalculatorRefs: group?.subCalculatorRefs ?? [],
      });
      const updatedGroup = {
        lineItems: processedItems,
        subCalculatorRefs: group?.subCalculatorRefs ?? [],
        groupAnnualTotal,
      };
      const newAllGroups = { ...worksheetDoc.expenseGroups, [groupKey]: updatedGroup };
      const rollup = await updateExpenseGroup(
        tenantId, user.uid, worksheetDoc.year, groupKey, updatedGroup, newAllGroups,
      );
      onGroupSaved(groupKey, updatedGroup, rollup);
    } catch {
      setSaveError('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddItem() {
    const newItem = {
      id: makeItemId(),
      label: '',
      amount: 0,
      frequency: 'M',
      annualizedAmount: 0,
      isCustom: true,
    };
    const next = [...localItems, newItem];
    setLocalItems(next);
    saveGroup(next);
  }

  function handleDeleteItem(id) {
    const next = localItems.filter((i) => i.id !== id);
    setLocalItems(next);
    saveGroup(next);
  }

  function handleItemChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => i.id === id ? { ...i, [field]: value } : i);
    setLocalItems(next);
    if (saveNow) saveGroup(next);
  }

  function handleBlur() {
    saveGroup(localItems);
  }

  const groupAnnualTotal = computeGroupTotal({
    lineItems: localItems.map((item) => ({
      ...item,
      annualizedAmount: annualizeAmount(parseFloat(item.amount) || 0, item.frequency),
    })),
    subCalculatorRefs: group?.subCalculatorRefs ?? [],
  });

  const filledCount = localItems.filter((i) => (parseFloat(i.amount) || 0) > 0).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2 w-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
          <span className="truncate">{label}</span>
          {localItems.length > 0 && (
            <span className="font-mono text-[10px] font-medium text-ink-muted tracking-wide shrink-0">
              {filledCount} of {localItems.length} filled
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {groupAnnualTotal > 0 && (
            <span className="text-xs font-medium text-ink-muted tabular-nums">
              {formatCurrency(groupAnnualTotal)} / yr
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          {saveError && (
            <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertCircle size={12} className="shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {localItems.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">No items yet. Add your first expense below.</p>
          ) : (
            <div className="mb-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border mb-1">
                <span className="flex-1 text-xs font-semibold text-ink-muted">Description</span>
                <span className="w-24 text-right text-xs font-semibold text-ink-muted">Amount</span>
                <span className="text-xs font-semibold text-ink-muted">Frequency</span>
                <span className="w-28 text-right text-xs font-semibold text-ink-muted">Annual</span>
                <span className="w-8" />
              </div>
              {localItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onChange={handleItemChange}
                  onDelete={handleDeleteItem}
                  onBlur={handleBlur}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddItem}
            disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <Plus size={13} />
            Add item
          </button>
        </div>
      )}
    </div>
  );
}

function PAYESummary({ worksheet }) {
  if (!worksheet) return null;
  const { totalAnnualAfterTax = 0, totalAnnualPreTax = 0 } = worksheet;
  if (totalAnnualAfterTax === 0 && totalAnnualPreTax === 0) return null;

  // Read-only summary cascade — all derived from existing worksheet fields.
  const payeGrossUp = Math.max(0, totalAnnualPreTax - totalAnnualAfterTax);
  const renewals = parseFloat(worksheet.estimatedRenewalIncome?.total) || 0;
  const commissionsRequired = Math.max(0, totalAnnualPreTax - renewals);

  return (
    <div className="rounded-xl bg-surface-raised border border-border px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Annual Income Target</p>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">After-tax total need</span>
        <span className="text-ink font-semibold tabular-nums">{formatCurrency(totalAnnualAfterTax)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-muted">+ PAYE gross-up</span>
        <span className="text-ink-muted tabular-nums">+ {formatCurrency(payeGrossUp)}</span>
      </div>
      <div className="flex justify-between text-sm border-t border-border pt-2">
        <span className="text-ink font-semibold">Pre-tax / gross need</span>
        <span className="text-ink font-bold tabular-nums">{formatCurrency(totalAnnualPreTax)}</span>
      </div>
      {renewals > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-ink-muted">− Renewal income</span>
          <span className="text-success-ink tabular-nums">− {formatCurrency(renewals)}</span>
        </div>
      )}
      <div className="flex justify-between items-baseline border-t border-border pt-2">
        <span className="text-ink font-semibold text-sm">1st-year commissions required</span>
        <span className="text-gold font-extrabold text-lg tabular-nums">{formatCurrency(commissionsRequired)}</span>
      </div>
    </div>
  );
}

function PAYERefreshBanner({ worksheet, onRefreshed }) {
  const { tenantId, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  const needsRefresh = worksheet?.payeBracketsVersionId &&
    worksheet.payeBracketsVersionId !== PAYE_BRACKETS_VERSION;

  if (!needsRefresh) return null;

  async function handleRefresh() {
    setRefreshing(true); setRefreshError('');
    try {
      const rollup = await refreshPAYECalculation(
        tenantId, user.uid, worksheet.year, worksheet.expenseGroups,
      );
      onRefreshed(rollup);
    } catch { setRefreshError('Refresh failed — check connection.'); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-4 py-3">
      <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Your PAYE calculation is based on an older tax bracket version.
        </p>
        {refreshError && <p className="text-xs text-red-600 mt-1">{refreshError}</p>}
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 shrink-0 min-h-[44px]"
      >
        {refreshing ? <Loader2 size={12} className="animate-spin" /> : null}
        Refresh PAYE Calculation
      </button>
    </div>
  );
}

const PRODUCT_LINE_FIELDS = [
  { key: 'life',     label: 'Life' },
  { key: 'ah',       label: 'A&H' },
  { key: 'property', label: 'Property' },
  { key: 'motor',    label: 'Motor' },
];

function CommissionTargetsPanel({ worksheet, onTargetsSaved }) {
  const { tenantId, user } = useAuth();
  const [targets, setTargets] = useState(() => ({
    life:     worksheet?.firstYearCommissionsTargets?.life     ?? 0,
    ah:       worksheet?.firstYearCommissionsTargets?.ah       ?? 0,
    property: worksheet?.firstYearCommissionsTargets?.property ?? 0,
    motor:    worksheet?.firstYearCommissionsTargets?.motor    ?? 0,
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setTargets({
      life:     worksheet?.firstYearCommissionsTargets?.life     ?? 0,
      ah:       worksheet?.firstYearCommissionsTargets?.ah       ?? 0,
      property: worksheet?.firstYearCommissionsTargets?.property ?? 0,
      motor:    worksheet?.firstYearCommissionsTargets?.motor    ?? 0,
    });
  }, [worksheet]);

  const renewalTotal = parseFloat(worksheet?.estimatedRenewalIncome?.total) || 0;
  const required = (parseFloat(worksheet?.totalAnnualPreTax) || 0) - renewalTotal;
  const targetsTotal = (parseFloat(targets.life) || 0) + (parseFloat(targets.ah) || 0)
    + (parseFloat(targets.property) || 0) + (parseFloat(targets.motor) || 0);

  async function save() {
    setSaving(true); setSaveError('');
    try {
      const result = await updateCommissionTargets(tenantId, user.uid, worksheet.year, targets, worksheet);
      onTargetsSaved(result);
    } catch { setSaveError('Save failed — check connection.'); }
    finally { setSaving(false); }
  }

  function handleSendToPlayground() {
    localStorage.setItem(PLAYGROUND_INCOME_GOAL_KEY, JSON.stringify(required));
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  }

  return (
    <div className="rounded-xl bg-card border border-border px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Commission Targets</p>

      <div className="flex justify-between items-center">
        <span className="text-sm text-ink-muted">Required 1st-Year Commissions</span>
        <span className="text-base font-bold text-ink tabular-nums">{formatCurrency(required)}</span>
      </div>
      {renewalTotal > 0 && (
        <div className="flex justify-between items-center text-xs text-ink-muted">
          <span>Estimated Renewal Income</span>
          <span className="tabular-nums">− {formatCurrency(renewalTotal)}</span>
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold text-ink-muted">Targets by Product Line</p>
        {PRODUCT_LINE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="flex-1 text-sm text-ink-muted">{label}</label>
            <input
              type="number"
              value={targets[key] === 0 ? '' : targets[key]}
              onChange={(e) => setTargets((prev) => ({ ...prev, [key]: e.target.value }))}
              onBlur={save}
              placeholder="0"
              min={0}
              aria-label={`${label} commission target`}
              className="w-36 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        ))}
        <div className="flex justify-between items-center pt-1 border-t border-border text-sm font-semibold">
          <span className="text-ink-muted">Total</span>
          <span className="tabular-nums text-ink">{formatCurrency(targetsTotal)}</span>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={12} className="shrink-0" /><span>{saveError}</span>
        </div>
      )}

      <div className="pt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSendToPlayground}
          disabled={saving || required <= 0}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <Send size={13} />
          {sent ? 'Sent!' : 'Send to Playground'}
        </button>
        {saving && <Loader2 size={14} className="animate-spin text-ink-muted" />}
      </div>
    </div>
  );
}

const CAR_PERSONAL_PCT = 33;
const CAR_BUSINESS_PCT = 67;

function SubCalcLineItems({ items, onChange, onDelete, onBlur }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border mb-1">
        <span className="flex-1 text-xs font-semibold text-ink-muted">Description</span>
        <span className="w-24 text-right text-xs font-semibold text-ink-muted">Amount</span>
        <span className="text-xs font-semibold text-ink-muted">Frequency</span>
        <span className="w-28 text-right text-xs font-semibold text-ink-muted">Annual</span>
        <span className="w-8" />
      </div>
      {items.map((item) => (
        <LineItemRow
          key={item.id}
          item={item}
          onChange={onChange}
          onDelete={onDelete}
          onBlur={onBlur}
        />
      ))}
    </div>
  );
}

function InsuranceIndustryCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { setLocalItems(calcData?.lineItems ?? []); }, [calcData]);

  const annualTotal = localItems.reduce(
    (sum, item) => sum + (parseFloat(annualizeAmount(parseFloat(item.amount) || 0, item.frequency)) || 0), 0,
  );

  async function save(items) {
    setSaving(true); setSaveError('');
    try {
      const processed = items.map((i) => {
        const amount = parseFloat(i.amount) || 0;
        return { ...i, amount, annualizedAmount: annualizeAmount(amount, i.frequency) };
      });
      const total = processed.reduce((s, i) => s + (parseFloat(i.annualizedAmount) || 0), 0);
      const updated = { lineItems: processed, annualTotal: total };
      const result = await updateSubCalculator(tenantId, user.uid, worksheetDoc.year, 'insuranceIndustry', updated, worksheetDoc);
      onSubCalcSaved('insuranceIndustry', updated, result);
    } catch { setSaveError('Save failed — check connection.'); }
    finally { setSaving(false); }
  }

  function handleAdd() {
    const next = [...localItems, { id: makeItemId(), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true }];
    setLocalItems(next); save(next);
  }
  function handleDelete(id) { const next = localItems.filter((i) => i.id !== id); setLocalItems(next); save(next); }
  function handleChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => i.id === id ? { ...i, [field]: value } : i);
    setLocalItems(next); if (saveNow) save(next);
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}>
        <span>Insurance Industry Expenses</span>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {annualTotal > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(annualTotal)} / yr</span>}
          <ChevronDown size={16} className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <p className="text-xs text-ink-muted mb-2">Rolls into Business Expenses</p>
          {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
          {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems)} />}
          {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
          <button type="button" onClick={handleAdd} disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
            <Plus size={13} />Add item
          </button>
        </div>
      )}
    </div>
  );
}

function CarExpensesCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [withLoan, setWithLoan] = useState(() => calcData?.withLoan ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { setLocalItems(calcData?.lineItems ?? []); setWithLoan(calcData?.withLoan ?? false); }, [calcData]);

  const lineAnnual = localItems.reduce(
    (sum, item) => sum + (parseFloat(annualizeAmount(parseFloat(item.amount) || 0, item.frequency)) || 0), 0,
  );
  const personalAnnual = Math.round((lineAnnual * CAR_PERSONAL_PCT) / 100);
  const businessAnnual = Math.round((lineAnnual * CAR_BUSINESS_PCT) / 100);

  async function save(items, loan) {
    setSaving(true); setSaveError('');
    try {
      const processed = items.map((i) => {
        const amount = parseFloat(i.amount) || 0;
        return { ...i, amount, annualizedAmount: annualizeAmount(amount, i.frequency) };
      });
      const total = processed.reduce((s, i) => s + (parseFloat(i.annualizedAmount) || 0), 0);
      const personal = Math.round((total * CAR_PERSONAL_PCT) / 100);
      const business = Math.round((total * CAR_BUSINESS_PCT) / 100);
      const updated = {
        lineItems: processed, withLoan: loan,
        personalSharePct: CAR_PERSONAL_PCT, businessSharePct: CAR_BUSINESS_PCT,
        annualTotalPersonal: personal, annualTotalBusiness: business,
      };
      const result = await updateSubCalculator(tenantId, user.uid, worksheetDoc.year, 'carExpenses', updated, worksheetDoc);
      onSubCalcSaved('carExpenses', updated, result);
    } catch { setSaveError('Save failed — check connection.'); }
    finally { setSaving(false); }
  }

  function handleAdd() {
    const next = [...localItems, { id: makeItemId(), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true }];
    setLocalItems(next); save(next, withLoan);
  }
  function handleDelete(id) { const next = localItems.filter((i) => i.id !== id); setLocalItems(next); save(next, withLoan); }
  function handleChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => i.id === id ? { ...i, [field]: value } : i);
    setLocalItems(next); if (saveNow) save(next, withLoan);
  }
  function handleLoanToggle() { const next = !withLoan; setWithLoan(next); save(localItems, next); }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}>
        <span>Car Expenses</span>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {lineAnnual > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(lineAnnual)} / yr</span>}
          <ChevronDown size={16} className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={handleLoanToggle} disabled={saving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${withLoan ? 'bg-primary' : 'bg-border'}`}
              role="switch" aria-checked={withLoan} aria-label="Includes loan payments">
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${withLoan ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-ink-muted">Includes loan payments</span>
          </div>
          <div className="flex gap-4 mb-2 text-xs text-ink-muted">
            <span>Personal ({CAR_PERSONAL_PCT}%): <span className="font-semibold text-ink tabular-nums">{formatCurrency(personalAnnual)}</span> → Living</span>
            <span>Business ({CAR_BUSINESS_PCT}%): <span className="font-semibold text-ink tabular-nums">{formatCurrency(businessAnnual)}</span> → Business</span>
          </div>
          {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
          {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems, withLoan)} />}
          {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
          <button type="button" onClick={handleAdd} disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
            <Plus size={13} />Add item
          </button>
        </div>
      )}
    </div>
  );
}

function LoansDebtCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { setLocalItems(calcData?.lineItems ?? []); }, [calcData]);

  const annualTotal = localItems.reduce(
    (sum, item) => sum + (parseFloat(annualizeAmount(parseFloat(item.amount) || 0, item.frequency)) || 0), 0,
  );

  async function save(items) {
    setSaving(true); setSaveError('');
    try {
      const processed = items.map((i) => {
        const amount = parseFloat(i.amount) || 0;
        return { ...i, amount, annualizedAmount: annualizeAmount(amount, i.frequency) };
      });
      const total = processed.reduce((s, i) => s + (parseFloat(i.annualizedAmount) || 0), 0);
      const updated = { lineItems: processed, annualTotal: total };
      const result = await updateSubCalculator(tenantId, user.uid, worksheetDoc.year, 'loansDebt', updated, worksheetDoc);
      onSubCalcSaved('loansDebt', updated, result);
    } catch { setSaveError('Save failed — check connection.'); }
    finally { setSaving(false); }
  }

  function handleAdd() {
    const next = [...localItems, { id: makeItemId(), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true }];
    setLocalItems(next); save(next);
  }
  function handleDelete(id) { const next = localItems.filter((i) => i.id !== id); setLocalItems(next); save(next); }
  function handleChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => i.id === id ? { ...i, [field]: value } : i);
    setLocalItems(next); if (saveNow) save(next);
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}>
        <span>Loans &amp; Debt</span>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {annualTotal > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(annualTotal)} / yr</span>}
          <ChevronDown size={16} className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <p className="text-xs text-ink-muted mb-2">Standalone total — not rolled into expense groups</p>
          {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
          {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems)} />}
          {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
          <button type="button" onClick={handleAdd} disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
            <Plus size={13} />Add item
          </button>
        </div>
      )}
    </div>
  );
}

export default function MoneyNeedsPanel() {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;

  const [year, setYear]         = useState(CURRENT_YEAR);
  const [worksheet, setWorksheet] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getMoneyNeeds(tenantId, uid, year);
      setWorksheet(result);
    } catch {
      setError('Could not load worksheet. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, uid, year]);

  useEffect(() => { load(); }, [load]);

  async function handleStart() {
    setCreating(true);
    setError('');
    try {
      const result = await createMoneyNeeds(tenantId, uid, year);
      setWorksheet(result);
    } catch {
      setError('Could not create worksheet. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleGroupSaved(groupKey, updatedGroup, rollup) {
    setWorksheet((prev) => ({
      ...prev,
      expenseGroups: { ...prev.expenseGroups, [groupKey]: updatedGroup },
      ...rollup,
    }));
  }

  function handleSubCalcSaved(calcKey, calcData, { rollup, updatedGroups }) {
    setWorksheet((prev) => ({
      ...prev,
      subCalculators: { ...prev.subCalculators, [calcKey]: calcData },
      expenseGroups: { ...prev.expenseGroups, ...updatedGroups },
      ...rollup,
    }));
  }

  function handleTargetsSaved({ firstYearCommissionsRequired, firstYearCommissionsTargets }) {
    setWorksheet((prev) => ({ ...prev, firstYearCommissionsRequired, firstYearCommissionsTargets }));
  }

  function handlePAYERefreshed(rollup) {
    setWorksheet((prev) => ({ ...prev, ...rollup, payeBracketsVersionId: PAYE_BRACKETS_VERSION }));
  }

  async function handleVisibilityToggle(checked) {
    const newVisibility = checked ? 'shared' : 'private';
    setWorksheet((prev) => ({ ...prev, visibility: newVisibility }));
    try {
      await updateVisibility(tenantId, uid, worksheet.year, newVisibility);
    } catch {
      setWorksheet((prev) => ({ ...prev, visibility: checked ? 'private' : 'shared' }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={20} className="text-primary" />
          <h2 className="text-lg font-bold text-ink">Money Needs Worksheet</h2>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 px-2 rounded-lg bg-surface border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
          aria-label="Select year"
        >
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !worksheet && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calculator size={28} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-ink">No {year} worksheet yet</p>
            <p className="text-sm text-ink-muted mt-1">
              Start your {year} Money Needs Worksheet to calculate your annual income target.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={creating}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 min-h-[44px]"
          >
            {creating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Start {year} worksheet
          </button>
        </div>
      )}

      {/* Worksheet */}
      {!loading && worksheet && (
        <div className="space-y-2">
          <PAYERefreshBanner worksheet={worksheet} onRefreshed={handlePAYERefreshed} />

          <div className="rounded-xl bg-card border border-border px-4 py-3 mb-2">
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={worksheet.visibility === 'shared'}
                onChange={(e) => handleVisibilityToggle(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
                aria-label="Share with my Unit Manager and Branch Manager"
              />
              <span className="text-sm text-ink">
                Share with my Unit Manager &amp; Branch Manager
              </span>
            </label>
          </div>

          {EXPENSE_GROUPS.map(({ key, label, dot }) => (
            <ExpenseGroupAccordion
              key={key}
              groupKey={key}
              label={label}
              dot={dot}
              group={worksheet.expenseGroups?.[key]}
              worksheetDoc={worksheet}
              onGroupSaved={handleGroupSaved}
            />
          ))}

          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide pt-2">Sub-Calculators</p>

          <InsuranceIndustryCalc
            calcData={worksheet.subCalculators?.insuranceIndustry}
            worksheetDoc={worksheet}
            onSubCalcSaved={handleSubCalcSaved}
          />
          <CarExpensesCalc
            calcData={worksheet.subCalculators?.carExpenses}
            worksheetDoc={worksheet}
            onSubCalcSaved={handleSubCalcSaved}
          />
          <LoansDebtCalc
            calcData={worksheet.subCalculators?.loansDebt}
            worksheetDoc={worksheet}
            onSubCalcSaved={handleSubCalcSaved}
          />

          <CommissionTargetsPanel
            worksheet={worksheet}
            onTargetsSaved={handleTargetsSaved}
          />

          <PAYESummary worksheet={worksheet} />
        </div>
      )}
    </div>
  );
}
