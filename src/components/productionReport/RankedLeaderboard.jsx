import React from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * RankedLeaderboard — ranked list component.
 *
 * entries: [{ id, rank, name, value, secondaryValue?, badgeStatus? }]
 * valueLabel: e.g. "API" or "Apps"
 * secondaryLabel: optional sub-value label
 * topN: cap the visible list (default unlimited)
 * currentEntityId: highlights the matching row
 * isCurrency: format value as currency
 */
export default function RankedLeaderboard({
  entries = [],
  _valueLabel = 'API',
  secondaryLabel,
  topN,
  currentEntityId,
  isCurrency = true,
}) {
  const visible = topN ? entries.slice(0, topN) : entries;

  if (visible.length === 0) {
    return (
      <div className="text-center py-6 text-ink-muted text-sm">
        No data for this period.
      </div>
    );
  }

  const medalClass = (rank) => {
    if (rank === 1) return 'bg-gold-tint text-gold';
    if (rank === 2) return 'bg-surface-muted text-ink-muted';
    if (rank === 3) return 'bg-warning-tint text-warning';
    return 'bg-surface text-ink-muted';
  };

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-border overflow-hidden bg-card">
      {visible.map((entry) => {
        const isMe = entry.id === currentEntityId;
        return (
          <div
            key={entry.id ?? entry.name}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${
              isMe ? 'bg-primary/5' : 'hover:bg-surface'
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${medalClass(entry.rank)}`}
            >
              {entry.rank}
            </span>

            <span className={`flex-1 text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-ink'}`}>
              {entry.name}
              {isMe && <span className="ml-1.5 text-[10px] text-primary/70">(you)</span>}
            </span>

            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold tabular-nums ${isMe ? 'text-primary' : 'text-ink'}`}>
                {isCurrency ? formatCurrency(entry.value) : entry.value}
              </p>
              {secondaryLabel && entry.secondaryValue !== undefined && (
                <p className="text-[10px] text-ink-muted tabular-nums">
                  {entry.secondaryValue} {secondaryLabel}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
