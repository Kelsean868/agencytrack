import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useCountUp } from '../../../hooks/useCountUp';

/**
 * Shared FR Money pieces (FR-3): class tokens, stat tiles, the "Why?"
 * disclosure. Pure — props only.
 */

export const EYEBROW = 'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted';
export const CARD = 'rounded-[18px] border border-border bg-card';
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
export const SKELETON = 'rounded-lg bg-fr-sunk motion-safe:animate-pulse';

export function WarnIcon({ className = '' }) {
  return <AlertTriangle size={14} aria-hidden="true" className={`shrink-0 text-fr-warm ${className}`} />;
}

/**
 * Tile value that counts old → new in 420 ms (MOTION3 rule 4). `value` null
 * renders "—". Money tiles keep "TTD" as a small prefix in one no-wrap run
 * (v3 rule 8: a figure is never broken across lines).
 */
function TileValue({ value, unit, decimals = 0 }) {
  const animated = useCountUp(value ?? 0, { duration: 420, decimals });
  if (value == null) return <span className="text-ink-muted">—</span>;
  if (unit === 'text') return <span>{value}</span>;
  const shown = unit === 'pct'
    ? `${Number(animated).toFixed(decimals)}%`
    : Math.round(Number(animated) || 0).toLocaleString('en-TT');
  const final = unit === 'pct'
    ? `${Number(value).toFixed(decimals)}%`
    : `TTD ${Math.round(Number(value) || 0).toLocaleString('en-TT')}`;
  return (
    <>
      <span aria-hidden="true" className="whitespace-nowrap">
        {unit === 'ttd' ? <span className="mr-1 font-sans text-[12px] font-semibold text-ink-muted sm:text-[13px]">TTD</span> : null}
        {shown}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

/**
 * @param {{ tile: { id, label, value, unit: 'ttd'|'pct'|'text', decimals?, note?, warm? }, loading?: boolean }} props
 */
export function StatTile({ tile, loading = false }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col gap-1.5 p-4`} data-testid={`money-tile-${tile.id}`}>
      <span className="text-[13px] font-medium text-ink-muted">{tile.label}</span>
      {loading ? (
        <span className={`h-7 w-24 ${SKELETON}`} aria-hidden="true" />
      ) : (
        <span
          className={`whitespace-nowrap font-display font-bold leading-none tabular-nums text-ink ${tile.unit === 'text' ? 'text-[18px] sm:text-[20px]' : 'text-[20px] sm:text-[26px]'}`}
          data-testid={`money-tile-${tile.id}-value`}
        >
          <TileValue value={tile.value} unit={tile.unit} decimals={tile.decimals} />
        </span>
      )}
      {tile.note ? (
        <span className={`flex min-w-0 items-start gap-1.5 text-[12px] leading-snug ${tile.warm ? 'font-semibold text-fr-warm' : 'text-ink-muted'}`}>
          {tile.warm ? <WarnIcon className="mt-px" /> : null}
          <span className="min-w-0">{tile.note}</span>
        </span>
      ) : null}
    </div>
  );
}

export function TileGrid({ tiles, loading = false, label }) {
  if (!tiles?.length) return null;
  const cols = tiles.length >= 4 ? 'lg:grid-cols-4' : tiles.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <section aria-label={label} className="min-w-0">
      <h2 className="sr-only">{label}</h2>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {tiles.map((t) => <StatTile key={t.id} tile={t} loading={loading} />)}
      </div>
    </section>
  );
}

/**
 * "Why?" — a one-line "how this is worked out" disclosure (canvas
 * DESKTOP3-MONEY: every number the agent might not understand gets one).
 * Native <details>, so it is keyboard- and screen-reader-operable for free.
 */
export function Why({ children, label = 'Why?' }) {
  return (
    <details className="group text-[12px] text-ink-muted">
      <summary className={`inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 font-bold text-primary ${FOCUS} rounded-md`}>
        {label}
      </summary>
      <p className="mt-1 leading-relaxed">{children}</p>
    </details>
  );
}

/**
 * FrCheckbox — a real <input type="checkbox"> with a 44×44 hit area (CLAUDE.md
 * touch-target rule; the harness measures the input box itself), drawn as a
 * 20px box. The input sits invisibly over the box; the box mirrors `checked`
 * and carries the focus ring (peer-focus-visible). Ink on the accent fill is
 * the FR on-accent token, which flips with the theme (v3 rule 6).
 * Place it first inside a `relative` <label>.
 */
export function FrCheckbox({ id, checked, onChange }) {
  return (
    <>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer absolute left-0 top-0 z-10 m-0 h-11 w-11 cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${checked ? 'border-fr-accent bg-fr-accent text-fr-on-accent' : 'border-ink-muted bg-card'}`}
      >
        {checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </>
  );
}

