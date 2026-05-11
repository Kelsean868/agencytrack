// E3 — Persistency entry form (modal).
//
// Six TTD inputs; gross/net/persistency derived live via calculations.js.
// Save calls persistencyService.savePersistency() which writes the doc with
// audit trail (enteredAt/By/ByRole + lastEditedAt/By/ByRole) and the derived
// fields (grossSettled, netSettled, persistency, meetsAwardGate).

import React, { useMemo, useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
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

export default function PersistencyEntryForm({
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
    e.preventDefault();
    if (!validation.ok) {
      setError(validation.msg);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await savePersistency(monthKey, agentUid, numericInputs, writerRole);
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
      aria-label={`Edit persistency for ${agentName} — ${monthKey}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="persistency-entry-form"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-auto bg-card rounded-2xl shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Persistency · {monthKey}
            </p>
            <p className="text-base font-semibold text-ink">{agentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
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
              <span className="text-xs text-ink-muted">{f.help}</span>
            </div>
          ))}
        </div>

        {/* Live derived preview */}
        <div className="mx-4 mb-4 p-3 rounded-xl bg-card-raised flex flex-col gap-2" data-testid="persistency-derived-preview">
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
            <p className="text-xs text-success font-semibold">Meets 90% award gate</p>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-card-raised transition-colors"
          >
            Cancel
          </button>
          <SaveButton
            onClick={handleSubmit}
            saving={saving}
            disabled={!validation.ok}
            label="Save"
            icon={<Save size={14} />}
          />
        </div>
      </form>
    </div>
  );
}
