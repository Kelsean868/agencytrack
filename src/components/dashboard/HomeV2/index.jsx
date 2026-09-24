import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { computeAgentAwards } from '../../../utils/awardsEngine';
import {
  buildPersistencyOutlook, formatOutlookPct, persistencyTone,
} from '../../../lib/persistency/persistencyOutlook';
import { getTodayTT } from '../../../utils/dateInputs';
import { computeSubmissionStreak } from '../../../utils/submissionStreak';
import {
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
  floorStatus,
} from '../../../utils/weeklyActivityFloors';
import { extractFields } from '../../../utils/extractFields';
import HeroCard from './HeroCard';
import PulseStrip from './PulseStrip';
import NeedsActionBanner from './NeedsActionBanner';
import RecentCompact from './RecentCompact';
import DeliveryStripCard from './DeliveryStripCard';
import StandardDetail from './StandardDetail';
import FilingStreakCelebration from './FilingStreakCelebration';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';
import MyPointsCard from '../../gamification/MyPointsCard';

/**
 * AgentDashboardHomeV2 — composed v2 home for the agent role.
 *
 * Pure presentation orchestrator. All data is consumed via props (already
 * loaded in AgentDashboard's effect). No new Firestore reads.
 *
 * The Standard chip opens an in-place StandardDetail drawer. Other chips
 * navigate via setActiveTab (PulseStrip's onChipClick maps the chip key to
 * a tabId).
 */
