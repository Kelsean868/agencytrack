import React from 'react';
import { linearScale, pathFromPoints } from './scales';

/**
 * Sparkline — the small trend line inside a stat tile.
 *
 * Spec: DESKTOP3.md "Glanceable rules" 1 — optional 12-point sparkline in
 * the de-emphasis colour, last point in the accent (chart-1).
 * MOTION3.md rule 2 — the end dot's cx/cy are CSS (fr-glide-svg-pt) so it
 * glides when the last value changes.
 *
 * @param {object} props
 * @param {number[]} props.values   the last 12 are drawn
 * @param {number} [props.width=96]
 * @param {number} [props.height=28]
 * @param {string} props.label      what the line is, for the accessible name
 * @param {(v:number)=>string} [props.format=String]
 */
const MAX_POINTS = 12;
const PAD = 3;

export default function Sparkline({ values = [], width = 96, height = 28, label, format = String }) {
  const vals = (values || []).filter(Number.isFinite).slice(-MAX_POINTS);
  if (vals.length === 0) {
    return <span className="text-[11px] text-ink-muted">No data yet</span>;
  }
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = linearScale([0, Math.max(1, vals.length - 1)], [PAD, width - PAD]);
  const y = lo === hi ? () => height / 2 : linearScale([lo, hi], [height - PAD, PAD]);
  const points = vals.map((v, i) => ({ x: vals.length === 1 ? width / 2 : x(i), y: y(v) }));
  const end = points[points.length - 1];
  const last = vals[vals.length - 1];
  const cx = Math.round(end.x * 100) / 100;
  const cy = Math.round(end.y * 100) / 100;

  return (
    <svg
      role="img"
      aria-label={`${label}: last ${format(last)}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        d={pathFromPoints(points)}
        className="fill-none stroke-ink-faint"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle data-part="end-dot" r="2.5" cx={cx} cy={cy} className="fill-chart-1 fr-glide-svg-pt" style={{ cx, cy }} />
    </svg>
  );
}
