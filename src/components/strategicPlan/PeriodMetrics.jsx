import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { StatHero } from './planPrimitives';
import { fmtTTD, fmtNum, fmtSignedTTD } from './planFormat';

// Track K — Period Metrics (deck §04). Goal vs actual for APPS / API / MANPOWER,
// one row per window + an FY summary. Granularity toggle drives Q1–Q4 vs H1/H2.
// Manpower Goal reads the OPTIONAL branchGoals.manpower field (dispatcher ruling) —
// "—" / "goal not set" when absent; the setter is Phase 2 (read-only fold here).

function StateChip({ state }) {
  if (state === 'progress') return <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">In progress</span>;
  if (state === 'future') return <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">Upcoming</span>;
  return <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-success-ink">✓ Closed</span>;
}

const signedNum = (v) => (v == null ? '—' : `${v < 0 ? '−' : '+'}${fmtNum(Math.abs(v))}`);
// Null variance is neutral (—), never success-green; negative danger, else success.
const varCls = (v) => (v == null ? 'text-ink-muted' : v < 0 ? 'text-danger-ink' : 'text-success-ink');

function Row({ r, testid }) {
  const manpowerVar = r.manpowerGoal == null ? null : r.manpowerActual - r.manpowerGoal;
  return (
    <tr data-testid={testid} className={`border-b border-border/50 ${r.isFy ? 'bg-surface-muted/50' : ''}`}>
      <td className="py-2 pr-3 text-left font-mono text-xs font-bold uppercase tracking-wide">
        <span className={r.isFy ? 'text-primary' : 'text-ink'}>{r.isFy ? 'FY' : r.label}</span>
      </td>
      {/* APPS */}
      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtNum(r.appGoal)}</td>
      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-ink">{fmtNum(r.appActual)}</td>
      <td className={`px-2 py-2 text-right font-mono tabular-nums ${varCls(r.appVariance)}`}>{signedNum(r.appVariance)}</td>
      {/* API */}
      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{fmtTTD(r.apiGoal)}</td>
      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-ink">{fmtTTD(r.apiActual)}</td>
      <td className={`px-2 py-2 text-right font-mono tabular-nums ${varCls(r.apiVariance)}`}>{fmtSignedTTD(r.apiVariance)}</td>
      {/* MANPOWER */}
      <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{r.manpowerGoal == null ? '—' : fmtNum(r.manpowerGoal)}</td>
      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-ink">{fmtNum(r.manpowerActual)}</td>
      <td className={`px-2 py-2 text-right font-mono tabular-nums ${varCls(manpowerVar)}`}>{signedNum(manpowerVar)}</td>
      <td className="px-2 py-2 text-center">{r.isFy ? <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">YTD</span> : <StateChip state={r.state} />}</td>
    </tr>
  );
}

export default function PeriodMetrics({ periodMetrics, loading, error, onRetry }) {
  const pm = periodMetrics;
  const heroItems = pm ? [
    { k: 'Apps · YTD (net)', v: fmtNum(pm.fy?.appActual), sub: `goal ${fmtNum(pm.fy?.appGoal)}` },
    { k: 'API · YTD (net)', v: fmtTTD(pm.fy?.apiActual), sub: `goal ${fmtTTD(pm.fy?.apiGoal)}` },
    {
      k: 'Manpower',
      v: pm.manpowerGoal != null ? `${fmtNum(pm.manpowerActual)} / ${fmtNum(pm.manpowerGoal)}` : fmtNum(pm.manpowerActual),
      sub: pm.manpowerGoal != null ? 'licensed / goal' : 'goal not set',
      tone: pm.manpowerGoal != null && pm.manpowerActual < pm.manpowerGoal ? 'warning' : undefined,
    },
  ] : [];

  return (
    <div className="space-y-3.5">
      {!loading && !error && pm && !pm.empty && <StatHero items={heroItems} testid="sp-period-hero" />}
      <SectionCard
        id="period-metrics"
        num="04"
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
              <table className="w-full min-w-[760px] border-collapse text-sm" data-testid="sp-period-table">
                <thead>
                  <tr className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    <th className="px-2 py-1.5 text-left" />
                    <th className="px-2 py-1.5 text-center" colSpan={3}>Apps · settled</th>
                    <th className="px-2 py-1.5 text-center" colSpan={3}>API · net settled</th>
                    <th className="px-2 py-1.5 text-center" colSpan={3}>Manpower · licensed</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                  <tr className="border-b border-border text-right font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    <th className="py-2 pr-3 text-left font-semibold">Period</th>
                    <th className="px-2 py-2 font-semibold">Goal</th><th className="px-2 py-2 font-semibold">Actual</th><th className="px-2 py-2 font-semibold">Var</th>
                    <th className="px-2 py-2 font-semibold">Goal</th><th className="px-2 py-2 font-semibold">Actual</th><th className="px-2 py-2 font-semibold">Var</th>
                    <th className="px-2 py-2 font-semibold">Goal</th><th className="px-2 py-2 font-semibold">Actual</th><th className="px-2 py-2 font-semibold">Var</th>
                    <th className="px-2 py-2 text-center font-semibold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {pm.rows.map((r) => <Row key={r.key} r={r} testid={`sp-period-row-${r.key}`} />)}
                  {pm.fy && <Row r={pm.fy} testid="sp-period-row-FY" />}
                </tbody>
              </table>
            </div>
          )}
        </SectionState>
      </SectionCard>
    </div>
  );
}
