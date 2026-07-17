import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { fmtTTD, fmtNum, fmtSignedTTD } from './planFormat';

// Track K — Strategic Plan · Period Metrics (deck p18). Goal vs actual for API /
// APP / manpower, one row per window. Granularity toggle (from the shell) drives
// Q1–Q4 vs H1/H2 row count.
export default function PeriodMetrics({ periodMetrics, loading, error, onRetry }) {
  const pm = periodMetrics;
  return (
    <SectionCard
      id="period-metrics"
      num="03"
      title="Period Metrics"
      subtitle={pm ? (pm.granularity === 'half' ? 'Half-year goal vs actual' : 'Quarterly goal vs actual') : 'Goal vs actual'}
    >
      <SectionState
        loading={loading}
        error={error}
        empty={!loading && !error && (!pm || pm.empty)}
        emptyLabel="No production recorded for these periods yet."
        onRetry={onRetry}
      >
        {pm && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm" data-testid="sp-period-table">
              <thead>
                <tr className="border-b border-border text-right text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 text-left font-semibold">Period</th>
                  <th className="px-2 py-2 font-semibold">API goal</th>
                  <th className="px-2 py-2 font-semibold">API actual</th>
                  <th className="px-2 py-2 font-semibold">API variance</th>
                  <th className="px-2 py-2 font-semibold">APP goal</th>
                  <th className="px-2 py-2 font-semibold">APP actual</th>
                  <th className="px-2 py-2 font-semibold">Manpower</th>
                </tr>
              </thead>
              <tbody>
                {pm.rows.map((r) => (
                  <tr key={r.key} data-testid={`sp-period-row-${r.key}`} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium text-ink">{r.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtTTD(r.apiGoal)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink">{fmtTTD(r.apiActual)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.apiVariance != null && r.apiVariance < 0 ? 'text-danger-ink' : 'text-success-ink'}`}>
                      {fmtSignedTTD(r.apiVariance)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtNum(r.appGoal)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.appActual)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.manpowerActual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionState>
    </SectionCard>
  );
}
