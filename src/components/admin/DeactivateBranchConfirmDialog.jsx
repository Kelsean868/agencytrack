import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * Branch deactivate / reactivate confirmation dialog (Track C — C1).
 *
 * Sibling to ui/ConfirmDialog.jsx — same visual scaffold, same a11y
 * baseline, same modal-friction profile, but branch-specific copy and no
 * typed-confirmation step (branch deactivation is reversible and
 * lower-severity than user deactivation).
 *
 * a11y contract (§4 dialog sweep): role="dialog" + aria-modal="true" +
 * aria-labelledby, useFocusTrap hook (focus-trapped, Escape cancels, focus
 * returns to the trigger on close), 44px close button. Cancel/Close stay
 * always-enabled (matching ui/ConfirmDialog.jsx) — only the destructive
 * confirm action disables while `loading`.
 */
export default function DeactivateBranchConfirmDialog({ branch, onConfirm, onCancel, loading }) {
  const isReactivate = branch?.isActive === false;
  const branchName = branch?.name ?? 'this branch';
  const modalRef = useFocusTrap({ onEscape: onCancel });

  if (isReactivate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-branch-dialog-heading"
          className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <p id="deactivate-branch-dialog-heading" className="text-sm font-bold text-ink">Reactivate branch?</p>
            <button
              type="button"
              onClick={onCancel}
              className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Reactivating <span className="font-semibold text-ink">{branchName}</span> makes it available for new assignments again.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(true)}
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? 'Reactivating…' : 'Reactivate'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-branch-dialog-heading"
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-ink shrink-0" />
            <p id="deactivate-branch-dialog-heading" className="text-sm font-bold text-ink">Deactivate branch?</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Deactivating <span className="font-semibold text-ink">{branchName}</span> hides it from new assignment dropdowns. Agents already assigned to this branch keep their assignment. You can reactivate anytime.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(false)}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
