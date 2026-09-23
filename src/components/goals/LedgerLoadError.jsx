import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * LedgerLoadError — the production figures come from the Policy Ledger (H1).
 * When that read fails, say so and offer a retry, rather than let every panel
 * below show a confident TTD 0.
 */
export default function LedgerLoadError({ onRetry }) {
  return (
    <div role="alert" className="card flex items-start gap-3 text-danger-ink mb-4" data-testid="ledger-load-error">
      <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold text-sm">Couldn&apos;t load your policy ledger</p>
        <p className="text-xs text-ink-muted mt-0.5">Your production figures come from it. Check your connection and retry.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
