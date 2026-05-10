import React, { useEffect, useMemo, useState } from 'react';
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

// Responsive layout thresholds — mirrors brief Phase 5 spec
const PAGE_SIZE = 24; // 12 rows × 2 cols per sub-panel page
const SUB_PANEL_INTERVAL_MS = 10_000;

function AgentRow({ agentId, agentName, rank, totals, photoURL, compact }) {
  const avatarSize = compact ? 'md' : 'tv';
  return (
    <div className="bg-card rounded-xl flex items-center gap-4 px-5 py-3">
      <span className={`${compact ? 'text-xl w-7' : 'text-3xl w-10'} text-center shrink-0`}>
        {rank <= 3 ? MEDALS[rank - 1] : (
          <span className={`text-ink-muted font-display font-bold ${compact ? 'text-lg' : 'text-2xl'}`}>
            #{rank}
          </span>
        )}
      </span>
      <Avatar agent={{ uid: agentId, name: agentName, photoURL }} size={avatarSize} />
      <div className="flex-1 min-w-0">
        <p className={`text-ink font-semibold truncate ${compact ? 'text-lg' : 'text-2xl'}`}>
          {agentName}
        </p>
        <p className="text-ink-muted text-sm">{totals.totalApps} apps</p>
      </div>
      <p className={`text-primary font-display font-bold shrink-0 ${compact ? 'text-lg' : 'text-2xl'}`}>
        TTD {fmtApi(totals.totalApi)}
      </p>
    </div>
  );
}

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
    // All agents — no cutoff
    return rankAgentsByApi(agentTotalsArray);
  }, [allSubmissions, allUsers]);

  const count = ranked.length;
  const layout = count <= 10 ? 'single' : count <= 50 ? 'double' : 'paged';

  // Sub-panel paging for 51+ agents
  const pageCount = layout === 'paged' ? Math.ceil(count / PAGE_SIZE) : 1;
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (layout !== 'paged') return;
    const t = setInterval(
      () => setPage((p) => (p + 1) % pageCount),
      SUB_PANEL_INTERVAL_MS
    );
    return () => clearInterval(t);
  }, [layout, pageCount]);

  // Reset page if ranked list changes (e.g., after a data refresh)
  useEffect(() => { setPage(0); }, [ranked]);

  const visibleAgents = layout === 'paged'
    ? ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : ranked;

  const compact = layout === 'paged'; // smaller cards when 51+

  return (
    <div className="w-full h-full flex flex-col p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-5xl font-display font-bold text-ink tracking-tight">
          Agent Leaderboard — YTD
        </h1>
        {layout === 'paged' && (
          <span className="text-ink-muted text-xl">
            {page + 1} / {pageCount}
          </span>
        )}
      </div>

      {ranked.length === 0 && (
        <p className="text-ink-muted text-2xl text-center mt-20">No submissions yet</p>
      )}

      {/* ≤10 agents: single column */}
      {layout === 'single' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {visibleAgents.map((agent) => (
            <AgentRow key={agent.agentId} {...agent} compact={false} />
          ))}
        </div>
      )}

      {/* 11–50 agents: two columns */}
      {layout === 'double' && (
        <div className="flex-1 grid grid-cols-2 gap-3 content-start overflow-hidden">
          {visibleAgents.map((agent) => (
            <AgentRow key={agent.agentId} {...agent} compact={false} />
          ))}
        </div>
      )}

      {/* 51+ agents: paginated two-column sub-panels, auto-advance every 10s */}
      {layout === 'paged' && (
        <div className="flex-1 grid grid-cols-2 gap-2 content-start overflow-hidden">
          {visibleAgents.map((agent) => (
            <AgentRow key={agent.agentId} {...agent} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
