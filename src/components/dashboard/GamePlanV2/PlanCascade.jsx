import React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import { allocationSegments, miniMonthBuckets } from '../../../lib/planCascadeViz';

// AllocationBar — segmented split of the planned annual API across the funded
// loop lines + a legend of dot · label · % chips (design: gameplan-pages.jsx).
function AllocationBar({ lines, lineKeys }) {
  const { segments } = allocationSegments(lines, lineKeys);
  if (segments.length === 0) return null;
  return (
    <div className="mt-2" data-testid="cascade-allocation-bar">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.key}
            className={s.dot}
            style={{ width: `${s.pct}%` }}
            data-testid={`cascade-alloc-seg-${s.key}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1" data-testid={`cascade-alloc-legend-${s.key}`}>
            <span className={`h-2 w-2 shrink-0 rounded-sm ${s.dot}`} aria-hidden="true" />
            <span className="font-mono text-[9px] font-bold text-ink">{s.label}</span>
            <span className="font-mono text-[9px] text-ink-muted">{Math.round(s.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// MiniMonthStrip — 12 tiny bars: past/current show actual, future shows target
// (design: gameplan-pages.jsx). Current month is gold, settled teal, future muted.
function MiniMonthStrip({ targets, actuals, currentMonthIndex }) {
  const buckets = miniMonthBuckets(targets, actuals, currentMonthIndex);
  return (
    <div className="mt-2 flex h-11 items-end gap-0.5" data-testid="cascade-mini-months" aria-hidden="true">
      {buckets.map((b) => (
        <div key={b.monthIndex} className="flex flex-1 flex-col items-center">
          <div
            className={`w-full rounded-sm ${
              b.kind === 'future'
                ? 'bg-surface-muted'
                : b.kind === 'current'
                ? 'bg-gold'
                : 'bg-primary'
            }`}
            style={{ height: `${b.heightPct}%` }}
            data-testid={`cascade-month-${b.monthIndex}`}
          />
        </div>
      ))}
    </div>
  );
}

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
 * Direction 1.5 (PR-U1): Money Needs + Year Plan collapse into one rung — the
 * Money Needs rung shows the commission need AND, once the merged allocator has
 * written the plan, the planned annual API. The Monthly and Review & Commit
 * rungs render as honest "Coming" states when the loop is gated off.
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
  yearPlanLines = null,
  lineKeys,
  monthlyPlanFilled = false,
  monthlyPlanTotal = 0,
  monthlyYtdDelta = 0,
  monthlyTargets = [],
  monthlyActuals = [],
  currentMonthIndex = 0,
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
        {yearPlanEnabled && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-gold/20 pt-2">
            <div className="text-xs text-ink-muted">Planned annual API</div>
            <div className="whitespace-nowrap font-display text-base font-extrabold tracking-tight text-ink">
              {yearPlanFilled ? formatCurrency(yearPlanTotalAPI) : (
                <span className="font-sans text-sm font-medium text-ink-muted">Allocate to set</span>
              )}
            </div>
          </div>
        )}
        {yearPlanEnabled && yearPlanFilled && (
          <AllocationBar lines={yearPlanLines} lineKeys={lineKeys} />
        )}
      </div>

      <CascadeArrow />
      {yearPlanEnabled ? (
        <div className="rounded-xl border border-primary/30 bg-primary-tint p-3.5">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            Step 2 · Monthly Plan
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-ink-muted">Per-month target</div>
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
                ? formatCurrency(monthlyPlanTotal / 12)
                : <span className="font-sans text-sm font-medium text-ink-muted">Set in your plan</span>}
            </div>
          </div>
          {monthlyPlanFilled && (
            <MiniMonthStrip
              targets={monthlyTargets}
              actuals={monthlyActuals}
              currentMonthIndex={currentMonthIndex}
            />
          )}
        </div>
      ) : (
        <ComingRung step="Step 2 · Monthly Plan" title="Monthly Plan" desc="Broken into 12 months" />
      )}

      <CascadeArrow />

      {yearPlanEnabled ? (
        committed ? (
          <div
            className={`rounded-xl border border-success/30 ${committedToken.tint} p-3.5`}
            data-testid="commit-rung-committed"
          >
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Step 3 · Review &amp; Commit
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
              Step 3 · Review &amp; Commit
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
        <ComingRung step="Step 3 · Review &amp; Commit" title="Review &amp; Commit" desc="Commit to your plan" />
      )}
    </div>
  );
}
