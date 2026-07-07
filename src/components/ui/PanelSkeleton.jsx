import React from 'react';

/**
 * Panel Skeleton kit — reusable loading-state primitives.
 *
 * The systemic fix for "content pops in after the screen-enter animation
 * completes": a panel renders a skeleton that reserves the REAL structural
 * footprint of the content it stands in for, so when data resolves the content
 * fills IN PLACE with no layout jump. The entrance fade plays over a
 * structurally-complete placeholder instead of a spinner, and the swap to real
 * content is a low-delta, in-place fill.
 *
 * Extracted and generalized from the field-measured Game-Plan skeleton work
 * (PR #825, branch feat/gp-skeleton). Game-Plan-specific compositions were left
 * behind; only the reusable core (Skeleton, SkeletonText, and the panel-shape
 * variants) is kept here.
 *
 * Reduced-motion: every pulse uses Tailwind's `motion-safe:` variant, so the
 * shimmer stays static under `prefers-reduced-motion: reduce`. The pulse lives
 * on the {@link Skeleton} atom and is the single source of the animation, so all
 * variants inherit reduced-motion safety.
 *
 * Fill: `bg-surface-muted` (the field-proven fill). The design system also ships
 * a `--color-skeleton` gradient-shimmer token (redesign-addendum §1); it is NOT
 * used here because it animates via background-position, which does not compose
 * with the pulse (opacity) model this kit — and the brief — specify. Swapping to
 * the gradient token is a rollout-time decision (see docs/design-system/skeleton-kit.md).
 *
 * NOTE: This kit is intentionally NOT wired into any live panel. It is the
 * primitive for the pending pop-in rollout, which applies it panel-by-panel.
 */

/**
 * Atomic pulsing placeholder block. Decorative (aria-hidden) and
 * reduced-motion-safe. Compose these — or the {@link PanelSkeleton} presets — to
 * mirror a panel's real layout.
 *
 * @param {string} [className] layout classes (height, radius, width) for this block
 */
export function Skeleton({ className = '', ...rest }) {
  return (
    <div
      className={`bg-surface-muted motion-safe:animate-pulse ${className}`}
      aria-hidden="true"
      {...rest}
    />
  );
}

/**
 * A value slot with a TEXT-IDENTICAL loading/ready tree: the SAME <span> renders
 * in both states, so loading→ready is a text-content + className change — NOT a
 * node insert/remove. Geometry stays stable via `reserveCh` (min-width in ch) +
 * `tabular-nums`, so a shimmering placeholder reserves the width the real figure
 * will take and there is no layout shift when data lands. Reduced-motion-safe.
 *
 * Use this for inline values (metrics, counts, currency) inside a header or card
 * whose surrounding structure is already present — it keeps the box while the
 * number resolves.
 *
 * @param {boolean} loading  when true, render the reserved placeholder
 * @param {number} [reserveCh]  min-width (ch) reserving the real value's width
 * @param {string} [className]  passthrough classes (applied in both states)
 * @param {React.ReactNode} [children]  the real value (shown when not loading)
 */
export function SkeletonText({ loading, reserveCh, className = '', children }) {
  return (
    <span
      className={`inline-block align-baseline tabular-nums ${
        loading
          ? 'rounded bg-surface-muted text-transparent motion-safe:animate-pulse select-none'
          : ''
      } ${className}`}
      style={reserveCh ? { minWidth: `${reserveCh}ch` } : undefined}
    >
      {loading ? ' ' : children}
    </span>
  );
}

/** Sensible default unit count per variant when `count` is not supplied. */
const DEFAULT_COUNT = { list: 4, 'card-grid': 4, 'metric-row': 4, table: 5 };

/**
 * Variant renderers. Each reserves a stable box via fixed Tailwind heights so the
 * placeholder occupies the footprint the real content will fill.
 *
 * @type {Record<string, (opts: {count: number, columns: number}) => React.ReactNode>}
 */
const VARIANTS = {
  /** Vertical stack of full-width rows — feeds, lists, tables of items. */
  list: ({ count }) => (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  ),

  /** Responsive grid of cards — KPI card grids, medal/badge grids. */
  'card-grid': ({ count }) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  ),

  /** Single horizontal row of equal-width metric slots — anchor / metric strips. */
  'metric-row': ({ count }) => (
    <div className="flex flex-col gap-3 sm:flex-row">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
      ))}
    </div>
  ),

  /** Header bar + body rows of column cells — dense data tables. */
  table: ({ count, columns }) => (
    <div className="space-y-2">
      <Skeleton className="h-10 rounded-lg" />
      {Array.from({ length: count }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-11 flex-1 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  ),
};

/**
 * A preset skeleton scaffold that reserves a common panel shape's footprint.
 * Exposed as a live status region so assistive tech announces the loading state.
 *
 * @param {object} props
 * @param {'list'|'card-grid'|'metric-row'|'table'} [props.variant='list']  panel shape
 * @param {number} [props.count]  repeated-unit count (rows / cards / metrics / body rows).
 *   Defaults per-variant when omitted.
 * @param {number} [props.columns=4]  cells per row — `table` variant only; ignored otherwise
 * @param {string} [props.label='Loading…']  accessible loading label
 * @param {string} [props.className]  passthrough classes on the status wrapper
 */
export default function PanelSkeleton({
  variant = 'list',
  count,
  columns = 4,
  label = 'Loading…',
  className = '',
}) {
  const render = VARIANTS[variant] || VARIANTS.list;
  const resolvedVariant = VARIANTS[variant] ? variant : 'list';
  // Defensive parse: a non-numeric prop (e.g. count="invalid") coerces to NaN,
  // which Array.from silently treats as length 0 — an empty skeleton. Fall back
  // to the variant default instead so a bad prop never renders nothing.
  const rawCount = Number(count ?? DEFAULT_COUNT[resolvedVariant]);
  const n = Number.isNaN(rawCount) ? DEFAULT_COUNT[resolvedVariant] : Math.max(0, Math.trunc(rawCount));
  const rawCols = Number(columns);
  const cols = Number.isNaN(rawCols) ? 4 : Math.max(1, Math.trunc(rawCols));

  return (
    <div
      className={`space-y-4 ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {render({ count: n, columns: cols })}
    </div>
  );
}
