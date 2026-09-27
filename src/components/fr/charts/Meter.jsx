import React from 'react';
import { pct } from './scales';

/**
 * Meter / MeterList — compact rows for the weekly minimums.
 *
 * Spec: DESKTOP3.md "Chart specs" — warnings use warm WITH an icon + words;
 * text never uses a series colour. MOTION3.md rule 1 — the 6px fill width
 * lives in inline style with fr-glide-w on a node that is never swapped.
 *
 * Met (value ≥ target) → accent fill + a check icon. Below target → accent,
 * unless the caller passes tone="warm" (the week is late), which turns the
 * fill warm and adds a warning icon and the word "Behind".
 *
 * @param {object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {number} props.target
 * @param {(v:number)=>string} [props.format=String]
 * @param {'accent'|'warm'} [props.tone]
 */
function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className="flex-none stroke-fr-accent">
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className="flex-none fill-fr-warm">
      <path d="M6 1.2 11.2 10.4H.8Z" />
      <path d="M6 4.6v2.8M6 8.7v.1" className="stroke-card" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function Meter({ label, value, target, format = String, tone }) {
  const v = Number.isFinite(value) ? value : 0;
  const hasTarget = Number.isFinite(target) && target > 0;
  const met = hasTarget && v >= target;
  const behind = hasTarget && !met && tone === 'warm';
  const fill = behind ? 'bg-fr-warm' : 'bg-fr-accent';
  const width = hasTarget ? pct(v, target) : 0;

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-ink" title={label}>
          {label}
        </span>
        <span className="flex flex-none items-center gap-1 text-[13px] tabular-nums text-ink">
          {met ? <CheckIcon /> : null}
          {behind ? (
            <>
              <WarnIcon />
              <span className="text-[11px] font-semibold text-fr-warm">Behind</span>
            </>
          ) : null}
          <span className="font-semibold">{format(v)}</span>
          <span className="text-ink-muted">/ {hasTarget ? format(target) : '—'}</span>
          {met ? <span className="sr-only">, met</span> : null}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-fr-sunk" aria-hidden="true">
        <div data-part="fill" className={`h-full rounded-full fr-glide-w ${fill}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * MeterList — a list of Meter rows.
 * @param {{ items: { key?: string, label: string, value: number, target: number, format?: Function, tone?: string }[] }} props
 */
export function MeterList({ items = [] }) {
  if (items.length === 0) return <p className="text-[13px] text-ink-muted">No data yet</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map(({ key, ...item }) => (
        <li key={key ?? item.label}>
          <Meter {...item} />
        </li>
      ))}
    </ul>
  );
}
