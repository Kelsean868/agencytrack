import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { buildPersistencyOutlook, outlookGateFor } from '../../../lib/persistency/persistencyOutlook';
import { filterCounts } from '../../../lib/policyLedgerDerivation';
import { isTieredCampaign } from '../../../utils/campaignEngine';
import { elapsedWorkingDays } from '../../../utils/planVariance';
import { getTodayTT } from '../../../utils/dateInputs';
import {
  weeklyFloors, thisWeekActuals, firstBehindStandardRow, buildDoNextItems,
} from '../../dashboard/HomeV2/homeDerivations';
import NeedsActionBanner from '../../dashboard/HomeV2/NeedsActionBanner';
import RecentCompact from '../../dashboard/HomeV2/RecentCompact';
import DeliveryStripCard from '../../dashboard/HomeV2/DeliveryStripCard';
import StandardDetail from '../../dashboard/HomeV2/StandardDetail';
import FilingStreakCelebration from '../../dashboard/HomeV2/FilingStreakCelebration';
import LedgerReconciliationNote from '../../dashboard/HomeV2/LedgerReconciliationNote';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';
import MyPointsCard from '../../gamification/MyPointsCard';
import { buildTodayModel, settledByMonthFrom, latestPersistencyPct } from '../../../lib/fr/todayModel';
import FrTodayView from './FrTodayView';
import useMinWidth from '../../../hooks/useMinWidth';

/** A campaign the compact card can render — the same test HomeV2 applies. */
function isHomeCampaign(c) {
  return Boolean(c) && isTieredCampaign(c) && c.structure === 'qualify';
}

/** Hour of day in Trinidad and Tobago (UTC-4 all year, no DST). */
function hourInTT(now = new Date()) {
  return (now.getUTCHours() + 20) % 24;
}

/**
 * FrToday — CONTAINER for the FR "Today" screen (FR-2, FR-D4).
 *
 * Takes the SAME props AgentDashboard hands AgentDashboardHomeV2 and
 * re-derives exactly what HomeV2 derives (campaign filter, weekly floors and
 * actuals, Do-next items, persistency gate month) with the same helpers.
 * HomeV2 is not changed. No new Firestore reads: every figure comes from
 * props already loaded by AgentDashboard.
 *
 * Adds two derivations for the FR view, both from data already in hand:
 *   · settledByMonth — from `campaignPolicies` (the UNFILTERED ledger list,
 *     the same list deriveYearProduction read for the hero) through
 *     settledCreditList, so the months sum to the hero figure (R5: date
 *     decides, not origin).
 *   · persistencyLatestPct — the latest E3 record, fraction → percent.
 *
 * Layout: `wide = useMinWidth(768)` picks ONE layout for the view, so each
 * slot component mounts once.
 *
 * The existing Home components travel into the pure view as `slots`;
 * StandardDetail and FilingStreakCelebration stay mounted here, outside the
 * view, exactly as HomeV2 mounts them.
 */
