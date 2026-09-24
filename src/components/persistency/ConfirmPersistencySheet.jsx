import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

import { savePersistency } from '../../services/persistencyService';
import { deriveAll } from '../../lib/persistency/calculations';
import { persistencyModelFor } from '../../lib/persistency/model';
import { applicableManualInputs, manualGate, manualConfirmationFields, importProvenanceLabel } from '../../lib/persistency/ledgerPrefill';
import { PERSISTENCY_LEDGER_WINDOW_MONTHS } from '../../lib/persistency/deriveFromLedger';
import { HO_CONFIRMED_SOURCE, formatOutlookPct } from '../../lib/persistency/persistencyOutlook';
import { outlookMonthLabel } from './outlookLabels';

/**
 * ConfirmPersistencySheet — the agent says the derived month matches the
 * head-office report, and it becomes a saved record.
 *
 * ONE CHOICE ONLY. The brief's second choice ("HO report says __%") would save
 * a head-office percentage on its own, and `firestore.rules` requires the six
 * money inputs on every persistency document. That needs a rules decision, so it
 * is not offered here. A different HO figure is entered through Self-entry.
 *
 * The four inputs the export does not carry are asked for again, with the same
 * gate the entry form uses: zero is an answer, blank is not.
 */
export default function ConfirmPersistencySheet({
  tenantId, agentUid, writerUid, writerRole, derived, onClose, onSaved,
}) {
  const monthKey = derived?.monthKey;
  const manualFields = useMemo(() => (monthKey ? applicableManualInputs(monthKey) : []), [monthKey]);
  const labels = useMemo(() => (monthKey ? persistencyModelFor(monthKey).labels : {}), [monthKey]);

  const [values, setValues] = useState(() => Object.fromEntries(manualFields.map((id) => [id, ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const gate = manualGate(values, monthKey);

  const numericInputs = useMemo(() => {
    if (!derived) return null;
    const out = {
      businessPlaced: derived.inputs.businessPlaced,
      notTakens: derived.inputs.notTakens,
      lapses: derived.inputs.lapses,
    };
    for (const id of manualFields) out[id] = Number.parseFloat(values[id]);
    return out;
  }, [derived, manualFields, values]);

  const willSave = gate.canSave && numericInputs ? deriveAll(numericInputs).persistency : null;

  if (!derived) return null;

  const handleSave = async () => {
    if (!gate.canSave) {
      setError(gate.blockMessage);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const uid = writerUid ?? agentUid;
      const now = new Date().toISOString();
      await savePersistency(tenantId, monthKey, agentUid, numericInputs, writerRole, {
        ...manualConfirmationFields({ uid, now }),
        ledgerDerived: true,
        ledgerExportDate: derived.exportDate ?? null,
        annuityMissedPremiumRule: derived.annuityMissedPremiumRule,
        ledgerWindowMonths: PERSISTENCY_LEDGER_WINDOW_MONTHS,
        source: HO_CONFIRMED_SOURCE,
        confirmedBy: uid,
        confirmedAt: now,
      });
      onSaved?.();
    } catch (err) {
      setError(err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Confirm ${outlookMonthLabel(monthKey)} persistency`} data-testid="confirm-persistency-sheet">
      <div className="fixed inset-0 z-40 bg-ink/20" aria-hidden="true" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Confirm against the HO report</p>
            <p className="text-base font-semibold text-ink">{outlookMonthLabel(monthKey)} · {formatOutlookPct(derived.persistency)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <p className="text-sm text-ink">
            Check this month on your head-office persistency report. If it matches, save it here as your confirmed figure.
          </p>
          <p className="text-xs text-ink-muted">
            {importProvenanceLabel(derived.exportDate) ?? 'From portfolio import'} · {derived.annuityRuleLabel}
          </p>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">The figures the export does not have</p>
            <p className="text-xs text-ink-muted">Enter each one from the HO report. Zero is a valid answer; blank is not.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {manualFields.map((id) => (
              <div key={id} className="flex flex-col gap-1">
                <label htmlFor={`confirm-${id}`} className="text-xs font-semibold text-ink">
                  {labels[id] ?? id} <span className="text-ink-muted font-normal">(TTD)</span>
                </label>
                <input
                  id={`confirm-${id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={values[id]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [id]: e.target.value }))}
                  className="min-h-[44px] px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid={`confirm-input-${id}`}
                />
              </div>
            ))}
          </div>

          {willSave != null && (
            <p className="text-sm text-ink" data-testid="confirm-will-save">
              Will save <strong>{formatOutlookPct(willSave)}</strong> for {outlookMonthLabel(monthKey)}.
            </p>
          )}
          {!gate.canSave && (
            <p className="text-xs text-warning-ink font-semibold" data-testid="confirm-block-message">{gate.blockMessage}</p>
          )}
          <p className="text-xs text-ink-muted">
            HO report shows a different figure? Close this and enter the month through Self-entry instead.
          </p>

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-border flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-card-raised transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!gate.canSave || saving}
            className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60"
            data-testid="confirm-matches-button"
          >
            <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Matches the HO report'}
          </button>
        </div>
      </div>
    </div>
  );
}
