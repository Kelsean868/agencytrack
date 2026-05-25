import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, ChevronDown, Loader2, AlertCircle, Plus, Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createMoneyNeeds, getMoneyNeeds,
  updateExpenseGroup, annualizeAmount, computeGroupTotal,
} from '../../services/moneyNeedsService';
import { formatCurrency } from '../../utils/formatters';

const EXPENSE_GROUPS = [
  { key: 'fixedExpenses',       label: 'Fixed Expenses' },
  { key: 'livingExpenses',      label: 'Living Expenses' },
  { key: 'businessExpenses',    label: 'Business Expenses' },
  { key: 'savingsAccumulation', label: 'Savings & Accumulation' },
  { key: 'miscellaneous',       label: 'Miscellaneous' },
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
        className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        type="number"
        value={item.amount === 0 ? '' : item.amount}
        onChange={(e) => onChange(item.id, 'amount', e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        min={0}
        aria-label="Expense amount"
        className="w-24 h-9 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <select
        value={item.frequency}
        onChange={(e) => onChange(item.id, 'frequency', e.target.value, true)}
        aria-label="Frequency"
        className="h-9 px-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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

function ExpenseGroupAccordion({ groupKey, label, group, worksheetDoc, onGroupSaved }) {
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

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}
      >
        <span>{label}</span>
        <div className="flex items-center gap-2">
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
  const { totalAnnualAfterTax = 0, totalAnnualPreTax = 0, computedPAYE = 0 } = worksheet;
  if (totalAnnualAfterTax === 0 && totalAnnualPreTax === 0) return null;

  return (
    <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 space-y-1.5">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">PAYE Summary</p>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">Total After-Tax Need</span>
        <span className="text-ink font-semibold tabular-nums">{formatCurrency(totalAnnualAfterTax)}</span>
      </div>
      <div className="flex justify-between text-sm border-t border-primary/20 pt-1.5">
        <span className="text-ink-muted">Required Gross Income</span>
        <span className="text-ink font-bold tabular-nums">{formatCurrency(totalAnnualPreTax)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-muted">Estimated PAYE</span>
        <span className="text-ink-muted tabular-nums">{formatCurrency(computedPAYE)}</span>
      </div>
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
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 min-h-[44px]"
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
          <div className="rounded-xl bg-card border border-border px-4 py-3 mb-2">
            <p className="text-xs text-ink-muted">
              Visibility: <span className="font-semibold text-ink">
                {worksheet.visibility === 'private' ? 'Private (only you)' : 'Shared'}
              </span>
              {' · '}Sharing controls coming in G5.
            </p>
          </div>

          {EXPENSE_GROUPS.map(({ key, label }) => (
            <ExpenseGroupAccordion
              key={key}
              groupKey={key}
              label={label}
              group={worksheet.expenseGroups?.[key]}
              worksheetDoc={worksheet}
              onGroupSaved={handleGroupSaved}
            />
          ))}

          <PAYESummary worksheet={worksheet} />
        </div>
      )}
    </div>
  );
}
