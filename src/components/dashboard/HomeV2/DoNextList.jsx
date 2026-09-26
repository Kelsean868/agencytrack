import React from 'react';
import { AlertTriangle, Check, ChevronRight, ClipboardList, RotateCcw } from 'lucide-react';

/**
 * DoNextList — Home redesign R1 block 4 ("Do next").
 *
 * Up to three items, each built only from real data and each a real link;
 * an item whose condition does not hold is simply absent. With none, one line
 * says "You're on track this week." — no empty card. The sample copy in the
 * mockups ("Book 2 fact-finds") is not rendered.
 */

const TONE = {
  teal: 'bg-primary-tint text-primary',
  warning: 'bg-warning-tint text-warning-ink',
  neutral: 'bg-surface-muted text-ink',
};

const ICONS = { confirm: Check, winback: RotateCcw, standard: ClipboardList };

function DoNextSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" data-testid="do-next-loading" aria-busy="true" aria-label="Loading what to do next">
      {[0, 1].map((i) => (
        <div key={i} className="h-16 rounded-2xl bg-surface-muted motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export default function DoNextList({ items = [], loading = false, incomplete = false, onRetry, onSelect }) {
  return (
    <section aria-label="Do next" className="flex flex-col gap-2.5" data-testid="do-next">
      <h2 className="font-display text-xl font-bold text-ink">Do next</h2>
      {loading ? (
        <DoNextSkeleton />
      ) : (
        <>
          {items.map((item) => {
            const Icon = ICONS[item.id] ?? ClipboardList;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.target)}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-ink-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid={`do-next-${item.id}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[item.tone] ?? TONE.neutral}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-ink">{item.title}</span>
                  <span className="text-[13px] text-ink-muted">{item.sub}</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
              </button>
            );
          })}
          {incomplete && (
            <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-warning-ink" data-testid="do-next-incomplete">
              <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
              <span>Some checks need your policy ledger, which didn&apos;t load.</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {items.length === 0 && !incomplete && (
            <p className="text-sm text-ink-muted" data-testid="do-next-on-track">You&apos;re on track this week.</p>
          )}
        </>
      )}
    </section>
  );
}
