import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { THIS_WEEK_TILES } from './homeDerivations';

/**
 * ThisWeekTiles — Home redesign R1 block 5 ("This week").
 *
 * Four tiles from the weekly activity standard: label, done / target, bar.
 * `actuals.values[key] === null` means the figure is not known yet (the daily
 * log does not capture prospecting calls, for one) — that tile shows "—" and an
 * empty bar, never a confident 0. "Details" opens the existing Standard drawer
 * (it was reached from the PulseStrip chip before R1 removed the strip).
 *
 * Mobile: one row of four. Desktop (inside a 5-of-12 column): 2 × 2.
 */

function Tile({ label, done, target }) {
  const known = done != null;
  const pct = known && target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const met = known && target > 0 && done >= target;
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-2.5 lg:p-3.5"
      data-testid={`this-week-${label.toLowerCase()}`}
      title={known ? undefined : 'Not captured by the daily log — shows once your weekly report has it'}
    >
      <span className="truncate text-xs text-ink-muted">{label}</span>
      <span className="text-[17px] font-bold tabular-nums text-ink lg:text-xl">
        {known ? done : '—'}
        <span className="text-xs font-medium text-ink-muted">/{target}</span>
      </span>
      <div
        className="h-[5px] w-full overflow-hidden rounded-full bg-primary-tint"
        role="progressbar"
        aria-label={`${label}: ${known ? done : 'not known yet'} of ${target}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        {/* The bar length is SVG geometry (no inline style). */}
        <svg viewBox="0 0 100 5" preserveAspectRatio="none" className="block h-full w-full" aria-hidden="true">
          {pct > 0 && <rect x="0" y="0" width={pct} height="5" className={met ? 'fill-success' : 'fill-primary'} />}
        </svg>
      </div>
    </div>
  );
}

export default function ThisWeekTiles({ floors, actuals, loading = false, error = false, onOpenDetails }) {
  return (
    <section aria-label="This week's activity" className="flex flex-col gap-2.5" data-testid="this-week">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-ink">This week</h2>
        {onOpenDetails && !loading && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="inline-flex min-h-[44px] items-center rounded px-1 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Details
          </button>
        )}
      </div>
      {loading ? (
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-2 lg:gap-3" data-testid="this-week-loading" aria-busy="true" aria-label="Loading this week's activity">
          {THIS_WEEK_TILES.map((t) => (
            <div key={t.key} className="h-[76px] rounded-2xl bg-surface-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-[13px] text-warning-ink" data-testid="this-week-error">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          Couldn&apos;t load this week&apos;s activity. Pull down to refresh.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-2 lg:gap-3">
          {THIS_WEEK_TILES.map((t) => (
            <Tile
              key={t.key}
              label={t.label}
              done={actuals?.values?.[t.key] ?? null}
              target={Number(floors?.[t.key]) || 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
