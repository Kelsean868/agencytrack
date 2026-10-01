import React from 'react';

/**
 * Donut — part-to-whole with at most five parts, plus a legend with direct
 * values.
 *
 * Spec: DESKTOP3.md "Chart specs" — donut only for part-to-whole with ≤ 5
 * parts (otherwise bars); series colours in fixed order chart-1..5, never
 * cycled; text never in a series colour. More than five parts throws in
 * development (CLAUDE.md v3 rule 11: silent fallbacks throw in dev).
 * MOTION3.md rule 1 — each arc's dasharray/dashoffset is inline style with a
 * CSS transition on the same <circle>, so parts glide when values change.
 *
 * @param {object} props
 * @param {{ key: string, label: string, value: number }[]} props.parts  ≤ 5
 * @param {number} [props.size=120]       px
 * @param {number} [props.thickness=14]   px
 * @param {React.ReactNode} [props.centerLabel]
 * @param {React.ReactNode} [props.centerValue]
 * @param {(v:number)=>string} [props.format=String]  legend values
 */
const MAX_PARTS = 5;
const STROKE = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3', 'stroke-chart-4', 'stroke-chart-5'];
const BG = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
const GLIDE_DASH =
  'transition-[stroke-dasharray,stroke-dashoffset] duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function Donut({
  parts = [],
  size = 120,
  thickness = 14,
  centerLabel,
  centerValue,
  format = String,
}) {
  let shown = parts || [];
  if (shown.length > MAX_PARTS) {
    const msg = `Donut: ${shown.length} parts given; a donut takes at most ${MAX_PARTS}. Use bars.`;
    if (import.meta.env.DEV) throw new Error(msg);
    console.error(msg);
    shown = shown.slice(0, MAX_PARTS);
  }

  const total = shown.reduce((sum, p) => sum + Math.max(0, p.value || 0), 0);
  if (shown.length === 0 || total <= 0) {
    return <p className="py-6 text-[13px] text-ink-muted">No data yet</p>;
  }

  const r = (size - thickness) / 2;
  const c = size / 2;
  let offset = 0;
  const arcs = shown.map((p, i) => {
    const share = (Math.max(0, p.value || 0) / total) * 100;
    const arc = { ...p, i, share: round2(share), start: round2(offset) };
    offset += share;
    return arc;
  });

  const aria = arcs.map((a) => `${a.label} ${format(a.value)} (${Math.round(a.share)}%)`).join(', ');

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative flex-none" role="img" aria-label={aria}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={c} cy={c} r={r} className="fill-none stroke-fr-sunk" strokeWidth={thickness} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              data-part="arc"
              cx={c}
              cy={c}
              r={r}
              pathLength="100"
              className={`fill-none ${STROKE[a.i]} ${GLIDE_DASH}`}
              strokeWidth={thickness}
              style={{ strokeDasharray: `${a.share} ${round2(100 - a.share)}`, strokeDashoffset: -a.start }}
            />
          ))}
        </svg>
        {centerValue !== undefined || centerLabel !== undefined ? (
          <div
            className="absolute flex flex-col items-center justify-center text-center"
            style={{ inset: thickness + 4 }}
          >
            {centerValue !== undefined ? (
              <span className="max-w-full font-display text-[15px] font-bold leading-tight tabular-nums text-ink">{centerValue}</span>
            ) : null}
            {centerLabel !== undefined ? <span className="mt-1 text-[11px] text-ink-muted">{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      {/* min-w-min: the legend is never narrower than its values and shares
          need — each row is a grid whose label column is minmax(3rem, 1fr), so
          the label counts for 3rem in the minimum (it truncates) but its full
          width in the natural size. When the values do not fit beside the
          ring the legend wraps UNDER it instead of squeezing
          (fr-fit-any-width decision 3). */}
      <ul className="min-w-min flex-1 space-y-1.5">
        {arcs.map((a) => (
          <li key={a.key} className="grid grid-cols-[auto_minmax(3rem,1fr)_auto_auto] items-center gap-2 text-[13px]">
            <span className={`h-2.5 w-2.5 flex-none rounded-sm ${BG[a.i]}`} aria-hidden="true" />
            <span className="min-w-0 truncate text-ink-muted" title={a.label}>
              {a.label}
            </span>
            <span className="flex-none font-semibold tabular-nums text-ink">{format(a.value)}</span>
            <span className="w-10 flex-none text-right tabular-nums text-ink-muted">{Math.round(a.share)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
