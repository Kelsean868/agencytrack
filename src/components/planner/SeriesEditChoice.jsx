import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { SeriesBadge } from './AppointmentSheet';

/**
 * SeriesEditChoice — the "this appointment repeats" choice sheet (recurrence
 * state 3). Raised BEFORE the edit form when the tapped item is a series
 * instance. "Edit this appointment only" is live (routes to the existing
 * single-doc edit path — past instances never change). "Edit this and all
 * future" is DEFERRED (disabled) — series-wide field edits across concrete
 * future instances need a cross-week series query + composite index that this
 * slice banks; cadence edits are impossible under the no-delete model. Cancel
 * dismisses.
 */
export default function SeriesEditChoice({ contextLine, onEditThisOnly, onClose }) {
  const trapRef = useFocusTrap({ onEscape: onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="This appointment repeats"
        data-testid="series-edit-choice"
        className="relative w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-3"
      >
        <div className="flex items-center gap-2">
          <SeriesBadge size={22} />
          <h2 className="text-base font-bold text-ink">This appointment repeats</h2>
        </div>
        {contextLine && <p className="text-xs text-ink-muted -mt-1">{contextLine}</p>}

        <button
          type="button"
          onClick={onEditThisOnly}
          data-testid="series-edit-this-only"
          className="flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl bg-primary/10 border border-primary/30 text-left hover:bg-primary/15 transition-colors"
        >
          <span className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
            <Clock size={17} className="text-primary" aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-ink">Edit this appointment only</span>
            <span className="block text-xs text-ink-muted mt-0.5">This one changes · the rest of the series stays</span>
          </span>
          <ChevronRight size={15} className="text-ink-muted shrink-0" aria-hidden="true" />
        </button>

        <div
          data-testid="series-edit-all-future"
          aria-disabled="true"
          className="flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl bg-card border border-dashed border-border opacity-60"
        >
          <span className="w-9 h-9 rounded-lg bg-card-raised border border-border flex items-center justify-center shrink-0">
            <Clock size={17} className="text-ink-dim" aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-ink-muted">
              Edit this and all future <span className="text-[10px] font-mono uppercase">soon</span>
            </span>
            <span className="block text-xs text-ink-muted mt-0.5">Series-wide editing is coming</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-testid="series-edit-cancel"
          className="min-h-[44px] rounded-xl text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
