import React from 'react';
import { tipAlign, keyIndexes, linearScale } from './scales';
import { roundPersistencyPct, formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';

/**
 * GateBars — persistency month by month against the gate.
 *
 * Spec: canvas D3M-Persistency (month bars grow UP from the 90% gate line in
 * chart-1 when at/above it, DOWN in warm when below, with a warning marker);
 * DESKTOP3.md "Chart specs" — the gate is a 1px solid line with the direct
 * label "Gate 90%", bars ≤ 24px with a 4px rounded data-end, values
 * direct-labelled. MOTION3.md rules 1–2 — each bar's top and height are
 * inline style on a node that is never swapped, with a top+height
 * transition, so a slider or tab change glides the bar across the gate.
 *
 * Values outside `domain` are clamped to its edge and marked with a break
 * mark plus ", beyond the chart range" in the accessible name.
 *
 * @param {object} props
 * @param {{ key: string, label: string, value: number, projected?: boolean }[]} props.data  value in percent, e.g. 86.6
 * @param {number} [props.gate=90]
 * @param {[number, number]} [props.domain=[70, 100]]
 * @param {number} [props.height=180]  plot height in px
 * @param {(v:number)=>string} [props.format]
 */
const MIN_BAR_PX = 2;
const GLIDE_TOP_HEIGHT =
  'transition-[top,height] duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Ruling R-a: a persistency percent prints at 2 decimals, half up, and the
// bar's side of the gate is judged on that same rounded value.
const defaultFormat = (v) => formatPersistencyPct(v);

function barClasses(up, projected) {
  if (up) {
    return projected
      ? 'rounded-t-[4px] border border-dashed border-chart-1 bg-chart-1/40'
      : 'rounded-t-[4px] bg-chart-1';
  }
  return projected
    ? 'rounded-b-[4px] border border-dashed border-fr-warm bg-fr-warm/40'
    : 'rounded-b-[4px] bg-fr-warm';
}

export default function GateBars({
  data = [],
  gate = 90,
  domain = [70, 100],
  height = 180,
  format = defaultFormat,
}) {
  if (!data || data.length === 0) {
    return <p className="py-6 text-[13px] text-ink-muted">No data yet</p>;
  }

  const [lo, hi] = domain;
  const y = linearScale([lo, hi], [height, 0]);
  const gateY = round2(y(Math.min(hi, Math.max(lo, gate))));
  const keys = keyIndexes(data.map((d) => d.value));

  // `@container`: whether every bar keeps its value label depends on the width
  // the CHART has (a card beside the sidebar, a phone), not on the window.
  return (
    <div className="@container">
      <div className="pb-8 pt-5">
        <div className="relative" style={{ height }}>
          <div
            data-part="gate"
            className={`pointer-events-none absolute inset-x-0 z-10 h-px bg-ink-muted ${GLIDE_TOP_HEIGHT}`}
            style={{ top: `${gateY}px` }}
          >
            <span className="absolute bottom-full right-0 mb-0.5 whitespace-nowrap bg-card px-1 text-[11px] tabular-nums text-ink-muted">
              Gate {gate}%
            </span>
          </div>
          <div className="absolute inset-0 flex gap-[2px]">
            {data.map((d, i) => {
              const clampedLow = d.value < lo;
              const clampedHigh = d.value > hi;
              const clamped = clampedLow || clampedHigh;
              const v = Math.min(hi, Math.max(lo, d.value));
              const up = roundPersistencyPct(d.value) >= gate;
              const endY = y(v);
              const h = Math.max(MIN_BAR_PX, round2(Math.abs(endY - gateY)));
              const top = up ? round2(gateY - h) : gateY;
              const valueText = format(d.value);
              const aria = `${d.label}: ${valueText}${d.projected ? ', projected' : ''}, ${
                up ? 'at or above' : 'below'
              } the ${gate}% gate${clamped ? ', beyond the chart range' : ''}`;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-label={aria}
                  className="group relative h-full min-w-0 flex-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div
                    data-part="bar"
                    data-clamped={clamped ? 'true' : undefined}
                    className={`absolute left-1/2 w-full max-w-[24px] -translate-x-1/2 ${GLIDE_TOP_HEIGHT} ${barClasses(up, d.projected)}`}
                    style={{ top: `${top}px`, height: `${h}px` }}
                  >
                    {clamped ? (
                      <svg
                        viewBox="0 0 14 6"
                        width="14"
                        height="6"
                        aria-hidden="true"
                        className={`absolute left-1/2 -translate-x-1/2 stroke-card ${up ? 'top-0.5' : 'bottom-0.5'}`}
                      >
                        <path d="M1 4 4 1l3 3 3-3 3 3" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                    {!up ? (
                      <svg
                        viewBox="0 0 10 8"
                        width="10"
                        height="8"
                        aria-hidden="true"
                        className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 fill-fr-warm"
                      >
                        <path d="M0 0h10L5 8Z" />
                      </svg>
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink ${
                        up ? 'bottom-full mb-1' : 'top-full mt-[11px]'
                      } ${keys.has(i) ? '' : 'hidden @[36rem]:inline'}`}
                    >
                      {d.projected ? '~' : ''}
                      {valueText}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute z-20 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold tabular-nums text-card group-hover:block group-focus-visible:block ${tipAlign(i, data.length)} ${
                        up ? 'bottom-full mb-5' : 'top-full mt-7'
                      }`}
                    >
                      {aria}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-[2px]" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-muted" title={d.label}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
