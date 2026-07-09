/**
 * awardProvenance.jsx — Awards provenance SHELL primitives (item 3.4, flag
 * `awardsProvenance`). Rendered ONLY when the flag is ON, from AgentAwardsPanel
 * (the LedgerSourceChip) and inside AwardDrillDrawer (the AwardProvenancePanel);
 * with the flag OFF neither mounts and the awards surface is byte-identical.
 *
 * Design source: `docs/design-system/screens-v2/app-awards-v2.jsx`
 * (LedgerSourceChip · ContributionBar base-vs-campaign · AwardProvenancePanel
 * "how this is calculated"). The chip states the ACTUAL source (Policy Ledger
 * or confirmed settlements); the base segment is real; campaign attribution is
 * a documented pending row (see lib/awardProvenance.js).
 */
import React from 'react';
import { formatCurrency } from '../../utils/formatters';

function fmtUnit(v, unit) {
  if (unit === 'TTD') return formatCurrency(v);
  if (unit === '%') return `${Number(v).toFixed(1)}%`;
  return String(Math.round(v));
}

// ── LedgerSourceChip — honest "where this comes from" pill ───────────────────
export function LedgerSourceChip({ sourceLive = false, source = 'CONFIRMED SETTLEMENTS' }) {
  const label = sourceLive ? 'LIVE FROM POLICY LEDGER' : `FROM ${source}`;
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted border border-border"
      data-testid="ledger-source-chip"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
        {label}
      </span>
    </span>
  );
}

// ── ContributionBar — stacked base-vs-campaign bar ───────────────────────────
export function ContributionBar({ provenance }) {
  if (!provenance) return null;
  const total = provenance.target > 0 ? provenance.target : Math.max(provenance.settled, 1);
  return (
    <div
      className="flex h-3 rounded-full overflow-hidden bg-surface-muted border border-border"
      data-testid="award-contribution-bar"
    >
      {provenance.segments.map((s, i) => (
        <div
          key={i}
          className={s.kind === 'campaign' ? 'h-full bg-gold' : 'h-full bg-primary'}
          style={{ width: `${Math.min(100, (s.value / total) * 100)}%` }}
          title={`${s.label} · ${fmtUnit(s.value, provenance.unit)}`}
        />
      ))}
    </div>
  );
}

// ── AwardProvenancePanel — "how this is calculated" block ────────────────────
export function AwardProvenancePanel({ provenance }) {
  if (!provenance) return null;
  const sourceWord = provenance.sourceLive ? 'your policy ledger' : 'confirmed settlements';
  return (
    <div className="mt-4" data-testid="award-provenance-panel">
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          How this is calculated
        </p>
        <LedgerSourceChip sourceLive={provenance.sourceLive} source={provenance.source} />
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <span className="text-xs text-ink-muted">Settled, drawn from {sourceWord}</span>
          <span className="text-sm font-bold text-ink tabular-nums">
            {fmtUnit(provenance.settled, provenance.unit)}
            <span className="text-[11px] text-ink-muted font-mono ml-1">
              / {fmtUnit(provenance.target, provenance.unit)}
            </span>
          </span>
        </div>

        <ContributionBar provenance={provenance} />

        {/* Legend — base segment (real, derived) */}
        <div className="flex flex-col gap-2 mt-3">
          {provenance.segments.map((s, i) => {
            const isCampaign = s.kind === 'campaign';
            return (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${isCampaign ? 'bg-gold' : 'bg-primary'}`} />
                <span className="flex-1 text-xs font-semibold text-ink min-w-0">{s.label}</span>
                <span className="text-xs font-bold font-mono text-ink tabular-nums">
                  {fmtUnit(s.value, provenance.unit)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Campaign attribution — documented pending (not derivable from engine) */}
        {provenance.campaignPending && (
          <div
            className="flex items-center gap-2.5 mt-3 pt-3 border-t border-border"
            data-testid="award-provenance-campaign-pending"
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-surface-muted border border-ink-dim" />
            <span className="flex-1 text-xs text-ink-muted">
              Campaign attribution · not yet itemized
            </span>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wide text-ink-muted">
              pending
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-ink-muted leading-relaxed mt-3">
        Award totals are drawn from {sourceWord}. Campaign production rolls into
        annual awards unless a campaign is standalone; a per-campaign breakdown is
        pending and shown separately once wired.
      </p>
    </div>
  );
}
