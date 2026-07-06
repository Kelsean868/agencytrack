import React from 'react';
import { Trophy, Medal } from 'lucide-react';
import Avatar from '../Avatar';

function RankIcon({ rank }) {
  if (rank === 1) return <Trophy size={26} className="text-presentation-gold shrink-0" />;
  if (rank === 2) return <Medal size={26} className="text-slate-300 shrink-0" />;
  if (rank === 3) return <Medal size={26} className="text-amber-600 shrink-0" />;
  return (
    <span className="text-ink-muted font-display font-bold text-xl w-7 text-center shrink-0">
      #{rank}
    </span>
  );
}

/**
 * ActivityLeaderboard — single-column ranked activity list with breakdown beneath each total.
 *
 * Props:
 *   title        — column heading string
 *   icon         — Lucide icon element rendered beside the title
 *   subtitle     — e.g. "(Names + Calls)"
 *   agents       — [{agentId, agentName, photoURL, rank, total, breakdown:[{label,value}]}]
 *   emptyMessage — shown when agents is empty
 */
export default function ActivityLeaderboard({
  title,
  icon,
  subtitle,
  agents = [],
  emptyMessage = 'No activity recorded this week',
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-primary">{icon}</span>
        <div>
          <h3 className="text-3xl font-display font-bold text-ink leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-ink-muted text-base mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {agents.length === 0 ? (
        <p className="text-ink-muted text-xl text-center mt-10">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          {agents.map((agent, idx) => (
            <div
              key={agent.agentId}
              className="bg-card rounded-xl px-5 py-3 motion-reduce:animate-none animate-stagger-in"
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-center gap-4">
                <RankIcon rank={agent.rank} />
                <Avatar agent={{ uid: agent.agentId, name: agent.agentName, photoURL: agent.photoURL }} size="lg" />
                <p className="text-ink font-semibold text-2xl flex-1 truncate">{agent.agentName}</p>
                <p className="text-primary font-display font-bold text-3xl shrink-0">
                  {agent.total}
                </p>
              </div>
              {agent.breakdown.length > 0 && (
                <p className="text-ink-muted text-sm mt-1 ml-14 pl-4">
                  {agent.breakdown.map((b) => `${b.value} ${b.label}`).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
