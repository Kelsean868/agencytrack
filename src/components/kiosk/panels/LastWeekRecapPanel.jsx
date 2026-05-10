import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
  computeComplianceStats,
} from '../../../lib/productionReport/computations';
import Avatar from '../Avatar';

function fmtApi(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

function lastSundayStr(ref) {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LastWeekRecapPanel({ allSubmissions, allUsers }) {
  const { topAgents, compliance, weekLabel } = useMemo(() => {
    const lastWeekRef = new Date();
    lastWeekRef.setDate(lastWeekRef.getDate() - 7);

    const lastWeekSubs = filterSubmissionsByPeriod(allSubmissions, 'week', lastWeekRef);
    const sunStr = lastSundayStr(lastWeekRef);

    const activeAgents = allUsers.filter((u) => u.role === 'agent');
    const comp = computeComplianceStats(lastWeekSubs, activeAgents, sunStr);

    const byAgent = {};
    for (const sub of lastWeekSubs) {
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
    const ranked = rankAgentsByApi(agentTotalsArray).slice(0, 5);

    const sunday = new Date(lastWeekRef);
    sunday.setDate(lastWeekRef.getDate() - lastWeekRef.getDay());
    const label = sunday.toLocaleDateString('en-TT', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    return { topAgents: ranked, compliance: comp, weekLabel: label };
  }, [allSubmissions, allUsers]);

  const pctColor =
    compliance.percent >= 80
      ? 'text-success'
      : compliance.percent >= 50
      ? 'text-warning'
      : 'text-danger';

  return (
    <div className="w-full h-full flex flex-col p-10">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-5xl font-display font-bold text-ink tracking-tight">
          Last Week Recap
        </h1>
        <span className="text-ink-muted text-xl">Week of {weekLabel}</span>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-ink-muted text-2xl font-semibold mb-2">Top Performers</h2>
          {topAgents.length === 0 && (
            <p className="text-ink-muted text-xl">No submissions last week</p>
          )}
          {topAgents.map(({ agentId, agentName, rank, totals, photoURL }) => (
            <div key={agentId} className="bg-card rounded-2xl flex items-center gap-5 px-6 py-4">
              <span className="text-3xl w-10 text-center">
                {rank <= 3 ? MEDALS[rank - 1] : (
                  <span className="text-ink-muted text-xl font-bold">#{rank}</span>
                )}
              </span>
              <Avatar agent={{ uid: agentId, name: agentName, photoURL }} size="lg" />
              <p className="text-ink text-2xl font-semibold flex-1 truncate">{agentName}</p>
              <p className="text-primary text-2xl font-display font-bold">
                {fmtApi(totals.totalApi)}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-card rounded-2xl flex flex-col items-center justify-center p-10">
          <p className="text-ink-muted text-2xl mb-6">Submission Rate</p>
          <p className={`text-9xl font-display font-bold ${pctColor}`}>
            {compliance.percent}%
          </p>
          <p className="text-ink-muted text-2xl mt-6">
            {compliance.submitted} of {compliance.total} agents
          </p>
        </div>
      </div>
    </div>
  );
}
