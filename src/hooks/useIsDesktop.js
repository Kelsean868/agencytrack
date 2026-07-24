import { useEffect, useState } from 'react';

// Tailwind's `lg` breakpoint (1024px) — the point at which the Planner switches
// from the single-column mobile views to the side-by-side desktop day-column
// board (Planner v2 E1/E5). Kept in sync with tailwind.config.js's default `lg`.
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * useIsDesktop — true when the viewport is at/above the `lg` breakpoint.
 *
 * Uses `matchMedia` (the established idiom in this repo, e.g. GamePlanV2's
 * reduced-motion hook) with a `change` listener so a resize across the boundary
 * re-renders. SSR/jsdom-safe: when `window.matchMedia` is absent (jsdom does not
 * implement it) the hook stays `false`, so component tests that don't stub
 * matchMedia render the mobile layout unchanged — deliberate, so the existing
 * Planner tests/smokes (which rely on a SINGLE set of `appt-card-{id}` testids)
 * are unaffected. Desktop-board tests stub matchMedia to opt in.
 *
 * @param {number} [minWidth=DESKTOP_MIN_WIDTH]
 * @returns {boolean}
 */
export default function useIsDesktop(minWidth = DESKTOP_MIN_WIDTH) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [minWidth]);

  return isDesktop;
}
