import React from 'react';
import StatusPill from '../ui/StatusPill';
import { SectionCard, SectionState } from './SectionState';
import { StatHero, PlanAvatar } from './planPrimitives';
import { fmtTTD, fmtNum, fmtPct, paceBand } from './planFormat';

// Track K — Agent Performance Tracker (deck §02). Dense per-advisor table with a
// glass-hero summary strip; producing Unit/Trainee Managers appear as rows
// (RULING 3). Two DISTINCT percentage columns (dispatcher ruling 2026-07-17,
// definition-drift guard):
//   • "% Obj" — the head-office figure: net settled ÷ ANNUAL quota (apiPctObj).
//     This is the deck column the Sales Manager reconciles against; unbanded.
//   • "Pace" — net ÷ (annual quota × elapsed) (apiPacePct), banded
//     ON PACE / AT FLOOR / BELOW (CD mockup read). Status pill keys off pace.
// Horizontally scroll-safe.

const BAND_CELL = {
  success: 'bg-success/15 text-success-ink',
  warning: 'bg-warning/15 text-warning-ink',
  danger: 'bg-danger/15 text-danger-ink',
  muted: 'text-ink-muted',
};

function heroItems(summary) {
  if (!summary) return [];
  return [
    { k: 'Advisors reporting', v: String(summary.advisors), sub: 'producing roster' },
    {
      k: 'Funnel · calls → apps',
      v: `${fmtNum(summary.callsTotal)} → ${fmtNum(summary.appsTotal)}`,
      sub: summary.funnelPct != null ? `${fmtPct(summary.funnelPct)} end-to-end` : '—',
    },
    { k: 'Net settled API · YTD', v: fmtTTD(summary.netYtd), sub: `of ${fmtTTD(summary.objYtd)} prorated` },
    summary.topProducer
      ? { k: '★ Top producer', v: summary.topProducer.name, sub: `${fmtTTD(summary.topProducer.netApi)} net settled`, tone: 'gold' }
      : { k: '★ Top producer', v: '—', sub: 'no settled production yet' },
  ];
}

export default function AgentPerformanceTracker({ agents, loading, error, onRetry, onDrillAgent }) {
  const rows = agents?.rows ?? [];
  const totals = rows.reduce((a, r) => ({
    calls: a.calls + r.calls, contacts: a.contacts + r.contacts, factFinds: a.factFinds + r.factFinds,
    ci: a.ci + r.closingInterviews, sub: a.sub + r.apiSubmitted, gross: a.gross + r.apiGrossSettled,
    net: a.net + r.apiNetSettled, obj: a.obj + (r.objYtd ?? 0), quota: a.quota + (r.apiQuota ?? 0),
  }), { calls: 0, contacts: 0, factFinds: 0, ci: 0, sub: 0, gross: 0, net: 0, obj: 0, quota: 0 });
  const totalPace = totals.obj > 0 ? (totals.net / totals.obj) * 100 : null;
  const totalAnnualPct = totals.quota > 0 ? (totals.net / totals.quota) * 100 : null;

  return (
    <div className="space-y-3.5">
      {!loading && !error && rows.length > 0 && <StatHero items={heroItems(agents?.summary)} testid="sp-agents-hero" />}
      <SectionCard id="agents" num="02" title="Agent Performance Tracker" subtitle="YTD per advisor · % Obj = net ÷ annual quota · Pace = net ÷ prorated objective">
        <SectionState
          loading={loading}
          error={error}
          empty={!loading && !error && rows.length === 0}
          emptyLabel="No advisors in this branch yet."
          onRetry={onRetry}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-right font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  <th className="py-2 pr-3 text-left font-semibold">Advisor</th>
                  <th className="px-2 py-2 font-semibold">Calls</th>
                  <th className="px-2 py-2 font-semibold">Contacts</th>
                  <th className="px-2 py-2 font-semibold">Fact Finds</th>
                  <th className="px-2 py-2 font-semibold">CIs</th>
                  <th className="px-2 py-2 font-semibold">Persist</th>
                  <th className="px-2 py-2 font-semibold">Obj · YTD</th>
                  <th className="px-2 py-2 font-semibold">Submitted</th>
                  <th className="px-2 py-2 font-semibold">Gross set</th>
                  <th className="px-2 py-2 font-semibold">Net set</th>
                  <th className="px-2 py-2 font-semibold">% Obj</th>
                  <th className="px-2 py-2 font-semibold">Pace</th>
                  <th className="px-2 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const band = paceBand(r.apiPacePct);
                  const rowInner = (
                    <div className="flex items-center gap-2">
                      <PlanAvatar name={r.name} />
                      <span className="font-semibold text-ink">{r.name}</span>
                      <span className="text-xs text-ink-muted">{r.title}</span>
                      {r.isUnitHead && <StatusPill variant="primary" label="Unit head" />}
                    </div>
                  );
                  return (
                    <tr key={r.id} data-testid={`sp-agent-row-${r.id}`} className="border-b border-border/50 hover:bg-surface-muted/60">
                      <td className="py-2 pr-3">
                        {onDrillAgent ? (
                          <button type="button" onClick={() => onDrillAgent(r.id)} className="inline-flex min-h-[44px] items-center text-left">{rowInner}</button>
                        ) : (
                          <span className="inline-flex min-h-[44px] items-center">{rowInner}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtNum(r.calls)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtNum(r.contacts)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtNum(r.factFinds)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtNum(r.closingInterviews)}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${r.persistencyPct != null && r.persistencyPct < 85 ? 'text-warning-ink' : 'text-ink-muted'}`}>{fmtPct(r.persistencyPct)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtTTD(r.objYtd)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtTTD(r.apiSubmitted)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtTTD(r.apiGrossSettled)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-bold text-ink" data-testid={`sp-agent-net-${r.id}`}>{fmtTTD(r.apiNetSettled)}</td>
                      {/* % Obj = raw annual (head-office figure) — unbanded */}
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink">{fmtPct(r.apiPctObj)}</td>
                      {/* Pace = net ÷ prorated objective — banded */}
                      <td className={`px-2 py-2 text-right font-mono tabular-nums font-bold ${BAND_CELL[band.variant]}`}>{fmtPct(r.apiPacePct)}</td>
                      <td className="px-2 py-2 text-center"><StatusPill variant={band.variant} label={band.label} /></td>
                    </tr>
                  );
                })}
                {rows.length > 0 && (
                  <tr className="border-t-2 border-border font-mono text-xs">
                    <td className="py-2 pr-3 text-left font-bold uppercase tracking-wider text-primary">Branch · {rows.length} advisors</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtNum(totals.calls)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtNum(totals.contacts)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtNum(totals.factFinds)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtNum(totals.ci)}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtTTD(totals.obj)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtTTD(totals.sub)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtTTD(totals.gross)}</td>
                    <td className="px-2 py-2 text-right font-bold text-primary">{fmtTTD(totals.net)}</td>
                    <td className="px-2 py-2 text-right font-bold text-ink">{fmtPct(totalAnnualPct)}</td>
                    <td className={`px-2 py-2 text-right font-bold ${BAND_CELL[paceBand(totalPace).variant]}`}>{fmtPct(totalPace)}</td>
                    <td className="px-2 py-2 text-center"><StatusPill variant={paceBand(totalPace).variant} label={paceBand(totalPace).label} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionState>
      </SectionCard>
    </div>
  );
}
