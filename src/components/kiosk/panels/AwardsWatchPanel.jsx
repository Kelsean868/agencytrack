import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
} from '../../../lib/productionReport/computations';

function fmtApi(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

// Milestones in ascending order of threshold
const MILESTONES = [
  { label: 'MDRT', threshold: 500_000 },
  { label: 'Agent of the Year', threshold: 1_000_000 },
];

export default function AwardsWatchPanel({ allSubmissions, allUsers }) {
  const { inContention, achieved } = useMemo(() => {
    const ytd = filterSubmissionsByPeriod(allSubmissions, 'ytd');
    const byAgent = {};
    for (const sub of ytd) {
      const aid = sub.agentId ?? sub.userId ?? '';
      if (!aid) continue;
      if (!byAgent[aid]) byAgent[aid] = [];
      byAgent[aid].push(sub);
    }
    const agentTotals = Object.entries(byAgent).map(([agentId, subs]) => {
      const user = allUsers.find((u) => u.id === agentId) ?? {};
      return {
        agentId,
        agentName: user.name || user.displayName || 'Agent',
        totals: computeAgentTotals(subs),
      };
    });

    const achieved = agentTotals
      .filter(({ totals }) => MILESTONES.some((m) => totals.totalApi >= m.threshold))
      .sort((a, b) => b.totals.totalApi - a.totals.totalApi)
      .slice(0, 4);

    const inContention = agentTotals
      .flatMap(({ agentId, agentName, totals }) =>
        MILESTONES.map((m) => {
          const pct = totals.totalApi / m.threshold;
          if (pct >= 1.0 || pct < 0.5) return null;
          return {
            agentId,
            agentName,
            totals,
            milestone: m,
            pct: Math.min(100, Math.round(pct * 100)),
            gap: Math.max(0, m.threshold - totals.totalApi),
          };
        }).filter(Boolean)
      )
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);

    return { inContention, achieved };
  }, [allSubmissions, allUsers]);

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-8 tracking-tight">
        Awards Watch
      </h1>

      {achieved.length > 0 && (
        <div className="mb-6">
          <h2 className="text-success text-xl font-semibold mb-3">Achieved</h2>
          <div className="flex flex-wrap gap-3">
            {achieved.map(({ agentId, agentName, totals }) => (
              <div
                key={agentId}
                className="bg-card rounded-xl px-5 py-3 flex items-center gap-3"
              >
                <span className="text-2xl">🏆</span>
                <span className="text-ink text-xl font-semibold">{agentName}</span>
                <span className="text-primary text-xl">TTD {fmtApi(totals.totalApi)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <h2 className="text-ink-muted text-2xl font-semibold">In Contention</h2>
        {inContention.length === 0 && (
          <p className="text-ink-muted text-xl mt-4">
            No agents currently between 50–100% of a milestone
          </p>
        )}
        {inContention.map(({ agentId, milestone, agentName, pct, gap }) => (
          <div
            key={`${agentId}-${milestone.label}`}
            className="bg-card rounded-2xl px-8 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-ink text-2xl font-semibold">{agentName}</span>
                <span className="text-ink-muted text-lg ml-4">→ {milestone.label}</span>
              </div>
              <div className="text-right">
                <span className="text-primary text-2xl font-bold">{pct}%</span>
                <span className="text-ink-muted text-lg ml-3">
                  TTD {fmtApi(gap)} to go
                </span>
              </div>
            </div>
            <div className="h-3 bg-surface-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
