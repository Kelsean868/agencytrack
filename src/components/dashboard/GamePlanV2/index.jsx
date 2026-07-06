import React, { useCallback, useEffect, useState } from 'react';
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

  const openMoneyNeeds = () => onOpenTab?.('money-needs');
  const openGoals = () => onOpenTab?.('goals');
  const openMonthlyPlan = GAME_PLAN_LOOP_ENABLED ? () => setMonthlyPlanOpen(true) : undefined;
  const openReviewCommit = GAME_PLAN_LOOP_ENABLED ? () => setReviewCommitOpen(true) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="game-plan-hub">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Game Plan</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Build your {year} — what you need to earn, step by step.</p>
        <p className="mt-0.5 text-xs text-ink-muted">Your year and monthly plans are visible to your managers.</p>
      </header>

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

      {/* Persist-shells: every section renders in ALL states (loading skeleton /
          error / empty / ready) so none mounts after the screen-enter fade — only
          inner values swap when the fetch resolves. See
          docs/design/motion-popin-systemic-fix.md. */}
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
        loading={loading}
        error={!!error}
        onRetry={load}
      />

      <StepRail
        moneyNeedsFilled={moneyNeedsFilled}
        onOpenMoneyNeeds={openMoneyNeeds}
        yearPlanFilled={yearPlanFilled}
        onOpenMonthlyPlan={openMonthlyPlan}
        monthlyPlanFilled={monthlyPlanFilled}
        onOpenReviewCommit={openReviewCommit}
        committed={committed}
        loading={loading}
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
        loading={loading}
        error={!!error}
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
    </div>
  );
}
