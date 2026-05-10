import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
} from '../../../lib/productionReport/computations';
import Avatar from '../Avatar';

function fmtApi(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function AgentLeaderboardPanel({ allSubmissions, allUsers }) {
  const ranked = useMemo(() => {
    const ytd = filterSubmissionsByPeriod(allSubmissions, 'ytd');
    const byAgent = {};
    for (const sub of ytd) {
      const aid = sub.agentId ?? sub.userId ?? '';
      if (!aid) continue;
      if (!byAgent[aid]) byAgent[aid] = [];
      byAgent[aid].push(sub);
    }
    const agentTotalsArray = Object.entries(byAgent).map(([agentId, subs]) => {
      const user = allUsers.find((u) => u.id === agentId) ?? {};
      return {
        agentId,
        agentName: user.name || user.displayName || 'Agent',
        unitId: user.unitId ?? '',
        photoURL: user.photoURL ?? null,
        totals: computeAgentTotals(subs),
      };
    });
    return rankAgentsByApi(agentTotalsArray).slice(0, 12);
  }, [allSubmissions, allUsers]);

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-8 tracking-tight">
        Agent Leaderboard — YTD
      </h1>
      <div className="flex-1 grid grid-cols-2 gap-4 content-start overflow-hidden">
        {ranked.length === 0 && (
          <p className="text-ink-muted text-2xl col-span-2 text-center mt-20">
            No submissions yet
          </p>
        )}
        {ranked.map(({ agentId, agentName, rank, totals, photoURL }) => (
          <div key={agentId} className="bg-card rounded-2xl flex items-center gap-5 px-6 py-4">
            <span className="text-3xl w-10 text-center">
              {rank <= 3 ? MEDALS[rank - 1] : (
                <span className="text-ink-muted text-2xl font-display font-bold">#{rank}</span>
              )}
            </span>
            <Avatar agent={{ uid: agentId, name: agentName, photoURL }} size="tv" />
            <div className="flex-1 min-w-0">
              <p className="text-ink text-2xl font-semibold truncate">{agentName}</p>
              <p className="text-ink-muted text-base">{totals.totalApps} apps</p>
            </div>
            <p className="text-primary text-2xl font-display font-bold">
              TTD {fmtApi(totals.totalApi)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
