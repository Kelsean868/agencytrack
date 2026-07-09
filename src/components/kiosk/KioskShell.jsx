import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PANEL_DURATIONS,
  PANEL_ORDER,
  PANEL_LABELS,
  POLL_INTERVAL_MS,
} from '../../lib/kiosk/kioskConfig';
import { buildKioskRotation } from '../../lib/kiosk/kioskRotation';
import { deriveKioskCelebrations } from '../../lib/kiosk/kioskCelebrations';
import {
  getKioskYTDSubmissions,
  getKioskTenantUsers,
  getKioskAgentOfMonth,
  getKioskCampaigns,
} from '../../lib/kiosk/kioskServices';

import AgentOfMonthPanel        from './panels/AgentOfMonthPanel';
import BranchOverviewPanel      from './panels/BranchOverviewPanel';
import RunningTotalsPanel       from './panels/RunningTotalsPanel';
import UnitLeaderboardPanel     from './panels/UnitLeaderboardPanel';
import LastWeekRecapPanel       from './panels/LastWeekRecapPanel';
import AwardsWatchPanel         from './panels/AwardsWatchPanel';
import CompliancePanel          from './panels/CompliancePanel';
import WelcomePanel             from './panels/WelcomePanel';
import YTDLeaderboardsPanel     from './panels/YTDLeaderboardsPanel';
import QTDLeaderboardsPanel     from './panels/QTDLeaderboardsPanel';
import MTDLeaderboardsPanel     from './panels/MTDLeaderboardsPanel';
import WeekLeaderboardsPanel    from './panels/WeekLeaderboardsPanel';
import WeeklyActivityPanel      from './panels/WeeklyActivityPanel';
import CampaignLeaderboardPanel from './panels/CampaignLeaderboardPanel';
import CelebrationsPanel        from './panels/CelebrationsPanel';
import KioskOverlay             from './KioskOverlay';
import FullscreenButton         from './FullscreenButton';

const PANEL_COMPONENTS = {
  welcome:             WelcomePanel,
  agentOfMonth:        AgentOfMonthPanel,
  branchOverview:      BranchOverviewPanel,
  branchRunningTotals: RunningTotalsPanel,
  unitLeaderboard:     UnitLeaderboardPanel,
  lastWeekRecap:       LastWeekRecapPanel,
  ytdLeaderboards:     YTDLeaderboardsPanel,
  qtdLeaderboards:     QTDLeaderboardsPanel,
  mtdLeaderboards:     MTDLeaderboardsPanel,
  weekLeaderboards:    WeekLeaderboardsPanel,
  weeklyActivity:      WeeklyActivityPanel,
  awardsWatch:         AwardsWatchPanel,
  compliance:          CompliancePanel,
  campaignLeaderboards: CampaignLeaderboardPanel,
  celebrations:        CelebrationsPanel,
};

// Panels that have nothing honest to show when there are zero submissions —
// dropped from the rotation so the wall never sits on a blank data slide.
const SUBMISSION_DEPENDENT = new Set([
  'branchOverview', 'branchRunningTotals', 'unitLeaderboard', 'lastWeekRecap',
  'ytdLeaderboards', 'qtdLeaderboards', 'mtdLeaderboards', 'weekLeaderboards',
  'weeklyActivity', 'awardsWatch', 'compliance',
]);

