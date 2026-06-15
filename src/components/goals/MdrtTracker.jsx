import React, { useMemo } from 'react';
import { Trophy, CheckCircle2, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { MDRT_THRESHOLDS_2026 } from '../../config/mdrtThresholds/2026';

const YEAR = 2026;

const TIERS = [
  { id: 'mdrt', label: 'MDRT', threshold: MDRT_THRESHOLDS_2026.mdrt },
  { id: 'cot',  label: 'COT',  threshold: MDRT_THRESHOLDS_2026.cot  },
  { id: 'tot',  label: 'TOT',  threshold: MDRT_THRESHOLDS_2026.tot  },
];

function LoadingSkeleton() {
  return (
    <div className="card" data-testid="mdrt-tracker-loading">
      <div className="flex flex-col gap-4">
        <div className="h-5 w-2/5 rounded-lg bg-surface-muted animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function NoProductionState() {
  return (
    <div className="card text-center" data-testid="mdrt-tracker-no-production">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-tint flex items-center justify-center mb-4">
        <Trophy size={22} className="text-primary" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-ink mb-1">No production recorded yet</p>
      <p className="text-xs text-ink-muted">
        Submit your first report to see your MDRT / COT / TOT progress.
      </p>
    </div>
  );
}

function TierRow({ tier, isNearest }) {
  const { id, label, threshold, progress, gap, met } = tier;

  const containerClass = met
    ? 'border-success/30 bg-success-tint'
    : isNearest
    ? 'border-primary/40 bg-primary-tint'
    : 'border-border bg-surface-raised';

  const labelClass = met
    ? 'text-success-ink'
    : isNearest
    ? 'text-primary'
    : 'text-ink';

  const pctClass = met
    ? 'text-success-ink'
    : isNearest
    ? 'text-primary'
    : 'text-ink-muted';

  const barClass = met
    ? 'bg-success'
    : isNearest
    ? 'bg-primary'
    : 'bg-ink-muted/40';

  return (
    <div
      className={`flex flex-col gap-2 p-3 rounded-xl border ${containerClass}`}
      data-testid={`mdrt-tier-${id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {met ? (
            <CheckCircle2 size={14} className="text-success-ink shrink-0" aria-hidden="true" />
          ) : (
            <Trophy
              size={14}
              className={`shrink-0 ${isNearest ? 'text-primary' : 'text-ink-muted'}`}
              aria-hidden="true"
            />
          )}
          <span className={`text-sm font-bold ${labelClass}`}>{label}</span>
          {isNearest && (
            <span className="text-[10px] font-bold tracking-widest uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
              Active target
            </span>
          )}
          {met && (
            <span className="text-[10px] font-bold tracking-widest uppercase text-success-ink bg-success/10 px-2 py-0.5 rounded-full whitespace-nowrap">
              Achieved
            </span>
          )}
        </div>
        <span
          className={`text-sm font-bold tabular-nums shrink-0 ${pctClass}`}
          data-testid={`mdrt-progress-${id}`}
        >
          {progress}%
        </span>
      </div>

      <div
        className="h-2 rounded-full bg-surface-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress: ${progress}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {!met && (
        <p className="text-[11px] text-ink-muted" data-testid={`mdrt-gap-${id}`}>
          {formatCurrency(gap)} more API needed · threshold {formatCurrency(threshold)}
        </p>
      )}
    </div>
  );
}

export default function MdrtTracker({ ytdTotals, loading }) {
  const ytdAPI = ytdTotals?.api ?? 0;

  const tiers = useMemo(
    () =>
      TIERS.map((t) => ({
        ...t,
        progress: Math.max(0, Math.min(100, Math.round((ytdAPI / t.threshold) * 100))),
        gap:      Math.max(0, t.threshold - ytdAPI),
        met:      ytdAPI >= t.threshold,
      })),
    [ytdAPI],
  );

  const nearest = tiers.find((t) => !t.met) ?? null;

  if (loading) return <LoadingSkeleton />;
  if (ytdAPI === 0) return <NoProductionState />;

  return (
    <div className="card flex flex-col gap-4" data-testid="mdrt-tracker">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-tint flex items-center justify-center shrink-0">
          <Trophy size={18} className="text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink">MDRT / COT / TOT Progress · {YEAR}</p>
          <p className="text-xs text-ink-muted">Indicative — based on your API</p>
        </div>
        <span className="text-[10px] font-bold tracking-widest font-mono uppercase text-ink-muted bg-surface-muted px-2 py-1 rounded-lg border border-border whitespace-nowrap">
          Indicative
        </span>
      </div>

      {/* Tier rows */}
      <div className="flex flex-col gap-3">
        {tiers.map((tier) => (
          <TierRow key={tier.id} tier={tier} isNearest={tier.id === nearest?.id} />
        ))}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-raised border border-border">
        <Info size={12} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Indicative goal-tracking only, not an official MDRT qualification calculation. Real MDRT
          premium credit may vary by product category. Thresholds: MDRT{' '}
          {formatCurrency(MDRT_THRESHOLDS_2026.mdrt)} · COT{' '}
          {formatCurrency(MDRT_THRESHOLDS_2026.cot)} · TOT{' '}
          {formatCurrency(MDRT_THRESHOLDS_2026.tot)} (T&T premium method, {YEAR}).
        </p>
      </div>
    </div>
  );
}
