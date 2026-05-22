import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Track I · I3a — Tier 1 accountability flag panel.
//
// Informational/warning surface (Nexus warning tokens, NOT alarm-red).
// Renders nothing when missed.length === 0 so consumers can mount unconditionally.
export default function AccountabilityFlagPanel({ missed }) {
  if (!missed || missed.length === 0) return null;

  return (
    <div
      className="rounded-2xl bg-warning/10 border border-warning/30 p-4"
      role="status"
      aria-label={`${missed.length} standard${missed.length === 1 ? '' : 's'} under target`}
      data-testid="accountability-flag-panel"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="text-warning shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold text-warning">
            {missed.length} standard{missed.length === 1 ? '' : 's'} under target
          </p>
          <ul className="space-y-1 text-sm text-text">
            {missed.map((m) => (
              <li
                key={m.key}
                className="flex items-center justify-between gap-3"
                data-testid={`accountability-flag-row-${m.key}`}
              >
                <span className="text-text">{m.label}</span>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {m.type === 'boolean'
                    ? 'expected'
                    : `${m.actual} / ${m.target}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
