import { AlertTriangle, X } from 'lucide-react';

/**
 * Branch deactivate / reactivate confirmation dialog (Track C — C1).
 *
 * Sibling to manager/DeactivateConfirmDialog.jsx — same visual scaffold,
 * same a11y baseline, same modal-friction profile, but branch-specific
 * copy and no typed-confirmation step (branch deactivation is reversible
 * and lower-severity than user deactivation).
 *
 * Sibling rationale (per C1 SS-2 decision): keeps DeactivateConfirmDialog
 * untouched and load-bearing for the user-deactivation flow. Future PR
 * may extract a shared scaffold once a third consumer materialises.
 */
export default function DeactivateBranchConfirmDialog({ branch, onConfirm, onCancel, loading }) {
  const isReactivate = branch?.isActive === false;
  const branchName = branch?.name ?? 'this branch';

  if (isReactivate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Reactivate branch?</p>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors"
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
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
            >
              Cancel
            </button>
            <button
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
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-ink shrink-0" />
            <p className="text-sm font-bold text-ink">Deactivate branch?</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors"
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
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
          >
            Cancel
          </button>
          <button
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
