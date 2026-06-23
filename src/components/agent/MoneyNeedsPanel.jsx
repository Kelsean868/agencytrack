import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, ChevronDown, Loader2, AlertCircle, Plus, Trash2, Send, RotateCcw, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  createMoneyNeeds, getMoneyNeeds,
  updateExpenseGroup, annualizeAmount, computeGroupTotal,
  updateSubCalculator, updateCommissionTargets, refreshPAYECalculation,
  updateVisibility, countFilledLineItems, calcFedValue,
  PLAYGROUND_INCOME_GOAL_KEY, PAYE_BRACKETS_VERSION,
  CAR_PERSONAL_PCT, CAR_BUSINESS_PCT, CAR_LOAN_LOANSDEBT_LINE_ID,
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

// Manual / custom expense line — editable label, amount, frequency, delete.
// On mobile (<sm) the label stacks above the amount/freq/annual/delete row.
function LineItemRow({ item, onChange, onDelete, onBlur, stacked = false }) {
  // Default (main panel): responsive — label above the numeric row on mobile,
  // single flat row on desktop (the PR-718 layout). `stacked` (calc modal):
  // ALWAYS stacked so the label takes the full row width and a long Description
  // renders in full inside the narrow FloatingCalcModal (~480px), where a flat
  // row would pin it to ~89px.
  const outerCls = stacked
    ? 'flex flex-col gap-1.5'
    : 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2';
  const labelCls = stacked
    ? 'w-full h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40'
    : 'w-full sm:flex-1 sm:min-w-0 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40';
  return (
    <div className="py-1.5 border-b border-border last:border-0">
      <div className={outerCls}>
        <input
          type="text"
          value={item.label}
          onChange={(e) => onChange(item.id, 'label', e.target.value)}
          onBlur={onBlur}
          placeholder="Description"
          aria-label="Expense description"
          className={labelCls}
        />
        <div className="flex items-center gap-2 flex-wrap">
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
            className="flex-1 sm:flex-none h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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
      </div>
    </div>
  );
}

