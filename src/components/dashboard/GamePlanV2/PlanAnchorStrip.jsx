import React from 'react';
import { RotateCw } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import { SkeletonText } from '../../ui/PanelSkeleton';

/**
 * PlanAnchorStrip — Game Plan v2 hub anchor (NEW chrome, EXISTING data).
 *
 * Text-identical loading/ready tree: ONE tree renders in loading AND ready — the
 * outer structure (columns, label, Draft pill, %, steps, chip skeleton) is the
 * SAME in both, and only leaf TEXT changes (a geometry-stable SkeletonText
 * placeholder → the real figure). So loading→ready is a text-content update, not
 * a node insert/remove: no late section mount, no layout shift.
 *
 * Residual (Rule 23): the headline + subtitle are rich SENTENCES that change by
 * data (empty vs filled), so they genuinely restructure — kept height-reserved
 * (min-h) as a best-effort geometry hold; their late text-paint is the expected
 * irreducible remainder. error/empty render in the same persisted shell.
 */
function Shell({ children }) {
  return (
    <section className="rounded-2xl border border-warning/40 bg-card p-5 shadow-sm" data-testid="game-plan-anchor">
      {children}
    </section>
  );
}

function AnchorLabel({ year }) {
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-warning-ink">
      Your {year} Plan
    </span>
  );
}

// Stable chip definitions — same order/labels/dots in loading and ready.
const CHIP_DEFS = [
  { key: 'afterTax', label: 'After-Tax Need', dot: 'bg-ink-muted', reserveCh: 10 },
  { key: 'renewals', label: 'Renewals Cover', dot: 'bg-success', reserveCh: 10 },
  { key: 'commission', label: 'Commission Need', dot: 'bg-gold', reserveCh: 10 },
  { key: 'api', label: 'API Commitment', dot: 'bg-primary', reserveCh: 10 },
];

export default function PlanAnchorStrip({
  year,
  commissionNeed,
  afterTaxNeed,
  renewalsCover,
  grossNeed,
  apiCommitment,
  planBuiltPct,
  stepsBuilt,
  totalSteps,
  moneyNeedsFilled,
  loading = false,
  error = false,
  onRetry,
}) {
  // Error — in place, with retry. Shell + testid persist (no mount swap).
  if (error) {
    return (
      <Shell>
        <AnchorLabel year={year} />
        <h2 className="mt-2 font-display text-xl font-extrabold leading-tight tracking-tight text-ink">
          Couldn&apos;t load your plan
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">Check your connection and try again.</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="game-plan-anchor-retry"
          >
            <RotateCw size={15} aria-hidden="true" /> Retry
          </button>
        ) : null}
      </Shell>
    );
  }

  const draft = statusToken('soft');
  const apiSet = !loading && typeof apiCommitment === 'number' && apiCommitment > 0;
  const filled = !loading && moneyNeedsFilled;
  const chipValue = {
    afterTax: formatCurrency(afterTaxNeed),
    renewals: formatCurrency(renewalsCover),
    commission: formatCurrency(commissionNeed),
    api: apiSet ? formatCurrency(apiCommitment) : '—',
  };

  return (
    <Shell>
      <div className="flex items-start justify-between gap-4" aria-busy={loading || undefined}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AnchorLabel year={year} />
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${draft.tint} ${draft.text}`}
            >
              Draft
            </span>
          </div>

          {/* Headline — genuine restructure (sentence depends on data); height held. */}
          <h2 className="mt-2 flex min-h-[1.75rem] max-w-md items-center font-display text-xl font-extrabold leading-tight tracking-tight text-ink">
            {loading ? (
              <span className="h-5 w-64 max-w-full rounded bg-surface-muted motion-safe:animate-pulse" aria-hidden="true" />
            ) : filled && commissionNeed > 0 ? (
              <span>
                Earn <span className="text-gold">{formatCurrency(commissionNeed)}</span> in commission to cover your year
              </span>
            ) : (
              <span>Build your {year} plan</span>
            )}
          </h2>

          <p className="mt-1.5 min-h-[2rem] max-w-md text-xs leading-relaxed text-ink-muted">
            {loading ? (
              <span aria-hidden="true">
                <span className="block h-3 w-full rounded bg-surface-muted motion-safe:animate-pulse" />
                <span className="mt-1 block h-3 w-2/3 rounded bg-surface-muted motion-safe:animate-pulse" />
              </span>
            ) : filled ? (
              <span>
                {formatCurrency(grossNeed)} gross need, {formatCurrency(renewalsCover)} from your renewal book
                {' '}— leaving {formatCurrency(commissionNeed)} to earn
                {apiSet ? (
                  <>
                    , a <span className="font-semibold text-ink">{formatCurrency(apiCommitment)} API</span> commitment
                  </>
                ) : null}
                .
              </span>
            ) : (
              <span>Start with Money Needs to see what you need to earn this year.</span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">Plan Built</div>
          <div className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight text-ink">
            <SkeletonText loading={loading} reserveCh={3}>{planBuiltPct}%</SkeletonText>
          </div>
          <div className="mt-1 font-mono text-[9px] text-ink-muted">
            <SkeletonText loading={loading} reserveCh={11}>{stepsBuilt} of {totalSteps} steps</SkeletonText>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        {CHIP_DEFS.map((cd) => (
          <div key={cd.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-sm ${loading ? 'bg-surface-muted' : cd.dot}`} aria-hidden="true" />
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-muted">{cd.label}</span>
              <span className="mt-0.5 whitespace-nowrap font-display text-sm font-extrabold tracking-tight text-ink">
                <SkeletonText loading={loading} reserveCh={cd.reserveCh}>{loading ? null : chipValue[cd.key]}</SkeletonText>
                {!loading && cd.key === 'api' && !apiSet ? (
                  <span className="ml-1.5 font-sans text-[9px] font-medium text-ink-muted">Set in your plan</span>
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
