import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RotateCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getMoneyNeeds } from '../../../services/moneyNeedsService';
import { getWeeklyPlan, commitWeeklyPlan } from '../../../services/weeklyPlanService';
import { getRecentSundays } from '../../../utils/validators';
import PlanAnchorStrip from './PlanAnchorStrip';
import StepRail from './StepRail';
import PlanCascade from './PlanCascade';
import CommitPreviewCard from './CommitPreviewCard';
import SuggestedWeekCard from './SuggestedWeekCard';

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
}) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;
  const now = new Date();
  const year = now.getFullYear();
  // Week-of-year label (mirrors AgentDashboard's topbar crumb math).
  const yearStart = new Date(year, 0, 1);
  const weekNum = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  // This week's Sunday (YYYY-MM-DD) — the weeklyPlans doc-ID date segment.
  const weekStart = getRecentSundays(1)[0];

  const [worksheet, setWorksheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Weekly plan (Slice 2) — committed plan for this week + commit lifecycle.
  const [committedPlan, setCommittedPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getMoneyNeeds(tenantId, uid, year);
      setWorksheet(result);
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
    } catch (err) {
      setPlanError(true);
      throw err; // keep the card in edit mode for retry
    } finally {
      setPlanBusy(false);
    }
  }, [tenantId, uid, weekStart, weeklyActivityFloors]);

  // ── Derived (all from existing moneyNeeds fields — no new data) ──────────
  const afterTaxNeed = worksheet?.totalAnnualAfterTax ?? 0;
  const renewalsCover = worksheet?.estimatedRenewalIncome?.total ?? 0;
  const grossNeed = worksheet?.totalAnnualPreTax ?? 0;
  // Commission need mirrors the worksheet's own derivation
  // (pre-tax gross − renewal income), computed live so it stays honest even
  // before the agent opens the commission-targets step.
  const commissionNeed = grossNeed > 0 ? Math.max(0, grossNeed - renewalsCover) : 0;
  const moneyNeedsFilled = afterTaxNeed > 0;
  const stepsBuilt = moneyNeedsFilled ? 1 : 0;
  const planBuiltPct = Math.round((stepsBuilt / TOTAL_STEPS) * 100);

  const openMoneyNeeds = () => onOpenTab?.('money-needs');
  const openGoals = () => onOpenTab?.('goals');

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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertCircle size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-ink">Couldn&apos;t load your plan</p>
            <p className="mt-1 text-sm text-ink-muted">{error}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
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

          <StepRail moneyNeedsFilled={moneyNeedsFilled} onOpenMoneyNeeds={openMoneyNeeds} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <PlanCascade commissionNeed={commissionNeed} moneyNeedsFilled={moneyNeedsFilled} />
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
            planBusy={planBusy}
            planError={planError}
          />
        </>
      )}
    </div>
  );
}
