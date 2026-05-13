import React, { useCallback, useEffect, useState } from 'react';
import { PANEL_DURATIONS, PANEL_ORDER, POLL_INTERVAL_MS } from '../../lib/kiosk/kioskConfig';
import { getAllYTDSubmissions, getTenantUsers } from '../../services/managerService';
import { getAgentOfMonthForKiosk } from '../../services/agentOfMonthService';

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
};

export default function KioskShell({ tenantId, branchId }) {
  const [panelIndex, setPanelIndex] = useState(0);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [agentOfMonthData, setAgentOfMonthData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [subs, users, aom] = await Promise.all([
        getAllYTDSubmissions(tenantId),
        getTenantUsers(tenantId),
        getAgentOfMonthForKiosk(tenantId).catch(() => null),
      ]);
      setAllSubmissions(subs);
      setAllUsers(users);
      setAgentOfMonthData(aom);
    } catch {
      // Silent on poll failures — stale data is better than a crash.
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data load + 5-minute polling.
  useEffect(() => {
    fetchData();
    const poll = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [fetchData]);

  // Panel rotation — each panel uses its own configured duration.
  useEffect(() => {
    const panelKey = PANEL_ORDER[panelIndex];
    const ms = PANEL_DURATIONS[panelKey] * 1000;
    const timer = setTimeout(() => {
      setPanelIndex((i) => (i + 1) % PANEL_ORDER.length);
    }, ms);
    return () => clearTimeout(timer);
  }, [panelIndex]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1a1612] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#4ab5b8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const panelKey = PANEL_ORDER[panelIndex];
  const PanelComponent = PANEL_COMPONENTS[panelKey];

  const sharedProps = {
    allSubmissions,
    allUsers,
    agentOfMonthData,
    tenantId,
    branchId,
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Crossfade: key forces remount + CSS fade-in on each panel change */}
      <div key={panelKey} className="w-full h-full animate-kiosk-fade">
        <PanelComponent {...sharedProps} />
      </div>
      <FullscreenButton />
    </div>
  );
}
