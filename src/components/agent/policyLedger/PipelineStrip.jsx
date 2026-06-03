import React from 'react';
import { formatCompactTTD } from '../../../utils/formatters';
import { derivePipeline } from '../../../lib/policyLedgerDerivation';
import { statusToken } from '../../../lib/policyStatusTokens';

/**
 * PipelineStrip — Tier 1 of Policy Ledger v2. Stage tiles + YTD hero + the
 * Active-Book flow bar. Everything is client-derived from the policy list
 * (no new reads). Pure presentational.
 */
export default function PipelineStrip({ policies }) {
  const { stages, totalSum, inFlightSum, flow } = derivePipeline(policies);
  const count = Array.isArray(policies) ? policies.length : 0;

  return (
    <div className="card bg-card p-5" data-testid="policy-pipeline-strip">
      {/* Head: eyebrow + heading + YTD hero */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-muted">
            Your policy pipeline
          </p>
          <h2 className="font-display font-extrabold text-2xl tracking-tight text-ink mt-1">
            {count} {count === 1 ? 'policy' : 'policies'} in motion
          </h2>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-faint">TOTAL · YTD</p>
          <p className="font-display font-extrabold text-2xl text-primary tracking-tight mt-0.5" data-testid="pipeline-total">
            {formatCompactTTD(totalSum)}
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5">{formatCompactTTD(inFlightSum)} in flight</p>
        </div>
      </div>

      {/* Stage tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
        {stages.map((s) => {
          const t = statusToken(s.role);
          return (
            <div key={s.key} className="bg-surface-muted border border-border rounded-[10px] p-3" data-testid={`pipeline-tile-${s.key}`}>
              <div className={`w-[7px] h-[7px] rounded-full mb-2 ${t.solid}`} />
              <p className="font-mono text-[8.5px] font-bold tracking-[0.1em] text-ink-faint uppercase truncate">{s.label}</p>
              <p className="font-display font-extrabold text-xl tracking-tight text-ink mt-2 leading-none" data-testid={`pipeline-count-${s.key}`}>{s.count}</p>
              <p className="font-mono text-[10px] text-ink-muted mt-1.5">{formatCompactTTD(s.sum)}</p>
            </div>
          );
        })}
      </div>

      {/* Active-Book flow bar */}
      <div className="mt-[18px]">
        <div className="flex justify-between items-baseline mb-2">
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-faint">POLICY FLOW · ACTIVE BOOK</p>
          <p className="text-[11px] text-ink-muted"><b className="text-ink">{formatCompactTTD(inFlightSum)}</b> in flight · push these to settle</p>
        </div>
        <div className="flex h-3.5 rounded-full overflow-hidden bg-surface-muted gap-0.5" data-testid="flow-bar">
          {flow.map((seg) => (
            <div key={seg.key} className={seg.solid} style={{ width: `${seg.pct}%` }} aria-hidden="true" />
          ))}
        </div>
        <div className="flex gap-x-[18px] gap-y-2 mt-2.5 flex-wrap">
          {flow.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-muted tracking-[0.04em]">
              <i className={`w-2.5 h-2.5 rounded-[3px] ${seg.solid}`} />
              {seg.label.toUpperCase()} · <b className="text-ink">{formatCompactTTD(seg.sum)}</b> · {seg.pct}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
