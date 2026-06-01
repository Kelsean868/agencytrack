import React, { useMemo } from 'react';
import { Trophy, Medal } from 'lucide-react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
  computeComplianceStats,
} from '../../../lib/productionReport/computations';
import Avatar from '../Avatar';
import { useCountUp } from '../../../hooks/useCountUp';

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

function RankIcon({ rank }) {
  if (rank === 1) return <Trophy size={28} className="text-presentation-gold shrink-0" />;
  if (rank === 2) return <Medal size={28} className="text-slate-300 shrink-0" />;
  if (rank === 3) return <Medal size={28} className="text-amber-600 shrink-0" />;
  return <span className="text-ink-muted text-xl font-bold w-7 text-center shrink-0">#{rank}</span>;
}

function CompliancePct({ value }) {
  const display = useCountUp(value, { duration: 800 });
  return <span className="animate-count-up">{Math.round(display)}%</span>;
}

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
          {topAgents.map(({ agentId, agentName, rank, totals, photoURL }, idx) => (
            <div
              key={agentId}
              className="bg-card rounded-2xl flex items-center gap-5 px-6 py-4 animate-stagger-in"
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
            >
              <RankIcon rank={rank} />
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
            <CompliancePct value={compliance.percent} />
          </p>
          <p className="text-ink-muted text-2xl mt-6">
            {compliance.submitted} of {compliance.total} agents
          </p>
        </div>
      </div>
    </div>
  );
}
