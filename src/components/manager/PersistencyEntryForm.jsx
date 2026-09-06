// Persistency Manager v2 S2 — entry drawer restyle.
// Mechanics (savePersistency call + payload fields + derivation) are untouched per D1.
// Layout change only: full-screen modal → right-side drawer with gold precedence banner.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { savePersistency } from '../../services/persistencyService';
import { deriveAll } from '../../lib/persistency/calculations';
import { persistencyModelFor } from '../../lib/persistency/model';
import { formatCurrency } from '../../utils/formatters';

// Which inputs this form shows is decided by the report month, not by a prop:
// six on the legacy model, seven (adding `decreases`) from September 2026.
// Labels come from the model too — see lib/persistency/model.js, which is also
// where the memo-vs-stored-id name collisions are documented.
//
// `{N}` interpolates the model's window length so the help copy cannot drift
// out of step with the window the period is actually reckoned over.
const HELP_BY_ID = {
  businessPlaced: 'Total new business placed during the {N}-month period.',
  notTakens:      'Business reversed by the client before in-force.',
  decreases:      'Premium decreases on policies within the 24-month window.',
  incPPPs:        'Premium Payment Plan increases over the period.',
  lumpsums100:    'Total face-value lumpsums; the calculation applies 10%.',
  lapses:         'Business that lapsed during the period.',
  reinstatements: 'Lapsed business reinstated during the period.',
};

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

// persistencyModelFor throws on a malformed monthKey (deliberately — a silent
// fallback on a money surface would render a plausible wrong form). This form is
// always mounted with a real month, so the null here is a render guard, not a
// fallback model: no month, no form, rather than the wrong month's fields.
function modelOrNull(monthKey) {
  return MONTH_KEY_RE.test(String(monthKey)) ? persistencyModelFor(monthKey) : null;
}

function fieldsForModel(model) {
  if (!model) return [];
  return model.inputs.map((id) => ({
    id,
    label: model.labels[id],
    help:  HELP_BY_ID[id].replace('{N}', String(model.windowMonths)),
  }));
}

function emptyInputs(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {});
}

function loadInitial(record, fields) {
  if (!record) return emptyInputs(fields);
  const out = emptyInputs(fields);
  for (const f of fields) {
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
  const model  = useMemo(() => modelOrNull(monthKey), [monthKey]);
  const fields = useMemo(() => fieldsForModel(model), [model]);

  const [inputs, setInputs] = useState(() => loadInitial(existingRecord, fieldsForModel(modelOrNull(monthKey))));
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
    for (const f of fields) {
      const n = parseFloat(inputs[f.id]);
      parsed[f.id] = Number.isFinite(n) ? n : 0;
    }
    return parsed;
  }, [inputs, fields]);

  const derived = useMemo(() => deriveAll(numericInputs), [numericInputs]);

  const validation = useMemo(() => {
    for (const f of fields) {
      const raw = inputs[f.id];
      if (raw === '') return { ok: false, field: f.id, msg: `${f.label} is required` };
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, field: f.id, msg: `${f.label} must be a non-negative number` };
      }
    }
    return { ok: true };
  }, [inputs, fields]);

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

  // AFTER every hook, so the hook order never varies. No month → no form; the
  // alternative would be guessing a model and rendering the wrong month's fields.
  if (!model) return null;

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
          <div className="h-9 w-9 rounded-full bg-primary/15 dark:bg-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary select-none">
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
            <Lock size={14} className="text-gold-ink shrink-0 mt-0.5" />
            <p className="text-sm text-gold-ink leading-snug">
              <strong>Saving locks {monthLabel} for {agentName}.</strong>{' '}
              Your figures override their self-entry; they&apos;ll see this month <strong>read-only</strong>.
            </p>
          </div>

          {/* Model inputs — 2-column grid. Six on the legacy model, seven from
              September 2026 (the memo's `decreases`). */}
          <div className="grid grid-cols-2 gap-3" data-testid={`persistency-inputs-${model.id}`}>
            {fields.map((f) => (
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
                <p className="text-ink-muted">{model.labels.grossSettled}</p>
                <p className="font-semibold text-ink" data-testid="derived-gross">{formatCurrency(derived.grossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">{model.labels.netSettled}</p>
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
