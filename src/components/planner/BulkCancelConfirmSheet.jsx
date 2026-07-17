import React, { useState } from 'react';
import { X, Loader2, Ban } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { BulkCapWarning, BULK_CAP_WARN } from './BulkMoveSheet';

/**
 * BulkCancelConfirmSheet — Run 9 A5 bulk soft-delete confirmation (R5:
 * status='cancelled', NEVER a hard delete). Confirmation is ALWAYS shown for
 * a bulk cancel, naming exactly how many appointments flip. Cancelled
 * appointments stay on the week dimmed-retained (RETIRED_STATUSES styling) —
 * the copy says so, so nobody mistakes this for deletion. R6: over
 * BULK_CAP_WARN selections the amber warning + acknowledgement checkbox gate
 * the confirm button.
 */
export default function BulkCancelConfirmSheet({
  count,
  saving = false,
  onConfirm,
  onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const [capAck, setCapAck] = useState(false);

  const overCap = count > BULK_CAP_WARN;
  const canConfirm = !saving && count > 0 && (!overCap || capAck);

  const titleId = 'bulk-cancel-title';
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="bulk-cancel-confirm"
        className="relative w-full sm:max-w-xs bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Ban size={18} className="text-danger-ink" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-ink">
              Cancel {count} {count === 1 ? 'appointment' : 'appointments'}?
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

        <p className="text-sm text-ink-muted">
          They stay on your week as a dimmed record — nothing is deleted, and
          you can undo this.
        </p>

        {overCap && <BulkCapWarning count={count} acked={capAck} onAckChange={setCapAck} />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl border border-border text-ink font-semibold text-sm hover:bg-surface transition-colors disabled:opacity-50"
          >
            Keep them
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            data-testid="bulk-cancel-confirm-apply"
            className="flex-1 min-h-[44px] rounded-xl border border-danger/40 bg-danger/10 text-danger-ink font-semibold text-sm hover:bg-danger/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Cancelling…</> : 'Cancel appointments'}
          </button>
        </div>
      </div>
    </div>
  );
}
