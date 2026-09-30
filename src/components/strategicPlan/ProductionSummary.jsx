import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { StatHero } from './planPrimitives';
import { fmtTTD, fmtPct, fmtSignedTTD } from './planFormat';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

// Track K — Production Summary (deck §03). Glass-hero summary + annual-vs-run-rate
// card (progress bar) + monthly prorated + persistency. All numbers from the
// single model; run-rate EOY = net ÷ elapsed fraction (brief §3 decision 6).

function heroItems(p) {
  return [
    { k: 'Annual quota', v: fmtTTD(p.annual.apiQuota), sub: 'branch objective' },
    { k: 'YTD net settled', v: fmtTTD(p.annual.apiNetSettled), sub: `${fmtPct(p.annual.apiPctAchieved)} achieved · ${fmtPct(p.elapsedPct)} elapsed` },
    { k: 'Run-rate · EOY', v: fmtTTD(p.annual.projectedApi), sub: 'net ÷ year elapsed' },
    p.annual.gapToQuota != null
      ? { k: 'Gap to quota', v: fmtSignedTTD(p.annual.gapToQuota), sub: `${fmtPct(p.annual.gapPct)} vs objective`, tone: p.annual.gapToQuota < 0 ? 'danger' : 'success' }
      : { k: 'Gap to quota', v: '—', sub: 'no quota set' },
  ];
}

function CardHead({ children }) {
  return (
    <div className="border-b border-border bg-surface-muted/50 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary">
      {children}
    </div>
  );
}

function KV({ label, value, tone }) {
  const c = tone === 'teal' ? 'text-primary' : tone === 'danger' ? 'text-danger-ink' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={`font-mono text-sm font-bold tabular-nums ${c}`}>{value}</span>
    </div>
  );
}

export default function ProductionSummary({ production, loading, error, onRetry }) {
  const p = production;
  const achieved = p ? Math.max(0, Math.min(100, p.annual.apiPctAchieved ?? 0)) : 0;
  return (
    <div className="space-y-3.5">
      {!loading && !error && p && !p.empty && <StatHero items={heroItems(p)} testid="sp-production-hero" />}
      <SectionCard id="production" num="03" title="Production Summary" subtitle="Branch quota, settled production, and run-rate projection">
        <SectionState
          loading={loading}
          error={error}
          empty={!loading && !error && (!p || p.empty)}
          emptyLabel="No settled production for this year yet."
          onRetry={onRetry}
        >
          {p && (
            <div className="grid gap-3.5 lg:grid-cols-3">
              {/* Annual quota vs run-rate */}
              <div className="overflow-hidden rounded-xl border border-border lg:col-span-2">
                <CardHead>Annual quota vs run-rate · TTD</CardHead>
                <div className="p-4">
                  <KV label="Annual quota" value={fmtTTD(p.annual.apiQuota)} />
                  <KV label="YTD net settled" value={fmtTTD(p.annual.apiNetSettled)} />
                  <KV label="YTD gross settled" value={fmtTTD(p.annual.apiGrossSettled)} />
                  <KV label="Avg monthly run-rate" value={fmtTTD(p.monthly.avgMonthlyApi)} />
                  <KV label="EOY projection" value={fmtTTD(p.annual.projectedApi)} tone="teal" />
                  {p.annual.gapToQuota != null && (
                    <KV label="Gap to quota" value={`${fmtSignedTTD(p.annual.gapToQuota)} · ${fmtPct(p.annual.gapPct)}`} tone={p.annual.gapToQuota < 0 ? 'danger' : undefined} />
                  )}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-1.5 rounded-full bg-primary dark:bg-primary-dark" style={{ width: `${achieved}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider">
                    <span className="text-ink-muted">{fmtPct(p.annual.apiPctAchieved)} achieved</span>
                    <span className={p.annual.gapToQuota != null && p.annual.gapToQuota < 0 ? 'text-warning-ink' : 'text-success-ink'}>
                      projected {fmtPct(p.annual.projectedApiPct)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly + persistency */}
              <div className="space-y-3.5">
                <div className="overflow-hidden rounded-xl border border-border">
                  <CardHead>Monthly · prorated</CardHead>
                  <div className="p-4">
                    <KV label="Monthly quota" value={fmtTTD(p.monthly.apiQuota)} />
                    <KV label="Avg monthly production" value={fmtTTD(p.monthly.avgMonthlyApi)} />
                    <KV label="% achieved" value={fmtPct(p.monthly.pctAchieved)} />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <CardHead>Persistency · floor 85%</CardHead>
                  <div className="p-4">
                    <KV label="Branch (current)" value={formatPersistencyPct(p.persistency.currentPct)} tone={p.persistency.currentPct != null && p.persistency.currentPct < 85 ? 'danger' : undefined} />
                    <KV label="EOY projection" value={p.persistency.eoyPct == null ? 'current only' : formatPersistencyPct(p.persistency.eoyPct)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionState>
      </SectionCard>
    </div>
  );
}