export default function AgentDashboardHomeV2({
  ytdTotals,
  // H1 — deriveYearProduction() output (derived figures, not a policy list).
  ledgerProduction,
  ledgerPending,
  ledgerError,
  onRetryLedger,
  onOpenLedgerCreate,
  personalAnnualAPI,
  kpiData,
  allSubmissions,
  resolvedMinimums,
  currentWeekSub,
  persistency,
  settlements,
  awardsRuleset,
  agentProfile,
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
}) {
  const [drawer, setDrawer] = useState(null); // null | 'standard'
  const thisYear = new Date().getFullYear();

  // ── Pulse chip data ─────────────────────────────────────────────────────
  const pulses = useMemo(() => {
    // Activity: 6-week sparkline from kpiData history (totalProductionCredit per week)
    const apiSeries = (kpiData ?? []).map((row) => row?.totalProductionCredit ?? 0);
    const activityStatus = apiSeries.length === 0
      ? 'No data yet'
      : apiSeries[apiSeries.length - 1] >= (apiSeries[apiSeries.length - 2] ?? 0)
        ? 'Trending ↑'
        : 'Trending ↓';

    // Standard: count met floors against current-week submission
    const floors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(resolvedMinimums?.weeklyActivityFloors ?? {}) };
    const actuals = deriveWeeklyFloorActuals(currentWeekSub ? extractFields(currentWeekSub) : null);
    let metCount = 0;
    for (const row of WEEKLY_ACTIVITY_FLOOR_ROWS) {
      if (floorStatus(floors[row.key] ?? 0, actuals[row.key] ?? 0) === 'green') metCount++;
    }
    const standardPct = Math.round((metCount / WEEKLY_ACTIVITY_FLOOR_ROWS.length) * 100);
    const standardTone = metCount >= 8 ? 'success' : metCount >= 5 ? 'warning' : 'danger';

    // Awards: pick the highest-progress in-contention award
    let awardsTone = 'gold';
    let awardsStatus = 'No award in contention';
    let awardsPercent = 0;
    try {
      const allAwards = computeAgentAwards(
        settlements ?? [],
        allSubmissions ?? [],
        agentProfile,
        new Date(),
        awardsRuleset
      );
      const inContention = Object.values(allAwards)
        .filter((a) => !a.eligible && a.inContention)
        .sort((a, b) => b.progressPercent - a.progressPercent);
      if (inContention.length > 0) {
        const top = inContention[0];
        awardsStatus = `Close to ${top.name}`;
        awardsPercent = top.progressPercent;
      } else {
        const qualified = Object.values(allAwards).filter((a) => a.eligible);
        if (qualified.length > 0) {
          awardsStatus = `${qualified.length} qualified`;
          awardsPercent = 100;
        }
      }
    } catch {
      // awards engine error — keep defaults
    }

    // Persistency: the outlook's headline — the newest of a confirmed record
    // and the month derived from the HO export, on the 24-month model. The
    // same builder the campaign card and the Persistency tab read, so the three
    // cannot disagree. (Replaces a year-to-date aggregate that blended the
    // legacy 12-month formula with the 24-month one.)
    let headline = null;
    try {
      headline = buildPersistencyOutlook({
        policies: campaignPolicies ?? [],
        records: Array.isArray(persistency) ? persistency : [],
        today: getTodayTT(),
      }).headline;
    } catch {
      // outlook error — the chip falls back to "No data yet"
    }
    const persDecimal = headline?.persistency ?? null;
    // Warning below the gate, never danger: this is not a confirmed gate month.
    const persTone = persDecimal === null ? 'teal' : persistencyTone(persDecimal);
    const persStatusText = persDecimal === null
      ? 'No data yet'
      : `${formatOutlookPct(persDecimal)} ${headline.kind}`;

    // Streak: current submission streak
    const { currentStreak, longestStreak } = computeSubmissionStreak(allSubmissions ?? [], thisYear);
    // Bars: per-week 1 if submitted else 0 from kpiData history slots
    const streakBars = apiSeries.length > 0 ? apiSeries.slice(-6).map((v) => (v > 0 ? Math.max(1, v) : 0)) : [];
    const streakTone = currentStreak >= longestStreak && longestStreak >= 2 ? 'gold' : 'teal';
    const streakStatus = currentStreak === 0
      ? 'No active streak'
      : `${currentStreak} ${currentStreak === 1 ? 'week' : 'weeks'}`;

    // Action: daily-nudge or weekly-report pending
    let actionCount = 0;
    if (showDailyCTA && todayDailyChecked && !todayDailyEntry) actionCount++;
    if (!currentWeekSub) actionCount++;
    const actionTone = actionCount > 0 ? 'danger' : 'success';
    const actionStatus = actionCount === 0
      ? "You're up to date"
      : `${actionCount} ${actionCount === 1 ? 'thing' : 'things'} today`;

    return [
      { key: 'activity', kind: 'activity', label: 'Activity',    status: activityStatus, tone: 'teal',
        ariaLabel: `Activity trend: ${activityStatus}. Open activity history.`,
        viz: { type: 'spark', values: apiSeries.length > 0 ? apiSeries : [0, 0, 0] } },
      { key: 'standard', kind: 'standard', label: 'Standard',    status: `${metCount} of ${WEEKLY_ACTIVITY_FLOOR_ROWS.length} met`, tone: standardTone,
        ariaLabel: `Weekly Standard: ${metCount} of ${WEEKLY_ACTIVITY_FLOOR_ROWS.length} floors met. Open detail.`,
        viz: { type: 'donut', percent: standardPct } },
      { key: 'awards',   kind: 'awards',   label: 'Awards',      status: awardsStatus, tone: awardsTone,
        ariaLabel: `Awards: ${awardsStatus}. Open Awards tab.`,
        viz: { type: 'donut', percent: awardsPercent } },
      { key: 'persist',  kind: 'persist',  label: 'Persistency', status: persStatusText, tone: persTone,
        ariaLabel: `24-month persistency: ${persStatusText}. Open Persistency tab.`,
        viz: { type: 'donut', percent: persDecimal === null ? 0 : Math.min(100, Math.round(persDecimal * 100)) } },
      { key: 'streak',   kind: 'streak',   label: 'Streak',      status: streakStatus, tone: streakTone,
        ariaLabel: `Submission streak: ${streakStatus}. Open History tab.`,
        viz: streakBars.length > 0 ? { type: 'bars', values: streakBars } : { type: 'badge', count: currentStreak } },
      { key: 'action',   kind: 'action',   label: 'Action',      status: actionStatus, tone: actionTone,
        ariaLabel: actionCount > 0 ? `${actionCount} pending action${actionCount === 1 ? '' : 's'} today.` : 'No pending actions today.',
        viz: { type: 'badge', count: actionCount } },
    ];
  }, [kpiData, resolvedMinimums, currentWeekSub, settlements, allSubmissions, agentProfile, awardsRuleset, persistency, campaignPolicies, thisYear, showDailyCTA, todayDailyChecked, todayDailyEntry]);

  // ── Chip click routing ─────────────────────────────────────────────────
  const handleChipClick = (key) => {
    if (key === 'standard')  { setDrawer('standard'); return; }
    if (key === 'awards')    { onOpenTab?.('awards');      return; }
    if (key === 'persist')   { onOpenTab?.('persistency'); return; }
    if (key === 'streak')    { onOpenTab?.('history');     return; }
    if (key === 'activity')  { onOpenTab?.('history');     return; }
    if (key === 'action') {
      if (showDailyCTA && todayDailyChecked && !todayDailyEntry) {
        onLogToday?.();
      } else if (!currentWeekSub) {
        onSubmit?.();
      }
    }
  };

  const showNudge = showDailyCTA && todayDailyChecked && !todayDailyEntry;

  return (
    <>
      {/* §2 "staggered assemble" (redesign-addendum §2 + design-conformance
          2026-07-12 row 85 residual) — the screen's top-level blocks rise in
          sequence via the shipped `.stagger` class (index.css; transform-only,
          nth-child delay, degrades to static under reduced-motion). Scoped to
          the always-synchronous flow blocks only — StandardDetail and
          FilingStreakCelebration render `position: fixed` overlays later
          (user/data-triggered, not part of initial assemble) and are kept
          OUTSIDE this wrapper so the animation never targets a fixed-position
          element directly (mirrors the AgentDashboard.jsx screen-enter comment
          on keeping fixed overlays out of transform-animated ancestors). */}
      <div className="stagger flex flex-col gap-4">

        {/* Submissions error banner */}
        {submissionsError && (
          <div
            role="alert"
            className="flex items-start gap-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger-ink"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm font-medium">
              {submissionsError === 'permission-denied'
                ? 'Could not load your activity data — permission denied. Contact your manager if this persists.'
                : 'Could not load your activity data. Check your connection and refresh.'}
            </p>
          </div>
        )}

        {/* Needs-action banner (above Hero) */}
        {showNudge && <NeedsActionBanner onLog={onLogToday} />}

        {/* Hero */}
        <HeroCard
          ytdApi={ytdTotals?.api ?? 0}
          personalAnnualAPI={personalAnnualAPI}
          onSubmit={onSubmit}
          production={ledgerProduction ?? null}
          pending={Boolean(ledgerPending)}
          error={Boolean(ledgerError)}
          onRetry={onRetryLedger}
          onOpenLedgerCreate={onOpenLedgerCreate}
        />

        {/* Campaign hero — H3: reads the policy ledger via derivePolicyLens,
            the SAME call CampaignLensPanel makes, never weekly submissions. */}
        {!campaignsLoading && activeCampaigns?.length > 0 && (
          <div className="flex flex-col gap-3">
            {activeCampaigns.map((c) => (
              <CampaignHeroCard
                key={c.id}
                campaign={c}
                policies={campaignPolicies ?? []}
                persistencyRecords={persistency}
              />
            ))}
          </div>
        )}

        {/* Pulse strip */}
        <PulseStrip pulses={pulses} activeKey={drawer === 'standard' ? 'standard' : null} onChipClick={handleChipClick} />

        {/* My Points — personal gamification card (self-contained, reads leaderboard/{uid}) */}
        <MyPointsCard />

        {/* Recent panel — 2-col on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <RecentCompact events={activityEvents} onViewAll={() => onOpenTab?.('history')} />
          <div className="flex flex-col gap-4">
            <DeliveryStripCard policies={policies} />
          </div>
        </div>
      </div>

      {/* StandardDetail drawer */}
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
