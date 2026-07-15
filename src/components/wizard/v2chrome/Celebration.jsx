import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { totalProductionAPI, totalApps, estCommission } from '../../../lib/schema/wizardLive.computations';
import { resolveLevel, LEVEL_THRESHOLDS } from '../../../lib/gamificationConfig.js';
import { weekNumber } from '../../../utils/dateHelpers';
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
 * Build-map Tier-2 #11 polish (this pass) — three additions over PR3, ported
 * from the design-intent mockup's `Celebration()` scene in
 * `docs/design-system/screens-v2/wizard-v2-screens.jsx`:
 *
 *   1. Gold WEEK-N medal — replaces the plain green check halo. `N` is the
 *      ISO-ish week-of-year derived via the canonical `weekNumber()` helper
 *      (`src/utils/dateHelpers.js`), the SAME helper + "WK N" convention
 *      already shipped in `DailyCaptureV2.jsx` and `GamePlanV2/index.jsx` —
 *      not a new "sequential submission count" semantic. Mockup's sample
 *      data confirms this reading (`weekShort: 'WK 48'` for `weekLabel:
 *      'Week of Nov 24'`, which lands in ISO week 48).
 *      Gold-rule compliance: the ring/fill is `--color-gold` decoration
 *      (`bg-gold/15` tint + `border-gold`), and the "Week" + number text
 *      inside uses `text-gold-ink` — the SAME certified pairing already
 *      shipped on `bg-gold/15`/`bg-gold-tint` badges elsewhere (e.g.
 *      `MoneyNeedsAllocator.jsx`, `CampaignStandings.jsx`,
 *      `FinancingBasisBadge.jsx`). A solid `bg-gold` fill + light text was
 *      considered and rejected: dark-mode `--color-gold` (#E0AA3E) is light
 *      enough that white text on it fails even AA-large (~2.1:1); the
 *      tint+ink pairing sidesteps that per-theme contrast flip entirely.
 *
 *   2. Stat-card pair — the old "Production API · N apps" subtext line is
 *      replaced with an Apps-written card + an Est. Commission card (the
 *      mockup's 3-card row minus Production API, which stays as this
 *      component's headline figure instead of being repeated). Est.
 *      Commission uses the existing `estCommission(formData, commissionRate)`
 *      pure fn (E2-era reverse-commission calc, already unit-tested in
 *      `wizardLive.computations.js`) — commissionRate is read from
 *      `userProfile.commissionRate` by the caller (WizardForm.jsx), the same
 *      value already threaded into `submitReport`/`WeekSoFarPanel` moments
 *      earlier in the same flow, so this is not a new fetch.
 *
 *   3. Secondary "View submission" CTA — wired via an optional
 *      `onViewSubmission` prop. WizardForm.jsx already owns a
 *      `viewingSubmission` + `submissionData` + `<SubmissionViewer>` overlay
 *      (reused unchanged from the History tab) for the "already submitted"
 *      interstitial; the caller reuses that exact mechanism rather than
 *      introducing new navigation plumbing. When the prop is omitted the
 *      button does not render (backward-compatible with existing callers).
 *
 * Motion-reduce safe: confetti + sparkles render only when
 * `prefers-reduced-motion: no-preference`. Reduced-motion users see a static
 * celebration card with the same numeric content and CTA.
 */
export default function Celebration({
  formData,
  weekStartingLabel,
  weekStarting,
  commissionRate = 0,
  earnedPoints = 0,
  priorPoints = 0,
  onClose,
  onViewSubmission,
}) {
  const liveAPI = totalProductionAPI(formData);
  const liveApps = totalApps(formData);
  const liveCommission = estCommission(formData, commissionRate);
  // weekStarting is the wizard's 'YYYY-MM-DD' state string (same shape
  // `formatDateFriendly`/`submissionDocId` already consume) — weekNumber()'s
  // string branch parses it at noon UTC, so no separate Date object is
  // needed here. Falls back to "now" only when the prop is omitted (e.g.
  // pre-existing tests that don't exercise the medal).
  const weekNum = weekNumber(weekStarting);

  // §2 count-up — the stat numerals count up on load. decimals:2 on the
  // API + commission figures preserves TTD cents exactly; apps/points are
  // whole numbers.
  const displayAPI = useCountUp(liveAPI, { duration: 1000, decimals: 2 });
  const displayApps = useCountUp(liveApps, { duration: 700, decimals: 0 });
  const displayCommission = useCountUp(liveCommission, { duration: 1000, decimals: 2 });
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

      {/* Gold WEEK-N medal — replaces the plain check halo (see file header). */}
      <div
        data-testid="wizard-v2-celebration-halo"
        className={`relative w-24 h-24 rounded-full bg-gold/15 border-4 border-gold flex flex-col items-center justify-center mb-5 ${
          reduceMotion ? '' : 'motion-safe:animate-pulse'
        } motion-reduce:animate-none`}
        aria-hidden="true"
      >
        <span className="text-[9px] font-bold font-mono uppercase tracking-[0.2em] text-gold-ink">
          Week
        </span>
        <span
          data-testid="wizard-v2-celebration-week-value"
          className="text-2xl font-display font-extrabold text-gold-ink leading-none mt-0.5"
        >
          {weekNum}
        </span>
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
          Production API
        </p>
      </div>

      {/* Stat-card pair — Apps written + Est. Commission (mockup's stat row,
          minus Production API which stays the headline figure above). */}
      <div
        data-testid="wizard-v2-celebration-stats"
        className="mt-5 grid grid-cols-2 gap-3 w-full max-w-xs"
      >
        <div
          data-testid="wizard-v2-celebration-stat-apps"
          className="rounded-xl border border-border bg-card px-4 py-3 text-center"
        >
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-gold-ink">
            Apps Written
          </p>
          <p
            data-testid="wizard-v2-celebration-stat-apps-value"
            className="text-xl font-display font-bold text-ink leading-none mt-2"
          >
            {displayApps}
          </p>
        </div>
        <div
          data-testid="wizard-v2-celebration-stat-commission"
          className="rounded-xl border border-border bg-card px-4 py-3 text-center"
        >
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary">
            Est. Commission
          </p>
          <p
            data-testid="wizard-v2-celebration-stat-commission-value"
            className="text-xl font-display font-bold text-ink leading-none mt-2"
          >
            {formatCurrency(displayCommission)}
          </p>
        </div>
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

      <div className="mt-8 w-full max-w-xs flex gap-3">
        {onViewSubmission && (
          <button
            type="button"
            onClick={onViewSubmission}
            data-testid="wizard-v2-celebration-view-submission"
            className="flex-1 h-11 rounded-xl border border-border bg-card text-ink font-semibold text-sm hover:bg-surface transition-colors"
          >
            View submission
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`btn-primary h-11 ${onViewSubmission ? 'flex-1' : 'w-full'}`}
        >
          Back to Dashboard
        </button>
      </div>
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
