import React, { useState, useRef } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import {
  sortByStartTime, dayLabel, shiftDateStr, computeDayGaps, RETIRED_STATUSES,
} from './planner.helpers';

/**
 * PlannerDesktopBoard — Planner v2 E1 desktop multi-day board + E2 drag-drop.
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
 * E2 drag-drop: each live card is draggable (grip affordance). Dragging shows
 * drop targets — the day columns (drop = change DAY, keep time) and per-day gap
 * slots between cards (drop = change TIME to that hole, and that column's day).
 * On drop the parent's `onReschedule(appt, { date, startTime })` calls the
 * EXISTING `postponeWithRebook` (drag is a faster path to the same move, not a
 * new mutation). Retired cards are not draggable. The churn dialog stays the tap
 * path (and the only mobile path) + the keyboard alternative.
 *
 * Span → columns:
 *   day  → [today]
 *   3day → [today, today+1, today+2]      (today-anchored)
 *   week → the Sun–Sat weekDates          (calendar week)
 * Week uses `dense` cards (README: "week = compact chips") in tighter columns.
 */

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
  onReschedule,
  followupsSlot = null,
  followupsCount = 0,
}) {
  const showFollowups = span === 'followups';
  const columns = span === 'week'
    ? weekDates
    : Array.from({ length: span === '3day' ? 3 : 1 }, (_, i) => shiftDateStr(today, i));
  const dense = span === 'week';

  // E2 drag state. draggedApptRef holds the full appt (not serialized through
  // dataTransfer — a component ref is simpler and the board never leaves this
  // tree); dropZone is the currently hovered target key (for the teal highlight).
  const [draggingId, setDraggingId] = useState(null);
  const [dropZone, setDropZone] = useState(null);
  const draggedApptRef = useRef(null);

  const startDrag = (e, a) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', a.id); // Firefox needs data to start a drag
    draggedApptRef.current = a;
    setDraggingId(a.id);
  };
  const endDrag = () => {
    setDraggingId(null);
    setDropZone(null);
    draggedApptRef.current = null;
  };
  const drop = (target) => {
    const a = draggedApptRef.current;
    endDrag();
    if (a) onReschedule?.(a, target);
  };

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
          const colDropId = `col-${date}`;
          const gaps = draggingId ? computeDayGaps(dayAppts) : [];
          const gapZone = (zone) => {
            const zoneKey = `${date}-${zone.key}`;
            return (
              <div
                key={zoneKey}
                data-testid={`planner-gap-${zoneKey}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropZone(zoneKey); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop({ date, startTime: zone.startTime }); }}
                className={`rounded transition-all ${
                  dropZone === zoneKey ? 'h-8 bg-primary/25 border-2 border-dashed border-primary/50' : 'h-2'
                }`}
                aria-hidden="true"
              />
            );
          };
          return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- E2 drag-drop day-change target (mouse-only progressive enhancement); the keyboard-accessible reschedule path is the churn dialog's Reschedule/Postpone per the planner-scheduler-v2 README
            <div
              key={date}
              data-testid={`planner-day-col-${date}`}
              onDragOver={(e) => { e.preventDefault(); if (draggingId) setDropZone(colDropId); }}
              onDrop={(e) => { e.preventDefault(); drop({ date, startTime: draggedApptRef.current?.startTime }); }}
              className={`rounded-xl bg-card border p-3 min-w-0 flex flex-col transition-colors ${
                dropZone === colDropId ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              }`}
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
                <>
                  {draggingId && gapZone({ key: 'gap-top', startTime: '08:00' })}
                  <p data-testid={`planner-day-empty-${date}`} className="text-xs text-ink-muted italic">
                    No appointments
                  </p>
                </>
              ) : (
                <div className={`flex flex-col ${dense ? 'gap-1.5' : 'gap-2'}`}>
                  {gaps[0] && gapZone(gaps[0])}
                  {dayAppts.map((a, i) => {
                    const retired = RETIRED_STATUSES.has(a.status);
                    return (
                      <React.Fragment key={a.id}>
                        <div
                          draggable={!retired}
                          onDragStart={retired ? undefined : (e) => startDrag(e, a)}
                          onDragEnd={retired ? undefined : endDrag}
                          data-testid={`planner-drag-${a.id}`}
                          className={`relative ${retired ? '' : 'cursor-grab active:cursor-grabbing'} ${
                            draggingId === a.id ? 'opacity-35' : ''
                          }`}
                        >
                          {!retired && (
                            <span
                              className="absolute left-0.5 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none opacity-40"
                              aria-hidden="true"
                            >
                              <GripVertical size={14} />
                            </span>
                          )}
                          {renderCard(a, { dense })}
                        </div>
                        {gaps[i + 1] && gapZone(gaps[i + 1])}
                      </React.Fragment>
                    );
                  })}
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
