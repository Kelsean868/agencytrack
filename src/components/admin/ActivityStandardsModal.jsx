import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, CheckSquare, Square } from 'lucide-react';
import { setManagerActivityStandards, NUMERIC_STANDARDS, BOOLEAN_STANDARDS } from '../../services/managerActivityStandardsService';

const ROLE_TABS = [
  { key: 'unit_manager',    label: 'Unit Managers' },
  { key: 'branch_manager',  label: 'Branch Managers' },
  { key: 'sales_manager',   label: 'Sales Managers' },
];

const NUMERIC_LABELS = {
  jfwCount:             'Joint Field Work (JFW)',
  oneOnOnesConducted:   'One-on-One Pipeline Reviews',
  namesSourced:         'Names Sourced',
  interviewsConducted:  'Initial Interviews Conducted',
  recruitsInFirstWeeks: 'New Recruits in First Weeks',
  trainingSessions:     'Training Sessions Delivered',
};

const BOOLEAN_LABELS = {
  unitMeetingHeld:    'Unit / Branch Meeting Held',
  dashboardReviewDone: 'Planning & Dashboard Review Done',
};

function emptyRoleForm() {
  const form = {};
  NUMERIC_STANDARDS.forEach((f) => { form[f] = ''; });
  BOOLEAN_STANDARDS.forEach((f) => { form[f] = false; });
  return form;
}

function fromStored(roleMap) {
  const form = emptyRoleForm();
  NUMERIC_STANDARDS.forEach((f) => {
    const v = roleMap?.[f];
    form[f] = (v != null && v !== '') ? String(v) : '';
  });
  BOOLEAN_STANDARDS.forEach((f) => {
    form[f] = Boolean(roleMap?.[f]);
  });
  return form;
}

function toPayload(forms) {
  const payload = {};
  for (const role of ROLE_TABS.map((t) => t.key)) {
    const rolePayload = {};
    NUMERIC_STANDARDS.forEach((f) => {
      const parsed = parseFloat(forms[role][f]);
      rolePayload[f] = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    });
    BOOLEAN_STANDARDS.forEach((f) => {
      rolePayload[f] = forms[role][f] === true ? true : null;
    });
    payload[role] = rolePayload;
  }
  return payload;
}

function focusableWithin(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(
    'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  ));
}

export default function ActivityStandardsModal({
  tenantId,
  currentUid,
  currentStandards,
  onClose,
  onSaved,
}) {
  const [activeRole, setActiveRole] = useState('unit_manager');
  const [forms, setForms] = useState(() => {
    const result = {};
    for (const { key } of ROLE_TABS) {
      result[key] = fromStored(currentStandards?.[key]);
    }
    return result;
  });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);

  const modalRef   = useRef(null);
  const triggerRef = useRef(null);
  const headingId  = 'activity-standards-modal-heading';

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const items = focusableWithin(modalRef.current);
    if (items.length > 0) items[0].focus();
    return () => { triggerRef.current?.focus?.(); };
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { if (!saving) onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusableWithin(modalRef.current);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  function handleNumericChange(role, field, value) {
    const clean = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setForms((prev) => ({ ...prev, [role]: { ...prev[role], [field]: clean } }));
    if (saveError) setSaveError(null);
  }

  function handleBooleanToggle(role, field) {
    setForms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: !prev[role][field] },
    }));
    if (saveError) setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = toPayload(forms);
      await setManagerActivityStandards(tenantId, payload, currentUid);
      onSaved?.(payload);
      onClose();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to update activity standards.";
      } else if (['unavailable', 'deadline-exceeded', 'cancelled'].includes(code)) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else {
        message = err?.message ?? 'Save failed. Please try again.';
      }
      setSaveError(message);
      setSaving(false);
    }
  }

  const activeForm = forms[activeRole];

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
              Edit activity standards
            </h2>
            <p className="text-sm text-ink-muted mt-0.5">
              Weekly targets per manager role. Leave blank to set no standard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 px-6 shrink-0" role="tablist" aria-label="Manager roles">
          {ROLE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeRole === key}
              onClick={() => setActiveRole(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                activeRole === key
                  ? 'bg-primary text-white'
                  : 'text-ink-muted hover:text-ink hover:bg-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable form area */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          <p className="text-xs text-ink-muted">Numeric: enter a weekly count (e.g. 2). Blank = no standard.</p>

          {NUMERIC_STANDARDS.map((field) => (
            <div key={field} className="flex items-center justify-between gap-4">
              <label
                htmlFor={`std-${activeRole}-${field}`}
                className="text-sm font-medium text-ink flex-1"
              >
                {NUMERIC_LABELS[field]}
              </label>
              <input
                id={`std-${activeRole}-${field}`}
                type="text"
                inputMode="numeric"
                value={activeForm[field]}
                onChange={(e) => handleNumericChange(activeRole, field, e.target.value)}
                disabled={saving}
                placeholder="—"
                aria-label={`${NUMERIC_LABELS[field]} standard for ${activeRole}`}
                className="w-20 h-11 px-3 rounded-lg bg-card border border-border text-ink text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
            </div>
          ))}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs text-ink-muted">Boolean: toggle on = "expected this week".</p>
            {BOOLEAN_STANDARDS.map((field) => (
              <button
                key={field}
                type="button"
                role="checkbox"
                aria-checked={activeForm[field]}
                onClick={() => handleBooleanToggle(activeRole, field)}
                disabled={saving}
                aria-label={`${BOOLEAN_LABELS[field]} standard for ${activeRole}`}
                className="flex items-center gap-3 w-full text-left min-h-[44px] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
              >
                <span className="text-primary shrink-0" aria-hidden="true">
                  {activeForm[field] ? <CheckSquare size={20} /> : <Square size={20} />}
                </span>
                <span className="text-sm font-medium text-ink">{BOOLEAN_LABELS[field]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 shrink-0 space-y-3">
          {saveError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" aria-hidden="true" /><span>Saving…</span></>
            ) : (
              <span>Save standards</span>
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
    </div>
  );
}
