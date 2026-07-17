import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { fmtTTD, fmtNum, fmtPct } from './planFormat';

function Row({ label, cells }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-3 text-ink-muted">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="px-2 py-2 text-right tabular-nums text-ink">{c}</td>
      ))}
    </tr>
  );
}

// Track K — Strategic Plan · Production Summary (deck p9). Three stacked tables:
// monthly (prorated), annual (with run-rate EOY projection), persistency.
export default function ProductionSummary({ production, loading, error, onRetry }) {
  const p = production;
  return (
    <SectionCard id="production" num="02" title="Production Summary" subtitle="Branch quota, settled production, and run-rate projection">
      <SectionState
        loading={loading}
        error={error}
        empty={!loading && !error && (!p || p.empty)}
        emptyLabel="No settled production for this year yet."
        onRetry={onRetry}
      >
        {p && (
          <div className="space-y-6">
            {/* Monthly (prorated) */}
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Monthly (prorated)</h3>
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3 text-left font-semibold">Metric</th>
                    <th className="px-2 py-2 font-semibold">Monthly quota</th>
                    <th className="px-2 py-2 font-semibold">Avg monthly prod.</th>
                    <th className="px-2 py-2 font-semibold">% achieved</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="API" cells={[fmtTTD(p.monthly.apiQuota), fmtTTD(p.monthly.avgMonthlyApi), fmtPct(p.monthly.pctAchieved)]} />
                </tbody>
              </table>
            </div>

            {/* Annual */}
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Annual</h3>
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3 text-left font-semibold">Metric</th>
                    <th className="px-2 py-2 font-semibold">Annual quota</th>
                    <th className="px-2 py-2 font-semibold">Submitted</th>
                    <th className="px-2 py-2 font-semibold">Gross settled</th>
                    <th className="px-2 py-2 font-semibold">Net settled</th>
                    <th className="px-2 py-2 font-semibold">Projected EOY<br /><span className="font-normal normal-case">run-rate</span></th>
                    <th className="px-2 py-2 font-semibold">% achieved</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="API" cells={[
                    fmtTTD(p.annual.apiQuota), fmtTTD(p.annual.apiSubmitted), fmtTTD(p.annual.apiGrossSettled),
                    fmtTTD(p.annual.apiNetSettled), fmtTTD(p.annual.projectedApi), fmtPct(p.annual.apiPctAchieved),
                  ]} />
                  <Row label="APP" cells={[
                    fmtNum(p.annual.appQuota), fmtNum(p.annual.appSubmitted), fmtNum(p.annual.appGrossSettled),
                    fmtNum(p.annual.appNetSettled), fmtNum(p.annual.projectedApp), fmtPct(p.annual.appPctAchieved),
                  ]} />
                </tbody>
              </table>
            </div>

            {/* Persistency */}
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Persistency</h3>
              <table className="w-full min-w-[320px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3 text-left font-semibold">Metric</th>
                    <th className="px-2 py-2 font-semibold">Current</th>
                    <th className="px-2 py-2 font-semibold">EOY projection</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="Branch persistency" cells={[fmtPct(p.persistency.currentPct), p.persistency.eoyPct == null ? 'current' : fmtPct(p.persistency.eoyPct)]} />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionState>
    </SectionCard>
  );
}
