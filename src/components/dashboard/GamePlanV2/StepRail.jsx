import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { statusToken } from '../../../lib/policyStatusTokens';
import { Skeleton } from '../../ui/PanelSkeleton';

/**
 * StepRail — Game Plan v2 three-step rail (NEW chrome).
 *
 * Direction 1.5 (PR-U1): the merged Money Needs + Allocator surface IS the
 * year-plan editor, so Money Needs + Year Plan collapse into one step. The rail
 * is Money Needs → Monthly Plan → Review & Commit. Money Needs is the only
 * always-LIVE step (clickable → Money Needs); Monthly Plan / Review & Commit
 * render as honest "next / coming" states — NOT cards showing fabricated data.
 *
 * Semantic roles per the build annotation, resolved through statusToken():
 *   done    → settled  (success)   current → in-flight (teal accent)
 *   next    → in-flight (teal)      coming  → closed    (muted)
 */
const RAIL_TOKEN_ROLE = {
  done: 'settled',
  current: 'in-flight',
  next: 'in-flight',
  coming: 'closed',
};

function StepCard({ variant, num, kicker, title, sub, onClick }) {
  const token = statusToken(RAIL_TOKEN_ROLE[variant]);
  const tinted = variant === 'current' || variant === 'next';
  const cardClass = tinted
    ? `${token.tint} border-primary/30`
    : `bg-card border-border${variant === 'coming' ? ' opacity-70' : ''}`;

  const circleClass =
    variant === 'coming'
      ? 'bg-surface-muted text-ink-muted'
      : `${token.solid} text-white`;

  const inner = (
    <>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-extrabold ${circleClass}`}
        aria-hidden="true"
      >
        {variant === 'done' ? <Check size={14} strokeWidth={3} /> : num}
      </span>
      <span className="min-w-0 text-left">
        <span className={`block font-mono text-[8px] font-bold uppercase tracking-[0.1em] ${token.text}`}>
          {kicker}
        </span>
        <span className="mt-0.5 block truncate text-xs font-bold tracking-tight text-ink">{title}</span>
        <span className="block text-[9px] text-ink-muted">{sub}</span>
      </span>
    </>
  );

  const base = `flex flex-1 items-center gap-3 rounded-xl border p-3 ${cardClass}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} min-h-[44px] text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={base} aria-disabled="true">
      {inner}
    </div>
  );
}

function Chevron() {
  return (
    <div className="flex shrink-0 items-center text-ink-muted" aria-hidden="true">
      <ChevronRight size={16} />
    </div>
  );
}

export default function StepRail({
  moneyNeedsFilled,
  onOpenMoneyNeeds,
  yearPlanFilled,
  onOpenMonthlyPlan,
  monthlyPlanFilled = false,
  onOpenReviewCommit,
  committed = false,
  loading = false,
}) {
  // Loading — skeleton the three step cards; the rail shell + testid persist (no
  // mount swap). No error branch: Money Needs stays navigable regardless of fetch.
  if (loading) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" data-testid="game-plan-rail" aria-busy="true" aria-label="Loading plan steps">
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Chevron />
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Chevron />
        <Skeleton className="h-16 flex-1 rounded-xl" />
      </div>
    );
  }
  // Direction 1.5 (PR-U1): Money Needs + Year Plan collapse into ONE step — the
  // merged Money Needs + Allocator surface writes the yearPlan. `yearPlanFilled`
  // (the merged write) is now Step 1's completion signal; `moneyNeedsFilled`
  // (worksheet started) drives the in-progress vs not-started copy.
  const step1Variant = yearPlanFilled ? 'done' : 'current';
  const step1Kicker = yearPlanFilled ? 'Done' : moneyNeedsFilled ? 'In progress' : 'Start';
  const step1Sub = yearPlanFilled ? 'Allocated by line' : 'What you need & how you write it';

  const step2Active = !!onOpenMonthlyPlan;
  const step2Variant = step2Active
    ? (monthlyPlanFilled ? 'done' : yearPlanFilled ? 'current' : 'next')
    : 'coming';
  const step2Kicker = step2Active
    ? (monthlyPlanFilled ? 'Done' : yearPlanFilled ? 'Start' : 'Next')
    : 'Coming';
  const step2Sub = step2Active ? 'Split into months' : 'Coming soon';

  const step3Active = !!onOpenReviewCommit && monthlyPlanFilled;
  const step3Variant = committed ? 'done' : step3Active ? 'current' : 'coming';
  const step3Kicker = committed ? 'Done' : step3Active ? 'Review' : 'Coming';
  const step3Sub = committed ? 'Plan committed' : step3Active ? 'Review & commit your plan' : 'Coming soon';

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" data-testid="game-plan-rail">
      <StepCard
        variant={step1Variant}
        num="1"
        kicker={step1Kicker}
        title="Money Needs"
        sub={step1Sub}
        onClick={onOpenMoneyNeeds}
      />
      <Chevron />
      <StepCard
        variant={step2Variant}
        num="2"
        kicker={step2Kicker}
        title="Monthly Plan"
        sub={step2Sub}
        onClick={step2Active ? onOpenMonthlyPlan : undefined}
      />
      <Chevron />
      <StepCard
        variant={step3Variant}
        num="3"
        kicker={step3Kicker}
        title="Review & Commit"
        sub={step3Sub}
        onClick={step3Active ? onOpenReviewCommit : undefined}
      />
    </div>
  );
}
