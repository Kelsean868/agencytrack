import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import {
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
} from '../../../utils/weeklyActivityFloors';
import { extractFields } from '../../../utils/extractFields';
import StandardRow from './StandardRow';

/**
 * StandardDetail — slide-in drawer body for the "Standard" Pulse chip.
 *
 * Renders the 10-row Expected-vs-Actual against the agent's resolved floors
 * + current-week submission. Same inputs as WeeklyStandardCard but in a
 * drawer shell mirroring AwardDrillDrawer (role=dialog, aria-modal, ESC,
 * focus-trap).
 *
 * Props:
 *   minimums       — resolvedMinimums (companyMinimums with tenure-resolved API floor)
 *   currentWeekSub — current-week submission (may be null → 0 actuals)
 *   onClose        — close handler
 *   onSubmit       — Submit weekly report CTA (footer); typically setShowWizard(true)
 */
export default function StandardDetail({ minimums, currentWeekSub, onClose, onSubmit }) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Focus-trap: focus the close button on mount.
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const floors = useMemo(
    () => ({ ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(minimums?.weeklyActivityFloors ?? {}) }),
    [minimums?.weeklyActivityFloors]
  );
  const actuals = useMemo(
    () => deriveWeeklyFloorActuals(currentWeekSub ? extractFields(currentWeekSub) : null),
    [currentWeekSub]
  );

  // Summary counts for the header pills
  // (delegate floorStatus categorization to the row's lib — simple recount here)
  // We don't need exact counts to render; StandardRow handles its own status pill.

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Weekly Standard — Expected vs Actual"
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-card"
        style={{
          width: '100%', maxWidth: 480,
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border border-border text-sm font-bold text-ink bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={13} aria-hidden="true" /> Close
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-bold tracking-widest uppercase text-warning font-mono">
            Week in progress
          </p>
          <h2
            className="text-ink mt-1.5"
            style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em',
              fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
            }}
          >
            Weekly Standard
          </h2>
          <p className="text-xs text-ink-muted mt-1.5">
            Expected vs Actual — the 10 floors that define a complete week.
          </p>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="flex flex-col">
            {WEEKLY_ACTIVITY_FLOOR_ROWS.map((row) => (
              <StandardRow
                key={row.key}
                row={row}
                expected={floors[row.key] ?? 0}
                actual={actuals[row.key] ?? 0}
              />
            ))}
          </ul>
        </div>

        {/* Footer CTA */}
        <div
          className="px-6 py-3 border-t border-border bg-surface-muted flex items-center justify-between gap-3 shrink-0"
        >
          <p className="text-xs text-ink-muted leading-snug">
            Submit this week to close any gaps.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-bold hover:bg-primary-dark dark:hover:bg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Open weekly report
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
