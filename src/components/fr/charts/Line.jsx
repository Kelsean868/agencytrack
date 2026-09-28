import React, { useLayoutEffect, useRef, useState } from 'react';
import { linearScale, niceMax, pathFromPoints, pathLength } from './scales';

/**
 * Line — one or more line series over shared x labels, optional area under
 * the first series and an optional target line.
 *
 * Spec: DESKTOP3.md "Chart specs" — series colours in fixed order (chart-1
 * first), lines 2px with round caps, end dot with a 2px ring in the surface
 * colour, area at 0.10 opacity, ≤ 3 gridlines, 1px solid never dashed,
 * target = 1px solid faint-ink line with a direct text label, endpoint
 * value direct-labelled. NEVER a dual axis: two measures of different scale
 * are two charts side by side — this component has one y scale by design.
 * MOTION3.md rule 3 — paths can't tween, so when the data signature changes
 * after mount the path class flips fr-draw-a ↔ fr-draw-b (and the area
 * fr-wash-a ↔ fr-wash-b) so the keyframe replays; the end dot is re-keyed
 * and fades in after the line (fr-dot-late).
 *
 * `--fr-len` is the path length. The SVG stretches (preserveAspectRatio
 * "none") and strokes are non-scaling, so browsers may dash in screen
 * units; the length used is the larger of the viewBox length and the
 * measured on-screen length, so the finished line is never cut short.
 *
 * All text is HTML over the SVG (SVG text would stretch with the viewBox).
 *
 * @param {object} props
 * @param {{ key: string, label: string, values: number[], tone?: 1|2|3|4|5 }[]} props.series
 * @param {string[]} props.labels        x labels, one per point
 * @param {number} [props.target]
 * @param {string} [props.targetLabel]
 * @param {number} [props.height=180]    px
 * @param {(v:number)=>string} [props.format=String]
 * @param {boolean} [props.area=true]    wash under the first series
 * @param {[number, number]} [props.domain]  y domain (default 0..niceMax)
 */
const VB_W = 600;
const PAD_X = 6;
const PAD_TOP = 14;
const PAD_BOTTOM = 4;
const MAX_X_LABELS = 6;

const STROKE = { 1: 'stroke-chart-1', 2: 'stroke-chart-2', 3: 'stroke-chart-3', 4: 'stroke-chart-4', 5: 'stroke-chart-5' };
const FILL = { 1: 'fill-chart-1', 2: 'fill-chart-2', 3: 'fill-chart-3', 4: 'fill-chart-4', 5: 'fill-chart-5' };
const BG = { 1: 'bg-chart-1', 2: 'bg-chart-2', 3: 'bg-chart-3', 4: 'bg-chart-4', 5: 'bg-chart-5' };

function toneOf(s, i) {
  const t = s.tone ?? i + 1;
  if (!STROKE[t] && import.meta.env.DEV) {
    throw new Error(`Line: series "${s.key}" has tone ${t}; only chart-1..5 exist.`);
  }
  return STROKE[t] ? t : 1;
}

export default function Line({ series = [], ...rest }) {
  const clean = (series || []).filter((s) => Array.isArray(s.values) && s.values.length > 0);
  if (clean.length === 0) {
    return <p className="py-6 text-[13px] text-ink-muted">No data yet</p>;
  }
  return <LinePlot series={clean} {...rest} />;
}

