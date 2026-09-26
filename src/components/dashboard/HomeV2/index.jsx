import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { buildPersistencyOutlook, outlookGateFor } from '../../../lib/persistency/persistencyOutlook';
import { filterCounts } from '../../../lib/policyLedgerDerivation';
import { isTieredCampaign } from '../../../utils/campaignEngine';
import { elapsedWorkingDays } from '../../../utils/planVariance';
import { getTodayTT } from '../../../utils/dateInputs';
import HeroCard from './HeroCard';
import NeedsActionBanner from './NeedsActionBanner';
import RecentCompact from './RecentCompact';
import DeliveryStripCard from './DeliveryStripCard';
import StandardDetail from './StandardDetail';
import FilingStreakCelebration from './FilingStreakCelebration';
import DoNextList from './DoNextList';
import ThisWeekTiles from './ThisWeekTiles';
import {
  weeklyFloors, thisWeekActuals, firstBehindStandardRow, buildDoNextItems,
} from './homeDerivations';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';
import MyPointsCard from '../../gamification/MyPointsCard';

/** A campaign the compact card can render: tiered, qualify structure (same test CampaignHeroCard applies). */
function isHomeCampaign(c) {
  return Boolean(c) && isTieredCampaign(c) && c.structure === 'qualify';
}

/**
 * AgentDashboardHomeV2 — the agent Home (redesign R1, 26 Sep 2026;
 * docs/briefs/home-campaign-redesign.md § R1, mockups C1-Home / C3-Home-Desktop).
 *
 * Pure presentation orchestrator. All data arrives via props (already loaded in
 * AgentDashboard). No new Firestore reads.
 *
 * Order, both breakpoints: Hero → Campaign (compact) → Do next → This week, then
 * the unchanged My Points, Recent and Delivery blocks. At ≥ 1024 px the blocks
 * sit on a 12-column grid: Hero 7 + Campaign 5, Do next 7 + This week 5.
 *
 * PulseStrip is no longer rendered here: its Awards / Persistency / Standard /
 * Action chips are covered by the campaign card, Do next and This week. The
 * Standard drawer it used to open is reached from This week's "Details".
 */
