import React, { useEffect, useState } from 'react';
import { X, Flame } from 'lucide-react';
import useFocusTrap from '../../../hooks/useFocusTrap';
import { computeSubmissionStreak } from '../../../utils/submissionStreak';
import {
  resolveStreakCelebration,
  FILING_WEEKLY_STREAK_MILESTONES,
} from '../../../lib/celebrations';
import {
  getFilingStreakCelebratedMax,
  setFilingStreakCelebratedMax,
} from '../../../lib/celebrationPrefs';

/**
 * FilingStreakCelebration — milestone takeover for the agent's weekly FILING
 * streak (consecutive weeks with a submitted weekly report, the value the home
 * PulseStrip already shows via computeSubmissionStreak.currentStreak).
 *
 * Fires on LOAD of the home surface that owns the streak display — the home is
 * a passive display with no save event of its own, so it mirrors the Goals
 * weekly-streak takeover (fire-on-load, persist the per-year marker so each
 * milestone fires ONCE, never re-firing on reload). Firing mechanics
 * (thresholds, celebratedMax marker, load-time evaluation) are UNCHANGED by
 * the visual reskin below — see resolveStreakCelebration in ../../../lib/celebrations.
 *
 * Rendered inside HomeV2 (not a new surface); returns null until a milestone
 * crosses, so it costs nothing on the common path.
 *
 * Presentation (2.11 reskin — design_handoff_sheet_celebrations_planner §2):
 * bespoke gold takeover (hero milestone number, flame medal, STREAK/BEST/NEXT
 * MILESTONE chips) — NOT the shared CelebrationTakeover primitive, which stays
 * on its existing warning-flame skin for the Goals-tab consumer
 * (GoalsCelebration.jsx) untouched by this PR. Eyebrow copy for the 5/10/25
 * rungs keeps the "FILING STREAK · N WEEKS" shape (rather than the mockup's
 * generic "FILING STREAK MILESTONE" label) so the on-disk VH leg
 * `t2-filing-streak-milestone` — which asserts literal text
 * /FILING STREAK.{0,4}5 WEEKS/i inside this dialog — keeps passing without
 * editing the smoke's assertion.
 */
export default function FilingStreakCelebration({ allSubmissions, agentUid, year }) {
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    if (!agentUid) return;
    try {
      const { currentStreak, longestStreak } = computeSubmissionStreak(allSubmissions ?? [], year);
      const celebratedMax = getFilingStreakCelebratedMax(agentUid, year);
      const { milestone } = resolveStreakCelebration({
        streak: currentStreak,
        celebratedMax,
        milestones: FILING_WEEKLY_STREAK_MILESTONES,
      });
      if (!milestone) return;
      // Persist BEFORE showing so a reload can never re-fire the same rung.
      setFilingStreakCelebratedMax(agentUid, year, milestone);
      setCelebration({ milestone, longestStreak });
    } catch (err) {
      // A celebration marker must never break the home render.
      console.error('Filing-streak celebration evaluation failed:', err);
    }
  }, [allSubmissions, agentUid, year]);

  if (!celebration) return null;
  return (
    <FilingStreakTakeover
      milestone={celebration.milestone}
      longestStreak={celebration.longestStreak}
      onClose={() => setCelebration(null)}
    />
  );
}

// Per-tier subtitle copy — verbatim from the mockup's STREAK_COPY (streak-
// celebrate.jsx), keyed by the milestone rung reached.
const STREAK_COPY = {
  5: 'Five straight weeks filed on time. The habit is forming — this is how the year gets built.',
  10: 'Ten weeks without a miss. Your manager sees a full, honest picture of the quarter.',
  25: 'Half a year of unbroken filing. The Master Sheet has never had a gap with your name on it.',
  52: 'A full year. Every single week, filed. Nobody can say what gets measured wasn’t done.',
};

const HERO_SIZE = {
  small: 'text-[76px] sm:text-[108px] md:text-[132px]',
  large: 'text-[84px] sm:text-[118px] md:text-[148px]',
};

