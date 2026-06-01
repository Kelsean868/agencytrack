// Explicit React import — required for vitest compatibility per banked rule
// (Vite supports automatic JSX transform but vitest does not always apply it).
// Touched here in Track J P5 because the new ManagerDashboardLeaderboardTab
// test mounts <ManagerDashboard /> directly.
import React, { useMemo, useState, useEffect } from 'react';
import {
  Users, TrendingUp, FileCheck, Presentation, Download,
  BarChart2, Gift, Trophy, ClipboardList, CheckCircle2, Award, Star, UserCircle, LineChart, Tv,
  Activity, UserPlus, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getWeeklySubmissions, getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { getPersistencyMapForYear } from '../../services/persistencyService';
import { exportBranchCSV } from '../../services/exportService';
import WizardForm from '../wizard/WizardForm';
import MasterSheet from '../manager/MasterSheet';
import CompliancePanel from '../manager/CompliancePanel';
import PersistencyTab from '../manager/PersistencyTab';
import GoalsPanel from '../manager/GoalsPanel';
import SettlementPanel from '../manager/SettlementPanel';
import MeetingMode from '../manager/MeetingMode';
import Leaderboard from '../gamification/Leaderboard';
import ProductionLeaderboardSurface from '../leaderboard/ProductionLeaderboardSurface';
import CampaignPanel from '../campaigns/CampaignPanel';
import UserManagementPanel from '../manager/UserManagementPanel';
import ManagerAwardsPanel from '../awards/ManagerAwardsPanel';
import ManagerOverviewTab from './ManagerOverviewTab';
import ProfileScreen from '../profile/ProfileScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';
import KioskModeTab from '../kiosk/KioskModeTab';
import AgentOfMonthTab from '../manager/AgentOfMonthTab';
import ManagerWarTab from '../manager/ManagerWarTab';
import TeamWarsTab from '../manager/TeamWarsTab';
import MonthlyRecruitingTab from '../manager/MonthlyRecruitingTab';
import PolicyReconciliationPanel from '../manager/PolicyReconciliationPanel';

// Sidebar nav items — single layout for all 4 manager roles. Per-role
// differentiation (tenant_admin: Company Config / Audit Log / Billing;
// sales_manager: cross-branch surfaces) lands in B5 + P9 alongside per-role
// dashboard differentiation. This is the explicit B4 boundary and is
// surfaced in the PR description.
const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',     tabId: 'overview',    Icon: BarChart2,     sectionLabel: 'Manage' },
  // I1.1: My WAR — UM/BM/SM file; tenant_admin/platform_admin read via I1.3b browse
  { id: 'my-war', label: 'My WAR', tabId: 'my-war', Icon: ClipboardList,
    roles: ['unit_manager', 'branch_manager', 'sales_manager'] },
  // I1.3b: Team WARs — upline browse (BM sees own branch; SM+ sees tenant-wide)
  { id: 'team-wars', label: 'Team WARs', tabId: 'team-wars', Icon: Activity,
    roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  // I2: Monthly Recruiting — UM/BM/SM file; BM/SM/TA/PA view the team
  { id: 'monthly-recruiting', label: 'Monthly Recruiting', tabId: 'monthly-recruiting', Icon: UserPlus },
  { id: 'team',        label: 'Team',         tabId: 'team',        Icon: Users },
  { id: 'campaigns',          label: 'Campaigns',         tabId: 'campaigns',          Icon: Gift },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: LineChart },
  { id: 'awards',            label: 'Awards',            tabId: 'awards',            Icon: Trophy },
  { id: 'mastersheet', label: 'Master Sheet', tabId: 'mastersheet', Icon: ClipboardList },
  { id: 'compliance',  label: 'Compliance',   tabId: 'compliance',  Icon: CheckCircle2 },
  { id: 'persistency', label: 'Persistency',  tabId: 'persistency', Icon: TrendingUp,    sectionLabel: 'Operations', testId: 'tab-persistency' },
  { id: 'goals',       label: 'Goals',        tabId: 'goals',       Icon: Award },
  { id: 'settlements',           label: 'Settlements',          tabId: 'settlements',           Icon: FileCheck },
  // H2a: Policy Reconciliation — manager confirms settled policies. Visibility gated
  // in-component (mirrors SettlementPanel canAccess: BM / tenant_admin / platform_admin
  // / canConfirmSettlements). Nav item visible to all manager roles; component handles
  // the access-denied state for uncredentialled callers.
  { id: 'policy-reconciliation', label: 'Policy Reconciliation', tabId: 'policy-reconciliation', Icon: ClipboardCheck },
  { id: 'leaderboard', label: 'Leaderboard',  tabId: 'leaderboard', Icon: Star,          sectionLabel: 'Tools' },
  // E6: agent of the month — branch_manager+ only (unit_manager excluded)
  { id: 'agent-of-month', label: 'Agent of Month', tabId: 'agent-of-month', Icon: Trophy, roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  // E5: kiosk tab — branch_manager+ only (unit_manager excluded)
  { id: 'kiosk',       label: 'Kiosk',        tabId: 'kiosk',       Icon: Tv,            roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  { id: 'profile',     label: 'Profile',      tabId: 'profile',     Icon: UserCircle },
];

// Mobile bottom-nav — 5 items chosen as the most-used manager surfaces.
// Master Sheet stands in for the mock's "Reports" item (no Reports tab
// exists today). All 4 manager roles share this layout for B4.
const BOTTOM_NAV = [
  { id: 'overview',    label: 'Dashboard', tabId: 'overview',    Icon: BarChart2 },
  { id: 'team',        label: 'Team',      tabId: 'team',        Icon: Users },
  { id: 'mastersheet', label: 'Reports',   tabId: 'mastersheet', Icon: ClipboardList },
  { id: 'campaigns',   label: 'Campaigns', tabId: 'campaigns',   Icon: Gift },
  { id: 'profile',     label: 'Profile',   tabId: 'profile',     Icon: UserCircle },
];

export default function ManagerDashboard() {
  const { userProfile, role, tenantId } = useAuth();
  const [showWizard, setShowWizard]       = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const [selectedWeek, setSelectedWeek]   = useState(getMostRecentSunday());
  const [meetingActive, setMeetingActive] = useState(false);
  const [meetingSubmissions, setMeetingSubmissions] = useState([]);

  // Agent IDs, full profiles, and new-advisor count for manager awards.
  // newAdvisors = agents in scope whose contractStartDate falls in the current calendar year.
  const [agentIds, setAgentIds]           = useState([]);
  const [agentProfiles, setAgentProfiles] = useState([]);
  const [newAdvisors, setNewAdvisors]     = useState(0);

  useEffect(() => {
    const currentYearStr = String(new Date().getFullYear());
    getTenantUsers(tenantId)
      .then((userList) => {
        const agents = userList.filter((u) => u.role === 'agent');
        setAgentIds(agents.map((u) => u.id));
        setAgentProfiles(agents);
        setNewAdvisors(
          agents.filter(
            (u) => typeof u.contractStartDate === 'string' && u.contractStartDate.startsWith(currentYearStr)
          ).length
        );
      })
      .catch(console.error);
  }, [tenantId]);

  const filteredNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)),
    [role]
  );

  const drawerNavItems = useMemo(
    () => filteredNavItems.filter((item) => !BOTTOM_NAV.find((b) => b.id === item.id)),
    [filteredNavItems]
  );

  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Manager';
  const roleLabel    = getRoleLabel(role);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const handleStartMeeting = async () => {
    try {
      const [subs, userList] = await Promise.all([
        getWeeklySubmissions(tenantId, selectedWeek),
        getTenantUsers(tenantId).catch(() => []),
      ]);
      const nameMap = {};
      userList.forEach((u) => {
        nameMap[u.id] = u.name ?? u.displayName ?? u.email ?? null;
      });
      const enriched = subs.map((sub) => {
        if (sub.agentName) return sub;
        const uid = sub.agentId ?? sub.userId ?? '';
        const name = nameMap[uid] ?? (uid ? `Agent ${uid.slice(-6)}` : 'Unknown');
        return { ...sub, agentName: name };
      });
      setMeetingSubmissions(enriched);
      setMeetingActive(true);
    } catch (e) {
      console.error('Failed to load meeting data:', e);
    }
  };

  const handleExportBranchCSV = async () => {
    try {
      const year = new Date().getFullYear();
      const [userList, subs, persMap] = await Promise.all([
        getTenantUsers(tenantId).catch(() => []),
        getAllYTDSubmissions(tenantId).catch(() => []),
        getPersistencyMapForYear(tenantId, year, {
          branchId: role === 'branch_manager' ? userProfile?.branchId : undefined,
          unitId:   role === 'unit_manager'   ? userProfile?.unitId   : undefined,
        }).catch(() => ({})),
      ]);
      exportBranchCSV(userList, subs, persMap);
    } catch (err) {
      console.error('Branch CSV export failed:', err);
    }
  };

  if (showWizard) {
    return <WizardForm onClose={() => setShowWizard(false)} />;
  }

  if (meetingActive) {
    return (
      <MeetingMode
        submissions={meetingSubmissions}
        selectedWeek={selectedWeek}
        onClose={() => setMeetingActive(false)}
      />
    );
  }

  // Topbar action slot — branch-CSV export (gated) + Start Meeting CTA.
  // Both buttons relocated from the per-dashboard header into the Shell's
  // topbar actions slot. Dark-mode toggle and sign-out live in TopBar /
  // sidebar foot respectively.
  const topbarActions = (
    <>
      {(role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin') && (
        <button
          type="button"
          onClick={handleExportBranchCSV}
          className="h-11 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Download size={16} />
          <span className="sr-only md:not-sr-only">Export Branch Report</span>
        </button>
      )}
      <button
        type="button"
        onClick={handleStartMeeting}
        className="h-10 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Presentation size={16} />
        <span className="sr-only md:not-sr-only">Start Meeting</span>
      </button>
    </>
  );

  return (
    <Shell
      navItems={filteredNavItems}
      bottomNavItems={BOTTOM_NAV}
      drawerNavItems={drawerNavItems}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={roleLabel}
      topbarActions={topbarActions}
      onSignOut={handleSignOut}
    >
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <ManagerOverviewTab
            role={role}
            userProfile={userProfile}
            tenantId={tenantId}
            onSubmitReport={() => setShowWizard(true)}
          />
        )}

        {activeTab === 'my-war'             && <ManagerWarTab />}
        {activeTab === 'team-wars'          && <TeamWarsTab />}
        {activeTab === 'monthly-recruiting' && <MonthlyRecruitingTab />}

        {activeTab === 'team' && <UserManagementPanel />}

        {activeTab === 'campaigns' && <CampaignPanel />}

        {activeTab === 'production-report' && <ProductionReportTab userRole={role} />}

        {activeTab === 'awards' && (
          <ManagerAwardsPanel
            agentIds={agentIds}
            agentProfiles={agentProfiles}
            currentDate={new Date()}
            role={role}
            tenantId={tenantId}
            newAdvisors={newAdvisors}
          />
        )}

        {activeTab === 'mastersheet' && (
          <MasterSheet selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'compliance' && (
          <CompliancePanel selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'persistency' && <PersistencyTab />}

        {activeTab === 'goals' && <GoalsPanel />}

        {activeTab === 'settlements' && <SettlementPanel />}

        {activeTab === 'policy-reconciliation' && <PolicyReconciliationPanel />}

        {/* Track J P5 — role-conditional Leaderboard tab.
            UM/BM → ProductionLeaderboardSurface (scoped to their branch via
            useLeaderboard, with P5a's scope control active). SM (and any
            other non-UM/BM role that lands here) → unchanged points board;
            SM has ownedBranchIds:['*'] and no single default branch, so
            their leaderboard experience is the all-branches picker = P5b.
            The points-board component stays referenced via this SM/TA/PA
            arm — not orphaned. Regression-guarded by tests. */}
        {activeTab === 'leaderboard' && (
          (role === 'unit_manager' || role === 'branch_manager')
            ? <ProductionLeaderboardSurface />
            : <Leaderboard />
        )}

        {activeTab === 'agent-of-month' && <AgentOfMonthTab />}

        {activeTab === 'kiosk' && <KioskModeTab />}

        {activeTab === 'profile' && <ProfileScreen />}
    </Shell>
  );
}