export default function AgentDashboardHomeV2({
  // H1 — deriveYearProduction() output (derived figures, not a policy list).
  ledgerProduction,
  ledgerPending,
  ledgerError,
  onRetryLedger,
  onOpenLedgerCreate,
  // The agent's OWN annual API goal (null when not set → the hero uses MDRT).
  personalGoalAPI,
  allSubmissions,
  resolvedMinimums,
  currentWeekSub,
  persistency,
  activityEvents,
  activeCampaigns,
  campaignsLoading,
  // Unfiltered — the campaign card tests dateIssued, not importSource (C-D10).
  // `policies` below stays FILTERED for DeliveryStripCard; these two arrays are
  // deliberately different views of one fetch, not a duplicate.
  campaignPolicies,
  agentUid,
  // Tier-3 3.1 — agent's own policies (settled + undelivered → delivery strip)
  policies,
  // S3b — plan-vs-actual Standard drawer
  committedPlan,
  weekDailyDocs,
  weekStart,
  // Daily nudge inputs
  showDailyCTA,
  todayDailyChecked,
  todayDailyEntry,
  // Error banner
  submissionsError,
  // Handlers
  onSubmit,
  onLogToday,
  onOpenTab,
  onOpenLedgerFilter,
}) {
  const [drawer, setDrawer] = useState(null); // null | 'standard'
  const thisYear = new Date().getFullYear();
  const todayTT = getTodayTT();

  // ── Campaign ─────────────────────────────────────────────────────────────
  const homeCampaigns = useMemo(
    () => (Array.isArray(activeCampaigns) ? activeCampaigns.filter(isHomeCampaign) : []),
    [activeCampaigns],
  );
  const campaignLoading = Boolean(campaignsLoading) || (Boolean(ledgerPending) && homeCampaigns.length > 0);
  const showCampaignSlot = campaignLoading || homeCampaigns.length > 0;
  // The campaign whose persistency gate Do next projects to — the first one
  // that gates (PersistencyTab picks the same way).
  const gatingCampaign = useMemo(
    () => homeCampaigns.find((c) => outlookGateFor(c)) ?? null,
    [homeCampaigns],
  );

  // ── This week ────────────────────────────────────────────────────────────
  const floors = useMemo(() => weeklyFloors(resolvedMinimums), [resolvedMinimums]);
  const weekLoading = committedPlan === undefined; // plan + daily docs load together
  const weekActuals = useMemo(
    () => thisWeekActuals({ currentWeekSub, dailyDocs: weekDailyDocs }),
    [currentWeekSub, weekDailyDocs],
  );

  // ── Do next ──────────────────────────────────────────────────────────────
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

  const handleDoNext = (target) => {
    if (target === 'ledger-confirm') { onOpenLedgerFilter?.('action'); return; }
    if (target === 'persistency') { onOpenTab?.('persistency'); return; }
    if (target === 'daily-log') onLogToday?.();
  };

  const showNudge = showDailyCTA && todayDailyChecked && !todayDailyEntry;

  return (
    <>
      {/* §2 "staggered assemble" — the screen's top-level blocks rise in
          sequence via the shipped `.stagger` class (transform-only, degrades to
          static under reduced motion). StandardDetail and
          FilingStreakCelebration render `position: fixed` overlays and stay
          OUTSIDE this wrapper so the animation never targets them. */}
      <div className="stagger flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5" data-testid="home-v2">

        {submissionsError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-danger-ink lg:col-span-12"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">
              {submissionsError === 'permission-denied'
                ? 'Could not load your activity data — permission denied. Contact your manager if this persists.'
                : 'Could not load your activity data. Check your connection and refresh.'}
            </p>
          </div>
        )}

        {showNudge && (
          <div className="lg:col-span-12"><NeedsActionBanner onLog={onLogToday} /></div>
        )}

        <div className={showCampaignSlot ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <HeroCard
            personalAnnualAPI={personalGoalAPI}
            onSubmit={onSubmit}
            production={ledgerProduction ?? null}
            pending={Boolean(ledgerPending)}
            error={Boolean(ledgerError)}
            onRetry={onRetryLedger}
            onOpenLedgerCreate={onOpenLedgerCreate}
          />
        </div>

        {/* Campaign (compact) — H3: reads the policy ledger via derivePolicyLens,
            the SAME call CampaignLensPanel makes, never weekly submissions. No
            active campaign → no card (no empty shell). */}
        {showCampaignSlot && (
          <div className="flex flex-col gap-3 lg:col-span-5" data-testid="home-campaign-slot">
            {campaignLoading ? (
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
            )}
          </div>
        )}

        <div className="lg:col-span-7">
          <DoNextList
            items={doNextItems}
            loading={doNextLoading}
            incomplete={Boolean(ledgerError)}
            onRetry={onRetryLedger}
            onSelect={handleDoNext}
          />
        </div>

        <div className="lg:col-span-5">
          <ThisWeekTiles
            floors={floors}
            actuals={weekActuals}
            loading={weekLoading}
            error={Boolean(submissionsError)}
            onOpenDetails={() => setDrawer('standard')}
          />
        </div>

        {/* My Points — personal gamification card (self-contained, reads leaderboard/{uid}) */}
        <div className="lg:col-span-12"><MyPointsCard /></div>

        {/* Recent panel — 2-col on lg+ */}
        <div className="grid grid-cols-1 gap-4 lg:col-span-12 lg:grid-cols-[1.5fr_1fr]">
          <RecentCompact events={activityEvents} onViewAll={() => onOpenTab?.('history')} />
          <div className="flex flex-col gap-4">
            <DeliveryStripCard policies={policies} />
          </div>
        </div>
      </div>

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

      {/* Filing-streak milestone celebration — fires on load when the weekly
          filing streak crosses an un-celebrated rung (once per milestone/year). */}
      <FilingStreakCelebration
        allSubmissions={allSubmissions}
        agentUid={agentUid}
        year={thisYear}
      />
    </>
  );
}
