import React, { useEffect, useState } from 'react';

/**
 * WarCompletionRing — small SVG donut showing % of a WAR's configured KPI
 * targets that were met (item 2.1 "CompletionRing"). Rendered on My WAR, every
 * team row, and the drill.
 *
 * The percentage is computed upstream by computeWarCompletion() in
 * accountabilityFlag.js. Honest denominator: ONLY KPIs that carry a configured
 * target count toward the ring (no-target KPIs are excluded, not fabricated as
 * "met"). When no target is configured for any KPI, pct is null → the ring
 * renders a neutral "no targets set" state.
 *
 * Motion: the arc eases into place once on mount via a `motion-safe:` stroke
 * transition (transform/opacity-equivalent — reduced-motion users get the final
 * offset with no animation). The numeric label is always the real value (never
 * a count-up), so it is deterministic for tests + assistive tech.
 *
 * @param {number|null} pct   0–100, or null when no targets are configured
 * @param {number} [met]      met-target count (for the aria label)
 * @param {number} [total]    configured-target count (for the aria label)
 * @param {number} [size=48]  px diameter
 * @param {number} [stroke=5] px ring thickness
 * @param {'default'|'hero'} [variant='default']  'hero' swaps to the certified
 *   glass-hero viz tokens (track + arc + numeral) so the ring stays legible on
 *   the dark-teal `.glass.hero.teal` surface, where the light-card success/
 *   warning/danger + `text-text` numeral would be invisible.
 */
export default function WarCompletionRing({ pct, met = 0, total = 0, size = 48, stroke = 5, className = '', variant = 'default' }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isHero = variant === 'hero';
  const hasData = pct != null;
  const safePct = hasData ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = mounted ? circ * (1 - safePct / 100) : circ;

  const ringColor = !hasData
    ? (isHero ? 'var(--hero-chip-border)' : 'var(--color-ink-dim)')
    : isHero
      ? safePct >= 80 ? 'var(--hero-dot-success)'
        : safePct >= 50 ? 'var(--hero-dot-warning)'
        : 'var(--hero-dot-danger)'
      : safePct >= 80 ? 'var(--color-success)'
        : safePct >= 50 ? 'var(--color-warning)'
        : 'var(--color-danger)';
  const trackColor = isHero ? 'var(--hero-chip-border)' : 'var(--color-surface-muted)';

  const label = hasData
    ? `KPI completion: ${safePct}% — ${met} of ${total} targets met`
    : 'KPI completion: no targets set';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      role="img"
      aria-label={label}
      data-testid="war-completion-ring"
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {hasData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums ${isHero ? 'text-[--hero-ink]' : 'text-text'} ${size <= 44 ? 'text-xs' : 'text-sm'}`}
      >
        {hasData ? safePct : '—'}
      </span>
    </div>
  );
}
