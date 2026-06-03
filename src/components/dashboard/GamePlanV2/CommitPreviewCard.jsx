import React from 'react';
import { Lock, ArrowRight, ArrowUpRight } from 'lucide-react';

/**
 * CommitPreviewCard — Game Plan v2 Step 4 (NEW chrome).
 *
 * A disabled PREVIEW affordance with honest copy: the commit → Goals write is
 * deferred to a later slice. The "View your Goals page" link is LIVE — it
 * routes to the existing Goals destination where commit would write later.
 */
export default function CommitPreviewCard({ year, onOpenGoals }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-border bg-card p-4 opacity-95" data-testid="game-plan-commit">
      <span className="absolute right-3.5 top-3.5 flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-ink">
        <Lock size={9} aria-hidden="true" /> Preview
      </span>

      <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        Step 4 · Review &amp; Commit
      </div>
      <div className="mt-2 font-display text-base font-extrabold tracking-tight text-ink-muted">
        Lock your plan to set your Goals
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
        Committing <em>will</em> write your API + apps to the Goals page as your personal commitment.{' '}
        <span className="font-semibold text-ink-muted">Available once the Year &amp; Monthly steps ship.</span>
      </p>

      <button
        type="button"
        disabled
        aria-disabled="true"
        data-testid="game-plan-commit-btn"
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-surface-muted px-3 text-sm font-bold text-ink-muted"
      >
        Commit {year} plan
        <ArrowRight size={14} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onOpenGoals}
        data-testid="game-plan-goals-link"
        className="mt-2.5 flex min-h-[44px] items-center gap-1.5 font-mono text-[11px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowUpRight size={13} aria-hidden="true" /> View your Goals page
      </button>
    </div>
  );
}