// Calc-fed line — prefilled from a sub-calculator, presented as a bordered
// card. Empty → teal CTA card (no input until calc is run). Filled → plain
// card with editable amount, Recalculate, and conditional Reset.
function CalcFedLineRow({ item, onChange, onReset, onBlur, onOpenCalc }) {
  const overridden = !!item.isOverridden;
  const filled = (parseFloat(item.amount) || 0) > 0;
  // Both car lines (carExpenses.personal / carExpenses.business) → 'carExpenses'.
  const calcId = item.calcKey ? item.calcKey.split('.')[0] : null;

  return (
    <div className={`rounded-xl border p-[11px_13px] space-y-2 ${filled ? 'border-border bg-surface' : 'border-primary bg-primary/5'}`}>
      {/* Row 1 — label (full, no truncation) + state chip */}
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-sm text-ink text-pretty">{item.label}</span>
        {overridden ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold">Edited</span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles size={10} aria-hidden="true" /> Calculator
          </span>
        )}
      </div>
      {/* Row 2 — empty: full-width CTA; filled: value-first + Recalculate + Reset */}
      {!filled ? (
        <button
          type="button"
          onClick={() => onOpenCalc(calcId)}
          aria-label={`Open ${item.label} calculator`}
          className="w-full min-h-12 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Calculator size={15} aria-hidden="true" />
          Build with calculator →
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            value={item.amount === 0 ? '' : item.amount}
            onChange={(e) => onChange(item.id, 'amount', e.target.value)}
            onBlur={onBlur}
            placeholder="0"
            min={0}
            aria-label={`${item.label} amount`}
            className="w-24 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-xs text-ink-muted tabular-nums">
            {formatCurrency(annualizeAmount(item.amount, item.frequency))} / yr
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {calcId && (
              <button
                type="button"
                onClick={() => onOpenCalc(calcId)}
                aria-label={`Open ${item.label} calculator`}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border text-primary text-xs font-semibold hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Calculator size={13} aria-hidden="true" />
                Recalculate
              </button>
            )}
            {overridden && (
              <button
                type="button"
                onClick={() => onReset(item.id)}
                aria-label={`Reset ${item.label} to calculator value`}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border text-ink-muted text-xs font-semibold hover:bg-surface-raised hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseGroupAccordion({ groupKey, label, dot, group, worksheetDoc, onGroupSaved, onOpenCalc }) {
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
      const groupAnnualTotal = computeGroupTotal({ lineItems: processedItems });
      const updatedGroup = {
        lineItems: processedItems,
        subCalculatorRefs: [],
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

  // Editing a calc-fed line's amount/frequency stores an explicit override.
  function handleItemChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (i.calcKey && (field === 'amount' || field === 'frequency')) updated.isOverridden = true;
      return updated;
    });
    setLocalItems(next);
    if (saveNow) saveGroup(next);
  }

  // Reset a calc-fed line back to its current calculator value.
  function handleResetCalcLine(id) {
    const next = localItems.map((i) => {
      if (i.id !== id || !i.calcKey) return i;
      const synced = calcFedValue(i.calcKey, worksheetDoc.subCalculators);
      return { ...i, isOverridden: false, amount: synced, frequency: 'A', annualizedAmount: synced };
    });
    setLocalItems(next);
    saveGroup(next);
  }

  function handleBlur() {
    saveGroup(localItems);
  }

  const calcFedItems = localItems.filter((i) => i.calcKey);
  const manualItems = localItems.filter((i) => !i.calcKey);

  const groupAnnualTotal = computeGroupTotal({
    lineItems: localItems.map((item) => ({
      ...item,
      annualizedAmount: annualizeAmount(parseFloat(item.amount) || 0, item.frequency),
    })),
  });

  const filledCount = localItems.filter((i) => (parseFloat(i.amount) || 0) > 0).length;

  const colHeader = (
    <div className="flex items-center gap-2 pb-1 border-b border-border mb-1">
      <span className="flex-1 text-xs font-semibold text-ink-muted">Description</span>
      <span className="w-24 text-right text-xs font-semibold text-ink-muted">Amount</span>
      <span className="text-xs font-semibold text-ink-muted">Frequency</span>
      <span className="w-28 text-right text-xs font-semibold text-ink-muted">Annual</span>
      <span className="w-8" />
    </div>
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 px-4 py-2 sm:py-0 sm:h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}
      >
        {/* Line 1 (mobile) / left segment (desktop): dot + full label, chevron pinned right on mobile */}
        <span className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          <span className={`h-2 w-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
          <span className="flex-1 min-w-0 [text-wrap:pretty]">{label}</span>
          <ChevronDown
            size={16}
            className={`sm:hidden shrink-0 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
        {/* Line 2 (mobile) / right segment (desktop): count + total, chevron on desktop.
            <span> (not <div>) so the header <button> holds only phrasing content. */}
        <span className="flex items-center gap-2 shrink-0 pl-[1.125rem] sm:pl-0 text-ink-muted">
          {localItems.length > 0 && (
            <span className="font-mono text-[10px] font-medium tracking-wide">
              {filledCount} of {localItems.length} filled
            </span>
          )}
          {saving && <Loader2 size={12} className="animate-spin" />}
          {groupAnnualTotal > 0 && (
            <span className="text-xs font-medium tabular-nums">
              {formatCurrency(groupAnnualTotal)} / yr
            </span>
          )}
          <ChevronDown
            size={16}
            className={`hidden sm:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          {saveError && (
            <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertCircle size={12} className="shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {calcFedItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2 flex items-center gap-1">
                <Sparkles size={11} aria-hidden="true" /> From your calculators
              </p>
              <div className="space-y-2">
                {calcFedItems.map((item) => (
                  <CalcFedLineRow
                    key={item.id}
                    item={item}
                    onChange={handleItemChange}
                    onReset={handleResetCalcLine}
                    onBlur={handleBlur}
                    onOpenCalc={onOpenCalc}
                  />
                ))}
              </div>
            </div>
          )}

          {manualItems.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">No items yet. Add your first expense below.</p>
          ) : (
            <div className="mb-2">
              {calcFedItems.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Your entries</p>
              )}
              {colHeader}
              {manualItems.map((item) => (
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

// Always-visible lede reframing the worksheet from survival-budgeting to
// lifestyle design — agents are commission-only with no income ceiling.
function WorksheetLede() {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <p className="text-sm font-semibold text-ink">Design the life you want</p>
      <p className="text-xs text-ink-muted mt-1 leading-relaxed">
        You set your own income — there&apos;s no ceiling. So don&apos;t just plan to get by.
        Map out the life you actually want, and see exactly what you&apos;ll need to earn to make it real.
      </p>
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
      <div className="border-b border-border pb-2">
        <p className="text-sm font-bold text-ink">The income your lifestyle requires</p>
        <p className="text-[11px] text-ink-muted mt-0.5">
          Everything above is your choice — this is the annual income it takes to fund it.
        </p>
        <div className="flex justify-between items-baseline mt-1.5">
          <span className="text-ink-muted text-sm">Income you must earn</span>
          <span className="text-ink font-bold text-lg tabular-nums">{formatCurrency(totalAnnualPreTax)}</span>
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-muted">− PAYE gross-up</span>
        <span className="text-ink-muted tabular-nums">− {formatCurrency(payeGrossUp)}</span>
      </div>
      <div className="flex justify-between text-sm border-t border-border pt-2">
        <span className="text-ink font-semibold">After-tax take-home</span>
        <span className="text-ink font-bold tabular-nums">{formatCurrency(totalAnnualAfterTax)}</span>
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
    localStorage.setItem(PLAYGROUND_INCOME_GOAL_KEY, JSON.stringify({ value: required, preTaxAlreadyApplied: true }));
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

// Calc-modal line items render in LineItemRow's `stacked` layout (label on its
// own full-width line). No flat column header — stacked rows wouldn't align to
// it, and each field is self-labelled (placeholder / "/ yr"), as on mobile.
function SubCalcLineItems({ items, onChange, onDelete, onBlur }) {
  return (
    <div className="mb-2">
      {items.map((item) => (
        <LineItemRow
          key={item.id}
          item={item}
          onChange={onChange}
          onDelete={onDelete}
          onBlur={onBlur}
          stacked
        />
      ))}
    </div>
  );
}

const CALC_TITLES = {
  insuranceIndustry: 'Insurance Industry Expenses',
  carExpenses: 'Car Expenses',
  loansDebt: 'Loans & Debt',
};

// Responsive floating-calculator shell: desktop = centred modal; mobile =
// full-screen bottom sheet. Reuses useFocusTrap (focus-first + focus-return
// to the originating trigger + Tab cycle + Escape). Mounted only while open,
// so the trap captures the trigger correctly and returns focus on unmount.
function FloatingCalcModal({ onClose, title, children }) {
  const modalRef = useFocusTrap({ onEscape: onClose });

  // Lock background scroll while open (matters most for the mobile bottom sheet).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full max-h-[100dvh] w-full flex-col rounded-none border-0 bg-surface-raised shadow-xl outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-extrabold tracking-tight text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title} calculator`}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function InsuranceIndustryCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-ink-muted">Prefills “Professional/industry expenses” in Business Expenses</p>
        <span className="flex shrink-0 items-center gap-2">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {annualTotal > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(annualTotal)} / yr</span>}
        </span>
      </div>
      {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
      {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems)} />}
      {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
      <button type="button" onClick={handleAdd} disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
        <Plus size={13} />Add item
      </button>
    </div>
  );
}

function CarExpensesCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { setLocalItems(calcData?.lineItems ?? []); }, [calcData]);

  const lineAnnual = localItems.reduce(
    (sum, item) => sum + (parseFloat(annualizeAmount(parseFloat(item.amount) || 0, item.frequency)) || 0), 0,
  );
  const personalAnnual = Math.round((lineAnnual * CAR_PERSONAL_PCT) / 100);
  const businessAnnual = Math.round((lineAnnual * CAR_BUSINESS_PCT) / 100);

  // Read-only car-loan reference, sourced from Loans & Debt (cost of ownership);
  // NOT part of the car total and NOT split.
  const carLoanRef = (worksheetDoc.subCalculators?.loansDebt?.lineItems ?? [])
    .filter((i) => i.id === CAR_LOAN_LOANSDEBT_LINE_ID)
    .reduce((s, i) => s + (annualizeAmount(parseFloat(i.amount) || 0, i.frequency) || 0), 0);

  async function save(items) {
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
        lineItems: processed, withLoan: false,
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
    setLocalItems(next); save(next);
  }
  function handleDelete(id) { const next = localItems.filter((i) => i.id !== id); setLocalItems(next); save(next); }
  function handleChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => i.id === id ? { ...i, [field]: value } : i);
    setLocalItems(next); if (saveNow) save(next);
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
        {lineAnnual > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(lineAnnual)} / yr</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-ink-muted">
        <span>Personal ({CAR_PERSONAL_PCT}%): <span className="font-semibold text-ink tabular-nums">{formatCurrency(personalAnnual)}</span> → Living</span>
        <span>Business ({CAR_BUSINESS_PCT}%): <span className="font-semibold text-ink tabular-nums">{formatCurrency(businessAnnual)}</span> → Business</span>
      </div>
      {carLoanRef > 0 && (
        <p className="mb-2 text-xs text-ink-muted">
          Car loan (from Loans &amp; Debt): <span className="font-semibold text-ink tabular-nums">{formatCurrency(carLoanRef)}</span>
          <span className="text-ink-muted"> / yr — reference only, not in the split</span>
        </p>
      )}
      {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
      {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems)} />}
      {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
      <button type="button" onClick={handleAdd} disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
        <Plus size={13} />Add item
      </button>
    </div>
  );
}

