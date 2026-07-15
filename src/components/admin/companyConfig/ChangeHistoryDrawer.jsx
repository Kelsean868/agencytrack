import React from 'react';
import { History, X } from 'lucide-react';
import PanelSkeleton from '../../ui/PanelSkeleton';

/**
 * Right-side change-history drawer (design handoff README §Change history).
 * Pure/presentational — `entries` and `loading` are supplied by the caller;
 * this component does not read Firestore/the audit collection itself.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {Array<{section: string, label: string, from: string, to: string, who: string, date: string, reason?: string, correction?: boolean}>} props.entries
 * @param {boolean} [props.loading]
 */
export default function ChangeHistoryDrawer({ open, onClose, entries, loading }) {
  if (!open) return null;
  const list = entries || [];

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- scrim-click-to-close on a non-interactive backdrop; the drawer itself carries the interactive semantics
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[55] flex justify-end bg-[rgba(14,11,7,.3)]"
    >
      <div
        role="dialog"
        aria-label="Change history"
        data-testid="ccfg-history"
        className="w-[min(400px,94vw)] h-full bg-card border-l border-border flex flex-col"
      >
        <div className="flex items-center gap-2.5 px-5 py-4.5 border-b border-border">
          <History size={17} className="text-ink-muted shrink-0" aria-hidden="true" />
          <span className="flex-1 font-display text-[16px] font-extrabold tracking-tight text-ink">Change history</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink p-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2.5">
          {loading && <PanelSkeleton variant="list" count={4} label="Loading change history…" />}

          {!loading && list.length === 0 && (
            <div className="py-5 text-[12.5px] text-ink-muted">No changes yet.</div>
          )}

          {!loading &&
            list.map((e, i) => (
              <div key={i} className="py-3 border-b border-border last:border-b-0">
                <div
                  className={`font-mono text-[9.5px] font-bold uppercase tracking-[.12em] ${
                    e.correction ? 'text-danger-ink' : 'text-ink-muted'
                  }`}
                >
                  {e.correction ? 'CORRECTION · ' : ''}
                  {e.section}
                </div>
                <div className="text-[13px] font-semibold text-ink mt-0.5">{e.label}</div>
                <div className="font-mono text-[11.5px] text-ink-muted mt-0.5">
                  {e.from} →{' '}
                  <span className={`font-bold ${e.correction ? 'text-danger-ink' : 'text-primary'}`}>{e.to}</span>
                </div>
                {e.reason && <div className="text-[11px] text-ink-muted mt-0.5 italic leading-snug">&ldquo;{e.reason}&rdquo;</div>}
                <div className="text-[11px] text-ink-muted mt-0.5">{e.who} · {e.date}</div>
              </div>
            ))}
        </div>

        <div className="px-5 py-3 border-t border-border text-[11px] text-ink-muted">
          Full audit trail lives in the Audit Log.
        </div>
      </div>
    </div>
  );
}
