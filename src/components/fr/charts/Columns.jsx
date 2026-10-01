import React, { useState } from 'react';
import { niceMax, tipAlign, highlightLabelClass } from './scales';

/**
 * Columns — vertical bars (one series, optional "waiting" ghost stacked on
 * top, optional target line).
 *
 * Spec: DESKTOP3.md "Chart specs" — one series in chart-1, emphasis over
 * colour (highlighted bars full, the rest faded), ghost = submitted/waiting,
 * bars ≤ 24px with a 4px rounded data-end, 2px gaps, target = 1px solid line
 * with a direct label, values direct-labelled (never only in a tooltip).
 * MOTION3.md rules 1, 6, 7 — part heights are inline style with fr-glide-h on
 * nodes that are never swapped, so data changes glide; the one-shot
 * fr-grow-y entrance sits on a WRAPPER (scaleY) so it never fights the height
 * transition, is staggered ≤ 25ms per item, and plays only for bars present
 * at first mount.
 *
 * @param {object} props
 * @param {{ key: string, label: string, value: number, ghost?: number, highlight?: boolean, note?: string }[]} props.data
 * @param {number} [props.target]
 * @param {string} [props.targetLabel]  e.g. "MDRT 688,800"
 * @param {number} [props.height=160]   plot height in px
 * @param {(v:number)=>string} [props.format=String]
 * @param {'highlight'|'all'} [props.emphasis='highlight']
 */
// Stagger delay: `!` because fr-look.css loads after Tailwind and its
// `animation` shorthand would otherwise reset the delay to 0.
const STAGGER_MS = 20;

function round2(n) {
  return Math.round(n * 100) / 100;
}


export default function Columns({ data = [], ...rest }) {
  if (!data || data.length === 0) {
    return <p className="py-6 text-[13px] text-ink-muted">No data yet</p>;
  }
  return <ColumnsPlot data={data} {...rest} />;
}

function ColumnsPlot({ data, target, targetLabel, height = 160, format = String, emphasis = 'highlight' }) {
  // Bars present at first mount get the entrance; bars added later do not.
  const [entranceKeys] = useState(() => new Set(data.map((d) => d.key)));

  const hasTarget = Number.isFinite(target) && target > 0;
  const max = niceMax(
    Math.max(...data.map((d) => (d.value || 0) + (d.ghost || 0)), hasTarget ? target : 0),
  );
  const toPx = (v) => round2(Math.min(height, Math.max(0, ((v || 0) / max) * height)));
  const anyHighlight = data.some((d) => d.highlight);
  const last = data.length - 1;
  const hiLabel = highlightLabelClass(data.map((d) => format(d.value || 0)), data.findIndex((d) => d.highlight));

  return (
    <div className="@container">
      <div className="pt-5">
        <div className="relative border-b border-border" style={{ height }}>
          {hasTarget ? (
            <div
              data-part="target"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 fr-glide-h"
              style={{ height: `${toPx(target)}px` }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-ink-muted" />
              {targetLabel ? (
                <span className="absolute bottom-full right-0 mb-0.5 whitespace-nowrap bg-card px-1 text-[11px] tabular-nums text-ink-muted">
                  {targetLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="absolute inset-0 flex gap-[2px]">
            {data.map((d, i) => {
              const ghost = Math.max(0, d.ghost || 0);
              const value = d.value || 0;
              const strong = emphasis === 'all' || !anyHighlight || d.highlight;
              const entrance = entranceKeys.has(d.key);
              const valueText = format(value);
              const aria = `${d.label}: ${valueText}${ghost ? `, plus ${format(ghost)} waiting` : ''}${d.note ? `, ${d.note}` : ''}`;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-label={aria}
                  className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div
                    className={`relative flex w-full max-w-[24px] flex-col justify-end ${
                      entrance ? 'fr-grow-y ![animation-delay:var(--fr-delay)]' : ''
                    }`}
                    style={entrance ? { '--fr-delay': `${i * STAGGER_MS}ms` } : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold tabular-nums text-card group-hover:block group-focus-visible:block ${tipAlign(i, data.length)}`}
                    >
                      {aria}
                    </span>
                    {d.highlight || i === last ? (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink ${d.highlight && i !== last ? hiLabel : 'mb-1'}`}
                      >
                        {valueText}
                      </span>
                    ) : null}
                    <div
                      data-part="ghost"
                      className={`w-full bg-fr-ghost fr-glide-h ${ghost > 0 ? 'rounded-t-[4px]' : ''} ${
                        ghost > 0 && value > 0 ? 'mb-[2px]' : ''
                      }`}
                      style={{ height: `${toPx(ghost)}px` }}
                    />
                    <div
                      data-part="value"
                      className={`w-full fr-glide-h ${strong ? 'bg-chart-1' : 'bg-chart-1/35'} ${
                        ghost > 0 ? '' : 'rounded-t-[4px]'
                      }`}
                      style={{ height: `${toPx(value)}px` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-muted" title={d.label}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
