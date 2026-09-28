import React from 'react';
import { niceMax, pct } from './scales';

/**
 * Bullet — horizontal bullet chart: solid progress, optional "waiting" ghost,
 * and a target tick with its label riding along.
 *
 * Spec: DESKTOP3.md "Chart specs" — settled = solid, submitted/waiting =
 * ghost, target = 1px solid line in the faint ink with a direct label.
 * MOTION3.md rules 1–2 — widths live in inline style with fr-glide-w, the
 * target tick and its label move with fr-glide-x; the nodes are always the
 * same elements, so a data change glides instead of jumping.
 *
 * The ghost sits in the same flex track right after the fill, so its left
 * edge follows the fill's gliding width — only width transitions are needed.
 *
 * @param {object} props
 * @param {number} props.value         settled amount
 * @param {number} [props.target]
 * @param {number} [props.max]         scale max (default niceMax of value+ghost / target)
 * @param {string} props.label
 * @param {string} [props.valueText]   formatted value for the label row
 * @param {string} [props.targetText]  formatted target, shown under the tick
 * @param {number} [props.ghostValue]  submitted / waiting amount
 * @param {'accent'|'warm'|'gold'} [props.tone='accent']
 * @param {number} [props.height=12]   track height in px
 */
const FILL = { accent: 'bg-fr-accent', warm: 'bg-fr-warm', gold: 'bg-fr-gold' };

export default function Bullet({
  value,
  target,
  max,
  label,
  valueText,
  targetText,
  ghostValue = 0,
  tone = 'accent',
  height = 12,
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <div>
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="mt-1 text-[13px] text-ink-muted">No data yet</p>
      </div>
    );
  }

  const ghost = Math.max(0, ghostValue || 0);
  const hasTarget = Number.isFinite(target);
  const scaleMax = max > 0 ? max : niceMax(Math.max(value + ghost, hasTarget ? target : 0));
  const fillPct = pct(value, scaleMax);
  const ghostPct = Math.max(0, pct(value + ghost, scaleMax) - fillPct);
  const targetPct = hasTarget ? pct(target, scaleMax) : 0;

  const vText = valueText ?? String(value);
  const tText = targetText ?? (hasTarget ? String(target) : '');
  const aria = [
    `${label}: ${vText}`,
    hasTarget ? `target ${tText}` : null,
    ghost > 0 ? `plus ${ghost.toLocaleString()} waiting` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Keep the target label inside the card near either end.
  const labelShift =
    targetPct > 85 ? '-translate-x-full' : targetPct < 15 ? 'translate-x-0' : '-translate-x-1/2';

  return (
    <div role="img" aria-label={aria}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink" title={label}>
          {label}
        </span>
        <span className="flex-none text-[13px] font-semibold tabular-nums text-ink">{vText}</span>
      </div>
      <div className="relative">
        {/* The tick is scoped to the track's own box, so it never runs down
            through the target label underneath. */}
        <div className="relative">
          <div className="flex w-full overflow-hidden rounded-full bg-fr-sunk" style={{ height }}>
            <div data-part="fill" className={`h-full fr-glide-w ${FILL[tone] || FILL.accent}`} style={{ width: `${fillPct}%` }} />
            <div data-part="ghost" className="h-full bg-fr-ghost fr-glide-w" style={{ width: `${ghostPct}%` }} />
          </div>
          {hasTarget ? (
            <div
              data-part="tick"
              className="absolute -top-1 -bottom-1 w-px -translate-x-1/2 bg-ink-muted fr-glide-x"
              style={{ left: `${targetPct}%` }}
            />
          ) : null}
        </div>
        {hasTarget ? (
          <>
            {tText ? (
              <div className="relative h-4">
                <span
                  data-part="target-label"
                  className={`absolute top-1 whitespace-nowrap text-[11px] tabular-nums text-ink-muted fr-glide-x ${labelShift}`}
                  style={{ left: `${targetPct}%` }}
                >
                  {tText}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
