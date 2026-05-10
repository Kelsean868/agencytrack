import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeBranchAggregates,
} from '../../../lib/productionReport/computations';

function fmtApi(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

export default function BranchOverviewPanel({ allSubmissions, allUsers }) {
  const { branch, dateStr } = useMemo(() => {
    const ytd = filterSubmissionsByPeriod(allSubmissions, 'ytd');
    const unitIds = [
      ...new Set(
        allUsers.filter((u) => u.role === 'agent').map((u) => u.unitId).filter(Boolean)
      ),
    ];
    const b = computeBranchAggregates(ytd, allUsers, unitIds);
    return {
      branch: b,
      dateStr: new Date().toLocaleDateString('en-TT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
    };
  }, [allSubmissions, allUsers]);

  const kpis = [
    { label: 'YTD API', value: fmtApi(branch.totalApi), accent: true },
    { label: 'YTD Apps Sold', value: branch.totalApps.toString(), accent: false },
    { label: 'Active Agents', value: branch.agentCount.toString(), accent: false },
    { label: 'Avg API / Agent', value: fmtApi(branch.avgApiPerAgent), accent: true },
  ];

  return (
    <div className="w-full h-full flex flex-col p-10">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-5xl font-display font-bold text-ink tracking-tight">Branch Overview</h1>
        <span className="text-ink-muted text-xl">{dateStr}</span>
      </div>
      <div className="grid grid-cols-2 gap-6 flex-1">
        {kpis.map(({ label, value, accent }) => (
          <div key={label} className="bg-card rounded-2xl flex flex-col items-center justify-center p-8">
            <span className="text-ink-muted text-2xl mb-4">{label}</span>
            <span className={`text-6xl font-display font-bold ${accent ? 'text-primary' : 'text-ink'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
