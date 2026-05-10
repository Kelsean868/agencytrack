import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeBranchAggregates,
} from '../../../lib/productionReport/computations';
import { useCountUp } from '../../../hooks/useCountUp';

function KpiCard({ label, rawValue, accent, isCurrency }) {
  const display = useCountUp(rawValue, { duration: 1000 });

  const formatted = isCurrency
    ? (() => {
        if (display >= 1_000_000) return `TTD ${(display / 1_000_000).toFixed(2)}M`;
        if (display >= 1_000) return `TTD ${(display / 1_000).toFixed(1)}K`;
        return `TTD ${Math.round(display).toLocaleString()}`;
      })()
    : Math.round(display).toString();

  return (
    <div className="bg-card rounded-2xl flex flex-col items-center justify-center p-8">
      <span className="text-ink-muted text-2xl mb-4">{label}</span>
      <span
        className={`text-6xl font-display font-bold animate-count-up ${accent ? 'text-primary' : 'text-ink'}`}
      >
        {formatted}
      </span>
    </div>
  );
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
    { label: 'YTD API', rawValue: branch.totalApi, accent: true, isCurrency: true },
    { label: 'YTD Apps Sold', rawValue: branch.totalApps, accent: false, isCurrency: false },
    { label: 'Active Agents', rawValue: branch.agentCount, accent: false, isCurrency: false },
    { label: 'Avg API / Agent', rawValue: branch.avgApiPerAgent, accent: true, isCurrency: true },
  ];

  return (
    <div className="w-full h-full flex flex-col p-10">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-5xl font-display font-bold text-ink tracking-tight">Branch Overview</h1>
        <span className="text-ink-muted text-xl">{dateStr}</span>
      </div>
      <div className="grid grid-cols-2 gap-6 flex-1">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
    </div>
  );
}
