import { useState, useRef, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { setCompanyMinimums } from '../../services/goalsService';
import { formatCurrency } from '../../utils/formatters';

/**
 * Edit Company Configuration modal (Design System v2 — B5).
 *
 * A11y contract:
 *   - role="dialog" + aria-modal="true" + aria-labelledby
 *   - First focusable element receives focus on open
 *   - Focus trap: Tab/Shift+Tab cycle stays within the modal
 *   - Escape cancels (when not saving)
 *   - Returns focus to the trigger element on close
 *   - aria-describedby on input → help text + error region
 *   - aria-invalid on input + role="alert" + aria-live="polite" on error
 *   - Reduced-motion guard via motion-safe: prefix on the backdrop transition
 *
 * Write-path discipline (per B5 plan §Write-path discipline gate):
 *   - Pre-write read seeds the form: parent passes the current annualAPI as a
 *     prop after a fresh getCompanyMinimums() call. No blind writes.
 *   - Save button disables on click + spinner.
 *   - Modal closes ONLY on write success (no optimistic UI).
 *   - On failure, modal stays open and surfaces a specific error message.
 *   - Error mapping: Firestore code → user-visible copy. Validation errors
 *     thrown by setCompanyMinimums propagate as plain Error.message.
 *
 * Currency UX (per Kyron's instruction note):
 *   - Raw numeric input — no during-typing formatting.
 *   - Formatted preview below: "Currently: TTD X / New: TTD {parsed}".
 */
const MAX_API = 10000000;

function focusableWithin(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(
    'button:not([disabled]):not([aria-hidden="true"]),' +
    '[href],' +
    'input:not([disabled]),' +
    'select:not([disabled]),' +
    'textarea:not([disabled]),' +
    '[tabindex]:not([tabindex="-1"])'
  ));
}

export default function EditConfigModal({
  tenantId,
  currentAnnualAPI,
  currentUid,
  onClose,
  onSaved,
}) {
  const [value, setValue] = useState(String(currentAnnualAPI ?? ''));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const headingId = 'edit-config-modal-heading';
  const helpId = 'edit-config-modal-help';
  const errorId = 'edit-config-modal-field-error';

  // Capture trigger + focus first focusable on open. Restore focus on close.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const items = focusableWithin(modalRef.current);
    if (items.length > 0) items[0].focus();

    return () => {
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, []);

  // Focus trap + Escape handler.
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (!saving) onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusableWithin(modalRef.current);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  const validationError = useMemo(() => {
    if (!touched) return null;
    if (value.trim() === '') return 'Required field.';
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return 'Must be a number.';
    if (parsed <= 0) return 'Must be a positive number.';
    if (parsed > MAX_API) return `Must be at most ${formatCurrency(MAX_API)}.`;
    return null;
  }, [value, touched]);

  const parsedValue = parseFloat(value);
  const hasUsableValue = Number.isFinite(parsedValue) && parsedValue > 0;
  const newValueDisplay = hasUsableValue ? formatCurrency(parsedValue) : '—';
  const currentDisplay = formatCurrency(currentAnnualAPI ?? 0);
  const noChange = hasUsableValue && parsedValue === currentAnnualAPI;
  const canSave = !saving && !validationError && hasUsableValue && !noChange;

  function handleChange(e) {
    // Strip everything except digits and a single decimal point.
    const next = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setValue(next);
    setTouched(true);
    if (submitError) setSubmitError(null);
  }

  async function handleSave() {
    setTouched(true);
    if (validationError || !hasUsableValue) return;

    setSaving(true);
    setSubmitError(null);

    try {
      await setCompanyMinimums(tenantId, { annualAPI: parsedValue }, currentUid);
      onSaved?.(parsedValue);
      onClose();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to update company config. Contact your platform admin.";
      } else if (
        code === 'unavailable' ||
        code === 'deadline-exceeded' ||
        code === 'cancelled'
      ) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else if (code === 'aborted' || code === 'failed-precondition') {
        message = 'Someone else just updated this. Refresh to see the latest.';
      } else if (err?.message) {
        message = err.message;
      } else {
        message = 'Save failed. Please try again.';
      }
      setSubmitError(message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-md p-6 border border-border"
      >
        <div className="flex items-start justify-between mb-1 gap-4">
          <h2 id={headingId} className="text-lg font-bold text-ink">Edit company minimum</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p id={helpId} className="text-sm text-ink-muted mb-5">
          Minimum annual API per agent, in TTD. All personal commitments must meet this floor.
        </p>

        <div className="mb-4">
          <label
            htmlFor="annualAPI"
            className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2"
          >
            Annual API (TTD)
          </label>
          <input
            id="annualAPI"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            disabled={saving}
            autoComplete="off"
            aria-describedby={validationError ? `${helpId} ${errorId}` : helpId}
            aria-invalid={validationError ? true : undefined}
            className="w-full h-11 px-3 rounded-lg border border-border bg-card text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          />
          {validationError && (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        <div className="mb-5 p-3 rounded-lg bg-card border border-border text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-muted">Currently</span>
            <span className="font-semibold text-ink">{currentDisplay}</span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-1">
            <span className="text-ink-muted">New</span>
            <span className="font-semibold text-primary">{newValueDisplay}</span>
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn-primary w-full mb-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Saving…</span>
            </>
          ) : (
            <span>Save changes</span>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="w-full h-11 text-center text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
