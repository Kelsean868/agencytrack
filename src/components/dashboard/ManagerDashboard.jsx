// Explicit React import — required for vitest compatibility per banked rule
// (Vite supports automatic JSX transform but vitest does not always apply it).
// Touched here in Track J P5 because the new ManagerDashboardLeaderboardTab
// test mounts <ManagerDashboard /> directly.
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, TrendingUp, FileCheck, Presentation, Download,
  BarChart2, Gift, Trophy, ClipboardList, CheckCircle2, Award, Star, UserCircle, LineChart, Tv,
  Activity, UserPlus, ClipboardCheck, BookOpen, LayoutList,
  NotebookPen, Target, Wallet, History, Zap, Banknote,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getWeeklySubmissions, getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { getPersistencyMapForYear } from '../../services/persistencyService';
import { exportBranchCSV } from '../../services/exportService';
import WizardForm from '../wizard/WizardForm';
import { resolvePath } from '../wizard/WizardForm.helpers';
import MasterSheet from '../manager/MasterSheet';
import CompliancePanel from '../manager/CompliancePanel';
import PersistencyTab from '../manager/PersistencyTab';
import SettlementPanel from '../manager/SettlementPanel';
import FinancingTab from '../manager/FinancingTab';
import MeetingMode from '../manager/MeetingMode';
import Leaderboard from '../gamification/Leaderboard';
import ProductionLeaderboardSurface from '../leaderboard/ProductionLeaderboardSurface';
import SmLeaderboardView from '../leaderboard/SmLeaderboardView';
import CampaignPanel from '../campaigns/CampaignPanel';
import UserManagementPanel from '../manager/UserManagementPanel';
import ManagerAwardsPanel from '../awards/ManagerAwardsPanel';
import ManagerOverviewTab from './ManagerOverviewTab';
import ProfileScreen from '../profile/ProfileScreen';
import Shell from '../shell/Shell';
import { getNavConfig, getWorkspaceGroups } from '../shell/navConfig';
import usePinnedNav from '../../hooks/usePinnedNav';
import useMenuLayout from '../../hooks/useMenuLayout';
import ProductionReportTab from '../productionReport/ProductionReportTab';
import KioskModeTab from '../kiosk/KioskModeTab';
import AgentOfMonthTab from '../manager/AgentOfMonthTab';
import ManagerWarTab from '../manager/ManagerWarTab';
import TeamWarsTab from '../manager/TeamWarsTab';
import MonthlyRecruitingTab from '../manager/MonthlyRecruitingTab';
import PolicyReconciliationPanel from '../manager/PolicyReconciliationPanel';
import TeamPerfRosterPage from '../manager/roster/TeamPerfRosterPage';
import { MANAGER_COMING_SOON_TABS } from '../../config/comingSoonTabs';
import GoalsPanel from '../manager/GoalsPanel';
import PolicyLedgerPanel from '../agent/PolicyLedgerPanel';
import DailyCaptureV2 from '../daily/DailyCaptureV2';
import DailyFAB from '../daily/DailyFAB';
import QuickAddMenu from '../shell/QuickAddMenu';
import { getQuickAddActions } from '../shell/quickAddConfig';
import GamePlanScreen from './GamePlanV2';
import MoneyNeedsPanel from '../agent/MoneyNeedsPanel';
import HistoryTab from '../submissions/HistoryTab';
import CommissionAnchorStrip from '../agent/CommissionAnchorStrip';
import CommissionPlayground from '../goals/CommissionPlayground';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import DerivedIncomePanel from '../goals/DerivedIncomePanel';
import AwardsReachPanel from '../goals/AwardsReachPanel';
import MdrtTracker from '../goals/MdrtTracker';
import { useMyProduction } from '../../hooks/useMyProduction';
import FinancingSelfView from '../financing/FinancingSelfView';
import UnitFinancingRoster from '../financing/UnitFinancingRoster';
import TeamPlansRoster from '../manager/TeamPlansRoster';

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
  { id: 'team-perf',  label: 'Team Roster',  tabId: 'team-perf',  Icon: LayoutList },
  { id: 'goals',       label: 'Goals',        tabId: 'goals',       Icon: Award },
  { id: 'settlements',           label: 'Settlements',          tabId: 'settlements',           Icon: FileCheck },
  // Track K · K1 — financing terms setup. BM/SM/TA/PA only (unit_manager excluded
  // per contract 5.3). UM/BM reach it via navConfig; this NAV_ITEMS entry serves
  // the SM/TA/PA (non-producing-manager) path.
  { id: 'financing',             label: 'Financing',            tabId: 'financing',             Icon: Banknote, roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  // H2a: Policy Reconciliation — manager confirms settled policies. Visibility gated
  // in-component (mirrors SettlementPanel canAccess: BM / tenant_admin / platform_admin
  // / canConfirmSettlements). Nav item visible to all manager roles; component handles
  // the access-denied state for uncredentialled callers.
  { id: 'policy-reconciliation', label: 'Policy Reconciliation', tabId: 'policy-reconciliation', Icon: ClipboardCheck },
  { id: 'leaderboard', label: 'Leaderboard',  tabId: 'leaderboard', Icon: Star,          sectionLabel: 'Tools' },
  // PM-2: My Production — producing manager (UM/BM) own-production screens.
  // Each item maps to one agent screen scoped to user.uid. DailyFAB overlay
  // activates when any mp-* tab is active. Policy Ledger was a standalone
  // nav item here (Option A, PM-2 Phase 0); it is now the Policies screen.
  { id: 'mp-report',      label: 'Weekly Report', tabId: 'mp-report',      Icon: NotebookPen, roles: ['unit_manager', 'branch_manager'], sectionLabel: 'My Production' },
  { id: 'mp-goals',       label: 'Goals',         tabId: 'mp-goals',       Icon: Target,      roles: ['unit_manager', 'branch_manager'] },
  { id: 'mp-game-plan',   label: 'Game Plan',     tabId: 'mp-game-plan',   Icon: BarChart2,   roles: ['unit_manager', 'branch_manager'] },
  { id: 'mp-money-needs', label: 'Money Needs',   tabId: 'mp-money-needs', Icon: Wallet,      roles: ['unit_manager', 'branch_manager'] },
  { id: 'mp-history',     label: 'History',       tabId: 'mp-history',     Icon: History,     roles: ['unit_manager', 'branch_manager'] },
  { id: 'mp-commission',  label: 'Commission',    tabId: 'mp-commission',  Icon: Zap,         roles: ['unit_manager', 'branch_manager'] },
  { id: 'mp-policies',    label: 'Policies',      tabId: 'mp-policies',    Icon: BookOpen,    roles: ['unit_manager', 'branch_manager'] },
  // E6: agent of the month — branch_manager+ only (unit_manager excluded)
  { id: 'agent-of-month', label: 'Agent of Month', tabId: 'agent-of-month', Icon: Trophy, roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  // E5: kiosk tab — branch_manager+ only (unit_manager excluded)
  { id: 'kiosk',       label: 'Kiosk',        tabId: 'kiosk',       Icon: Tv,            roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] },
  { id: 'profile',     label: 'Profile',      tabId: 'profile',     Icon: UserCircle },
].map(item => item.tabId && MANAGER_COMING_SOON_TABS.has(item.tabId) ? { ...item, disabled: true } : item);

