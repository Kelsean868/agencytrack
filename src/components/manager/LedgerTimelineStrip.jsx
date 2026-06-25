// Track K · K2 — LedgerTimelineStrip.
//
// Presentational 12-cell-style band of the agent's financing ledger: each cell
// is a month coloured by state (entered / current / skipped-flagged / future)
// with a compact running balance. Skipped months carry the reconciliation flag
// (informational in K2 — the gap is flagged, never interpolated; K6 wires the
// carry/blocker). Nexus tokens only, both themes. Pure — the orchestrator
// computes `cells`.
import React from 'react';

// Compact TTD for the narrow cells (e.g. 8000 → "8.0K", -1200 → "-1.2K").
function compactTTD(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

const CELL_STYLES = {
  entered: 'bg-primary/10 border-primary/30 text-primary',
  current: 'bg-gold-tint border-gold text-gold',
  skipped: 'bg-danger/10 border-danger/40 text-danger-ink',
  future:  'bg-surface-muted border-border text-ink-faint opacity-60',
};

const LEGEND = [
  { state: 'entered', label: 'Entered',  dot: 'bg-primary' },
  { state: 'current', label: 'Entering', dot: 'bg-gold' },
  { state: 'skipped', label: 'Skipped',  dot: 'bg-danger' },
  { state: 'future',  label: 'Future',   dot: 'bg-ink-faint' },
];

export default function LedgerTimelineStrip({ cells = [] }) {
  return (
    <div className="card" data-testid="financing-ledger-strip">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-sm font-semibold text-ink">Monthly ledger · running balance</p>
        <div className="flex gap-3 flex-wrap">
          {LEGEND.map((l) => (
            <span key={l.state} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
              <span className={['h-2 w-2 rounded-sm shrink-0', l.dot].join(' ')} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      {cells.length === 0 ? (
        <p className="text-sm text-ink-muted">No statements yet. Enter the opening month to start the ledger.</p>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {cells.map((c) => (
            <div
              key={c.month}
              data-testid={`financing-cell-${c.month}`}
              data-state={c.state}
              className={[
                'relative flex-1 min-w-[58px] rounded-lg border px-2 py-2 text-center',
                CELL_STYLES[c.state] ?? CELL_STYLES.future,
              ].join(' ')}
            >
              <div className="text-[9px] font-bold uppercase tracking-wide">{c.label}</div>
              <div className="text-xs font-extrabold mt-1 whitespace-nowrap">
                {c.state === 'current' ? '⌖' : c.state === 'entered' ? compactTTD(c.balance) : '—'}
              </div>
              {c.state === 'skipped' && (
                <span
                  className="absolute -top-1.5 -right-1 h-4 w-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center"
                  aria-label="Skipped month — reconciliation flag"
                >!</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