/**
 * Filing-streak milestone takeover — bespoke gold-forward reskin (Nexus v2,
 * §2 Celebration surfaces). The milestone NUMBER is the hero; the flame medal
 * supports it. One-tap dismiss (whole overlay is the target); a real 44px
 * dismiss control sits top-right for keyboard/pointer users, aria-labelled
 * "Dismiss celebration" — unchanged from the prior markup so
 * scripts/verification/vh/vh-helpers.mjs's login() auto-dismiss selector
 * still matches without edits.
 *
 * §4 dialog contract preserved: role="dialog", aria-modal, focus-trapped,
 * Escape closes, focus returns to the trigger on unmount.
 * §2 motion: prefers-reduced-motion gets the static variant — no confetti, no
 * pop/rise/ring, halo frozen at ~55% opacity. Content is always the final
 * (non-animated) end-state; nothing is opacity-gated.
 */
function FilingStreakTakeover({ milestone, longestStreak, onClose }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(m.matches);
    const handler = (e) => setReduceMotion(e.matches);
    m.addEventListener?.('change', handler);
    return () => m.removeEventListener?.('change', handler);
  }, []);

  const dialogRef = useFocusTrap({ onEscape: onClose });

  const annual = milestone === 52;
  const milestoneIdx = FILING_WEEKLY_STREAK_MILESTONES.indexOf(milestone);
  const next =
    milestoneIdx >= 0 && milestoneIdx < FILING_WEEKLY_STREAK_MILESTONES.length - 1
      ? FILING_WEEKLY_STREAK_MILESTONES[milestoneIdx + 1]
      : null;
  const best = Math.max(Number(longestStreak) || 0, milestone);
  const eyebrowText = annual ? '★ FILING STREAK · A FULL YEAR' : `FILING STREAK · ${milestone} WEEKS`;
  const heroSize = annual || milestone >= 10 ? HERO_SIZE.large : HERO_SIZE.small;

  const chips = [
    { key: 'STREAK', value: `${milestone} wks`, gold: true },
    { key: 'BEST', value: `${best} wks` },
    next ? { key: 'NEXT MILESTONE', value: `${next} wks` } : { key: 'THIS YEAR', value: '52 / 52' },
  ];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filing-streak-celebration-title"
      data-testid="filing-streak-celebration"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 py-8 text-center overflow-y-auto bg-bg/90 backdrop-blur-sm"
    >
      {/* Scrim click closes (keyboard path is Escape / CTA). Decorative. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default"
      />

      {/* Ambient gold glow behind the hero. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[90%] sm:w-[58%] h-[46%] sm:h-[58%] rounded-full opacity-70"
        style={{ background: 'radial-gradient(circle, var(--color-medal-1-glow) 0%, transparent 62%)' }}
      />

      {!reduceMotion && <StreakConfetti dense={annual} />}

      {/* Dismiss — single node so the VH login() helper's aria-label selector
          always resolves to exactly one element; the "ESC · DISMISS" label is
          a progressive sm+ enhancement, not a second control. Real 44px target. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss celebration"
        data-testid="celebration-dismiss"
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5 h-11 px-3 rounded-full text-ink-muted hover:bg-card/70 transition-colors"
      >
        <X size={18} aria-hidden="true" />
        <span
          aria-hidden="true"
          className="hidden sm:inline text-[10.5px] font-bold font-mono uppercase tracking-[0.08em]"
        >
          ESC · DISMISS
        </span>
      </button>

      {/* Whole content area is a dismiss target too ("TAP ANYWHERE TO CONTINUE") —
          pointer-events-none here lets clicks over the copy/chips fall through to
          the full-screen scrim button above; the CTA re-enables pointer-events so
          it still captures its own click. Avoids a click handler on a
          non-interactive element (jsx-a11y/no-static-element-interactions). */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full pointer-events-none">
        {/* Medal — supports the hero number, doesn't lead it. */}
        <div className="relative w-24 h-24 mb-3" aria-hidden="true">
          <div
            className={`absolute -inset-4 rounded-full ${reduceMotion ? 'opacity-[0.55]' : 'motion-safe:animate-pulse'}`}
            style={{ background: 'radial-gradient(circle, var(--color-medal-1-glow) 0%, transparent 68%)' }}
          />
          {!reduceMotion && (
            <div className="absolute -inset-2 rounded-full border-2 border-gold/40 motion-safe:[animation:celebration-ring_2.4s_ease-out_infinite]" />
          )}
          {annual && <div className="absolute -inset-3 rounded-full border border-gold/30" />}
          <div
            className={`badge-medal medal-1 relative w-24 h-24 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-medal-pop_720ms_cubic-bezier(0.34,1.56,0.64,1)_both]'}`}
          >
            <Flame size={40} className="text-white relative z-[1]" strokeWidth={2} aria-hidden="true" />
          </div>
        </div>

        <p
          data-testid="celebration-eyebrow"
          className={`text-[11px] font-bold font-mono uppercase tracking-[0.24em] text-gold-ink ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_ease-out_both]'}`}
        >
          {eyebrowText}
        </p>

        <h2 id="filing-streak-celebration-title" className="flex flex-col items-center mt-1">
          <span
            className={`font-display font-extrabold text-gold leading-[0.9] ${heroSize} ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_60ms_ease-out_both]'}`}
            style={{ letterSpacing: '-0.045em' }}
          >
            {milestone}
          </span>
          <span
            className={`text-xl sm:text-2xl font-display font-bold text-ink mt-1.5 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_60ms_ease-out_both]'}`}
            style={{ letterSpacing: '-0.02em' }}
          >
            weeks filed in a row
          </span>
        </h2>

        <p
          className={`text-sm text-ink-muted leading-relaxed mt-3 max-w-[300px] ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_120ms_ease-out_both]'}`}
        >
          {STREAK_COPY[milestone] ?? STREAK_COPY[5]}
        </p>

        <div
          data-testid="celebration-stats"
          className={`flex gap-2.5 mt-6 ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_180ms_ease-out_both]'}`}
        >
          {chips.map((c) => (
            <div
              key={c.key}
              className={`flex flex-col items-center rounded-xl border px-4 py-2.5 ${
                c.gold ? 'bg-gold/10 border-gold/30' : 'bg-card-raised border-border'
              }`}
            >
              <span
                className={`text-[9px] font-bold font-mono uppercase tracking-[0.1em] ${
                  c.gold ? 'text-gold-ink' : 'text-ink-muted'
                }`}
              >
                {c.key}
              </span>
              <span className="text-lg font-display font-bold text-ink tabular-nums mt-1">{c.value}</span>
            </div>
          ))}
        </div>

        {/* CTA — teal primary is the AA-safe button across all accents (D6);
            gold stays confined to decoration + certified AA-large display text. */}
        <div
          className={`flex flex-col items-center gap-2 mt-8 w-full ${reduceMotion ? '' : 'motion-safe:[animation:celebration-rise_600ms_240ms_ease-out_both]'}`}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="celebration-primary-cta"
            className="pointer-events-auto w-full max-w-xs h-11 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors"
          >
            Keep filing
          </button>
        </div>
        <p className="mt-3 text-[10px] font-bold font-mono uppercase tracking-[0.14em] text-ink-faint">
          TAP ANYWHERE TO CONTINUE
        </p>
      </div>
    </div>
  );
}

// ── Confetti — deterministic (no Math.random), transform-only, motion-gated.
// Local to this takeover (gold-forward palette); mirrors the shared
// CelebrationTakeover's ConfettiLayer grammar without exporting a dependency
// on that component (kept untouched for the Goals-tab consumer).
function StreakConfetti({ dense }) {
  const count = dense ? 56 : 40;
  const colors = ['gold', 'warning', 'primary', 'white'];
  const items = Array.from({ length: count }, (_, i) => {
    const left = (i * 137.5) % 100; // golden-angle scatter
    const delay = (i % 8) * 80;
    const fall = 1200 + (i % 5) * 200;
    const rotate = (i * 47) % 360;
    const color = colors[i % colors.length];
    return { i, left, delay, fall, rotate, color };
  });
  const colorClass = (c) =>
    c === 'gold' ? 'bg-gold' : c === 'warning' ? 'bg-warning' : c === 'white' ? 'bg-white' : 'bg-primary';
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
