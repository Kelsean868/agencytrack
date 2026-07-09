import React, { useState } from 'react';
import { X, PackageCheck, AlertTriangle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';

/**
 * MarkDeliveredDialog — the CRO "Mark delivered" confirm sheet (Tier-3 3.1).
 *
 * §4 dialog contract: focus trap + Escape-to-close (useFocusTrap), a 44px close
 * affordance, tokens only, no inline styles. Carries a delivery-date input
 * (defaults to today, max = today so a future date can never be chosen — the
 * client mirror of the rules Arm E `policyDeliveryDate <= request.time` guard).
 *
 * onConfirm(deliveryDate) is called with the chosen "YYYY-MM-DD" string; the
 * parent owns the recordPolicyDelivery call, loading, and success handling.
 */
export default function MarkDeliveredDialog({ policy, onConfirm, onCancel, saving = false, error = '' }) {
  const dialogRef = useFocusTrap({ onEscape: saving ? () => {} : onCancel });
  const today = getTodayTT();
  const [deliveryDate, setDeliveryDate] = useState(today);

  const owner = policy?.ownerName ?? policy?.insuredName ?? policy?.policyNumber ?? 'this policy';
  const api = policy?.settledAPI != null ? formatCurrency(policy.settledAPI) : null;
  const futureInvalid = deliveryDate > today;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop as a button (established drawer pattern) — click closes. */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        disabled={saving}
        className="absolute inset-0 bg-black/40 border-0 p-0 m-0 cursor-pointer"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-delivered-title"
        className="card w-full max-w-md relative"
        data-testid="mark-delivered-dialog"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Close"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3 pr-10">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <PackageCheck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="mark-delivered-title" className="text-base font-display font-bold text-ink">
              Mark policy delivered
            </h2>
            <p className="text-sm text-ink-muted mt-1 break-words">
              {owner}
              {policy?.policyNumber ? <span className="text-ink-faint"> · {policy.policyNumber}</span> : null}
              {api ? <span className="text-ink-muted"> · {api} API</span> : null}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="delivery-date" className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
            Delivery date
          </label>
          <input
            id="delivery-date"
            type="date"
            value={deliveryDate}
            max={today}
            onChange={(e) => setDeliveryDate(e.target.value)}
            disabled={saving}
            className="w-full min-h-[44px] px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
            data-testid="delivery-date-input"
          />
          <p className="text-xs text-ink-muted mt-1">
            Confirming delivery stops the 30-day clawback clock. The date cannot be in the future.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-danger/10 border border-danger/30 text-danger-ink text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-[44px] px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(deliveryDate)}
            disabled={saving || futureInvalid}
            className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2"
            data-testid="mark-delivered-confirm"
          >
            {saving ? 'Saving…' : 'Mark delivered'}
          </button>
        </div>
      </div>
    </div>
  );
}
