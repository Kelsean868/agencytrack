import React from 'react';
import { monthlyPace } from '../../lib/monthlyPlanMath';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_H = 72; // px

export default function MonthChart({ targets, actuals, year, currentMonthIndex, todayTT }) {
  const maxVal = Math.max(...(targets || [1]), ...(actuals || [0]), 1);

  return (
    <div
      className="flex w-full items-end gap-0.5 sm:gap-1"
      role="img"
      aria-label="Monthly plan chart"
    >
      {(targets || []).map((target, i) => {
        const actual = actuals?.[i] ?? 0;
        const isCurrent = i === currentMonthIndex;

        const targetH = Math.round((target / maxVal) * CHART_H);
        const actualH = actual > 0 ? Math.round((actual / maxVal) * CHART_H) : 0;
        const isAhead = target > 0 && actual >= target;

        const pace = isCurrent
          ? monthlyPace(target, year, i, actual, todayTT)
          : null;
        const paceH = pace && maxVal > 0
          ? Math.round((pace.expectedToDate / maxVal) * CHART_H)
          : 0;

        const actualColorClass = isAhead
          ? 'bg-amber-400 dark:bg-amber-500'
          : 'bg-primary dark:bg-primary-dark';

        return (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
            data-testid={`month-col-${i}`}
          >
            <div className="relative w-full" style={{ height: CHART_H }}>
              {/* Ghost target bar */}
              {target > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-sm bg-primary/15 dark:bg-primary/25"
                  style={{ height: targetH }}
                  aria-hidden="true"
                />
              )}

              {/* Actual bar */}
              {actualH > 0 && (
                <div
                  className={`absolute inset-x-0.5 bottom-0 overflow-hidden rounded-t-sm ${actualColorClass}`}
                  style={{ height: actualH }}
                  aria-hidden="true"
                >
                  {isCurrent && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.18) 3px, rgba(255,255,255,0.18) 6px)',
                      }}
                    />
                  )}
                </div>
              )}

              {/* Pace tick (current month, only when target > 0 and pace is meaningful) */}
              {isCurrent && target > 0 && paceH > 0 && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-ink-muted/60"
                  style={{ bottom: paceH }}
                  aria-hidden="true"
                  data-testid="pace-tick"
                />
              )}
            </div>

            <span
              className={`text-[9px] leading-tight ${
                isCurrent
                  ? 'font-bold text-primary dark:text-primary-dark'
                  : 'text-ink-muted'
              }`}
            >
              {MONTH_NAMES[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
