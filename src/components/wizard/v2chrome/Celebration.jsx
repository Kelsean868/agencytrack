import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { totalProductionAPI, totalApps } from '../../../lib/schema/wizardLive.computations';
import { resolveLevel, LEVEL_THRESHOLDS } from '../../../lib/gamificationConfig.js';
import { useCountUp } from '../../../hooks/useCountUp';

/**
 * Wizard v2 PR3 — submit celebration.
 *
 * Renders after `submitReport` resolves successfully. Shows the agent the API
 * they just shipped + a confirmation that their week is in the leaderboard
 * pool. The "now in the leaderboard" copy reflects the EXISTING submit →
 * aggregate-CF → leaderboard path (the scheduled `recomputeLeaderboardScheduled`
 * picks up the new submission on its next hourly run — see Phase 1 source-
 * verify). No new wiring; messaging only.
 *
 * Motion-reduce safe: confetti + sparkles render only when
 * `prefers-reduced-motion: no-preference`. Reduced-motion users see a static
 * celebration card with the same numeric content and CTA.
 */
export default function Celebration({
  formData,
  weekStartingLabel,
  earnedPoints = 0,
  priorPoints = 0,
  onClose,
}) {
  const liveAPI = totalProductionAPI(formData);
  const liveApps = totalApps(formData);

  // §2 count-up — the two stat numerals count up on load. decimals:2 on the
  // API figure preserves TTD cents exactly; earnedPoints is a whole number.
  const displayAPI = useCountUp(liveAPI, { duration: 1000, decimals: 2 });
  const displayEarnedPoints = useCountUp(earnedPoints, { duration: 900, decimals: 0 });

  const cumulative = priorPoints + earnedPoints;
  const currentLevel = resolveLevel(cumulative);
  const prevLevel = resolveLevel(priorPoints);
  const isLevelUp = earnedPoints > 0 && currentLevel.level !== prevLevel.level;
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.level === currentLevel.level + 1);
  const toNext = nextLevel ? nextLevel.threshold - cumulative : null;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(m.matches);
    const handler = (e) => setReduceMotion(e.matches);
    m.addEventListener?.('change', handler);
    return () => m.removeEventListener?.('change', handler);
  }, []);

  return (
    <div
      data-testid="wizard-v2-celebration"
      role="status"
      aria-live="polite"
      className="relative flex flex-col items-center text-center px-6 py-10 pt-16 max-w-lg mx-auto"
    >
      {/* Confetti + Sparkles — only when motion is OK */}
      {!reduceMotion && (
        <>
          <ConfettiLayer count={36} />
          <SparkleLayer count={14} />
        </>
      )}

      {/* Check halo */}
      <div
        data-testid="wizard-v2-celebration-halo"
        className={`relative w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-5 ${
          reduceMotion ? '' : 'motion-safe:animate-pulse'
        } motion-reduce:animate-none`}
        aria-hidden="true"
      >
        <Check size={40} className="text-success-ink" />
      </div>

      <h2
        className="text-2xl sm:text-3xl font-display font-bold text-ink leading-tight"
        style={{ letterSpacing: '-0.022em' }}
      >
        Report submitted!
      </h2>
      <p className="text-sm text-ink-muted mt-2">
        Your weekly report for {weekStartingLabel} is in.
      </p>

      {/* Production headline */}
      <div
        data-testid="wizard-v2-celebration-api"
        className="mt-6 flex flex-col items-center"
      >
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-gold-ink">
          You shipped
        </p>
        <p
          data-testid="wizard-v2-celebration-api-value"
          className="text-4xl sm:text-5xl font-display font-bold text-ink leading-none mt-2"
          style={{ letterSpacing: '-0.028em' }}
        >
          {formatCurrency(displayAPI)}
        </p>
        <p className="text-xs text-ink-muted mt-2">
          Production API · {liveApps} apps
        </p>
      </div>

      {/* Points earned */}
      {earnedPoints > 0 ? (
        <div className="mt-6 flex flex-col items-center" data-testid="wizard-celebration-points">
          <p
            className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
              isLevelUp ? 'text-gold-ink' : 'text-primary'
            }`}
          >
            {isLevelUp ? 'Level Up ✦' : 'This Week'}
          </p>
          <p
            data-testid="wizard-celebration-earned"
            className="text-3xl font-display font-bold text-ink leading-none mt-1"
            style={{ letterSpacing: '-0.022em' }}
          >
            +{displayEarnedPoints} pts
          </p>
          {isLevelUp ? (
            <p
              data-testid="wizard-celebration-level-up"
              className="text-sm text-ink mt-1"
            >
              You reached <span className="font-semibold">{currentLevel.title}</span>
            </p>
          ) : nextLevel ? (
            <p
              data-testid="wizard-celebration-progress"
              className="text-xs text-ink-muted mt-1"
            >
              {toNext} to {nextLevel.title}
            </p>
          ) : (
            <p
              data-testid="wizard-celebration-at-top"
              className="text-xs text-ink-muted mt-1"
            >
              Legend — you&apos;re at the top
            </p>
          )}
        </div>
      ) : (
        <p
          className="mt-6 text-sm text-ink-muted"
          data-testid="wizard-celebration-zero"
        >
          Logged — keep building.
        </p>
      )}

      {/* Leaderboard messaging */}
      <p
        data-testid="wizard-v2-celebration-leaderboard"
        className="mt-6 text-sm text-ink leading-snug"
      >
        Your week is now in the team leaderboard pool.
      </p>
      <p className="text-[11px] text-ink-muted mt-1 leading-snug">
        Standings refresh hourly.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="btn-primary mt-8 w-full max-w-xs h-11"
      >
        Back to Dashboard
      </button>
    </div>
  );
}

// ─── Visual atoms — pure decorative SVG, decoupled from React state ────────

function ConfettiLayer({ count }) {
  // Deterministic by index — no Math.random/Date.now in scripts/builds.
  const items = Array.from({ length: count }, (_, i) => {
    const left = (i * 137.5) % 100;                     // golden-angle scatter
    const delay = (i % 8) * 80;                          // staggered ms
    const fall = 1100 + (i % 5) * 180;                   // ms total fall
    const rotate = (i * 47) % 360;
    const color = ['gold', 'primary', 'success'][i % 3];
    return { i, left, delay, fall, rotate, color };
  });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden motion-reduce:hidden"
    >
      {items.map((it) => (
        <span
          key={it.i}
          className={`absolute block w-1.5 h-2.5 rounded-[1px] ${
            it.color === 'gold'
              ? 'bg-gold'
              : it.color === 'primary'
                ? 'bg-primary'
                : 'bg-success'
          }`}
          style={{
            left: `${it.left}%`,
            top: '-12px',
            transform: `rotate(${it.rotate}deg)`,
            animation: `wizardv2-confetti-fall ${it.fall}ms ${it.delay}ms ease-out forwards`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function SparkleLayer({ count }) {
  const items = Array.from({ length: count }, (_, i) => {
    const left  = ((i * 211) % 90) + 5;
    const top   = ((i * 73)  % 60) + 5;
    const delay = (i % 7) * 130;
    return { i, left, top, delay };
  });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden motion-reduce:hidden"
    >
      {items.map((it) => (
        <span
          key={it.i}
          className="absolute w-1 h-1 rounded-full bg-gold"
          style={{
            left: `${it.left}%`,
            top:  `${it.top}%`,
            animation: `wizardv2-sparkle-pop 900ms ${it.delay}ms ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}
