import React, { useState, useMemo } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  APPOINTMENT_TYPES, FREE_BLOCK_LABELS,
} from '../../services/plannerService';

/**
 * AppointmentSheet — add / edit an appointment (screen 4). Mobile bottom-sheet ↔
 * desktop centered dialog (§4 dialog contract via useFocusTrap: focus-return,
 * Escape, 44px close). "Save & add another" keeps the sheet open for rapid
 * phone-day booking (create mode only).
 *
 * Owns local form state; the parent owns the Firestore write (via onSave) and
 * passes `saving` / `error`. On a bad write the parent keeps the sheet open and
 * sets `error` — an inline role=alert card renders below the actions.
 */
export default function AppointmentSheet({
  mode = 'create',
  initial = null,
  prospects = [],
  saving = false,
  error = '',
  onSave,
  onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });

  const [type, setType]           = useState(initial?.type ?? 'PC');
  const [date, setDate]           = useState(initial?.date ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [durationMin, setDuration] = useState(String(initial?.durationMin ?? 30));
  const [prospectId, setProspectId] = useState(initial?.prospectId ?? '');
  const [freeBlockLabel, setFreeLabel] = useState(initial?.freeBlockLabel ?? FREE_BLOCK_LABELS[0]);
  const [note, setNote]           = useState(initial?.note ?? '');
  const [apiAmount, setApiAmount] = useState(
    initial?.apiAmount != null ? String(initial.apiAmount) : '');
  const [prospectQuery, setProspectQuery] = useState('');

  const isFree = type === 'FREE';
  const showApi = type === 'SALE' || type === 'CI';

  const filteredProspects = useMemo(() => {
    const q = prospectQuery.trim().toLowerCase();
    const list = q
      ? prospects.filter((p) => (p.clientName || '').toLowerCase().includes(q))
      : prospects;
    return list.slice(0, 8);
  }, [prospects, prospectQuery]);

  const selectedProspect = prospects.find((p) => p.id === prospectId) || null;

  const buildData = () => ({
    type, date, startTime, durationMin, note,
    prospectId: isFree ? '' : prospectId,
    freeBlockLabel: isFree ? freeBlockLabel : '',
    apiAmount: showApi ? apiAmount : null,
  });

  const canSave = Boolean(date && startTime && durationMin);

  const handleSave = (addAnother) => {
    if (!canSave || saving) return;
    onSave(buildData(), addAnother);
    if (addAnother) {
      // Keep type/date; reset the per-appointment fields for the next slot.
      setProspectId('');
      setProspectQuery('');
      setNote('');
      setApiAmount('');
    }
  };

  const titleId = 'appt-sheet-title';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="appointment-sheet"
        className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-lg max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border/60">
          <h2 id={titleId} className="text-base font-bold text-ink">
            {mode === 'edit' ? 'Edit appointment' : 'Book appointment'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Type picker */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">
              Activity type
            </span>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Activity type">
              {APPOINTMENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  aria-pressed={type === t.key}
                  className={`min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                      : 'bg-card-raised border-border text-ink-muted hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prospect search OR free-block label */}
          {isFree ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-free-label" className="text-sm font-medium text-ink">Free block</label>
              <select
                id="appt-free-label"
                value={freeBlockLabel}
                onChange={(e) => setFreeLabel(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {FREE_BLOCK_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-prospect-search" className="text-sm font-medium text-ink">
                Prospect <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              {selectedProspect ? (
                <div className="flex items-center justify-between gap-2 h-11 px-3 rounded-lg bg-primary/5 border border-primary/30">
                  <span className="text-sm font-semibold text-ink truncate">{selectedProspect.clientName}</span>
                  <button
                    type="button"
                    onClick={() => { setProspectId(''); setProspectQuery(''); }}
                    className="text-xs font-semibold text-primary hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center h-11 px-3 rounded-lg bg-surface border border-border focus-within:ring-2 focus-within:ring-primary/40">
                    <Search size={15} className="text-ink-muted shrink-0" aria-hidden="true" />
                    <input
                      id="appt-prospect-search"
                      type="text"
                      value={prospectQuery}
                      onChange={(e) => setProspectQuery(e.target.value)}
                      placeholder={prospects.length ? 'Search your prospects…' : 'No prospects loaded'}
                      className="flex-1 ml-2 bg-transparent text-ink text-base focus:outline-none"
                    />
                  </div>
                  {prospectQuery.trim() && filteredProspects.length > 0 && (
                    <ul className="mt-1 rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
                      {filteredProspects.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setProspectId(p.id); setProspectQuery(''); }}
                            className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-ink hover:bg-surface transition-colors"
                          >
                            {p.clientName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* Date + time + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-date" className="text-sm font-medium text-ink">Date</label>
              <input
                id="appt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-time" className="text-sm font-medium text-ink">Start time</label>
              <input
                id="appt-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="appt-duration" className="text-sm font-medium text-ink">Length (minutes)</label>
            <select
              id="appt-duration"
              value={durationMin}
              onChange={(e) => setDuration(e.target.value)}
              className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>

          {/* API (for SALE / CI conversions) */}
          {showApi && (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-api" className="text-sm font-medium text-ink">
                API written <span className="text-ink-muted font-normal">(TTD, optional)</span>
              </label>
              <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
                <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">TTD</span>
                <input
                  id="appt-api"
                  type="text"
                  inputMode="decimal"
                  value={apiAmount}
                  onChange={(e) => setApiAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="flex-1 px-2 bg-transparent text-ink text-base text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div className="flex flex-col gap-1">
            <label htmlFor="appt-note" className="text-sm font-medium text-ink">
              Note <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="appt-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Anything to remember…"
              className="px-3 py-2 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2">
              <p className="text-sm text-danger-ink">{error}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 z-10 flex items-center gap-2 px-4 py-3 bg-card border-t border-border/60">
          {mode === 'create' && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={!canSave || saving}
              data-testid="appt-save-another"
              className="flex-1 min-h-[44px] rounded-xl border border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              Save &amp; add another
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!canSave || saving}
            data-testid="appt-save"
            className="flex-1 min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
