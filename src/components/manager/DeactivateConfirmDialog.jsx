import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeactivateConfirmDialog({ user, onConfirm, onCancel, loading }) {
  const isReactivate = user?.active === false;
  const [emailInput, setEmailInput] = useState('');

  if (isReactivate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Reactivate account?</p>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            <span className="font-semibold text-ink">{user.name ?? user.email}</span> will be able to sign in and use AgencyTrack again immediately.
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

  const confirmed = emailInput.trim().toLowerCase() === (user?.email ?? '').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger shrink-0" />
            <p className="text-sm font-bold text-ink">Deactivate account?</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          This signs <span className="font-semibold text-ink">{user?.name ?? user?.email}</span> out immediately, blocks login, and preserves their submissions and settlements.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deactivate-confirm-email" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Type their email to confirm
          </label>
          <input
            id="deactivate-confirm-email"
            type="text"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={user?.email ?? ''}
            autoComplete="off"
            className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-danger/40"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(false)}
            disabled={!confirmed || loading}
            className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
