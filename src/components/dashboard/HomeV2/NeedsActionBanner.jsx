import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * NeedsActionBanner — v2 amber warning banner for "you haven't logged today".
 *
 * Reuses the existing E6 daily-nudge conditions; this component is purely a
 * restyle/reposition of the warning treatment seen above the Hero in v2.
 */
export default function NeedsActionBanner({ onLog, title = "You haven't logged today yet", subtitle = '30-second capture · rolls into your weekly report Sunday' }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3.5 p-3.5 rounded-xl border"
      style={{
        background: 'var(--color-warning-tint)',
        borderColor: 'rgb(var(--warning-channels) / 0.33)',
      }}
    >
      <div
        aria-hidden="true"
        className="shrink-0 flex items-center justify-center bg-card border"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          borderColor: 'rgb(var(--warning-channels) / 0.33)',
        }}
      >
        <AlertTriangle size={16} className="text-warning-ink" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onLog}
        className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg bg-warning text-white text-xs font-bold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
      >
        Log today
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