export default function FrToday({
  ledgerProduction,
  ledgerPending,
  ledgerError,
  onRetryLedger,
  onOpenLedgerCreate,
  personalGoalAPI,
  allSubmissions,
  resolvedMinimums,
  currentWeekSub,
  persistency,
  activityEvents,
  activeCampaigns,
  campaignsLoading,
  campaignPolicies,
  agentUid,
  agentProfile,
  policies,
  committedPlan,
  weekDailyDocs,
  weekStart,
  showDailyCTA,
  todayDailyChecked,
  todayDailyEntry,
  submissionsError,
  onSubmit,
  onLogToday,
  onOpenTab,
  onOpenLedgerFilter,
}) {
  const [drawer, setDrawer] = useState(null); // null | 'standard'
  // One layout only (every slot mounts once): grid ≥768px, swipe pages below.
  const wide = useMinWidth(768);
  const thisYear = new Date().getFullYear();
  const todayTT = getTodayTT();

  // ── Campaign (as HomeV2) ─────────────────────────────────────────────────
  const homeCampaigns = useMemo(
    () => (Array.isArray(activeCampaigns) ? activeCampaigns.filter(isHomeCampaign) : []),
    [activeCampaigns],
  );
  const campaignLoading = Boolean(campaignsLoading) || (Boolean(ledgerPending) && homeCampaigns.length > 0);
  const showCampaignSlot = campaignLoading || homeCampaigns.length > 0;
  const gatingCampaign = useMemo(
    () => homeCampaigns.find((c) => outlookGateFor(c)) ?? null,
    [homeCampaigns],
  );

  // ── This week (as HomeV2) ────────────────────────────────────────────────
  const floors = useMemo(() => weeklyFloors(resolvedMinimums), [resolvedMinimums]);
  const weekLoading = committedPlan === undefined;
  const weekActuals = useMemo(
    () => thisWeekActuals({ currentWeekSub, dailyDocs: weekDailyDocs }),
    [currentWeekSub, weekDailyDocs],
  );

  // ── Do next (as HomeV2) ──────────────────────────────────────────────────
  const awaitingConfirmCount = useMemo(
    () => (Array.isArray(campaignPolicies) ? filterCounts(campaignPolicies).action : null),
    [campaignPolicies],
  );
  const gateMonth = useMemo(() => {
    if (!Array.isArray(campaignPolicies) || !gatingCampaign) return null;
    try {
      return buildPersistencyOutlook({
        policies: campaignPolicies,
        records: Array.isArray(persistency) ? persistency : [],
        today: todayTT,
        gate: outlookGateFor(gatingCampaign),
      }).gateMonth;
    } catch {
      return null; // outlook error → the win-back item stays hidden
    }
  }, [campaignPolicies, gatingCampaign, persistency, todayTT]);
  const behind = useMemo(
    () => (weekLoading ? null : firstBehindStandardRow({
      floors, actuals: weekActuals, elapsed: elapsedWorkingDays(weekStart, todayTT),
    })),
    [weekLoading, floors, weekActuals, weekStart, todayTT],
  );
  const doNextItems = useMemo(
    () => buildDoNextItems({ awaitingConfirmCount, gateMonth, behind }),
    [awaitingConfirmCount, gateMonth, behind],
  );
  const doNextLoading = Boolean(ledgerPending) || Boolean(campaignsLoading) || weekLoading;

  // ── FR-only derivations (read-time, from props) ──────────────────────────
  const productionYear = ledgerProduction?.year ?? thisYear;
  const settledByMonth = useMemo(
    () => (Array.isArray(campaignPolicies) ? settledByMonthFrom(campaignPolicies, productionYear) : []),
    [campaignPolicies, productionYear],
  );
  const persistencyLatest = useMemo(() => latestPersistencyPct(persistency), [persistency]);

  const model = useMemo(() => buildTodayModel({
    production: ledgerProduction ?? null,
    pending: Boolean(ledgerPending),
    error: Boolean(ledgerError),
    personalGoalAPI,
    floors,
    actuals: weekActuals,
    weekLoading,
    weekError: Boolean(submissionsError),
    weekStart,
    doNextItems,
    doNextLoading,
    currentWeekSub,
    persistencyLatestPct: persistencyLatest,
    settledByMonth,
    todayTT,
    hourTT: hourInTT(),
    displayName: agentProfile?.name ?? '',
  }), [
    ledgerProduction, ledgerPending, ledgerError, personalGoalAPI, floors, weekActuals, weekLoading,
    submissionsError, weekStart, doNextItems, doNextLoading, currentWeekSub, persistencyLatest,
    settledByMonth, todayTT, agentProfile?.name,
  ]);

  const handleAction = (action) => {
    switch (action) {
      case 'submit': onSubmit?.(); return;
      case 'log-today':
      case 'daily-log': onLogToday?.(); return;
      case 'ledger-create': onOpenLedgerCreate?.(); return;
      case 'standard-details': setDrawer('standard'); return;
      case 'ledger-confirm': onOpenLedgerFilter?.('action'); return;
      case 'persistency': onOpenTab?.('persistency'); return;
      case 'game-plan': onOpenTab?.('game-plan'); return;
      default:
        // CLAUDE.md v3 rule 11 — an unknown action must not fail silently.
        if (import.meta.env.DEV) console.warn(`FrToday: unknown action "${action}"`);
    }
  };

  const showNudge = showDailyCTA && todayDailyChecked && !todayDailyEntry;

  // Parenthesised so the policy-array guard (excludeImported.test.js) does not
  // read this object literal as a JSX prop; the real prop sites inside it —
  // CampaignHeroCard `policies`, DeliveryStripCard `policies`,
  // LedgerReconciliationNote `production` — are still enumerated by it.
  const slots = ({
    banner: submissionsError ? (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-danger-ink">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium">
          {submissionsError === 'permission-denied'
            ? 'Could not load your activity data — permission denied. Contact your manager if this persists.'
            : 'Could not load your activity data. Check your connection and refresh.'}
        </p>
      </div>
    ) : null,
    nudge: showNudge ? <NeedsActionBanner onLog={onLogToday} /> : null,
    reconciliation: ledgerProduction
      ? <LedgerReconciliationNote production={ledgerProduction} onOpenLedgerCreate={onOpenLedgerCreate} />
      : null,
    campaign: showCampaignSlot ? (
      campaignLoading ? (
        <CampaignHeroCard variant="compact" campaign={null} loading />
      ) : (
        homeCampaigns.map((c) => (
          <CampaignHeroCard
            key={c.id}
            variant="compact"
            campaign={c}
            policies={campaignPolicies ?? []}
            persistencyRecords={persistency}
            error={Boolean(ledgerError)}
            onOpenDetails={() => onOpenTab?.('awards')}
          />
        ))
      )
    ) : null,
    points: <MyPointsCard />,
    recent: <RecentCompact events={activityEvents} onViewAll={() => onOpenTab?.('history')} />,
    delivery: <DeliveryStripCard policies={policies} />,
  });

  return (
    <>
      <FrTodayView
        model={model}
        wide={wide}
        loading={Boolean(ledgerPending)}
        error={Boolean(ledgerError)}
        onRetry={onRetryLedger}
        onNavigate={(tabId) => onOpenTab?.(tabId)}
        onAction={handleAction}
        slots={slots}
      />

      {drawer === 'standard' && (
        <StandardDetail
          minimums={resolvedMinimums}
          currentWeekSub={currentWeekSub}
          committedPlan={committedPlan}
          dailyDocs={weekDailyDocs}
          weekStart={weekStart}
          onClose={() => setDrawer(null)}
          onSubmit={() => { setDrawer(null); onSubmit?.(); }}
          onOpenGamePlan={() => { setDrawer(null); onOpenTab?.('game-plan'); }}
        />
      )}

      <FilingStreakCelebration
        allSubmissions={allSubmissions}
        agentUid={agentUid}
        year={thisYear}
      />
    </>
  );
}
