/**
 * swipeMath — the pure maths behind the FR phone "swipe pages" pager.
 *
 * What: rubber band at the ends, velocity projection on release, the one-page
 * snap decision, the horizontal-intent test and the track translate.
 * Why: kept free of React so every rule can be unit/property tested.
 * Spec: docs/design-system/screens-fr/specs/SWIPE3.md rule 4 — a copy of the
 * swipe engine in M3-Home.dc.html (rubber band `dx*W*0.55/(W+0.55*|dx|)`,
 * projection `x + (v/1000)*0.99/(1-0.99)`, threshold ±W/2, one page per swipe).
 */

/** Rubber-band resistance used when dragging past the first or last page. */
export function rubberBand(dx, width) {
  return (dx * width * 0.55) / (width + 0.55 * Math.abs(dx));
}

/**
 * Where a released drag would come to rest if it kept decelerating
 * (decay rate 0.99 per ms, as in the iOS scroll-view model).
 * @param {number} offsetPx current (displayed) drag offset in px
 * @param {number} velocityPxPerSec release velocity in px/s (negative = leftwards)
 */
export function projectOffset(offsetPx, velocityPxPerSec) {
  return offsetPx + ((velocityPxPerSec / 1000) * 0.99) / (1 - 0.99);
}

/** Clamp `n` into 0..count-1. */
function clampIndex(n, count) {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, n));
}

/**
 * The page to snap to after a release. Moves AT MOST one page.
 * `dragPx` is the displayed drag offset (after any rubber band); a negative
 * value means the finger moved left, i.e. towards the next page.
 */
export function resolveTargetIndex({ index, count, dragPx, velocityPxPerSec = 0, width }) {
  const projected = projectOffset(dragPx, velocityPxPerSec);
  const threshold = width / 2;
  let target = index;
  if (projected < -threshold) target = index + 1;
  else if (projected > threshold) target = index - 1;
  return clampIndex(target, count);
}

/** True when a gesture reads as a horizontal swipe (not a vertical scroll). */
export function isHorizontalIntent(dx, dy) {
  return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
}

/**
 * The displayed drag offset: 1:1, except rubber-banded when pulling past
 * the first page (rightwards) or the last page (leftwards).
 */
export function dragOffsetFor(index, width, dragPx, count) {
  const pastStart = index <= 0 && dragPx > 0;
  const pastEnd = index >= count - 1 && dragPx < 0;
  return pastStart || pastEnd ? rubberBand(dragPx, width) : dragPx;
}

/** The track translateX in px for page `index` while dragged by `dragPx`. */
export function translateFor(index, width, dragPx, count) {
  return -index * width + dragOffsetFor(index, width, dragPx, count);
}
