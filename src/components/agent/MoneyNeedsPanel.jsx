import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, ChevronDown, Loader2, AlertCircle, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createMoneyNeeds, getMoneyNeeds } from '../../services/moneyNeedsService';

const EXPENSE_GROUPS = [
  { key: 'fixedExpenses',       label: 'Fixed Expenses' },
  { key: 'livingExpenses',      label: 'Living Expenses' },
  { key: 'businessExpenses',    label: 'Business Expenses' },
  { key: 'savingsAccumulation', label: 'Savings & Accumulation' },
  { key: 'miscellaneous',       label: 'Miscellaneous' },
];

const CURRENT_YEAR = new Date().getFullYear();

function AccordionGroup({ label }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-12 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors min-h-[44px]"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          size={16}
          className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 text-sm text-ink-muted border-t border-border">
          Line-item entry coming in G3.
        </div>
      )}
    </div>
  );
}

export default function MoneyNeedsPanel() {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;

  const [year, setYear]         = useState(CURRENT_YEAR);
  const [doc, setDoc]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getMoneyNeeds(tenantId, uid, year);
      setDoc(result);
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
      setDoc(result);
    } catch {
      setError('Could not create worksheet. Check your connection and try again.');
    } finally {
      setCreating(false);
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
      {!loading && !doc && (
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

      {/* Worksheet shell — 5 accordion groups */}
      {!loading && doc && (
        <div className="space-y-2">
          <div className="rounded-xl bg-card border border-border px-4 py-3 mb-2">
            <p className="text-xs text-ink-muted">
              Visibility: <span className="font-semibold text-ink">
                {doc.visibility === 'private' ? 'Private (only you)' : 'Shared'}
              </span>
              {' · '}Sharing controls coming in G5.
            </p>
          </div>
          {EXPENSE_GROUPS.map(({ key, label }) => (
            <AccordionGroup key={key} label={label} />
          ))}
        </div>
      )}
    </div>
  );
}
