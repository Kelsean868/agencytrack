import React from 'react';
import { Plus } from 'lucide-react';
import { sortByStartTime, dayLabel, shiftDateStr } from './planner.helpers';

/**
 * PlannerDesktopBoard — Planner v2 E1 desktop multi-day board.
 *
 * Renders side-by-side day columns for the selected span (Day / 3 days / Week),
 * mounted only at the `lg` breakpoint by AgentPlannerPanel (via useIsDesktop).
 * Columns are fluid (`1fr` via Tailwind grid-cols-N — never fixed-width), so the
 * board reclaims space when the sidebar collapses (E5, which lifts the panel's
 * width cap on desktop). The appointment cards themselves are rendered by the
 * parent through `renderCard`, so every card keeps the exact churn / select /
 * conflict / series wiring the mobile views use — the board is a layout, not a
 * fork of the interaction model.
 *
 * Span → columns:
 *   day  → [today]
 *   3day → [today, today+1, today+2]      (today-anchored)
 *   week → the Sun–Sat weekDates          (calendar week)
 * Week uses `dense` cards (README: "week = compact chips") in tighter columns.
 *
 * No date math of its own beyond `shiftDateStr` (the banked A5 helper) — grouping
 * and sorting reuse `byDate` / `sortByStartTime` from planner.helpers.
 */

// Day-span options (render the column grid). Follow-ups is appended as a 4th
// toggle option so desktop keeps the follow-ups view the single-column layout
// had — it renders the parent-provided `followupsSlot`, not columns.
const BOARD_SPANS = [
  { key: 'day', label: 'Day', days: 1 },
  { key: '3day', label: '3 days', days: 3 },
  { key: 'week', label: 'Week', days: 7 },
];

const GRID_COLS = { day: 'grid-cols-1', '3day': 'grid-cols-3', week: 'grid-cols-7' };

export default function PlannerDesktopBoard({
  span = '3day',
  onSpanChange,
  today,
  weekDates = [],
  byDate,
  onBook,
  renderCard,
  followupsSlot = null,
  followupsCount = 0,
}) {
  const showFollowups = span === 'followups';
  const columns = span === 'week'
    ? weekDates
    : Array.from({ length: span === '3day' ? 3 : 1 }, (_, i) => shiftDateStr(today, i));
  const dense = span === 'week';

  return (
    <div data-testid="planner-desktop-board">
      {/* View toggle (Day / 3 days / Week / Follow-ups) */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Planner view">
        {BOARD_SPANS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={span === s.key}
            onClick={() => onSpanChange?.(s.key)}
            data-testid={`planner-span-${s.key}`}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
              span === s.key
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-card border-border text-ink-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={showFollowups}
          onClick={() => onSpanChange?.('followups')}
          data-testid="planner-span-followups"
          className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
            showFollowups
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-card border-border text-ink-muted hover:text-ink'
          }`}
        >
          Follow-ups
          {followupsCount > 0 && <span className="ml-1.5 text-[11px] font-mono">({followupsCount})</span>}
        </button>
      </div>

      {showFollowups ? (
        followupsSlot
      ) : (
      /* Day columns — fluid 1fr via grid-cols-N */
      <div className={`grid gap-3 ${GRID_COLS[span] ?? 'grid-cols-3'}`}>
        {columns.map((date) => {
          const dayAppts = sortByStartTime(byDate.get(date) || []);
          const isToday = date === today;
          return (
            <div
              key={date}
              data-testid={`planner-day-col-${date}`}
              className="rounded-xl bg-card border border-border p-3 min-w-0 flex flex-col"
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className={`text-sm font-semibold truncate ${isToday ? 'text-primary' : 'text-ink'}`}>
                  {dayLabel(date)}{isToday && ' · Today'}
                </span>
                <button
                  type="button"
                  onClick={() => onBook?.(date)}
                  aria-label={`Book on ${dayLabel(date)}`}
                  data-testid={`planner-day-add-${date}`}
                  className="inline-flex items-center justify-center shrink-0 min-w-[44px] min-h-[44px] rounded-lg text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              {dayAppts.length === 0 ? (
                <p data-testid={`planner-day-empty-${date}`} className="text-xs text-ink-muted italic">
                  No appointments
                </p>
              ) : (
                <div className={`flex flex-col ${dense ? 'gap-1.5' : 'gap-2'}`}>
                  {dayAppts.map((a) => renderCard(a, { dense }))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
