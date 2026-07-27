import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * PlannerWeekNav — prev / next week + "Today" snap-back.
 *
 * ONE control, rendered by both the mobile Week view and the desktop board, both
 * driven by the panel's single `anchorDate` state — there is no second source of
 * week truth. Navigation is unlimited in both directions; the loaded window
 * follows the VIEWED week (see `loadEnd` in AgentPlannerPanel).
 *
 * PROVENANCE GAP (recorded deliberately): the planner-scheduler-v2 design
 * authority — `docs/design-system/proposals/planner-scheduler-v2/README.md` and
 * every mockup module under its `mockups/` — specifies the E1 Day / 3-day / Week
 * view toggle but is SILENT on week navigation: the boards are frozen on
 * "Tue 23 Jun 2026" and contain no prev/next affordance of any kind. This
 * control is therefore built minimal and conventional (chevrons + a range label
 * + Today), NOT ported from a mockup. If a future design pass specifies week
 * navigation, that spec wins over this component's choices.
 */
export default function PlannerWeekNav({
  rangeLabel,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
  className = '',
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`} data-testid="planner-week-nav">
      <button
        type="button"
        onClick={onPrev}
        data-testid="planner-week-prev"
        aria-label="Previous week"
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-surface transition-colors"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <span
        data-testid="planner-week-label"
        aria-live="polite"
        className="px-2 text-sm font-semibold text-ink tabular-nums whitespace-nowrap"
      >
        {rangeLabel}
      </span>
      <button
        type="button"
        onClick={onNext}
        data-testid="planner-week-next"
        aria-label="Next week"
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-surface transition-colors"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {/* Snap-back is offered only when it would do something — on the current
          week the button would be a no-op, and a permanently-inert control
          reads as broken. */}
      {!isCurrentWeek && (
        <button
          type="button"
          onClick={onToday}
          data-testid="planner-week-today"
          className="ml-1 min-h-[44px] px-3 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}
