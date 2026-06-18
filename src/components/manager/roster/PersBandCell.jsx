import React from 'react';
import { PERS_FLOOR, PERS_GATE } from '../../../lib/persistency/calculations';

// Input: persistency 0–100 scale (matches RosterRow interface).
// PERS_FLOOR (0.80) and PERS_GATE (0.90) are decimal; scale to 0–100 for comparison.
const FLOOR = PERS_FLOOR * 100; // 80
const GATE  = PERS_GATE  * 100; // 90

function bandTextClass(p) {
  if (p >= GATE)  return 'text-success-ink';
  if (p >= FLOOR) return 'text-warning-ink';
  return 'text-danger-ink';
}

function bandFillClass(p) {
  if (p >= GATE)  return 'bg-success';
  if (p >= FLOOR) return 'bg-warning';
  return 'bg-danger';
}

export default function PersBandCell({ persistency }) {
  if (persistency === null || persistency === undefined) {
    return (
      <div className="flex flex-col items-end" data-testid="pers-band-cell-empty">
        <span className="font-display font-extrabold text-sm text-ink-muted">—</span>
      </div>
    );
  }
  const pct = Math.min(Math.max(persistency, 0), 100);
  return (
    <div className="flex flex-col items-end gap-1" data-testid="pers-band-cell">
      <span className={`font-display font-extrabold text-sm leading-none ${bandTextClass(pct)}`}>
        {pct}%
      </span>
      {/* Two-tick band — same grammar as PersRoster BandTrack */}
      <div
        className="relative h-1.5 rounded-full bg-border/40"
        style={{ width: 74, overflow: 'visible' }}
        aria-hidden="true"
      >
        <div
          className={`absolute left-0 top-0 bottom-0 rounded-full ${bandFillClass(pct)}`}
          style={{ width: `${pct}%` }}
        />
        {/* Floor tick at 80% — danger */}
        <div
          className="absolute w-0.5 bg-danger rounded-sm"
          style={{ left: '80%', top: '-3px', bottom: '-3px' }}
        />
        {/* Gate tick at 90% — success */}
        <div
          className="absolute w-0.5 bg-success rounded-sm"
          style={{ left: '90%', top: '-3px', bottom: '-3px' }}
        />
      </div>
    </div>
  );
}
