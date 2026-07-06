import React from 'react';
import { RotateCw } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import { Skeleton } from '../../ui/PanelSkeleton';

/**
 * PlanAnchorStrip — Game Plan v2 hub anchor (NEW chrome, EXISTING data).
 *
 * Leads with the income/commission need. Every figure is read from the
 * existing moneyNeeds worksheet output — no new data. Completeness % is
 * DERIVED (Money Needs filled = 1 of 4 steps → 25%); the status pill is a
 * static "Draft" (commit doesn't exist in Slice 1, so this is honest).
 *
 * Persist-shells: the `<section data-testid="game-plan-anchor">` shell renders in
 * ALL states — loading (skeleton values), error (in-place retry), empty (native
 * "build your plan"), ready — so the section never mounts/unmounts after the
 * screen-enter fade. Only inner values swap in when the worksheet resolves.
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
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          Check your connection and try again.
        </p>
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

  // Loading — skeleton the value-bearing elements; keep the shell + chip labels.
  if (loading) {
    return (
      <Shell>
        <div className="flex items-start justify-between gap-4" aria-busy="true" aria-label="Loading your plan">
          <div className="min-w-0 flex-1">
            <AnchorLabel year={year} />
            <Skeleton className="mt-2 h-6 w-3/4 max-w-md rounded" />
            <Skeleton className="mt-2.5 h-4 w-full max-w-md rounded" />
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">Plan Built</div>
            <Skeleton className="mt-1 ml-auto h-8 w-14 rounded" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {['After-Tax Need', 'Renewals Cover', 'Commission Need', 'API Commitment'].map((label) => (
            <div key={label} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-sm bg-surface-muted" aria-hidden="true" />
              <div className="flex flex-col leading-tight">
                <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</span>
                <Skeleton className="mt-1 h-4 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  const draft = statusToken('soft');
  const apiSet = typeof apiCommitment === 'number' && apiCommitment > 0;

  const chips = [
    { label: 'After-Tax Need', value: formatCurrency(afterTaxNeed), dot: 'bg-ink-muted' },
    { label: 'Renewals Cover', value: formatCurrency(renewalsCover), dot: 'bg-success' },
    { label: 'Commission Need', value: formatCurrency(commissionNeed), dot: 'bg-gold' },
    {
      label: 'API Commitment',
      value: apiSet ? formatCurrency(apiCommitment) : '—',
      hint: apiSet ? null : 'Set in your plan',
      dot: 'bg-primary',
    },
  ];

  return (
    <Shell>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AnchorLabel year={year} />
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${draft.tint} ${draft.text}`}
            >
              Draft
            </span>
          </div>

          <h2 className="mt-2 max-w-md font-display text-xl font-extrabold leading-tight tracking-tight text-ink">
            {moneyNeedsFilled && commissionNeed > 0 ? (
              <>
                Earn <span className="text-gold">{formatCurrency(commissionNeed)}</span> in commission to cover your year
              </>
            ) : (
              <>Build your {year} plan</>
            )}
          </h2>

          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-muted">
            {moneyNeedsFilled ? (
              <>
                {formatCurrency(grossNeed)} gross need, {formatCurrency(renewalsCover)} from your renewal book
                {' '}— leaving {formatCurrency(commissionNeed)} to earn
                {apiSet ? (
                  <>
                    , a <span className="font-semibold text-ink">{formatCurrency(apiCommitment)} API</span> commitment
                  </>
                ) : null}
                .
              </>
            ) : (
              <>Start with Money Needs to see what you need to earn this year.</>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Plan Built
          </div>
          <div className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight text-ink">
            {planBuiltPct}%
          </div>
          <div className="mt-1 font-mono text-[9px] text-ink-muted">
            {stepsBuilt} of {totalSteps} steps
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        {chips.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-sm ${c.dot}`} aria-hidden="true" />
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                {c.label}
              </span>
              <span className="mt-0.5 whitespace-nowrap font-display text-sm font-extrabold tracking-tight text-ink">
                {c.value}
                {c.hint ? (
                  <span className="ml-1.5 font-sans text-[9px] font-medium text-ink-muted">{c.hint}</span>
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
