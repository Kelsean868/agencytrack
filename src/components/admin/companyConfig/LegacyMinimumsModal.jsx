import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CompanyConfigPanel from '../CompanyConfigPanel';

/**
 * LegacyMinimumsModal (Run 5, Item E) — the quiet escape hatch that hosts the
 * EXISTING company-minimums editor (`CompanyConfigPanel`) in the app's standard
 * scrim-dialog idiom (matches EditConfigModal / the admin modals) until the
 * effective-dating engine (slice 1.5) retires it. The panel is rendered with its
 * `embedded` prop so its own `card` chrome doesn't double-wrap inside the dialog.
 *
 * Scope: presentation shell only. All read/write/validation lives in the
 * existing CompanyConfigPanel + EditConfigModal it opens — unchanged.
 */
export default function LegacyMinimumsModal({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- scrim-click-to-close on a non-interactive backdrop; the dialog carries the interactive semantics
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/40 backdrop-blur-sm overflow-y-auto"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit minimums (legacy editor)"
        data-testid="ccfg-legacy-modal"
        className="w-full max-w-2xl bg-surface-raised rounded-2xl border border-border shadow-xl mb-[8vh]"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <span className="flex-1 font-display text-[16px] font-extrabold tracking-tight text-ink">
            Edit minimums (legacy editor)
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          <CompanyConfigPanel embedded />
        </div>
      </div>
    </div>
  );
}