function LoansDebtCalc({ calcData, worksheetDoc, onSubCalcSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => calcData?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-ink-muted">Prefills “Debt reduction (non-mortgage)” in Savings &amp; Accumulation</p>
        <span className="flex shrink-0 items-center gap-2">
          {saving && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          {annualTotal > 0 && <span className="text-xs font-medium text-ink-muted tabular-nums">{formatCurrency(annualTotal)} / yr</span>}
        </span>
      </div>
      {saveError && <div className="flex items-center gap-2 mb-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400"><AlertCircle size={12} className="shrink-0" /><span>{saveError}</span></div>}
      {localItems.length > 0 && <SubCalcLineItems items={localItems} onChange={handleChange} onDelete={handleDelete} onBlur={() => save(localItems)} />}
      {localItems.length === 0 && <p className="text-xs text-ink-muted py-2">No items yet.</p>}
      <button type="button" onClick={handleAdd} disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50 min-h-[44px]">
        <Plus size={13} />Add item
      </button>
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
  // Which floating calculator is open: 'insuranceIndustry' | 'carExpenses' | 'loansDebt' | null.
  // Lifted to the panel so triggers embedded in any expense group open the right calc.
  const [openCalc, setOpenCalc] = useState(null);

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

  // 1.8 — worksheet-level FILLED N/total tally, derived from the same per-group
  // line items the accordions count. Shown only once the worksheet has loaded.
  const { filled: filledTotal, total: itemsTotal } = countFilledLineItems(worksheet?.expenseGroups);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={20} className="text-primary" />
          <h2 className="text-lg font-bold text-ink">Money Needs Worksheet</h2>
          {worksheet && (
            <span
              data-testid="money-needs-filled-counter"
              className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted bg-surface-raised border border-border rounded-full px-2 py-0.5 shrink-0"
            >
              Filled {filledTotal}/{itemsTotal}
            </span>
          )}
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
          <WorksheetLede />

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
              onOpenCalc={setOpenCalc}
            />
          ))}

          <CommissionTargetsPanel
            worksheet={worksheet}
            onTargetsSaved={handleTargetsSaved}
          />

          <PAYESummary worksheet={worksheet} />

          {/* Floating calculators — opened by the trigger next to each calc-fed
              line. Mounted only while open so the focus trap captures the
              originating trigger and returns focus to it on close. */}
          {openCalc && (
            <FloatingCalcModal
              onClose={() => setOpenCalc(null)}
              title={CALC_TITLES[openCalc]}
            >
              {openCalc === 'insuranceIndustry' && (
                <InsuranceIndustryCalc
                  calcData={worksheet.subCalculators?.insuranceIndustry}
                  worksheetDoc={worksheet}
                  onSubCalcSaved={handleSubCalcSaved}
                />
              )}
              {openCalc === 'carExpenses' && (
                <CarExpensesCalc
                  calcData={worksheet.subCalculators?.carExpenses}
                  worksheetDoc={worksheet}
                  onSubCalcSaved={handleSubCalcSaved}
                />
              )}
              {openCalc === 'loansDebt' && (
                <LoansDebtCalc
                  calcData={worksheet.subCalculators?.loansDebt}
                  worksheetDoc={worksheet}
                  onSubCalcSaved={handleSubCalcSaved}
                />
              )}
            </FloatingCalcModal>
          )}
        </div>
      )}
    </div>
  );
}
