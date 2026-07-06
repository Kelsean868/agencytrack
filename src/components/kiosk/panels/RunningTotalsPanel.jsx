import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
} from '../../../lib/productionReport/computations';
import { useCountUp } from '../../../hooks/useCountUp';

function fmtApi(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

function CountUpApi({ value }) {
  const display = useCountUp(value, { duration: 1000 });
  return <span className="motion-reduce:animate-none animate-count-up">{fmtApi(display)}</span>;
}

function CountUpNum({ value }) {
  const display = useCountUp(value, { duration: 800 });
  return <span className="motion-reduce:animate-none animate-count-up">{Math.round(display)}</span>;
}

export default function RunningTotalsPanel({ allSubmissions }) {
  const { mtd, qtd, ytd } = useMemo(() => {
    return {
      mtd: computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'mtd')),
      qtd: computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'quarter')),
      ytd: computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'ytd')),
    };
  }, [allSubmissions]);

  const periods = [
    { label: 'Month to Date', data: mtd },
    { label: 'Quarter to Date', data: qtd },
    { label: 'Year to Date', data: ytd },
  ];

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-10 tracking-tight">
        Branch Running Totals — Cumulative
      </h1>
      <div className="flex-1 grid grid-cols-3 gap-6">
        {periods.map(({ label, data }) => (
          <div key={label} className="bg-card rounded-2xl flex flex-col p-8 gap-8">
            <h2 className="text-ink-muted text-2xl font-semibold">{label}</h2>
            <div>
              <p className="text-ink-muted text-lg mb-1">API</p>
              <p className="text-primary text-5xl font-display font-bold">
                <CountUpApi value={data.totalApi} />
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-lg mb-1">Apps</p>
              <p className="text-ink text-5xl font-display font-bold">
                <CountUpNum value={data.totalApps} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
