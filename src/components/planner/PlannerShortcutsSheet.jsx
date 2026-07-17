import React from 'react';
import { Keyboard } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * The full Run 9 A2 shortcut map, in the order they're most useful to a new
 * agent: create first, then the reference itself, then navigation, then the
 * per-appointment actions, then A1's undo/redo (kept here so the map has one
 * canonical home instead of drifting between the panel and a help doc).
 */
const SHORTCUT_ROWS = [
  { keys: ['N'], desc: 'Book a new appointment' },
  { keys: ['Shift', '?'], desc: 'Show this shortcuts list' },
  { keys: ['←', '→'], desc: 'Switch view — Today, Week, Follow-ups' },
  { keys: ['↑', '↓'], desc: 'Move focus between appointment cards' },
  { keys: ['Enter'], desc: 'Open the focused appointment' },
  { keys: ['E'], desc: 'Edit the focused appointment' },
  { keys: ['Ctrl', 'Z'], desc: 'Undo the last action (⌘Z on Mac)' },
  { keys: ['Ctrl', 'Y'], desc: 'Redo the last undone action (⌘Y on Mac)' },
];

function KeyBadge({ label }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-border bg-card-raised text-[11px] font-mono font-semibold text-ink">
      {label}
    </span>
  );
}

/**
 * PlannerShortcutsSheet — the keyboard-shortcuts reference (Run 9 A2). Opened
 * by the `?` shortcut or the header's "?" icon button. A plain reference list,
 * not interactive beyond Close — useFocusTrap + Escape close it like every
 * other planner sheet/dialog.
 */
export default function PlannerShortcutsSheet({ onClose }) {
  const trapRef = useFocusTrap({ onEscape: onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-testid="planner-shortcuts-sheet"
        className="relative w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2">
          <Keyboard size={20} className="text-primary" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink">Keyboard shortcuts</h2>
        </div>

        <ul className="flex flex-col gap-1">
          {SHORTCUT_ROWS.map((row) => (
            <li key={row.desc} className="flex items-center justify-between gap-3 min-h-[44px] py-1">
              <span className="text-sm text-ink-muted">{row.desc}</span>
              <span className="flex items-center gap-1 shrink-0">
                {row.keys.map((k, i) => (
                  <React.Fragment key={`${row.desc}-${k}`}>
                    {i > 0 && <span className="text-ink-dim text-xs" aria-hidden="true">+</span>}
                    <KeyBadge label={k} />
                  </React.Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          data-testid="planner-shortcuts-close"
          className="min-h-[44px] rounded-xl text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}
