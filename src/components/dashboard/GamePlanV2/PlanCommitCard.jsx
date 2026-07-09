import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import { commitChecklist, commitReady } from '../../../lib/planCascadeViz';

/**
 * PlanCommitCard — the mockup's inline "Review & Commit" hub card + "Before you
 * commit" checklist (gameplan-pages.jsx, agent view). Read-only affordance: it
 * OPENS the existing ReviewCommitModal (`onOpenReviewCommit`) — the modal stays
 * the single commit write path. The checklist is completion-DERIVED (not stored).
 *
 * Only mounts under the loop flag; the caller gates on yearPlanEnabled.
 */
export default function PlanCommitCard({
  moneyNeedsFilled = false,
  yearPlanFilled = false,
  monthlyPlanFilled = false,
  committed = false,
  committedAnnualAPI = null,
  onOpenReviewCommit,
}) {
  const items = commitChecklist({ moneyNeedsFilled, yearPlanFilled, monthlyPlanFilled });
  const ready = commitReady({ moneyNeedsFilled, yearPlanFilled, monthlyPlanFilled });
  const committedToken = statusToken('settled');

  return (
    <div className="card" data-testid="plan-commit-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Step 3 · Review &amp; Commit
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">
            {committed ? 'Your plan is committed' : 'Lock your plan to set your Goals'}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {committed
              ? 'Managers can see your target — only you can change it.'
              : 'Committing writes your Personal Commitment to your Goals page.'}
          </p>
        </div>
        {committed && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-wider ${committedToken.tint} ${committedToken.text}`}
            data-testid="plan-commit-card-committed"
          >
            Committed
          </span>
        )}
      </div>

      {/* Before you commit — completion-derived readiness checklist */}
      <ul className="mb-3 space-y-1" data-testid="plan-commit-checklist">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2.5 py-1"
            data-testid={`commit-check-${item.key}`}
            data-done={item.done ? 'true' : 'false'}
          >
            <span
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${
                item.done ? 'bg-success' : 'border border-ink-dim bg-surface-muted'
              }`}
              aria-hidden="true"
            >
              {item.done && <Check size={11} strokeWidth={3} className="text-white" />}
            </span>
            <span
              className={`text-xs font-semibold ${
                item.done ? 'text-ink-muted line-through' : 'text-ink'
              }`}
            >
              {item.label}
            </span>
            <span className="sr-only">{item.done ? 'done' : 'not done'}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpenReviewCommit}
        disabled={!onOpenReviewCommit}
        data-testid="plan-commit-cta"
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 dark:bg-primary-dark dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {committed
          ? 'Review your plan'
          : ready
          ? 'Review & commit your plan'
          : 'Review your plan'}
        <ArrowRight size={15} aria-hidden="true" />
      </button>

      {!committed && !ready && (
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          Finish the steps above to commit.
        </p>
      )}
      {committedAnnualAPI != null && committed && (
        <p className="mt-2 text-center text-[11px] text-ink-muted" data-testid="plan-commit-card-api">
          Personal commitment · {formatCurrency(committedAnnualAPI)}
        </p>
      )}
    </div>
  );
}