// Mobile bottom-nav — SM/TA/PA (non-producing managers). 5-slot v2 layout: 4 tabs
// + auto-appended "More". Profile folded into the More drawer (v2 nav reorder);
// NAV_ITEMS already carries a profile row, so the drawer derivation surfaces it
// automatically once it leaves the bottom nav. No FAB for these roles.
const BOTTOM_NAV = [
  { id: 'overview',    label: 'Dashboard', tabId: 'overview',    Icon: BarChart2     },
  { id: 'team',        label: 'Team',      tabId: 'team',        Icon: Users         },
  { id: 'mastersheet', label: 'Reports',   tabId: 'mastersheet', Icon: ClipboardList },
  { id: 'campaigns',   label: 'Campaigns', tabId: 'campaigns',   Icon: Gift          },
];

// UM/BM mobile bottom-nav — 5-slot v2 layout: 2 tabs · center ＋ · 1 tab · More
// (the "More" button is auto-appended by MobileBottomNav, so it is the 5th slot
// and the FAB sits dead-center). Center ＋ ("Create") opens the Quick-Add sheet
// (PR-3). Profile folded into the More drawer (v2 nav reorder) — the
// producingManager nav config has no profile row, so it is injected in
// drawerNavItems below. Campaigns lands in More too.
// Icon field omitted on the fab item — MobileBottomNav always renders Plus for fabs.
const BOTTOM_NAV_PRODUCING = [
  { id: 'overview',    label: 'Dashboard', tabId: 'overview',    Icon: BarChart2     },
  { id: 'team',        label: 'Team',      tabId: 'team',        Icon: Users         },
  { id: 'create',      label: 'Create',    action: 'quick-add',  fab: true           },
  { id: 'mastersheet', label: 'Reports',   tabId: 'mastersheet', Icon: ClipboardList },
];

