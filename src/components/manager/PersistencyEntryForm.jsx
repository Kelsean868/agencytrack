// Persistency Manager v2 S2 — entry drawer restyle.
// Mechanics (savePersistency call + payload fields + derivation) are untouched per D1.
// Layout change only: full-screen modal → right-side drawer with gold precedence banner.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { savePersistency } from '../../services/persistencyService';
import { deriveAll } from '../../lib/persistency/calculations';
import { formatCurrency } from '../../utils/formatters';

const FIELDS = [
  { id: 'businessPlaced',  label: 'Business Placed',          help: 'Total new business placed during the 12-month period.' },
  { id: 'notTakens',       label: 'Not Takens',               help: 'Business reversed by the client before in-force.' },
  { id: 'incPPPs',         label: '12-Month Inc PPPs',        help: 'Premium Payment Plan increases over the period.' },
  { id: 'lumpsums100',     label: 'Lumpsums (100%)',          help: 'Total face-value lumpsums; the calculation applies 10%.' },
  { id: 'lapses',          label: 'Lapses',                   help: 'Business that lapsed during the period.' },
  { id: 'reinstatements',  label: 'Reinstatements',           help: 'Lapsed business reinstated during the period.' },
];

function emptyInputs() {
  return FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {});
}

function loadInitial(record) {
  if (!record) return emptyInputs();
  const out = emptyInputs();
  for (const f of FIELDS) {
    const v = record[f.id];
    out[f.id] = v == null ? '' : String(v);
  }
  return out;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
}

export default function PersistencyEntryForm({
  tenantId,
  monthKey,
  agentUid,
  agentName,
  existingRecord,
  writerRole,
  onClose,
  onSaved,
}) {
  const [inputs, setInputs] = useState(() => loadInitial(existingRecord));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey]);

  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const numericInputs = useMemo(() => {
    const parsed = {};
    for (const f of FIELDS) {
      const n = parseFloat(inputs[f.id]);
      parsed[f.id] = Number.isFinite(n) ? n : 0;
    }
    return parsed;
  }, [inputs]);

  const derived = useMemo(() => deriveAll(numericInputs), [numericInputs]);

  const validation = useMemo(() => {
    for (const f of FIELDS) {
      const raw = inputs[f.id];
      if (raw === '') return { ok: false, field: f.id, msg: 'Required' };
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, field: f.id, msg: 'Must be a non-negative number' };
      }
    }
    return { ok: true };
  }, [inputs]);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!validation.ok) {
      setError(validation.msg);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await savePersistency(tenantId, monthKey, agentUid, numericInputs, writerRole);
      onSaved();
    } catch (err) {
      setError(err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Enter persistency for ${agentName} — ${monthKey}`}
      data-testid="persistency-entry-form"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/20"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <form
        onSubmit={handleSubmit}
        className="fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 bg-card shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="h-9 w-9 rounded-full bg-primary/15 dark:bg-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary dark:text-primary-dark select-none">
            {agentName ? agentName.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase() : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Enter persistency · {monthKey}
            </p>
            <p className="text-base font-semibold text-ink truncate">{agentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          {/* Gold precedence banner */}
          <div className="flex gap-2.5 p-3 rounded-xl bg-gold-tint" data-testid="pers-precedence-banner">
            <Lock size={14} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-gold leading-snug">
              <strong>Saving locks {monthLabel} for {agentName}.</strong>{' '}
              Your figures override their self-entry; they&apos;ll see this month <strong>read-only</strong>.
            </p>
          </div>

          {/* Six inputs — 2-column grid */}
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.id} className="flex flex-col gap-1">
                <label htmlFor={`pers-${f.id}`} className="text-xs font-semibold text-ink">
                  {f.label} <span className="text-ink-muted font-normal">(TTD)</span>
                </label>
                <input
                  id={`pers-${f.id}`}
                  data-testid={`persistency-input-${f.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs[f.id]}
                  onChange={(e) => setInputs({ ...inputs, [f.id]: e.target.value })}
                  className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
                <span className="text-xs text-ink-muted leading-tight">{f.help}</span>
              </div>
            ))}
          </div>

          {/* Live derived preview */}
          <div
            className="p-3 rounded-xl bg-primary/10 flex flex-col gap-2"
            data-testid="persistency-derived-preview"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Derived</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-ink-muted">Gross Settled</p>
                <p className="font-semibold text-ink" data-testid="derived-gross">{formatCurrency(derived.grossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Net Settled</p>
                <p className="font-semibold text-ink" data-testid="derived-net">{formatCurrency(derived.netSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Persistency</p>
                <p className="font-semibold text-ink" data-testid="derived-persistency">
                  {(derived.persistency * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {derived.persistency >= 0.90 && (
              <p className="text-xs text-success-ink font-semibold">Meets 90% award gate</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-card-raised transition-colors"
          >
            Cancel
          </button>
          <SaveButton
            onClick={handleSubmit}
            saving={saving}
            disabled={!validation.ok}
            label={`🔒 Save & lock ${monthLabel}`}
            savingLabel="Saving…"
          />
        </div>
      </form>
    </div>
  );
}