export default function KioskShell({ tenantId, branchId }) {
  const [panelIndex, setPanelIndex] = useState(0);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [agentOfMonthData, setAgentOfMonthData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [subs, users, aom, camps] = await Promise.all([
        getKioskYTDSubmissions(tenantId, branchId),
        // getKioskTenantUsers lists users, which the kiosk rules do not grant
        // (kiosk has `get`, not `list` — the users read-split in SHAKEDOWN-002
        // dropped the kiosk list arm). Degrade to [] so a denied users-list does
        // not reject the whole Promise.all and blank submissions/AOM too; panels
        // fall back to a generic "Agent" label. FU: restore a branch-scoped
        // kiosk users-list for real names.
        getKioskTenantUsers(tenantId).catch(() => []),
        getKioskAgentOfMonth(tenantId).catch(() => null),
        // 3.6: kiosk-flagged campaigns. Degrade to [] on any read failure so a
        // campaigns-rule change or absent collection never blanks the wall.
        getKioskCampaigns(tenantId).catch(() => []),
      ]);
      setAllSubmissions(subs);
      setAllUsers(users);
      setAgentOfMonthData(aom);
      setCampaigns(camps);
    } catch {
      // Silent on poll failures — stale data is better than a crash.
    } finally {
      setLoading(false);
    }
  }, [tenantId, branchId]);

  // Initial data load + 5-minute polling.
  useEffect(() => {
    fetchData();
    const poll = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [fetchData]);

  // Effective rotation — base order minus empty panels, plus dynamic campaign +
  // celebration panels (empty-skip). Recomputed only when the data behind it
  // changes so the running rotation stays stable between polls.
  const rotation = useMemo(() => {
    const hasSubs = allSubmissions.length > 0;
    const droppedKeys = new Set();
    if (!hasSubs) SUBMISSION_DEPENDENT.forEach((k) => droppedKeys.add(k));
    const hasWinner = agentOfMonthData
      && ['api', 'apps', 'activity'].some((c) => agentOfMonthData[c]);
    if (!hasWinner) droppedKeys.add('agentOfMonth');

    // A campaign panel earns a slot only if it can produce standings — i.e.
    // there is at least one participant (a branch agent or a submitting agentId).
    const hasAgents = allUsers.some((u) => !u.role || u.role === 'agent')
      || allSubmissions.some((s) => s.agentId || s.userId);
    const flaggedCampaigns = hasAgents ? campaigns : [];

    const hasCelebrations = deriveKioskCelebrations(allUsers).length > 0;

    return buildKioskRotation(PANEL_ORDER, { flaggedCampaigns, hasCelebrations, droppedKeys });
  }, [allSubmissions, allUsers, agentOfMonthData, campaigns]);

  const safeIndex = rotation.length > 0 ? panelIndex % rotation.length : 0;
  const entry = rotation[safeIndex] ?? { key: 'welcome' };
  const durationMs = (PANEL_DURATIONS[entry.key] ?? 30) * 1000;

  // Panel rotation — each panel uses its own configured duration.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPanelIndex((i) => (i + 1) % Math.max(rotation.length, 1));
    }, durationMs);
    return () => clearTimeout(timer);
  }, [safeIndex, durationMs, rotation.length]);

  if (loading) {
    return (
      <div className="fixed inset-0 kiosk-stage flex items-center justify-center" data-kiosk="true">
        <div className="w-10 h-10 border-2 border-presentation-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const PanelComponent = PANEL_COMPONENTS[entry.key] ?? WelcomePanel;
  const activeCampaign = entry.campaignId
    ? campaigns.find((c) => c.id === entry.campaignId)
    : null;

  const sharedProps = {
    allSubmissions,
    allUsers,
    agentOfMonthData,
    tenantId,
    branchId,
    ...(entry.key === 'campaignLeaderboards' ? { campaign: activeCampaign } : {}),
  };

  const overlayLabel = entry.key === 'campaignLeaderboards'
    ? (activeCampaign?.name ?? PANEL_LABELS.campaignLeaderboards)
    : (PANEL_LABELS[entry.key] ?? '');

  return (
    <div className="fixed inset-0 overflow-hidden kiosk-stage" data-kiosk="true">
      {/* Theatrical backdrop — animated blob field + vignette (pointer-inert). */}
      <div className="kiosk-backdrop" aria-hidden="true">
        <div className="kiosk-blob kiosk-blob-a" />
        <div className="kiosk-blob kiosk-blob-b" />
        <div className="kiosk-blob kiosk-blob-c" />
        <div className="kiosk-vignette" />
      </div>

      {/* Crossfade: key forces remount + CSS fade-in on each panel change */}
      <div
        key={`${entry.key}:${entry.campaignId ?? ''}`}
        className="relative z-[1] w-full h-full motion-reduce:animate-none animate-kiosk-fade"
      >
        <PanelComponent {...sharedProps} />
      </div>

      <KioskOverlay index={safeIndex} total={rotation.length} label={overlayLabel} />
      <FullscreenButton />
    </div>
  );
}
