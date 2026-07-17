import React, { useState } from 'react';
import { X, Loader2, CalendarDays, Minus, Plus, AlertTriangle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

// R6 (operator-locked): a bulk op over this many appointments requires an
// explicit acknowledgement tick before the primary action enables.
export const BULK_CAP_WARN = 200;

// Clamp for the ±days stepper — a week-scoped planner never needs more.
const SHIFT_LIMIT = 30;

/**
 * BulkCapWarning — shared R6 fence for the bulk sheets. Renders the amber
 * "You're changing N appointments" panel + the required acknowledgement
 * checkbox (data-testid="bulk-cap-ack"). Only mounted when count > cap, so
 * the testid is a reliable presence signal for the gate.
 */
export function BulkCapWarning({ count, acked, onAckChange }) {
  return (
    <div className="rounded-xl bg-warning/10 border border-warning/40 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-warning-ink shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold text-warning-ink">
          You&rsquo;re changing {count} appointments
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => onAckChange(e.target.checked)}
          data-testid="bulk-cap-ack"
          className="w-5 h-5 rounded border-border accent-[var(--color-primary)]"
        />
        I understand — apply to all {count}
      </label>
    </div>
  );
}

/**
 * BulkMoveSheet — Run 9 A5 bulk move. Two modes via radio:
 *  - 'set':   one date input; every selected appointment moves to that date.
 *  - 'shift': a ±N days stepper; every selected appointment shifts relative
 *             to its OWN current date.
 * Update-in-place (doc ids preserved) — the parent maps the choice into
 * per-doc { date } patches through bulkUpdateAppointments. R6: over
 * BULK_CAP_WARN selections, the amber warning + acknowledgement checkbox
 * gate the Apply button.
 */
export default function BulkMoveSheet({
  count,
  defaultDate = '',
  saving = false,
  onApply,
  onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const [mode, setMode] = useState('set'); // 'set' | 'shift'
  const [date, setDate] = useState(defaultDate);
  const [shiftDays, setShiftDays] = useState(1);
  const [capAck, setCapAck] = useState(false);

  const overCap = count > BULK_CAP_WARN;
  const modeValid = mode === 'set'
    ? /^\d{4}-\d{2}-\d{2}$/.test(date)
    : shiftDays !== 0;
  const canApply = modeValid && !saving && count > 0 && (!overCap || capAck);

  const step = (delta) => {
    setShiftDays((d) => Math.max(-SHIFT_LIMIT, Math.min(SHIFT_LIMIT, d + delta)));
  };

  const handleApply = () => {
    if (!canApply) return;
    onApply(mode === 'set' ? { mode, date } : { mode, shiftDays });
  };

  const titleId = 'bulk-move-title';
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="bulk-move-sheet"
        className="relative w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-ink">
              Move {count} {count === 1 ? 'appointment' : 'appointments'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode choice. Each row is a div (NOT a wrapping <label>) because the
            rows contain their own interactive controls (date input, stepper
            buttons) — nesting those inside a label would make every tap also
            hit the radio. The radio associates with its title via htmlFor. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">How to move</legend>
          <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors min-h-[44px] ${
            mode === 'set' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
          }`}>
            <input
              type="radio"
              id="bulk-move-mode-set"
              name="bulk-move-mode"
              value="set"
              checked={mode === 'set'}
              onChange={() => setMode('set')}
              data-testid="bulk-move-mode-set"
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span className="flex-1 min-w-0">
              <label htmlFor="bulk-move-mode-set" className="block text-sm font-semibold text-ink cursor-pointer">
                Set same date for all
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onFocus={() => setMode('set')}
                disabled={saving}
                aria-label="New date"
                data-testid="bulk-move-date"
                className="mt-2 h-11 w-full px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </span>
          </div>

          <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors min-h-[44px] ${
            mode === 'shift' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
          }`}>
            <input
              type="radio"
              id="bulk-move-mode-shift"
              name="bulk-move-mode"
              value="shift"
              checked={mode === 'shift'}
              onChange={() => setMode('shift')}
              data-testid="bulk-move-mode-shift"
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span className="flex-1 min-w-0">
              <label htmlFor="bulk-move-mode-shift" className="block text-sm font-semibold text-ink cursor-pointer">
                Shift each by ±N days
              </label>
              <span className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('shift'); step(-1); }}
                  disabled={saving}
                  aria-label="Shift one day earlier"
                  data-testid="bulk-move-shift-minus"
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-border text-ink hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span
                  data-testid="bulk-move-shift-value"
                  aria-live="polite"
                  className="flex-1 text-center text-sm font-bold tabular-nums text-ink"
                >
                  {shiftDays > 0 ? `+${shiftDays}` : shiftDays} {Math.abs(shiftDays) === 1 ? 'day' : 'days'}
                </span>
                <button
                  type="button"
                  onClick={() => { setMode('shift'); step(1); }}
                  disabled={saving}
                  aria-label="Shift one day later"
                  data-testid="bulk-move-shift-plus"
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-border text-ink hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </span>
            </span>
          </div>
        </fieldset>

        {overCap && <BulkCapWarning count={count} acked={capAck} onAckChange={setCapAck} />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl border border-border text-ink font-semibold text-sm hover:bg-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            data-testid="bulk-move-apply"
            className="flex-1 min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Moving…</> : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
