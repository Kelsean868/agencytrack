import React, { useEffect, useState } from 'react';
import { X, Flame, Trophy, Check, Award } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * CelebrationTakeover — shared full-screen milestone-celebration dialog.
 *
 * The recognition grammar (medal + halo + confetti + eyebrow / title / body /
 * stat cards / CTA) shared by the Daily Capture streak takeover and the Goals
 * celebrations. The wizard's Celebration.jsx predates this and is intentionally
 * left untouched (its copy + leaderboard messaging are bespoke).
 *
 * §4 dialog contract: role="dialog", aria-modal, focus-trapped (useFocusTrap),
 * Escape closes, focus returns to the trigger on unmount, closed = unmounted
 * (removed from the tab order).
 *
 * §2 motion: everything decorative is gated behind
 * `prefers-reduced-motion: no-preference`. Reduced motion → a static
 * congratulation card (no confetti, no pop, no rise) with identical content.
 * Content entrance is transform-only (never opacity) so a throttled tab can
 * never strand text at opacity:0 — the visible end-state is always the base.
 */

const MEDALS = {
  gold:   { Icon: Trophy, circle: 'bg-gold',     glow: 'bg-gold/25' },
  flame:  { Icon: Flame,  circle: 'bg-warning',  glow: 'bg-warning/25' },
  bronze: { Icon: Award,  circle: 'bg-warning',  glow: 'bg-warning/25' },
  silver: { Icon: Check,  circle: 'bg-primary',  glow: 'bg-primary/25' },
};

// Accent → token classes. Small gold text MUST be gold-ink (AA); teal/warning
// use their -ink display tokens where small.
const ACCENTS = {
  gold:    { eyebrow: 'text-gold-ink',    statLabel: 'text-gold-ink',    statTint: 'bg-gold/10 border-gold/30' },
  warning: { eyebrow: 'text-warning-ink', statLabel: 'text-warning-ink', statTint: 'bg-warning/10 border-warning/30' },
  teal:    { eyebrow: 'text-primary',     statLabel: 'text-primary',     statTint: 'bg-primary/10 border-primary/30' },
};

