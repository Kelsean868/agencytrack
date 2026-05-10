import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeBranchAggregates,
} from '../../../lib/productionReport/computations';

function fmtApi(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function UnitLeaderboardPanel({ allSubmissions, allUsers }) {
  const units = useMemo(() => {
    const ytd = filterSubmissionsByPeriod(allSubmissions, 'ytd');
    const unitIds = [
      ...new Set(
        allUsers.filter((u) => u.role === 'agent').map((u) => u.unitId).filter(Boolean)
      ),
    ];
    const branch = computeBranchAggregates(ytd, allUsers, unitIds);
    return branch.unitBreakdown.map((u, i) => {
      const manager = allUsers.find((usr) => usr.id === u.unitId);
      const unitName = manager?.unitName || `${manager?.name || 'Unit'}'s Team`;
      return { ...u, unitName, rank: i + 1 };
    });
  }, [allSubmissions, allUsers]);

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-10 tracking-tight">
        Unit Rankings — YTD
      </h1>
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {units.length === 0 && (
          <p className="text-ink-muted text-2xl text-center mt-20">No unit data yet</p>
        )}
        {units.map(({ rank, unitName, agentCount, totalApi, avgApiPerAgent }) => (
          <div key={rank} className="bg-card rounded-2xl flex items-center px-8 py-5 gap-6">
            <span
              className={`text-4xl font-display font-bold w-14 text-center ${
                RANK_COLORS[rank - 1] ?? 'text-ink-muted'
              }`}
            >
              #{rank}
            </span>
            <div className="flex-1">
              <p className="text-ink text-3xl font-semibold">{unitName}</p>
              <p className="text-ink-muted text-lg mt-1">{agentCount} agents</p>
            </div>
            <div className="text-right">
              <p className="text-primary text-4xl font-display font-bold">TTD {fmtApi(totalApi)}</p>
              <p className="text-ink-muted text-lg">Avg TTD {fmtApi(avgApiPerAgent)} / agent</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
