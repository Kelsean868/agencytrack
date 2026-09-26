/**
 * progressDonutGeometry.js — the pure ring maths behind ProgressDonut
 * (100×100 viewBox, radius 42). Split out so the component file exports only
 * components (react-refresh) and so R2 and tests can reuse the geometry.
 */

export const DONUT_RADIUS = 42;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Pure geometry for the ring. Exported for tests and for R2.
 * @returns {{ fraction:number, dash:number, gap:number, tickAngle:(number|null) }}
 *   `fraction` is clamped to 0–1; `tickAngle` is degrees clockwise from 12 o'clock.
 */
export function donutGeometry({ value, max, tick = null }) {
  const v = Number(value);
  const m = Number(max);
  const fraction = m > 0 && Number.isFinite(v) ? clamp01(v / m) : 0;
  const dash = fraction * DONUT_CIRCUMFERENCE;
  const hasTick = tick != null && Number.isFinite(Number(tick));
  return {
    fraction,
    dash,
    gap: DONUT_CIRCUMFERENCE - dash,
    tickAngle: hasTick ? clamp01(Number(tick)) * 360 : null,
  };
}
