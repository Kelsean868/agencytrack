import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

function formatValue(category, value) {
  if (category === 'api') return formatCurrency(value || 0);
  if (category === 'apps') return `${value || 0} app${value !== 1 ? 's' : ''}`;
  return `${value || 0} pts`;
}

function AgentAvatar({ photoURL, name, size = 8 }) {
  const dim = `w-${size} h-${size}`;
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${dim} rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0`}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export default function AOMCategorySection({
  category,
  label,
  Icon,
  candidates,
  winner,
  isLocked,
  onApprove,
  approving,
}) {
  return (
    <div className="bg-card rounded-xl border border-card-raised p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Icon className="text-primary" size={20} aria-hidden="true" />
        <h3 className="font-semibold text-ink">{label}</h3>
      </div>

      {winner && (
        <div
          className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
          aria-label={`Current winner: ${winner.agentName}`}
        >
          <AgentAvatar photoURL={winner.photoURL} name={winner.agentName} size={10} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{winner.agentName}</p>
            <p className="text-xs text-primary font-medium">
              {formatValue(category, winner.achievementValue)}
            </p>
          </div>
          <CheckCircle2 size={18} className="text-primary shrink-0" aria-hidden="true" />
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-4">
          No submissions for this month yet.
        </p>
      ) : (
        <ol aria-label={`${label} candidates`} className="flex flex-col divide-y divide-card-raised">
          {candidates.map((c) => {
            const isWinner = winner?.agentUid === c.agentUid;
            const isApproving = approving === c.agentUid;
            return (
              <li key={c.agentUid} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-center text-sm font-bold text-ink-muted shrink-0">
                  {c.rank}
                </span>
                <AgentAvatar photoURL={c.photoURL} name={c.agentName} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{c.agentName}</p>
                  <p className="text-xs text-ink-muted">{formatValue(category, c.value)}</p>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => onApprove(c.agentUid)}
                    disabled={isApproving || isWinner}
                    aria-label={
                      isWinner
                        ? `${c.agentName} is the current winner`
                        : `Approve ${c.agentName} as ${label}`
                    }
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 ${
                      isWinner
                        ? 'bg-primary/10 text-primary cursor-default'
                        : 'bg-surface-raised text-ink hover:bg-primary/10 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isApproving ? 'Saving…' : isWinner ? 'Winner' : 'Approve'}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
