import { useState, useRef, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { createBranch, updateBranch } from '../../services/branchService';

/**
 * Branch editor modal (Track C — C1).
 *
 * Reused scaffolding from EditConfigModal.jsx (B5):
 *   - role="dialog" + aria-modal="true" + aria-labelledby
 *   - First focusable element receives focus on open
 *   - Focus trap: Tab/Shift+Tab cycle stays within the modal
 *   - Escape cancels (when not saving)
 *   - Returns focus to the trigger element on close
 *   - aria-describedby on input → help text + error region
 *   - aria-invalid on input + role="alert" + aria-live="polite" on error
 *
 * Inline duplication (per C1 SS-2 decision): we duplicate the focus-trap
 * scaffolding rather than extracting a useFocusTrap hook now. Single
 * additional consumer in C1; if a third lands in C2/C3, extract then.
 *
 * Modes:
 *   - mode="create" — empty form, calls createBranch on save
 *   - mode="edit"   — pre-seeded from `branch` prop (parent did a fresh
 *                     getBranch read), calls updateBranch on save
 *
 * Write-path discipline:
 *   - parseFloat / numeric: N/A — all string fields.
 *   - Save button disables on click + spinner.
 *   - Modal closes ONLY on write success.
 *   - On failure, modal stays open and surfaces a specific error.
 *   - Error mapping: Firestore code → user-visible copy; service-layer
 *     validation errors (empty name, duplicate name) propagate as
 *     plain Error.message.
 */
const MAX_NAME_LENGTH = 100;
const UNASSIGNED_VALUE = '__unassigned';

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

export default function BranchEditorModal({
  mode,
  tenantId,
  currentUid,
  branch,
  branchManagers,
  onClose,
  onSaved,
}) {
  const isEdit = mode === 'edit';

  const [name, setName] = useState(branch?.name ?? '');
  const [managerSelection, setManagerSelection] = useState(
    branch?.managerId ?? UNASSIGNED_VALUE
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const headingId = 'branch-editor-heading';
  const helpId = 'branch-editor-name-help';
  const errorId = 'branch-editor-name-error';

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
      } else if (!e.shiftKey && active === first) {
        // no-op
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
    const trimmed = name.trim();
    if (!trimmed) return 'Branch name is required.';
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Branch name must be at most ${MAX_NAME_LENGTH} characters.`;
    }
    return null;
  }, [name, touched]);

  const trimmedName = name.trim();
  const resolvedManagerId =
    managerSelection === UNASSIGNED_VALUE ? null : managerSelection;

  const isDirty = isEdit
    ? trimmedName !== (branch?.name ?? '') ||
      resolvedManagerId !== (branch?.managerId ?? null)
    : trimmedName.length > 0;

  const canSave = !saving && !validationError && trimmedName.length > 0 && isDirty;

  function handleNameChange(e) {
    setName(e.target.value);
    setTouched(true);
    if (submitError) setSubmitError(null);
  }

  function handleManagerChange(e) {
    setManagerSelection(e.target.value);
    if (submitError) setSubmitError(null);
  }

  async function handleSave() {
    setTouched(true);
    if (validationError || !trimmedName) return;

    setSaving(true);
    setSubmitError(null);

    try {
      const payload = {
        name: trimmedName,
        managerId: resolvedManagerId,
      };
      if (isEdit) {
        await updateBranch(tenantId, branch.id, payload, currentUid);
      } else {
        await createBranch(tenantId, payload, currentUid);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to manage branches. Contact your platform admin.";
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
          <h2 id={headingId} className="text-lg font-bold text-ink">
            {isEdit ? 'Edit branch' : 'Add branch'}
          </h2>
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
          {isEdit
            ? 'Update the branch name or reassign the branch manager.'
            : 'Branches group units and agents. Create one for each physical or organisational location.'}
        </p>

        <div className="mb-4">
          <label
            htmlFor="branch-name"
            className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2"
          >
            Branch name
          </label>
          <input
            id="branch-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={() => setTouched(true)}
            disabled={saving}
            autoComplete="off"
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Port of Spain"
            aria-describedby={validationError ? `${helpId} ${errorId}` : helpId}
            aria-invalid={validationError ? true : undefined}
            className="w-full h-11 px-3 rounded-lg border border-border bg-card text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          />
          {validationError && (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="mt-2 text-sm text-danger flex items-center gap-1.5"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        <div className="mb-5">
          <label
            htmlFor="branch-manager"
            className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2"
          >
            Branch manager
          </label>
          <select
            id="branch-manager"
            value={managerSelection}
            onChange={handleManagerChange}
            disabled={saving}
            className="w-full h-11 px-3 rounded-lg border border-border bg-card text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            <option value={UNASSIGNED_VALUE}>Unassigned</option>
            {(branchManagers ?? []).map((bm) => (
              <option key={bm.uid} value={bm.uid}>
                {bm.name ?? bm.email ?? bm.uid}
              </option>
            ))}
          </select>
          {(branchManagers?.length ?? 0) === 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              No active branch managers in this tenant yet. Leave Unassigned for now and reassign once managers are created.
            </p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2"
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
            <span>{isEdit ? 'Save changes' : 'Create branch'}</span>
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