// Profile row for the mobile "More" drawer (v2 nav reorder). Injected only when
// the derived drawer lacks it — the producingManager nav config has no profile
// row (UM/BM reach Profile via the sidebar avatar on desktop), whereas the
// non-producing managers' NAV_ITEMS yields one automatically. Routes to the
// existing activeTab === 'profile' screen, which hosts its own Sign Out.
const PROFILE_NAV_ITEM = { id: 'profile', label: 'Profile', tabId: 'profile', Icon: UserCircle };

const MP_TABS = new Set(['mp-report', 'mp-goals', 'mp-game-plan', 'mp-money-needs', 'mp-history', 'mp-commission', 'mp-policies', 'mp-financing']);

export default function ManagerDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();
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

  // Pull-to-refresh — enabled on data-feed tabs only.
  // Game Plan is an agent-only surface so no exclusion needed here.
  const [ptrRevision, setPtrRevision] = useState(0);
  const PTR_MANAGER_TABS = new Set(['overview', 'mastersheet', 'leaderboard', 'mp-history', 'mp-policies']);
  const [showMpDailyModal, setShowMpDailyModal] = useState(false);
  const [showQuickAdd,     setShowQuickAdd]     = useState(false);
  // Producing-manager fast path: dedicated wizard host (mirrors the agent's
  // showWizard host). The daily-review → Confirm flow routes here; vars are
  // re-set fresh on every open via openMpWizardForWeek (onClose does not reset
  // them — safe because the helper always re-sets before showing).
  const [showMpWizard, setShowMpWizard]               = useState(false);
  const [mpWizardWeek, setMpWizardWeek]               = useState('');
  const [mpWizardInitialStep, setMpWizardInitialStep] = useState(1);
  const [mpWizardInitialScreen, setMpWizardInitialScreen] = useState(null);
  const mpPlaygroundRef = useRef(null);

  const isProducingManager = role === 'unit_manager' || role === 'branch_manager';
  const myProd = useMyProduction(
    isProducingManager ? tenantId : null,
    isProducingManager ? user?.uid : null,
    userProfile,
  );

  // E6 logging-mode: unset defaults to 'hybrid' (showDailyCTA = true).
  const mpLoggingMode = userProfile?.loggingMode ?? 'hybrid';
  const showMpDailyCTA = mpLoggingMode === 'daily' || mpLoggingMode === 'hybrid';

  // Producing-manager fast path — mirrors AgentDashboard.openWizardForWeek.
  // Fast path (reviewed week has daily entries) lands on the Confirm screen and
  // advances to step 10 (Rate); full path opens at step 1 with no Confirm. The
  // draftHint is the reviewed week's real aggregation passed up by DailyCaptureV2.
  const openMpWizardForWeek = (week, draftHint = null) => {
    const path = resolvePath(mpLoggingMode, draftHint);
    setMpWizardInitialStep(path === 'fast' ? 10 : 1);
    setMpWizardInitialScreen(path === 'fast' ? 'confirm' : null);
    setMpWizardWeek(week);
    setShowMpWizard(true);
  };

  // Lazy-load own policies when Commission tab is first visited.
  // Destructured to avoid re-running when other myProd fields update (Gemini G1).
  const { policies: myProdPolicies, loadPolicies: myProdLoadPolicies } = myProd;
  useEffect(() => {
    if (activeTab === 'mp-commission' && myProdPolicies === null) myProdLoadPolicies();
  }, [activeTab, myProdPolicies, myProdLoadPolicies]);
  const onPullRefresh = useCallback(() => {
    setPtrRevision((r) => r + 1);
  }, []);

  // Stable "now" so the ManagerAwardsPanel currentDate prop keeps a constant
  // identity across renders (EFF-009) — its internal useMemo(currentDate) was
  // being defeated by a fresh Date() passed on every render.
  const now = useMemo(() => new Date(), []);

  const filteredNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)),
    [role]
  );

  // Nav redesign PR-1: producing managers (UM/BM) render the centralized
  // producingManager config (route-faithful — every item points at an existing
  // tabId, branch-only items gated via `roles`). All other manager roles
  // (sales_manager / tenant_admin / platform_admin) keep the existing inline
  // nav unchanged. The shared NAV_ITEMS array and the activeTab render-switch
  // are deliberately untouched, so no screen can regress.
  // Menu layout (Nav redesign PR-4) — producing managers honor the stored
  // preference; non-producing manager roles aren't producingManager so they
  // never enter the workspace path. Agents clamp at the resolver (n/a here).
  const { menuLayout, setMenuLayout } = useMenuLayout({ role, tenantId, uid: user?.uid });
  const [workspace, setWorkspace] = useState('work'); // session-state, default My Work (decision #4)
  const isWorkspaceLayout = isProducingManager && (menuLayout === 'workspace' || menuLayout === 'both');

  // Full role nav — the descriptor universe for pinned-zone resolution. Always
  // the complete producingManager config (independent of the active workspace)
  // so the `both` layout's pinned rows always resolve to a descriptor.
  const fullNav = useMemo(
    () => (isProducingManager ? getNavConfig('producingManager', { role }) : filteredNavItems),
    [isProducingManager, role, filteredNavItems]
  );

  // Rendered groups — the workspace partition for workspace/both, else the full
  // nav (pinned layout + non-producing roles render exactly as before).
  const navItems = useMemo(
    () => (isWorkspaceLayout ? getWorkspaceGroups('producingManager', { role, workspace }) : fullNav),
    [isWorkspaceLayout, role, workspace, fullNav]
  );

  const drawerNavItems = useMemo(
    () => {
      const activeNav = isProducingManager ? BOTTOM_NAV_PRODUCING : BOTTOM_NAV;
      const derived = navItems.filter((item) => !activeNav.find((b) => b.id === item.id));
      // Profile lives in the More drawer (v2 nav reorder). Non-producing managers'
      // NAV_ITEMS already yields a profile row here; the producingManager config
      // has none, so inject it. Guarded so it never duplicates.
      return derived.some((i) => i.id === 'profile') ? derived : [...derived, PROFILE_NAV_ITEM];
    },
    [navItems, isProducingManager]
  );

  // ★ Pinned-nav (Nav redesign PR-2) — producing managers (UM/BM) only. Other
  // manager roles pass no tenantId/uid/configKey (hook is inert) and forward no
  // pinned props to Shell, so their nav renders exactly as before. Resolves pins
  // against `fullNav` (not the rendered subset) so `both`'s pins always resolve.
  const { pinnedItems, isPinned, pin, unpin } = usePinnedNav({
    tenantId:  isProducingManager ? tenantId : undefined,
    uid:       isProducingManager ? user?.uid : undefined,
    configKey: isProducingManager ? 'producingManager' : null,
    navItems:  fullNav,
  });

  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Manager';
  const roleLabel    = getRoleLabel(role);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  // Quick-Add + bottom-nav action dispatch (PR-3). 'quick-add' opens the
  // QuickAddMenu. Tab-based Quick-Add actions route via setActiveTab.
  // 'log-today' opens the producing-manager daily-capture overlay (Decision #6).
  // 'start-meeting' delegates to handleStartMeeting (deferred from PR-1).
  const handleMgrAction = (action) => {
    if (action === 'quick-add') {
      setShowQuickAdd(true);
    } else if (action === 'log-today') {
      setShowMpDailyModal(true);
    } else if (action === 'start-meeting') {
      handleStartMeeting();
    } else if ([
      'mp-report', 'mp-policies', 'monthly-recruiting',
      'persistency', 'campaigns', 'mp-goals',
    ].includes(action)) {
      setActiveTab(action);
    }
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

  // Producing-manager fast-path host — daily-review → Confirm. Threads the
  // resolvePath-derived initialStep/initialScreen plus goal/floors (step-11
  // seeding) for the manager's OWN production. getDraft inside WizardForm is
  // uid-generic, so it auto-loads submissions/{managerUid}_{week}.
  if (showMpWizard) {
    return (
      <WizardForm
        initialWeek={mpWizardWeek}
        initialStep={mpWizardInitialStep}
        initialScreen={mpWizardInitialScreen}
        goal={myProd.goals}
        floors={myProd.companyMinimums?.weeklyActivityFloors}
        onClose={() => setShowMpWizard(false)}
      />
    );
  }

  // My Production — Weekly Report tab renders WizardForm full-screen (same
  // pattern as showWizard; onClose returns to Goals as the natural next screen).
  if (activeTab === 'mp-report') {
    return <WizardForm onClose={() => setActiveTab('mp-goals')} />;
  }

  // My Production — DailyCaptureV2 full-screen overlay when FAB is tapped.
  if (showMpDailyModal) {
    return (
      <DailyCaptureV2
        onClose={() => setShowMpDailyModal(false)}
        onReviewSubmit={(week, draftHint) => {
          // Route on the REVIEWED week's real aggregation (draftHint) into the
          // dedicated fast-path host — Confirm when the week has daily entries,
          // full otherwise. Mirrors AgentDashboard's onReviewSubmit.
          setShowMpDailyModal(false);
          openMpWizardForWeek(week, draftHint);
        }}
      />
    );
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
      navItems={navItems}
      pinnedItems={isProducingManager ? pinnedItems : undefined}
      isPinned={isProducingManager ? isPinned : undefined}
      onPin={isProducingManager ? pin : undefined}
      onUnpin={isProducingManager ? unpin : undefined}
      showPinnedZone={isProducingManager ? menuLayout !== 'workspace' : true}
      showWorkspaceToggle={isWorkspaceLayout}
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      bottomNavItems={isProducingManager ? BOTTOM_NAV_PRODUCING : BOTTOM_NAV}
      drawerNavItems={drawerNavItems}
      onAction={handleMgrAction}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={roleLabel}
      topbarActions={topbarActions}
      onSignOut={handleSignOut}
      onPullRefresh={PTR_MANAGER_TABS.has(activeTab) ? onPullRefresh : undefined}
    >
        {/* Quick-Add FAB (desktop pencil) — shown on any My Production tab
            when in daily/hybrid mode. Hides on mobile (<768px) via DailyFAB.
            Opens the Quick-Add popover; 'Log today' inside it opens the daily
            capture overlay (Decision #6 verdict). Relocated above the tab-content
            run so the screen-enter transform never reparents this fixed FAB. */}
        {MP_TABS.has(activeTab) && showMpDailyCTA && (
          <DailyFAB
            onClick={() => setShowQuickAdd(true)}
            todayLogged={true}
          />
        )}

        {/* Quick-Add menu — popover (desktop) or sheet (mobile) */}
        {showQuickAdd && (
          <QuickAddMenu
            actions={getQuickAddActions(isProducingManager ? 'producingManager' : 'manager')}
            onSelect={handleMgrAction}
            onClose={() => setShowQuickAdd(false)}
            todayLogged={true}
          />
        )}

        {/* ── Screen-enter (redesign-addendum §2): tab-content fades + rises 8px
            on tab navigation. Keyed on activeTab; wraps only the tab blocks
            (fixed FAB/QuickAdd relocated above). Gated + degrades in index.css. */}
        <div key={activeTab} className="screen-enter">
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <ManagerOverviewTab
            key={ptrRevision}
            role={role}
            userProfile={userProfile}
            tenantId={tenantId}
            onSubmitReport={(role === 'unit_manager' || role === 'branch_manager') ? () => setShowWizard(true) : undefined}
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
            currentDate={now}
            role={role}
            tenantId={tenantId}
            newAdvisors={newAdvisors}
          />
        )}

        {activeTab === 'mastersheet' && (
          <MasterSheet key={ptrRevision} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'compliance' && (
          <CompliancePanel selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'persistency' && <PersistencyTab />}

        {activeTab === 'team-perf' && <TeamPerfRosterPage />}

        {activeTab === 'goals' && <GoalsPanel />}

        {activeTab === 'settlements' && <SettlementPanel />}

        {activeTab === 'financing' && <FinancingTab />}

        {/* Track K · K10a — UM-only unit financing roster (distinct from the BM
            `financing` tab). Nav gates it to unit_manager; the component guards
            the role defensively (getTenantUsers only unit-scopes for a UM). */}
        {activeTab === 'unit-financing' && <UnitFinancingRoster tenantId={tenantId} />}

        {/* PR-GPM1 — UM/BM read-only roster of consent-shared Money Needs
            worksheets. Nav gates it to UM/BM (matching the G5 rules arms — no
            TA/PA read exists); the component guards the role defensively. */}
        {activeTab === 'team-game-plans' && <TeamPlansRoster tenantId={tenantId} />}

        {activeTab === 'policy-reconciliation' && <PolicyReconciliationPanel />}

        {/* Track J P5 + P5b — role-conditional Leaderboard tab.
              UM/BM        → ProductionLeaderboardSurface (own branch, P5a
                             scope control active).
              sales_manager → SmLeaderboardView (P5b — all-branches picker
                             + BM-style unit scope within the picked branch;
                             ownedBranchIds:['*'] / head of sales).
              PA (and any other manager role that falls through this arm) →
                             gamification/Leaderboard points board. The
                             component stays referenced via this arm — not
                             orphaned. Regression-guarded by tests. */}
        {activeTab === 'leaderboard' && (
          (role === 'unit_manager' || role === 'branch_manager')
            ? <ProductionLeaderboardSurface key={ptrRevision} />
            : role === 'sales_manager'
              ? <SmLeaderboardView key={ptrRevision} />
              : <Leaderboard key={ptrRevision} />
        )}

        {activeTab === 'agent-of-month' && <AgentOfMonthTab />}

        {activeTab === 'kiosk' && <KioskModeTab />}

        {/* ── MY PRODUCTION — own-production screens for UM/BM ── */}
        {/* mp-report handled via early return (WizardForm full-screen) */}

        {activeTab === 'mp-goals' && (
          <>
            <GapAnalysisPanel
              hierarchy={myProd.hierarchy}
              ytdTotals={myProd.ytdTotals}
              loading={myProd.hierarchyLoading}
              error={myProd.hierarchyError}
              ytdPersistency={myProd.ytdPersistency}
              persistencyFloor={myProd.companyMinimums?.persistency ?? 90}
            />
            <div className="mt-4 border-t border-border pt-4">
              <DerivedIncomePanel
                hierarchy={myProd.hierarchy}
                ytdTotals={myProd.ytdTotals}
                commissionRate={parseFloat(userProfile?.commissionRate) || null}
                loading={myProd.hierarchyLoading}
              />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <AwardsReachPanel
                submissions={myProd.allSubmissions}
                confirmedSettlements={myProd.settlements}
                agentProfile={userProfile}
              />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <MdrtTracker
                ytdTotals={myProd.ytdTotals}
                loading={myProd.loading}
              />
            </div>
          </>
        )}

        {activeTab === 'mp-game-plan' && <GamePlanScreen />}

        {activeTab === 'mp-money-needs' && <MoneyNeedsPanel />}

        {activeTab === 'mp-history' && (
          <HistoryTab submissions={myProd.allSubmissions} />
        )}

        {activeTab === 'mp-commission' && (
          <div className="flex flex-col gap-4">
            <CommissionAnchorStrip
              policies={myProd.policies || []}
              loading={myProd.policiesLoading}
              error={myProd.policiesError}
              onRetry={() => { myProd.loadPolicies(); }}
              persistencyHistory={myProd.persistency}
              committedAnnualAPI={myProd.goals?.personalAnnualAPI ?? null}
              commissionRate={parseFloat(userProfile?.commissionRate) || 35}
              onScrollToPlayground={() => mpPlaygroundRef.current?.scrollIntoView({ behavior: 'smooth' })}
            />
            <div ref={mpPlaygroundRef}>
              <CommissionPlayground
                submissions={myProd.allSubmissions}
                agentId={user?.uid}
                tenantId={tenantId}
                currentGoal={myProd.goals?.personalAnnualAPI ?? null}
                onGoalSaved={() => myProd.reload()}
              />
            </div>
          </div>
        )}

        {activeTab === 'mp-policies' && <PolicyLedgerPanel key={ptrRevision} />}

        {/* Track K · K9 — financed-UM own financing self-view (agent-style, own uid).
            The unit-management half is K10 and is NOT mounted here. */}
        {activeTab === 'mp-financing' && <FinancingSelfView tenantId={tenantId} subjectUid={user?.uid} />}

        {activeTab === 'profile' && (
          <ProfileScreen menuLayout={menuLayout} onMenuLayoutChange={setMenuLayout} />
        )}
        </div>
    </Shell>
  );
}
