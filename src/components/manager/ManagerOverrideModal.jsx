import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, CheckSquare, Square, Trash2 } from 'lucide-react';
import {
  getManagerActivityStandardOverride,
  setManagerActivityStandardOverride,
  clearManagerActivityStandardOverride,
} from '../../services/managerStandardOverrideService';
import { NUMERIC_STANDARDS, BOOLEAN_STANDARDS } from '../../services/managerActivityStandardsService';

const NUMERIC_LABELS = {
  jfwCount:             'Joint Field Work (JFW)',
  oneOnOnesConducted:   'One-on-One Pipeline Reviews',
  namesSourced:         'Names Sourced',
  interviewsConducted:  'Initial Interviews Conducted',
  recruitsInFirstWeeks: 'New Recruits in First Weeks',
  trainingSessions:     'Training Sessions Delivered',
};

const BOOLEAN_LABELS = {
  unitMeetingHeld:     'Unit / Branch Meeting Held',
  dashboardReviewDone: 'Planning & Dashboard Review Done',
};

function emptyForm() {
  const form = {};
  NUMERIC_STANDARDS.forEach((f) => { form[f] = ''; });
  BOOLEAN_STANDARDS.forEach((f) => { form[f] = false; });
  return form;
}

function fromOverrideDoc(overrideDoc) {
  const form = emptyForm();
  NUMERIC_STANDARDS.forEach((f) => {
    const v = overrideDoc?.[f];
    form[f] = (v != null && v !== '') ? String(v) : '';
  });
  BOOLEAN_STANDARDS.forEach((f) => {
    form[f] = Boolean(overrideDoc?.[f]);
  });
  return form;
}

function toPayload(form) {
  const payload = {};
  NUMERIC_STANDARDS.forEach((f) => {
    const parsed = parseFloat(form[f]);
    if (Number.isFinite(parsed) && parsed >= 0) payload[f] = parsed;
  });
  BOOLEAN_STANDARDS.forEach((f) => {
    if (form[f] === true) payload[f] = true;
  });
  return payload;
}

function focusableWithin(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(
    'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  ));
}

export default function ManagerOverrideModal({
  tenantId,
  managerId,
  managerName,
  currentUid,
  onClose,
  onSaved,
}) {
  const [form,        setForm]        = useState(emptyForm);
  const [loadingDoc,  setLoadingDoc]  = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [clearing,    setClearing]    = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  const modalRef   = useRef(null);
  const triggerRef = useRef(null);
  const headingId  = 'manager-override-modal-heading';

  // Load existing overrides on mount.
  useEffect(() => {
    if (!tenantId || !managerId) return;
    getManagerActivityStandardOverride(tenantId, managerId)
      .then((doc) => setForm(fromOverrideDoc(doc)))
      .catch(() => setForm(emptyForm()))
      .finally(() => setLoadingDoc(false));
  }, [tenantId, managerId]);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const items = focusableWithin(modalRef.current);
    if (items.length > 0) items[0].focus();
    return () => { triggerRef.current?.focus?.(); };
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { if (!saving && !clearing) onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusableWithin(modalRef.current);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving, clearing]);

  function handleNumericChange(field, value) {
    const clean = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setForm((prev) => ({ ...prev, [field]: clean }));
    if (saveError) setSaveError(null);
  }

  function handleBooleanToggle(field) {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
    if (saveError) setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = toPayload(form);
      await setManagerActivityStandardOverride(tenantId, managerId, payload, currentUid);
      onSaved?.();
      onClose();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to set custom standards.";
      } else if (['unavailable', 'deadline-exceeded', 'cancelled'].includes(code)) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else {
        message = err?.message ?? 'Save failed. Please try again.';
      }
      setSaveError(message);
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setSaveError(null);
    try {
      await clearManagerActivityStandardOverride(tenantId, managerId);
      onSaved?.();
      onClose();
    } catch (err) {
      setSaveError(err?.message ?? 'Clear failed. Please try again.');
      setClearing(false);
    }
  }

  const busy = saving || clearing || loadingDoc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 shrink-0">
          <div>
            <h2 id={headingId} className="text-lg font-bold text-ink">
              Custom standards for {managerName}
            </h2>
            <p className="text-sm text-ink-muted mt-0.5">
              Override the org-default targets for this manager. Leave blank to use the org default.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form area */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loadingDoc ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-muted" aria-label="Loading current overrides" />
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-muted">Numeric: weekly count. Blank = use org default.</p>

              {NUMERIC_STANDARDS.map((field) => (
                <div key={field} className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={`ovr-${field}`}
                    className="text-sm font-medium text-ink flex-1"
                  >
                    {NUMERIC_LABELS[field]}
                  </label>
                  <input
                    id={`ovr-${field}`}
                    type="text"
                    inputMode="numeric"
                    value={form[field]}
                    onChange={(e) => handleNumericChange(field, e.target.value)}
                    disabled={busy}
                    placeholder="—"
                    aria-label={`${NUMERIC_LABELS[field]} override`}
                    className="w-20 h-11 px-3 rounded-lg bg-card border border-border text-ink text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  />
                </div>
              ))}

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs text-ink-muted">Boolean: on = expected this week.</p>
                {BOOLEAN_STANDARDS.map((field) => (
                  <button
                    key={field}
                    type="button"
                    role="checkbox"
                    aria-checked={form[field]}
                    onClick={() => handleBooleanToggle(field)}
                    disabled={busy}
                    aria-label={`${BOOLEAN_LABELS[field]} override`}
                    className="flex items-center gap-3 w-full text-left min-h-[44px] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
                  >
                    <span className="text-primary shrink-0" aria-hidden="true">
                      {form[field] ? <CheckSquare size={20} /> : <Square size={20} />}
                    </span>
                    <span className="text-sm font-medium text-ink">{BOOLEAN_LABELS[field]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 shrink-0 space-y-3">
          {saveError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" aria-hidden="true" /><span>Saving…</span></>
            ) : (
              <span>Save custom standards</span>
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="w-full h-11 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 rounded-lg transition-colors"
          >
            {clearing ? (
              <><Loader2 size={14} className="animate-spin" aria-hidden="true" /><span>Clearing…</span></>
            ) : (
              <><Trash2 size={14} aria-hidden="true" /><span>Clear all overrides (revert to org defaults)</span></>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full h-11 text-center text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
