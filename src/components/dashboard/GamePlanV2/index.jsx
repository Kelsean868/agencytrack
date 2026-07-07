import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RotateCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getMoneyNeeds } from '../../../services/moneyNeedsService';
import { getYearPlan, LINE_KEYS } from '../../../services/yearPlanService';
import { getMonthlyPlan } from '../../../services/monthlyPlanService';
import { bucketActualsByMonth, ytdDelta as computeYtdDelta } from '../../../lib/monthlyPlanMath';
import { getWeeklyPlan, commitWeeklyPlan, deleteWeeklyPlan } from '../../../services/weeklyPlanService';
import { getDailyEntriesForWeek } from '../../../services/dailyActivityService';
import { getRecentSundays } from '../../../utils/validators';
import { weekNumber } from '../../../utils/dateHelpers';
import PlanAnchorStrip from './PlanAnchorStrip';
import StepRail from './StepRail';
import PlanCascade from './PlanCascade';
import PlanSuggestionsCard from './PlanSuggestionsCard';
import SuggestedWeekCard from './SuggestedWeekCard';
import MonthlyPlanModal from '../../agent/MonthlyPlanModal';
import ReviewCommitModal from './ReviewCommitModal';

const GAME_PLAN_LOOP_ENABLED = import.meta.env.VITE_GAME_PLAN_LOOP_ENABLED !== 'false';

// POC — the data-gated entrance holds the screen-enter fade until data is ready,
// capped so a slow fetch can't strand the user on the loading state.
const ENTRANCE_CAP_MS = 400; // max-wait: release the fade even if data isn't ready
const SLOW_PATH_MS = 2000;   // past this, show a subtle "taking longer" reassurance

// prefers-reduced-motion — mirrors the GoalCarousel/Celebration pattern. Used only
// by the POC data-gated entrance to skip the fade under reduced-motion. The
// `.screen-enter` CSS is ALSO gated behind the same media query (index.css), so
// this JS guard is belt-and-suspenders AND makes the reduced-motion path testable.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * GamePlanScreen — Game Plan v2 hub (Slice 1).
 *
 * Composition-first: the shell chrome (anchor / rail / cascade / preview
 * commit) is NEW, but every figure is read from the EXISTING moneyNeeds
 * worksheet. No new collection, no new write path, no Firestore rules change.
 *
 * The forward steps (Year Plan / Monthly / Commit) render as honest
 * "next / coming" states — never empty or fabricated data. Plan completeness
 * is derived (Money Needs filled = 1 of 4); the status is a static "Draft".
 *
 * `committedAnnualAPI` is the raw Goals personalAnnualAPI (or null) — the
 * API Commitment chip shows it when set, otherwise an honest not-yet-set
 * state. It is intentionally NOT the company-floor fallback, so the chip
 * never fabricates a figure.
 *
 * `onOpenTab(tabId)` routes to the Money Needs step and the Goals page.
 *
 * The Weekly Planner card (Slice 1) is a read-only "This week" rung below the
 * cascade. It composes the existing goal-decomposition engine over the agent's
 * committed API anchor + history-derived ratios — no new data, no store. Its
 * inputs (goals assumptions, submission history, the company floor) are loaded
 * once by AgentDashboard and threaded in; `dataLoading` / `dataError` / `onRetry`
 * drive its honest loading / error states.
 */
const TOTAL_STEPS = 3;

