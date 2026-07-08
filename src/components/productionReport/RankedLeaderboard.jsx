import React from 'react';
import { Trophy } from 'lucide-react';
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
  valueLabel = 'API',
  secondaryLabel,
  topN,
  currentEntityId,
  isCurrency = true,
}) {
  const visible = topN ? entries.slice(0, topN) : entries;

  if (visible.length === 0) {
    return (
      <div className="text-center py-6 flex flex-col items-center gap-2" data-testid="ranked-leaderboard-empty">
        <Trophy size={20} className="text-ink-muted" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink">No {valueLabel.toLowerCase()} recorded yet</p>
        <p className="text-xs text-ink-muted">Try a different time period using the toggle above.</p>
      </div>
    );
  }

  const medalClass = (rank) => {
    if (rank === 1) return 'bg-gold-tint text-gold-ink';
    if (rank === 2) return 'bg-surface-muted text-ink-muted';
    if (rank === 3) return 'bg-warning-tint text-warning-ink';
    return 'bg-surface text-ink-muted';
  };

  const showingSubset = Boolean(topN) && entries.length > visible.length;

  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      {/* Card-scoped vertical scroll (§5) + sticky header row */}
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2 border-b border-border bg-surface text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          <span className="w-7 shrink-0 text-center">#</span>
          <span className="flex-1">Agent</span>
          <span className="text-right shrink-0">
            {valueLabel}{secondaryLabel ? ` / ${secondaryLabel}` : ''}
          </span>
        </div>

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

              <span
                className={`flex-1 text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-ink'}`}
                title={entry.name}
              >
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

      {/* Live footer count (§5) */}
      <div className="px-4 py-2 border-t border-border bg-surface text-xs text-ink-muted">
        {showingSubset
          ? `Showing ${visible.length} of ${entries.length}`
          : `${entries.length} agent${entries.length !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
