import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { statusToken } from '../../../lib/policyStatusTokens';

/**
 * StepRail — Game Plan v2 four-step rail (NEW chrome).
 *
 * Money Needs is the only LIVE step (clickable → Money Needs). Year Plan /
 * Monthly Plan / Review & Commit render as honest "next / coming" states —
 * NOT interactive cards showing empty or fabricated data.
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

export default function StepRail({ moneyNeedsFilled, onOpenMoneyNeeds, onOpenYearPlan, yearPlanFilled }) {
  const step2Active = !!onOpenYearPlan;
  const step2Variant = step2Active ? (yearPlanFilled ? 'done' : 'current') : 'next';
  const step2Kicker = step2Active ? (yearPlanFilled ? 'Done' : 'Start') : 'Next';
  const step2Sub = step2Active ? (yearPlanFilled ? 'API allocated by line' : 'Allocate API by line') : 'Coming soon';
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" data-testid="game-plan-rail">
      <StepCard
        variant={moneyNeedsFilled ? 'done' : 'current'}
        num="1"
        kicker={moneyNeedsFilled ? 'Done' : 'Start'}
        title="Money Needs"
        sub="What you need to earn"
        onClick={onOpenMoneyNeeds}
      />
      <Chevron />
      <StepCard
        variant={step2Variant}
        num="2"
        kicker={step2Kicker}
        title="Year Plan"
        sub={step2Sub}
        onClick={onOpenYearPlan}
      />
      <Chevron />
      <StepCard variant="coming" num="3" kicker="Coming" title="Monthly Plan" sub="Coming soon" />
      <Chevron />
      <StepCard variant="coming" num="4" kicker="Coming" title="Review & Commit" sub="Coming soon" />
    </div>
  );
}
