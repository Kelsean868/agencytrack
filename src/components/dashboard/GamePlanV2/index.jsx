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
import PlanAnchorStrip from './PlanAnchorStrip';
import StepRail from './StepRail';
import PlanCascade from './PlanCascade';
import CommitPreviewCard from './CommitPreviewCard';
import SuggestedWeekCard from './SuggestedWeekCard';
import YearPlanModal from '../../agent/YearPlanModal';
import MonthlyPlanModal from '../../agent/MonthlyPlanModal';
import ReviewCommitModal from './ReviewCommitModal';

const YEAR_PLAN_ENABLED = import.meta.env.VITE_YEAR_PLAN_ENABLED === 'true';

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
const TOTAL_STEPS = 4;

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
  // Week-of-year label (mirrors AgentDashboard's topbar crumb math).
  const yearStart = new Date(year, 0, 1);
  const weekNum = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  const currentMonthIndex = now.getMonth();
  // This week's Sunday (YYYY-MM-DD) — the weeklyPlans doc-ID date segment.
  const weekStart = getRecentSundays(1)[0];

  const [worksheet, setWorksheet] = useState(null);
  const [yearPlan, setYearPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearPlanOpen, setYearPlanOpen] = useState(false);
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
        YEAR_PLAN_ENABLED
          ? getYearPlan(tenantId, uid, year).catch(() => null)
          : Promise.resolve(null),
        YEAR_PLAN_ENABLED
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
  const yearPlanFilled = YEAR_PLAN_ENABLED && yearPlanTotalAPI > 0;
  const monthlyPlanFilled = YEAR_PLAN_ENABLED &&
    (monthlyPlan?.targets ?? []).reduce((s, v) => s + (parseFloat(v) || 0), 0) > 0;
  const monthlyPlanTotal = monthlyPlan?.anchorAPI ?? 0;
  const monthlyYtdDelta = monthlyPlanFilled
    ? computeYtdDelta(bucketActualsByMonth(submissions, year), monthlyPlan.targets, currentMonthIndex)
    : 0;
  const committed = YEAR_PLAN_ENABLED && monthlyPlan?.status === 'committed';
  const committedAt = committed
    ? (monthlyPlan?.committedAt instanceof Date
        ? monthlyPlan.committedAt
        : monthlyPlan?.committedAt?.toDate?.() ?? null)
    : null;
  const stepsBuilt = (moneyNeedsFilled ? 1 : 0) + (yearPlanFilled ? 1 : 0) + (monthlyPlanFilled ? 1 : 0) + (committed ? 1 : 0);
  const planBuiltPct = Math.round((stepsBuilt / TOTAL_STEPS) * 100);

  const openMoneyNeeds = () => onOpenTab?.('money-needs');
  const openGoals = () => onOpenTab?.('goals');
  const openYearPlan = YEAR_PLAN_ENABLED ? () => setYearPlanOpen(true) : undefined;
  const openMonthlyPlan = YEAR_PLAN_ENABLED ? () => setMonthlyPlanOpen(true) : undefined;
  const openReviewCommit = YEAR_PLAN_ENABLED ? () => setReviewCommitOpen(true) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="game-plan-hub">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Game Plan</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Build your {year} — what you need to earn, step by step.</p>
      </header>

      {loading && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading your plan">
          <div className="h-36 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="flex gap-2">
            <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-16 flex-1 animate-pulse rounded-xl bg-surface-muted" />
          </div>
          <div className="flex items-center justify-center py-6 text-ink-muted">
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          </div>
        </div>
      )}

      {!loading && error && (
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
      )}

      {yearPlanOpen && (
        <YearPlanModal
          onClose={() => setYearPlanOpen(false)}
          moneyNeedsWorksheet={worksheet}
          avgPolicyAPI={avgPolicyAPI}
        />
      )}

      {monthlyPlanOpen && (
        <MonthlyPlanModal
          onClose={() => setMonthlyPlanOpen(false)}
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
          onOpenYearPlan={() => { setReviewCommitOpen(false); setYearPlanOpen(true); }}
          onOpenMonthlyPlan={() => { setReviewCommitOpen(false); setMonthlyPlanOpen(true); }}
        />
      )}

      {!loading && !error && (
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
            onOpenYearPlan={openYearPlan}
            yearPlanFilled={yearPlanFilled}
            onOpenMonthlyPlan={openMonthlyPlan}
            monthlyPlanFilled={monthlyPlanFilled}
            onOpenReviewCommit={openReviewCommit}
            committed={committed}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <PlanCascade
              commissionNeed={commissionNeed}
              moneyNeedsFilled={moneyNeedsFilled}
              yearPlanEnabled={YEAR_PLAN_ENABLED}
              yearPlanTotalAPI={yearPlanTotalAPI}
              yearPlanFilled={yearPlanFilled}
              monthlyPlanFilled={monthlyPlanFilled}
              monthlyPlanTotal={monthlyPlanTotal}
              monthlyYtdDelta={monthlyYtdDelta}
              committed={committed}
              committedAt={committedAt}
            />
            <CommitPreviewCard year={year} onOpenGoals={openGoals} />
          </div>

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
      )}
    </div>
  );
}
