import React from 'react';
import { Clock, CalendarRange, CalendarCheck, ChevronRight } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { SeriesBadge } from './AppointmentSheet';

/**
 * SeriesEditChoice — the "this appointment repeats" scope chooser (recurrence
 * state 3). Raised BEFORE the edit form when the tapped item is a series
 * instance. Three live scopes (Run 9 F3d, operator rulings R1/R2):
 *   • "Edit this appointment only" — the existing single-doc edit path; the rest
 *     of the series is untouched.
 *   • "Edit this and all future"   — propagate the changed fields to THIS
 *     instance + every later instance (date >= this occurrence's date). Earlier
 *     instances keep their per-instance edits (R2 this-and-future preserves).
 *   • "Edit all (current + future)" — propagate to every non-past instance
 *     (date >= today). Overwrites prior per-instance edits (R2 all overwrites).
 *     Past instances are historical record and are NEVER rewritten (R1).
 * Propagation NEVER touches the per-occurrence date, status, or series metadata —
 * only field edits (time / duration / type / prospect / note / API) flow through.
 * Cancel dismisses.
 */
export default function SeriesEditChoice({
  contextLine, onEditThisOnly, onEditFuture, onEditAll, onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose });

  const options = [
    {
      testid: 'series-edit-this-only',
      icon: Clock,
      onClick: onEditThisOnly,
      title: 'Edit this appointment only',
      subtitle: 'This one changes · the rest of the series stays',
      accent: true,
    },
    {
      testid: 'series-edit-future',
      icon: CalendarRange,
      onClick: onEditFuture,
      title: 'Edit this and all future',
      subtitle: 'This one + every later occurrence · earlier ones stay',
      accent: false,
    },
    {
      testid: 'series-edit-all',
      icon: CalendarCheck,
      onClick: onEditAll,
      title: 'Edit all (current + future)',
      subtitle: 'Every upcoming occurrence · past appointments never change',
      accent: false,
    },
  ];

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

        {options.map(({ testid, icon: Icon, onClick, title, subtitle, accent }) => (
          <button
            key={testid}
            type="button"
            onClick={onClick}
            data-testid={testid}
            className={`flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl border text-left transition-colors ${
              accent
                ? 'bg-primary/10 border-primary/30 hover:bg-primary/15'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <span className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <Icon size={17} className="text-primary" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-ink">{title}</span>
              <span className="block text-xs text-ink-muted mt-0.5">{subtitle}</span>
            </span>
            <ChevronRight size={15} className="text-ink-muted shrink-0" aria-hidden="true" />
          </button>
        ))}

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
