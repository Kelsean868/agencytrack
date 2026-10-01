/**
 * FR chart kit — pure scale and path helpers.
 *
 * Charts compute their geometry here, then hand it to the DOM as inline
 * style so CSS can glide it (MOTION3.md rule 1). No chart library
 * (DESKTOP3.md "Glanceable rules" 4).
 */

/** Round to 2 decimal places, dropping "-0". */
function round2(n) {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Linear map from a domain to a range. A zero-width domain maps to r0.
 * @param {[number, number]} domain
 * @param {[number, number]} range
 * @returns {(v: number) => number}
 */
export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0;
  return (v) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Round a maximum UP to 1, 2, 2.5 or 5 × 10^n so axes end on a clean figure.
 * Zero, negative or non-finite input returns 1 so a scale never collapses.
 * @param {number} v
 * @returns {number}
 */
export function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(v));
  const f = v / base;
  const step = NICE_STEPS.find((s) => f <= s + 1e-9);
  return Number((step * base).toPrecision(12));
}

/**
 * Percentage of max, clamped to 0..100. max ≤ 0 (or non-finite input) → 0.
 * @param {number} v
 * @param {number} max
 * @returns {number}
 */
export function pct(v, max) {
  if (!Number.isFinite(v) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (v / max) * 100));
}

/**
 * SVG path "d" string (M … L …) from points, 2 dp.
 * @param {{x: number, y: number}[]} points
 * @returns {string}
 */
export function pathFromPoints(points) {
  if (!points || points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round2(p.x)} ${round2(p.y)}`)
    .join(' ');
}

/**
 * Total length of the polyline through the points (sum of segment lengths).
 * Used as `--fr-len` for the stroke-dasharray redraw (MOTION3.md rule 3).
 * @param {{x: number, y: number}[]} points
 * @returns {number}
 */
export function pathLength(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/**
 * tipAlign(i, n) — horizontal anchoring for a bar's hover/focus tooltip, so a
 * tooltip never pokes past the chart edge (on a phone that widens the whole
 * page). First third anchors left, last third right, the middle centres.
 */
export function tipAlign(i, n) {
  if (n <= 1) return 'left-1/2 -translate-x-1/2';
  if (i < n / 3) return 'left-0';
  if (i >= (2 * n) / 3) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

/**
 * keyIndexes(values) — the bars that keep a direct label on a narrow screen:
 * first, last, lowest and highest (DESKTOP3.md: key values direct-labelled;
 * every value stays in the tooltip and the Table view).
 */
export function keyIndexes(values) {
  const out = new Set();
  if (!values.length) return out;
  out.add(0);
  out.add(values.length - 1);
  let min = 0;
  let max = 0;
  values.forEach((v, i) => {
    if (v < values[min]) min = i;
    if (v > values[max]) max = i;
  });
  out.add(min);
  out.add(max);
  return out;
}

// fr-fit-any-width W-4 — the highlighted bar and the last bar both carry a
// value label. When the plot is too narrow for the two to clear each other,
// the highlighted label sits one line higher (ruling: "raise one label").
// Whether they clear depends on the bar count, how far apart the two bars
// are and the label length, so the threshold is picked per chart below; the
// switch itself is a container query on the plot. Literal class names so
// Tailwind generates them.
const LABEL_CHAR_PX = 6.6; // 11px semibold tabular figures
const LABEL_GAP_PX = 8;
/** One value-label line (11px text, ~16px box): bar tops this far apart never collide. */
export const LABEL_LINE_PX = 16;
const RAISE_STEPS = [
  [16, 'mb-5 @[16rem]:mb-1'],
  [20, 'mb-5 @[20rem]:mb-1'],
  [24, 'mb-5 @[24rem]:mb-1'],
  [28, 'mb-5 @[28rem]:mb-1'],
  [32, 'mb-5 @[32rem]:mb-1'],
  [40, 'mb-5 @[40rem]:mb-1'],
  [48, 'mb-5 @[48rem]:mb-1'],
  [56, 'mb-5 @[56rem]:mb-1'],
  [64, 'mb-5 @[64rem]:mb-1'],
];

/** Margin class for the highlighted bar's value label (see RAISE_STEPS). */
export function highlightLabelClass(texts, highlightIndex) {
  const last = texts.length - 1;
  if (highlightIndex < 0 || highlightIndex === last) return 'mb-1';
  const labelPx = Math.max(texts[highlightIndex].length, texts[last].length) * LABEL_CHAR_PX + LABEL_GAP_PX;
  const needPx = (texts.length * labelPx) / (last - highlightIndex);
  const step = RAISE_STEPS.find(([rem]) => rem * 16 >= needPx);
  return step ? step[1] : 'mb-5';
}