function LinePlot({ series, labels = [], target, targetLabel, height = 180, format = String, area = true, domain }) {
  const svgRef = useRef(null);
  const [screenScaleX, setScreenScaleX] = useState(1);

  const n = Math.max(labels.length, ...series.map((s) => s.values.length));
  const hasTarget = Number.isFinite(target);
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const [d0, d1] = domain || [0, niceMax(Math.max(...all, hasTarget ? target : 0))];
  const xScale = linearScale([0, Math.max(1, n - 1)], [PAD_X, VB_W - PAD_X]);
  const x = (i) => (n <= 1 ? VB_W / 2 : xScale(i));
  const yScale = linearScale([d0, d1], [height - PAD_BOTTOM, PAD_TOP]);
  const y = (v) => yScale(Math.min(d1, Math.max(d0, v)));
  const baseY = height - PAD_BOTTOM;

  const plotted = series.map((s, i) => {
    const tone = toneOf(s, i);
    const points = s.values.map((v, j) => ({ x: x(j), y: y(v) }));
    const viewLen = pathLength(points);
    const screenLen = pathLength(points.map((p) => ({ x: p.x * screenScaleX, y: p.y })));
    return { ...s, tone, points, d: pathFromPoints(points), len: Math.ceil(Math.max(viewLen, screenLen)) };
  });

  // Redraw on data change (not on unrelated re-renders): derive a signature,
  // flip a counter when it changes (state-from-props pattern).
  const signature = JSON.stringify([labels, series.map((s) => [s.key, s.values])]);
  const [sig, setSig] = useState(signature);
  const [flip, setFlip] = useState(0);
  if (sig !== signature) {
    setSig(signature);
    setFlip((f) => f + 1);
  }
  const drawCls = flip % 2 === 0 ? 'fr-draw-a' : 'fr-draw-b';
  const washCls = flip % 2 === 0 ? 'fr-wash-a' : 'fr-wash-b';

  // Measure the on-screen width so --fr-len covers the stretched path.
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScreenScaleX(w / VB_W);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const first = plotted[0];
  const areaD = first.points.length > 1
    ? `${first.d} L${Math.round(first.points[first.points.length - 1].x * 100) / 100} ${baseY} L${Math.round(first.points[0].x * 100) / 100} ${baseY} Z`
    : '';
  const grid = [d0, (d0 + d1) / 2, d1].map((v) => y(v));
  const labelStep = Math.max(1, Math.ceil(labels.length / MAX_X_LABELS));

  const summary = [
    ...plotted.map((s) => `${s.label} ends at ${format(s.values[s.values.length - 1])}`),
    hasTarget ? `target ${targetLabel ?? format(target)}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <div>
      <div role="img" aria-label={summary} className="relative" style={{ height }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {grid.map((gy, i) => (
            <line
              key={`grid-${i}`}
              x1="0"
              x2={VB_W}
              y1={gy}
              y2={gy}
              className="stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              shapeRendering="crispEdges"
            />
          ))}
          {hasTarget ? (
            <line
              data-part="target"
              x1="0"
              x2={VB_W}
              y1={y(target)}
              y2={y(target)}
              className="stroke-ink-muted"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              shapeRendering="crispEdges"
            />
          ) : null}
          {area && areaD ? (
            <path data-part="area" d={areaD} className={`opacity-10 ${FILL[first.tone]} ${washCls}`} />
          ) : null}
          {plotted.map((s) => (
            <path
              key={s.key}
              data-part="line"
              d={s.d}
              className={`fill-none ${STROKE[s.tone]} ${drawCls}`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ '--fr-len': s.len }}
            />
          ))}
        </svg>
        {hasTarget && targetLabel ? (
          <span
            className="absolute right-0 -translate-y-full whitespace-nowrap bg-card px-1 pb-0.5 text-[11px] tabular-nums text-ink-muted"
            style={{ top: `${(y(target) / height) * 100}%` }}
          >
            {targetLabel}
          </span>
        ) : null}
        {plotted.map((s) => {
          const end = s.points[s.points.length - 1];
          const left = (end.x / VB_W) * 100;
          const top = (end.y / height) * 100;
          const text = plotted.length > 1 ? `${s.label} ${format(s.values[s.values.length - 1])}` : format(s.values[s.values.length - 1]);
          return (
            <React.Fragment key={`${s.key}-${flip}`}>
              <span
                data-part="end-dot"
                className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card fr-dot-late ${BG[s.tone]}`}
                style={{ left: `${left}%`, top: `${top}%` }}
              />
              <span
                data-part="end-label"
                className={`absolute -translate-x-full whitespace-nowrap pr-2 text-[11px] font-semibold tabular-nums text-ink fr-dot-late ${
                  top < 15 ? 'pt-1.5' : '-translate-y-full pb-1'
                }`}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {text}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      {labels.length > 0 ? (
        <div className="relative mt-1.5 h-4" aria-hidden="true">
          {labels.map((label, i) => {
            const last = labels.length - 1;
            // Keep every labelStep-th label plus the last one, but drop a
            // stepped label that sits too close to the last (they would collide).
            const onStep = i % labelStep === 0 && (i === last || last - i >= Math.ceil(labelStep / 2) + 1);
            if (!onStep && i !== last) return null;
            const shift = i === 0 ? '' : i === labels.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
            return (
              <span
                key={`${label}-${i}`}
                className={`absolute top-0 whitespace-nowrap text-[11px] text-ink-muted ${shift}`}
                style={{ left: `${(x(i) / VB_W) * 100}%` }}
              >
                {label}
              </span>
            );
          })}
        </div>
      ) : null}
      {plotted.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {plotted.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <span className={`h-0.5 w-3 rounded-full ${BG[s.tone]}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
