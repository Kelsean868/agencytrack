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
 *
 * L0 — the two-layer ring (docs/design-system/proposals/ledger-2026-09/,
 * C1–C4). An optional `pending` value draws a FAINT arc first (settled +
 * pending, clamped at the ring's max) and the existing SOLID arc on top of it
 * (settled only) — same start angle, same direction, so the faint arc reads
 * as "the rest of the way to what's in the pipeline". No `pending` (or 0)
 * renders exactly as before: no faint arc, no visual change for existing
 * callers. Faint colour is an EXISTING token at reduced opacity (no new
 * token): `primary/40` on card surfaces, `white/40` on the teal hero — both
 * lift correctly in dark mode because `--color-primary` itself lifts there.
 */

const TONES = {
  teal: {
    track: 'stroke-primary-tint',
    arc: 'stroke-primary',
    faint: 'stroke-primary/40',
    dot: 'bg-primary',
    dotFaint: 'bg-primary/40',
    tick: 'stroke-ink',
    center: 'fill-ink',
    sub: 'fill-ink-muted',
  },
  warning: {
    track: 'stroke-warning-tint',
    arc: 'stroke-warning',
    faint: 'stroke-warning/40',
    dot: 'bg-warning',
    dotFaint: 'bg-warning/40',
    tick: 'stroke-ink',
    center: 'fill-ink',
    sub: 'fill-ink-muted',
  },
  onHero: {
    track: 'stroke-[--hero-chip-island]',
    arc: 'stroke-[--hero-ink]',
    faint: 'stroke-white/40',
    dot: 'bg-[--hero-ink]',
    dotFaint: 'bg-white/40',
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
  pending = null,
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

  const pendingNum = Number(pending);
  const hasPending = Number.isFinite(pendingNum) && pendingNum > 0;
  const combined = hasPending
    ? donutGeometry({ value: (Number(value) || 0) + pendingNum, max })
    : null;

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
  const shownPending = drawn ? (combined?.dash ?? 0) : 0;
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
      {shownPending > 0 && (
        <circle
          cx="50" cy="50" r={DONUT_RADIUS}
          fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${shownPending} ${DONUT_CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
          className={`${palette.faint} motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out`}
          data-testid="donut-arc-pending"
        />
      )}
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

/**
 * RingLegend — the two-layer ring's shared legend (C1–C4): a solid dot for
 * "Settled — counts" and a faint dot for "Submitted — waiting to settle",
 * shown once per ring group. Callers hide it entirely when nothing in the
 * group has a pending value (`show={false}`) rather than rendering an empty
 * explanation for zero.
 *
 * FX (docs/briefs/ledger-layout-and-l3.md § FX item 2): the Home hero's C1
 * mockup shows the legend as VALUES — "Settled 87,146 · Submitted 123,146" —
 * not the descriptive copy above. Passing `values={{ settled, submitted }}`
 * (whole-number TTD figures the caller already derived — never computed
 * here) switches to that pattern; omitting it keeps every other caller
 * (Awards, Campaign card, Campaign screen) unchanged.
 */
export function RingLegend({ show, tone = 'teal', className = '', values = null }) {
  if (!show) return null;
  const palette = TONES[tone] ?? TONES.teal;
  const textClass = tone === 'onHero' ? 'text-[--hero-ink-muted-teal]' : 'text-ink-muted';
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-TT');
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-xs ${textClass} ${className}`}
      data-testid="ring-legend"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${palette.dot}`} aria-hidden="true" />
        {values ? `Settled ${fmt(values.settled)}` : 'Settled — counts'}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${palette.dotFaint}`} aria-hidden="true" />
        {values ? `Submitted ${fmt(values.submitted)}` : 'Submitted — waiting to settle'}
      </span>
    </div>
  );
}
