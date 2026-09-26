import React, { useEffect, useState } from 'react';
import { DONUT_RADIUS, DONUT_CIRCUMFERENCE, donutGeometry } from './progressDonutGeometry';

/**
 * ProgressDonut — the one shared progress ring (Home redesign R1; reused by the
 * Campaign screen in R2). Sits beside GoalDonut, which keeps its own callers.
 *
 * Geometry is a 100×100 viewBox, radius 42, stroke 10 — the mockups'
 * (docs/design-system/proposals/home-campaign-2026-09/) ring. The arc starts at
 * 12 o'clock and runs clockwise. `tick` (0–1) draws a short radial mark on the
 * ring — the MDRT point on the hero, the persistency gate on a campaign.
 *
 * Colour is token-only via Tailwind stroke/fill utilities:
 *   teal    — card surfaces (primary on primary tint)
 *   warning — below a gate (warning on warning tint)
 *   onHero  — the teal hero pane (hero ink on the hero chip island)
 *
 * The fill animates from 0 on mount only when the viewer has NOT asked for
 * reduced motion (and matchMedia exists); otherwise the final arc renders
 * immediately, so reduced-motion, print and tests all see the real value.
 */

const TONES = {
  teal: {
    track: 'stroke-primary-tint',
    arc: 'stroke-primary',
    tick: 'stroke-ink',
    center: 'fill-ink',
    sub: 'fill-ink-muted',
  },
  warning: {
    track: 'stroke-warning-tint',
    arc: 'stroke-warning',
    tick: 'stroke-ink',
    center: 'fill-ink',
    sub: 'fill-ink-muted',
  },
  onHero: {
    track: 'stroke-[--hero-chip-island]',
    arc: 'stroke-[--hero-ink]',
    tick: 'stroke-[--hero-dot-warning]',
    center: 'fill-[--hero-ink]',
    sub: 'fill-[--hero-ink-muted-teal]',
  },
};

function prefersMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ProgressDonut({
  value,
  max,
  tone = 'teal',
  tick = null,
  centerLabel = null,
  subLabel = null,
  ariaLabel,
  className = 'w-[86px] h-[86px]',
  testId,
}) {
  const palette = TONES[tone] ?? TONES.teal;
  const { dash, tickAngle } = donutGeometry({ value, max, tick });

  // Mount animation: start empty, then draw to the real arc on the next frame.
  const [drawn, setDrawn] = useState(() => !prefersMotion());
  useEffect(() => {
    if (drawn) return undefined;
    const raf = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(() => setDrawn(true))
      : null;
    if (raf == null) setDrawn(true);
    return () => {
      if (raf != null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(raf);
    };
  }, [drawn]);

  const shown = drawn ? dash : 0;
  const centerY = subLabel ? 48 : 57;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={ariaLabel}
      className={`shrink-0 ${className}`}
      data-testid={testId}
    >
      <circle
        cx="50" cy="50" r={DONUT_RADIUS}
        fill="none" strokeWidth="10"
        className={palette.track}
      />
      {shown > 0 && (
        <circle
          cx="50" cy="50" r={DONUT_RADIUS}
          fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${shown} ${DONUT_CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
          className={`${palette.arc} motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out`}
          data-testid="donut-arc"
        />
      )}
      {tickAngle != null && (
        <g transform={`rotate(${tickAngle} 50 50)`} data-testid="donut-tick">
          <line
            x1="50" y1="1" x2="50" y2="17"
            strokeWidth="2.5" strokeLinecap="round"
            className={palette.tick}
          />
        </g>
      )}
      {centerLabel != null && (
        <text
          x="50" y={centerY} textAnchor="middle" aria-hidden="true"
          fontSize={String(centerLabel).length > 5 ? 18 : 22} fontWeight="700"
          className={`font-display ${palette.center}`}
        >
          {centerLabel}
        </text>
      )}
      {subLabel != null && (
        <text
          x="50" y="64" textAnchor="middle" aria-hidden="true"
          fontSize="8.5" letterSpacing="0.5"
          className={`font-mono ${palette.sub}`}
        >
          {subLabel}
        </text>
      )}
    </svg>
  );
}
