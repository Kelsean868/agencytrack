import React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';

function formatSeal(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-TT', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

/**
 * PlanCascade — Game Plan v2 "plan so far" (NEW chrome, read-only).
 *
 * The live rung shows the real Money Needs commission total. The Year Plan
 * and Monthly rungs render as honest "Coming" states — not empty or
 * fabricated data.
 */
function ComingRung({ step, title, desc }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-raised p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {step}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">{desc}</div>
        </div>
        <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-ink-muted">
          Coming
        </span>
      </div>
      <span className="sr-only">{title} — coming soon</span>
    </div>
  );
}

function CascadeArrow() {
  return (
    <div className="flex justify-center py-1 text-ink-muted" aria-hidden="true">
      <ChevronDown size={16} />
    </div>
  );
}

export default function PlanCascade({
  commissionNeed,
  moneyNeedsFilled,
  yearPlanEnabled,
  yearPlanTotalAPI,
  yearPlanFilled,
  monthlyPlanFilled = false,
  monthlyPlanTotal = 0,
  monthlyYtdDelta = 0,
  committed = false,
  committedAt = null,
}) {
  const committedToken = statusToken('settled');
  return (
    <div className="card" data-testid="game-plan-cascade">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          The plan so far
        </span>
        <span className="font-mono text-[9px] text-ink-muted">Need → split → months</span>
      </div>

      <div className="rounded-xl border border-gold/30 bg-gold-tint p-3.5">
        <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          Step 1 · Money Needs
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="text-xs text-ink-muted">Commission you must earn this year</div>
          <div className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight text-ink">
            {moneyNeedsFilled ? formatCurrency(commissionNeed) : 'Not started'}
          </div>
        </div>
      </div>

      <CascadeArrow />

      {yearPlanEnabled ? (
        <div className="rounded-xl border border-primary/30 bg-primary-tint p-3.5">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            Step 2 · Year Plan
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="text-xs text-ink-muted">Planned annual API</div>
            <div className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight text-ink">
              {yearPlanFilled ? formatCurrency(yearPlanTotalAPI) : (
                <span className="font-sans text-sm font-medium text-ink-muted">Set in your plan</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ComingRung step="Step 2 · Year Plan" title="Year Plan" desc="Split across product lines" />
      )}

      <CascadeArrow />
      {yearPlanEnabled ? (
        <div className="rounded-xl border border-primary/30 bg-primary-tint p-3.5">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            Step 3 · Monthly Plan
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-ink-muted">Annual target split into 12 months</div>
              {monthlyPlanFilled && (
                <div
                  className={`mt-1 font-mono text-[9px] font-bold ${
                    monthlyYtdDelta > 0
                      ? 'text-success-ink'
                      : monthlyYtdDelta < 0
                      ? 'text-danger-ink'
                      : 'text-ink-muted'
                  }`}
                  data-testid="monthly-ytd-badge"
                >
                  {monthlyYtdDelta > 0
                    ? `+${formatCurrency(monthlyYtdDelta)} ahead`
                    : monthlyYtdDelta < 0
                    ? `${formatCurrency(Math.abs(monthlyYtdDelta))} behind`
                    : 'on pace'}
                </div>
              )}
            </div>
            <div className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight text-ink">
              {monthlyPlanFilled
                ? formatCurrency(monthlyPlanTotal)
                : <span className="font-sans text-sm font-medium text-ink-muted">Set in your plan</span>}
            </div>
          </div>
        </div>
      ) : (
        <ComingRung step="Step 3 · Monthly Plan" title="Monthly Plan" desc="Broken into 12 months" />
      )}

      <CascadeArrow />

      {yearPlanEnabled ? (
        committed ? (
          <div
            className={`rounded-xl border border-success/30 ${committedToken.tint} p-3.5`}
            data-testid="commit-rung-committed"
          >
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Step 4 · Review &amp; Commit
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="text-xs text-ink-muted">
                {committedAt ? `Committed · ${formatSeal(committedAt)} TT` : 'Committed'}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-wider ${committedToken.tint} ${committedToken.text}`}
              >
                Committed
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary-tint p-3.5" data-testid="commit-rung-ready">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Step 4 · Review &amp; Commit
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="text-xs text-ink-muted">Commit to your plan</div>
              <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-ink-muted">
                Next
              </span>
            </div>
          </div>
        )
      ) : (
        <ComingRung step="Step 4 · Review &amp; Commit" title="Review &amp; Commit" desc="Commit to your plan" />
      )}
    </div>
  );
}
