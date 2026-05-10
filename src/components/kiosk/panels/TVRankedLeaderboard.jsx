import React, { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import Avatar from '../Avatar';
import { useCountUp } from '../../../hooks/useCountUp';

const PAGE_SIZE = 12;
const DEFAULT_PAGE_DURATION_MS = 12_000;

function fmtApi(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

function RankIcon({ rank }) {
  if (rank === 1) return <Trophy size={28} className="text-yellow-400 shrink-0" />;
  if (rank === 2) return <Medal size={28} className="text-slate-300 shrink-0" />;
  if (rank === 3) return <Medal size={28} className="text-amber-600 shrink-0" />;
  return (
    <span className="text-ink-muted font-display font-bold text-2xl w-7 text-center shrink-0">
      #{rank}
    </span>
  );
}

function AnimatedValue({ value, isCurrency }) {
  const display = useCountUp(value, { duration: 800 });
  return (
    <span className="animate-count-up">
      {isCurrency ? fmtApi(display) : Math.round(display)}
    </span>
  );
}

function AgentRow({ agentId, agentName, photoURL, rank, value, isCurrency, rowIndex }) {
  return (
    <div
      className="bg-card rounded-xl flex items-center gap-4 px-5 py-3 animate-stagger-in"
      style={{ animationDelay: `${rowIndex * 100}ms`, animationFillMode: 'both' }}
    >
      <RankIcon rank={rank} />
      <Avatar agent={{ uid: agentId, name: agentName, photoURL }} size="lg" />
      <p className="text-ink font-semibold text-2xl flex-1 truncate">{agentName}</p>
      <p className="text-primary font-display font-bold text-2xl shrink-0">
        <AnimatedValue value={value} isCurrency={isCurrency} />
      </p>
    </div>
  );
}

/**
 * TVRankedLeaderboard — kiosk-scale single-column leaderboard.
 *
 * Props:
 *   title        — column header string
 *   agents       — [{ agentId, agentName, photoURL, rank, totals }]
 *   isCurrency   — true = format as TTD, false = raw count
 *   valueKey     — 'totalApi' | 'totalApps'
 *   pageDurationMs — ms per sub-page (default 12 000)
 */
export default function TVRankedLeaderboard({
  title,
  agents = [],
  isCurrency = true,
  valueKey = 'totalApi',
  pageDurationMs = DEFAULT_PAGE_DURATION_MS,
}) {
  const pageCount = Math.ceil(agents.length / PAGE_SIZE) || 1;
  const [page, setPage] = useState(0);

  // Reset to page 0 when agent list changes (e.g., data refresh)
  useEffect(() => { setPage(0); }, [agents]);

  useEffect(() => {
    if (pageCount <= 1) return;
    const t = setInterval(
      () => setPage((p) => (p + 1) % pageCount),
      pageDurationMs
    );
    return () => clearInterval(t);
  }, [pageCount, pageDurationMs]);

  const visible = agents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-3xl font-display font-bold text-ink">{title}</h3>
        {pageCount > 1 && (
          <span className="text-ink-muted text-lg">
            {page + 1} / {pageCount}
          </span>
        )}
      </div>

      {agents.length === 0 ? (
        <p className="text-ink-muted text-xl text-center mt-10">No data for this period</p>
      ) : (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          {visible.map((agent, idx) => (
            <AgentRow
              key={agent.agentId}
              agentId={agent.agentId}
              agentName={agent.agentName}
              photoURL={agent.photoURL ?? null}
              rank={agent.rank}
              value={agent.totals[valueKey]}
              isCurrency={isCurrency}
              rowIndex={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}