export default function GamePlanScreen({
  committedAnnualAPI = null,
  onOpenTab,
  avgPolicyAPI = null,
  prospectRatio = null,
  submissions = [],
  weeklyActivityFloors = null,
  dataLoading = false,
  dataError = false,
  onRetry,
  // S3b — notify AgentDashboard after a same-session commit/delete so the
  // Standard drawer stays in sync without a full page reload.
  onPlanChanged,
  // POC (data-gated entrance) — opt-in. When true, this screen OWNS its own
  // screen-enter fade, held until data is ready (or ENTRANCE_CAP_MS). The caller
  // MUST also suppress its dashboard-level `.screen-enter` for this tab so the
  // fade plays once on populated content instead of firing on the skeleton.
  // Default false → byte-identical legacy behavior (ManagerDashboard, etc.).
  gatedEntrance = false,
}) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;
  const now = new Date();
  const year = now.getFullYear();
  // Week-of-year label — shared floored, Sunday-anchored helper (BUG-102).
  const weekNum = weekNumber(now);
  const currentMonthIndex = now.getMonth();
  // This week's Sunday (YYYY-MM-DD) — the weeklyPlans doc-ID date segment.
  const weekStart = getRecentSundays(1)[0];

  const [worksheet, setWorksheet] = useState(null);
  const [yearPlan, setYearPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthlyPlanOpen, setMonthlyPlanOpen] = useState(false);
  const [reviewCommitOpen, setReviewCommitOpen] = useState(false);

  // Weekly plan (Slice 2) — committed plan for this week + commit lifecycle.
  const [committedPlan, setCommittedPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState(false);

  // Daily Capture docs for this week (Slice 3a) — the mid-week actuals source.
  // Errors degrade to an empty week (zero actuals) rather than blocking the card.
  const [dailyDocs, setDailyDocs] = useState([]);

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setLoading(true);
    setError('');
    try {
      const [result, plan, mPlan] = await Promise.all([
        getMoneyNeeds(tenantId, uid, year),
        GAME_PLAN_LOOP_ENABLED
          ? getYearPlan(tenantId, uid, year).catch(() => null)
          : Promise.resolve(null),
        GAME_PLAN_LOOP_ENABLED
          ? getMonthlyPlan(tenantId, uid, year).catch(() => null)
          : Promise.resolve(null),
      ]);
      setWorksheet(result);
      setYearPlan(plan);
      setMonthlyPlan(mPlan);
    } catch {
      setError('Could not load your plan. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, uid, year]);

  useEffect(() => { load(); }, [load]);

  const loadPlan = useCallback(async () => {
    if (!tenantId || !uid) return;
    try {
      setCommittedPlan(await getWeeklyPlan(tenantId, uid, weekStart));
    } catch {
      setCommittedPlan(null);
    }
  }, [tenantId, uid, weekStart]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const loadDaily = useCallback(async () => {
    if (!tenantId || !uid) return;
    try {
      setDailyDocs(await getDailyEntriesForWeek(tenantId, uid, weekStart));
    } catch {
      setDailyDocs([]);
    }
  }, [tenantId, uid, weekStart]);

  useEffect(() => { loadDaily(); }, [loadDaily]);

  // Slice 3a — the week's submitted report (if any) is the FINAL actuals source;
  // reuse the already-loaded submissions (no refetch). Otherwise the card falls
  // back to the daily aggregate (mid-week).
  const weekSubmission =
    submissions.find((s) => s?.status === 'submitted' && s?.weekStarting === weekStart) ?? null;

  const handleCommitPlan = useCallback(async (targets, provenance, anchorAPIAtCommit) => {
    if (!tenantId || !uid) return;
    setPlanBusy(true);
    setPlanError(false);
    try {
      await commitWeeklyPlan(
        tenantId, uid, weekStart,
        { targets, provenance, anchorAPIAtCommit },
        weeklyActivityFloors,
      );
      setCommittedPlan(await getWeeklyPlan(tenantId, uid, weekStart));
      onPlanChanged?.(); // keep AgentDashboard's committedPlan in sync
    } catch (err) {
      setPlanError(true);
      throw err; // keep the card in edit mode for retry
    } finally {
      setPlanBusy(false);
    }
  }, [tenantId, uid, weekStart, weeklyActivityFloors, onPlanChanged]);

  const handleDeletePlan = useCallback(async () => {
    if (!tenantId || !uid) return;
    setPlanBusy(true);
    setPlanError(false);
    try {
      await deleteWeeklyPlan(tenantId, uid, weekStart);
      setCommittedPlan(null);
      onPlanChanged?.(); // keep AgentDashboard's committedPlan in sync
    } catch {
      setPlanError(true);
    } finally {
      setPlanBusy(false);
    }
  }, [tenantId, uid, weekStart, onPlanChanged]);

  // ── Derived (all from existing moneyNeeds fields — no new data) ──────────
  const afterTaxNeed = worksheet?.totalAnnualAfterTax ?? 0;
  const renewalsCover = worksheet?.estimatedRenewalIncome?.total ?? 0;
  const grossNeed = worksheet?.totalAnnualPreTax ?? 0;
  // Commission need mirrors the worksheet's own derivation
  // (pre-tax gross − renewal income), computed live so it stays honest even
  // before the agent opens the commission-targets step.
  const commissionNeed = grossNeed > 0 ? Math.max(0, grossNeed - renewalsCover) : 0;
  const moneyNeedsFilled = afterTaxNeed > 0;
  const yearPlanTotalAPI = yearPlan
    ? LINE_KEYS.reduce((sum, k) => {
        const line = yearPlan.lines?.[k];
        return sum + (line?.enabled !== false ? (line?.targetAPI ?? 0) : 0);
      }, 0)
    : 0;
  const yearPlanFilled = GAME_PLAN_LOOP_ENABLED && yearPlanTotalAPI > 0;
  const monthlyPlanFilled = GAME_PLAN_LOOP_ENABLED &&
    (monthlyPlan?.targets ?? []).reduce((s, v) => s + (parseFloat(v) || 0), 0) > 0;
  const monthlyPlanTotal = monthlyPlan?.anchorAPI ?? 0;
  const monthlyYtdDelta = monthlyPlanFilled
    ? computeYtdDelta(bucketActualsByMonth(submissions, year), monthlyPlan.targets, currentMonthIndex)
    : 0;
  const committed = GAME_PLAN_LOOP_ENABLED && monthlyPlan?.status === 'committed';
  const committedAt = committed
    ? (monthlyPlan?.committedAt instanceof Date
        ? monthlyPlan.committedAt
        : monthlyPlan?.committedAt?.toDate?.() ?? null)
    : null;
  // Direction 1.5 (PR-U1): Money Needs + Year Plan are ONE step now. The merged
  // allocator writing the yearPlan (`yearPlanFilled`) is step 1's completion.
  const stepsBuilt = (yearPlanFilled ? 1 : 0) + (monthlyPlanFilled ? 1 : 0) + (committed ? 1 : 0);
  const planBuiltPct = Math.round((stepsBuilt / TOTAL_STEPS) * 100);

  // ── POC: data-gated whole-screen entrance ─────────────────────────────────
  // Instead of firing the screen-enter immediately (which animates the skeleton,
  // then the real values pop in as they paint = the residual pop), HOLD the
  // entrance until the screen's primary data is ready — then play the fade+rise
  // ONCE on populated content. `loading` is the single reliable ready-signal:
  // every value-bearing panel (anchor/rail/cascade) derives from
  // worksheet/yearPlan/monthlyPlan, all set BEFORE `loading` flips false. The
  // weekly-plan / daily / SuggestedWeekCard inputs are honest stragglers with
  // their own loading states — intentionally excluded (they'd never converge
  // reliably; the brief accepts them filling in after). Cap at ENTRANCE_CAP_MS
  // so a slow fetch can't strand the user on the loading state; past SLOW_PATH_MS
  // show a subtle reassurance.
  const reducedMotion = usePrefersReducedMotion();
  const dataReady = !loading && !error;
  const [entranceReleased, setEntranceReleased] = useState(false);
  const [slowPath, setSlowPath] = useState(false);

  // Entrance release — dataReady wins immediately; otherwise the ENTRANCE_CAP_MS
  // cap releases it. Keying on dataReady/entranceReleased means the cap timer is
  // cleared the instant data arrives, so no stray setState fires after release.
  useEffect(() => {
    if (!gatedEntrance || entranceReleased) return undefined;
    if (dataReady) {
      setEntranceReleased(true);
      return undefined;
    }
    const capId = setTimeout(() => setEntranceReleased(true), ENTRANCE_CAP_MS);
    return () => clearTimeout(capId);
  }, [gatedEntrance, dataReady, entranceReleased]);

  // Slow-path reassurance after SLOW_PATH_MS while still loading. Also keyed on
  // dataReady so the timer is cleared the moment data arrives — a fast load never
  // triggers a late setSlowPath re-render of this screen.
  useEffect(() => {
    if (!gatedEntrance || dataReady) return undefined;
    const slowId = setTimeout(() => setSlowPath(true), SLOW_PATH_MS);
    return () => clearTimeout(slowId);
  }, [gatedEntrance, dataReady]);

  const openMoneyNeeds = () => onOpenTab?.('money-needs');
  const openGoals = () => onOpenTab?.('goals');
  const openMonthlyPlan = GAME_PLAN_LOOP_ENABLED ? () => setMonthlyPlanOpen(true) : undefined;
  const openReviewCommit = GAME_PLAN_LOOP_ENABLED ? () => setReviewCommitOpen(true) : undefined;

  const headerBlock = (
    <header>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Game Plan</h1>
      <p className="mt-0.5 text-sm text-ink-muted">Build your {year} — what you need to earn, step by step.</p>
      <p className="mt-0.5 text-xs text-ink-muted">Your year and monthly plans are visible to your managers.</p>
    </header>
  );

  // Quiet loading state — no entrance animation. `slow` adds a subtle
  // reassurance line once the wait exceeds SLOW_PATH_MS.
  const renderLoading = (slow) => (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your plan" data-testid="game-plan-loading">
      <div className="h-36 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="flex gap-2">
        <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-ink-muted">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        {slow && (
          <p
            className="text-xs text-ink-muted"
            role="status"
            aria-live="polite"
            data-testid="game-plan-slow-message"
          >
            Taking longer than expected…
          </p>
        )}
      </div>
    </div>
  );

  const errorBlock = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger-ink">
        <AlertCircle size={24} aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-ink">Couldn&apos;t load your plan</p>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
      </div>
      <button
        type="button"
        onClick={load}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <RotateCw size={15} aria-hidden="true" /> Retry
      </button>
    </div>
  );

  // Modals are position:fixed overlays — kept OUTSIDE the entrance wrapper so the
  // one-shot screen-enter transform never reparents their containing block. They
  // only open on user interaction (after the entrance has completed), so this is
  // both correct and safe.
  const modalsBlock = (
    <>
      {monthlyPlanOpen && (
        <MonthlyPlanModal
          onClose={() => setMonthlyPlanOpen(false)}
          onAfterSave={load}
          yearPlanAPI={yearPlanTotalAPI}
          submissions={submissions}
          year={year}
          avgPolicyAPI={avgPolicyAPI}
        />
      )}

      {reviewCommitOpen && (
        <ReviewCommitModal
          onClose={() => setReviewCommitOpen(false)}
          year={year}
          yearPlan={yearPlan}
          monthlyPlan={monthlyPlan}
          yearPlanFilled={yearPlanFilled}
          monthlyPlanFilled={monthlyPlanFilled}
          yearPlanTotalAPI={yearPlanTotalAPI}
          avgPolicyAPI={avgPolicyAPI}
          committedAnnualAPI={committedAnnualAPI}
          onAfterCommit={load}
          onOpenMoneyNeeds={() => { setReviewCommitOpen(false); openMoneyNeeds(); }}
          onOpenMonthlyPlan={() => { setReviewCommitOpen(false); setMonthlyPlanOpen(true); }}
        />
      )}
    </>
  );

  const contentBlock = (
    <>
      <PlanAnchorStrip
        year={year}
        commissionNeed={commissionNeed}
        afterTaxNeed={afterTaxNeed}
        renewalsCover={renewalsCover}
        grossNeed={grossNeed}
        apiCommitment={committedAnnualAPI}
        planBuiltPct={planBuiltPct}
        stepsBuilt={stepsBuilt}
        totalSteps={TOTAL_STEPS}
        moneyNeedsFilled={moneyNeedsFilled}
      />

      <StepRail
        moneyNeedsFilled={moneyNeedsFilled}
        onOpenMoneyNeeds={openMoneyNeeds}
        yearPlanFilled={yearPlanFilled}
        onOpenMonthlyPlan={openMonthlyPlan}
        monthlyPlanFilled={monthlyPlanFilled}
        onOpenReviewCommit={openReviewCommit}
        committed={committed}
      />

      <PlanCascade
        commissionNeed={commissionNeed}
        moneyNeedsFilled={moneyNeedsFilled}
        yearPlanEnabled={GAME_PLAN_LOOP_ENABLED}
        yearPlanTotalAPI={yearPlanTotalAPI}
        yearPlanFilled={yearPlanFilled}
        monthlyPlanFilled={monthlyPlanFilled}
        monthlyPlanTotal={monthlyPlanTotal}
        monthlyYtdDelta={monthlyYtdDelta}
        committed={committed}
        committedAt={committedAt}
      />

      {/* B3 — manager→agent plan suggestions (agent's own data; renders
          nothing when there are none). Reads through the agent-own arm. */}
      <PlanSuggestionsCard tenantId={tenantId} agentId={uid} />

      <SuggestedWeekCard
        committedAnnualAPI={committedAnnualAPI}
        avgPolicyAPI={avgPolicyAPI}
        prospectRatio={prospectRatio}
        submissions={submissions}
        floors={weeklyActivityFloors}
        loading={dataLoading}
        error={dataError}
        onRetry={onRetry}
        onBuildPlan={openGoals}
        weekLabel={`Wk ${weekNum}`}
        committedPlan={committedPlan}
        onCommit={handleCommitPlan}
        onDeletePlan={handleDeletePlan}
        planBusy={planBusy}
        planError={planError}
        weekStart={weekStart}
        weekSubmission={weekSubmission}
        dailyDocs={dailyDocs}
      />
    </>
  );

  // ── POC (opt-in): data-gated entrance ──────────────────────────────────────
  // Until the entrance releases (dataReady OR ENTRANCE_CAP_MS), show ONLY the
  // quiet loading state — no header, no entrance animation. On release, mount the
  // fully-populated screen inside a fresh `.screen-enter` wrapper so the fade+rise
  // fires ONCE on real content (nothing arrives after → no post-animation pop).
  // reducedMotion skips the class (CSS already suppresses it too); content just
  // appears. If the cap fires while still loading, the wrapper animates the
  // skeleton and content fills after — the accepted straggler tradeoff.
  if (gatedEntrance) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" data-testid="game-plan-hub">
        {!entranceReleased ? (
          renderLoading(slowPath)
        ) : (
          <div
            key="gp-screen-enter"
            className={reducedMotion ? 'space-y-4' : 'screen-enter space-y-4'}
            data-testid="game-plan-entrance"
          >
            {headerBlock}
            {loading && renderLoading(slowPath)}
            {!loading && error && errorBlock}
            {!loading && !error && contentBlock}
          </div>
        )}
        {modalsBlock}
      </div>
    );
  }

  // Legacy (default) path — byte-for-byte the prior behavior. The caller's
  // dashboard-level `.screen-enter` owns the entrance here.
  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="game-plan-hub">
      {headerBlock}
      {loading && renderLoading(false)}
      {!loading && error && errorBlock}
      {modalsBlock}
      {!loading && !error && contentBlock}
    </div>
  );
}
