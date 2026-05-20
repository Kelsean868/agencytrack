import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import {
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
  floorStatus,
} from '../../utils/weeklyActivityFloors';
import { extractFields } from '../../utils/extractFields';

const STATUS_CLASSES = {
  green: 'bg-success/10 text-success border-success/30',
  amber: 'bg-warning/10 text-warning border-warning/30',
  red:   'bg-danger/10 text-danger border-danger/30',
};

const STATUS_LABELS = {
  green: 'Met',
  amber: 'Close',
  red:   'Below',
};

function formatValue(value, isCurrency) {
  if (isCurrency) return formatCurrency(value);
  return String(Math.round(parseFloat(value) || 0));
}

export default function WeeklyStandardCard({ minimums, currentWeekSub, loading, error }) {
  const [footnoteOpen, setFootnoteOpen] = useState(null);

  const floors = useMemo(
    () => ({ ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(minimums?.weeklyActivityFloors ?? {}) }),
    [minimums?.weeklyActivityFloors]
  );

  const actuals = useMemo(() => {
    if (!currentWeekSub) {
      return deriveWeeklyFloorActuals(null);
    }
    return deriveWeeklyFloorActuals(extractFields(currentWeekSub));
  }, [currentWeekSub]);

  if (loading) {
    return (
      <div className="card mb-6" aria-busy="true">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
          Weekly Standard — Expected vs Actual
        </p>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-9 rounded-md bg-border/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
          Weekly Standard — Expected vs Actual
        </p>
        <p className="text-sm text-danger">Failed to load company minimums.</p>
      </div>
    );
  }

  const hasSubmission = !!currentWeekSub;

  return (
    <section
      aria-labelledby="weekly-standard-heading"
      className="card mb-6"
    >
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h3
          id="weekly-standard-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Weekly Standard — Expected vs Actual
        </h3>
        {!hasSubmission && (
          <span className="text-[10px] text-ink-muted italic">
            No submission yet this week — Actuals show 0.
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {WEEKLY_ACTIVITY_FLOOR_ROWS.map((row) => {
          const expected = floors[row.key] ?? 0;
          const actual   = actuals[row.key] ?? 0;
          const status   = floorStatus(expected, actual);
          const statusClass = STATUS_CLASSES[status];
          const statusLabel = STATUS_LABELS[status];
          const footnoteId  = row.footnote ? `weekly-standard-footnote-${row.key}` : undefined;

          return (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 py-2 min-h-[44px] border-b border-border/40 last:border-b-0"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-sm text-ink truncate">{row.label}</span>
                {row.footnote && (
                  <button
                    type="button"
                    onClick={() => setFootnoteOpen(footnoteOpen === row.key ? null : row.key)}
                    aria-expanded={footnoteOpen === row.key}
                    aria-controls={footnoteId}
                    aria-label={`More info about ${row.label}`}
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
                  >
                    <Info size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="text-xs text-ink-muted text-right tabular-nums whitespace-nowrap">
                <span className="text-[10px] uppercase tracking-wide mr-1">Expected</span>
                <span className="text-sm font-semibold text-ink">
                  {formatValue(expected, row.isCurrency)}
                </span>
              </div>

              <div className="text-xs text-ink-muted text-right tabular-nums whitespace-nowrap">
                <span className="text-[10px] uppercase tracking-wide mr-1">Actual</span>
                <span className="text-sm font-semibold text-ink">
                  {formatValue(actual, row.isCurrency)}
                </span>
              </div>

              <span
                className={`inline-flex items-center justify-center px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                aria-label={`${row.label}: ${statusLabel}`}
              >
                {statusLabel}
              </span>

              {row.footnote && footnoteOpen === row.key && (
                <p
                  id={footnoteId}
                  className="col-span-4 text-xs text-ink-muted bg-surface/60 rounded-md px-3 py-2 mt-1"
                >
                  {row.footnote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
