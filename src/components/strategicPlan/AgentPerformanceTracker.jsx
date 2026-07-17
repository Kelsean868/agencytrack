import React from 'react';
import StatusPill from '../ui/StatusPill';
import { SectionCard, SectionState } from './SectionState';
import { fmtTTD, fmtNum, fmtPct, fmtYears, pctVariant } from './planFormat';

// Track K — Strategic Plan · Agent Performance Tracker (deck p5). Dense per-advisor
// table; horizontally scroll-safe. Producing Unit/Trainee Managers appear as rows
// (RULING 3). % Objective Achieved = calendar-year NET settled ÷ annual quota.
export default function AgentPerformanceTracker({ agents, loading, error, onRetry, onDrillAgent }) {
  const rows = agents?.rows ?? [];
  return (
    <SectionCard id="agents" num="01" title="Agent Performance Tracker" subtitle="Year-to-date production vs annual objective, per advisor">
      <SectionState
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyLabel="No advisors in this branch yet."
        onRetry={onRetry}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Advisor</th>
                <th className="px-2 py-2 text-right font-semibold">Exp</th>
                <th className="px-2 py-2 text-right font-semibold">Calls</th>
                <th className="px-2 py-2 text-right font-semibold">Contacts</th>
                <th className="px-2 py-2 text-right font-semibold">Fact Finds</th>
                <th className="px-2 py-2 text-right font-semibold">CIs</th>
                <th className="px-2 py-2 text-right font-semibold">Persist.</th>
                <th className="px-2 py-2 text-right font-semibold">API Quota</th>
                <th className="px-2 py-2 text-right font-semibold">API Net</th>
                <th className="px-2 py-2 text-right font-semibold">API % Obj</th>
                <th className="px-2 py-2 text-right font-semibold">APP Net</th>
                <th className="px-2 py-2 text-right font-semibold">APP % Obj</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-testid={`sp-agent-row-${r.id}`}
                  className="border-b border-border/50 hover:bg-surface-muted/60"
                >
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => onDrillAgent?.(r.id)}
                      className="min-h-[44px] text-left"
                    >
                      <span className="font-medium text-ink">{r.name}</span>
                      <span className="ml-2 text-xs text-ink-muted">{r.title}</span>
                      {r.isUnitHead && (
                        <StatusPill variant="primary" label="Unit head" className="ml-2" />
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtYears(r.experienceYears)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.calls)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.contacts)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.factFinds)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.closingInterviews)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtPct(r.persistencyPct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtTTD(r.apiQuota)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink" data-testid={`sp-agent-net-${r.id}`}>
                    {fmtTTD(r.apiNetSettled)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <StatusPill variant={pctVariant(r.apiPctObj)} label={fmtPct(r.apiPctObj)} />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtNum(r.appNetSettled)}</td>
                  <td className="px-2 py-2 text-right">
                    <StatusPill variant={pctVariant(r.appPctObj)} label={fmtPct(r.appPctObj)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </SectionCard>
  );
}