export default function CelebrationTakeover({
  open,
  onClose,
  medal = 'flame',
  accent = 'warning',
  eyebrow,
  title,
  body,
  stats = [],
  primaryCta,
  secondaryCta,
  confettiColors = ['gold', 'warning', 'primary'],
  autoDismissMs = 0,
  labelId = 'celebration-title',
  testId = 'celebration-takeover',
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(m.matches);
    const handler = (e) => setReduceMotion(e.matches);
    m.addEventListener?.('change', handler);
    return () => m.removeEventListener?.('change', handler);
  }, []);

  // Focus trap + Escape-to-close + focus return. Hook order is stable; the
  // ref is only attached when open, but the effects no-op on a null ref.
  const dialogRef = useFocusTrap({ onEscape: onClose });

  // Optional auto-dismiss (off by default; mockups ship a CTA).
  useEffect(() => {
    if (!open || !autoDismissMs) return undefined;
    const id = setTimeout(() => onClose?.(), autoDismissMs);
    return () => clearTimeout(id);
  }, [open, autoDismissMs, onClose]);

  if (!open) return null;

  const m = MEDALS[medal] ?? MEDALS.flame;
  const a = ACCENTS[accent] ?? ACCENTS.warning;
  const MedalIcon = m.Icon;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      data-testid={testId}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 py-8 text-center overflow-y-auto bg-bg/90"
    >
      {/* Scrim click closes (keyboard path is Escape / CTA). Decorative. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default"
      />

      {/* Close (X) — real 44px dismiss target */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss celebration"
        className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors z-10"
      >
        <X size={20} aria-hidden="true" />
      </button>

      {/* Confetti — motion only */}
      {!reduceMotion && <ConfettiLayer colors={confettiColors} count={40} />}

      <div className="relative z-10 flex flex-col items-center max-w-md w-full">
        {/* Medal + halo (decorative) */}
        <div className="relative w-28 h-28 mb-5" aria-hidden="true">
          <div
            className={`absolute -inset-4 rounded-full ${m.glow} blur-xl ${reduceMotion ? '' : 'motion-safe:animate-pulse'}`}
          />
          <div
            className={`relative w-28 h-28 rounded-full ${m.circle} flex items-center justify-center shadow-lg ${reduceMotion ? '' : 'motion-safe:[animation:celebration-medal-pop_720ms_cubic-bezier(0.34,1.56,0.64,1)_both]'}`}
          >
            <MedalIcon size={46} className="text-white" strokeWidth={2} aria-hidden="true" />
          </div>
        </div>

        {eyebrow && (
          <p
            data-testid="celebration-eyebrow"
            className={`text-[11px] font-bold font-mono uppercase tracking-[0.18em] ${a.eyebrow} ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_ease-out_both]'}`}
          >
            {eyebrow}
          </p>
        )}

        <h2
          id={labelId}
          className={`text-2xl sm:text-3xl font-display font-bold text-ink leading-tight mt-2 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_60ms_ease-out_both]'}`}
          style={{ letterSpacing: '-0.028em' }}
        >
          {title}
        </h2>

        {body && (
          <p
            className={`text-sm text-ink-muted leading-relaxed mt-3 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_120ms_ease-out_both]'}`}
          >
            {body}
          </p>
        )}

        {stats.length > 0 && (
          <div
            data-testid="celebration-stats"
            className={`flex gap-2.5 mt-6 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_180ms_ease-out_both]'}`}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col items-center rounded-xl border px-4 py-2.5 ${
                  s.highlight || i === 0 ? a.statTint : 'bg-card-raised border-border'
                }`}
              >
                <span
                  className={`text-[9px] font-bold font-mono uppercase tracking-[0.1em] ${
                    s.highlight || i === 0 ? a.statLabel : 'text-ink-muted'
                  }`}
                >
                  {s.label}
                </span>
                <span className="text-lg font-display font-bold text-ink tabular-nums mt-1">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTAs — teal primary is the AA-safe button across all accents (D6);
            the accent lives in the medal / eyebrow / stats / glow. */}
        <div
          className={`flex flex-col items-center gap-2 mt-8 w-full ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_240ms_ease-out_both]'}`}
        >
          {primaryCta && (
            <button
              type="button"
              onClick={primaryCta.onClick}
              data-testid="celebration-primary-cta"
              className="w-full max-w-xs h-11 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors"
            >
              {primaryCta.label}
            </button>
          )}
          {secondaryCta && (
            <button
              type="button"
              onClick={secondaryCta.onClick}
              className="w-full max-w-xs min-h-[44px] rounded-xl border border-border text-ink-muted font-semibold text-sm hover:bg-surface transition-colors"
            >
              {secondaryCta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Confetti — deterministic (no Math.random), transform-only, motion-gated ──
function ConfettiLayer({ colors, count }) {
  const items = Array.from({ length: count }, (_, i) => {
    const left = (i * 137.5) % 100; // golden-angle scatter
    const delay = (i % 8) * 80;
    const fall = 1200 + (i % 5) * 200;
    const rotate = (i * 47) % 360;
    const color = colors[i % colors.length];
    return { i, left, delay, fall, rotate, color };
  });
  const colorClass = (c) =>
    c === 'gold' ? 'bg-gold' : c === 'warning' ? 'bg-warning' : c === 'success' ? 'bg-success' : 'bg-primary';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden motion-reduce:hidden"
    >
      {items.map((it) => (
        <span
          key={it.i}
          className={`absolute block w-1.5 h-2.5 rounded-[1px] ${colorClass(it.color)}`}
          style={{
            left: `${it.left}%`,
            top: '-12px',
            transform: `rotate(${it.rotate}deg)`,
            animation: `celebration-confetti-fall ${it.fall}ms ${it.delay}ms ease-out forwards`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
