import React from 'react';

/**
 * Shared loading-skeleton kit.
 *
 * A skeleton should reserve the REAL structural footprint of the content it stands
 * in for, so that when data resolves the content fills IN PLACE with no layout jump.
 * This is the fix for "content pops in after the screen-enter animation completes":
 * the entrance fade plays over a structurally-complete placeholder instead of a
 * spinner, and the swap to real content is a low-delta, in-place fill.
 *
 * Reduced-motion: the shimmer uses `motion-safe:animate-pulse`, so it stays static
 * under `prefers-reduced-motion: reduce`.
 */

/** Atomic pulsing placeholder block. Compose these to mirror a panel's layout. */
export function Skeleton({ className = '', ...rest }) {
  return <div className={`bg-surface-muted motion-safe:animate-pulse ${className}`} aria-hidden="true" {...rest} />;
}

const VARIANTS = {
  hero: () => <Skeleton className="h-36 rounded-2xl" />,
  list: (rows) => (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  ),
  cards: (n) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  ),
  report: () => (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  ),
};

/**
 * A preset skeleton scaffold.
 *
 * @param {'hero'|'list'|'cards'|'report'} variant
 * @param {number} rows  row/card count for list/cards variants
 * @param {string} label accessible loading label
 */
export default function PanelSkeleton({ variant = 'list', rows = 6, label = 'Loading…', className = '' }) {
  const render = VARIANTS[variant] || VARIANTS.list;
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-busy="true" aria-live="polite" aria-label={label}>
      {render(rows)}
    </div>
  );
}
