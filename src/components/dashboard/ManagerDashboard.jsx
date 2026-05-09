import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, FileCheck, AlertCircle, Presentation, Download,
  BarChart2, Gift, Trophy, ClipboardList, CheckCircle2, Award, Star, UserCircle, LineChart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getWeeklySubmissions, getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { getAllPersistencyForYear } from '../../services/persistencyService';
import { exportBranchCSV } from '../../services/exportService';
import WizardForm from '../wizard/WizardForm';
import MasterSheet from '../manager/MasterSheet';
import CompliancePanel from '../manager/CompliancePanel';
import PersistencyPanel from '../manager/PersistencyPanel';
import GoalsPanel from '../manager/GoalsPanel';
import CommissionPlayground from '../goals/CommissionPlayground';
import { getGoals } from '../../services/goalsService';
import SettlementPanel from '../manager/SettlementPanel';
import MeetingMode from '../manager/MeetingMode';
import Leaderboard from '../gamification/Leaderboard';
import CampaignPanel from '../campaigns/CampaignPanel';
import UserManagementPanel from '../manager/UserManagementPanel';
import ManagerAwardsPanel from '../awards/ManagerAwardsPanel';
import MotivationalCarousel from './MotivationalCarousel';
import ProfileScreen from '../profile/ProfileScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';

// Sidebar nav items — single layout for all 4 manager roles. Per-role
// differentiation (tenant_admin: Company Config / Audit Log / Billing;
// sales_manager: cross-branch surfaces) lands in B5 + P9 alongside per-role
// dashboard differentiation. This is the explicit B4 boundary and is
// surfaced in the PR description.
const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',     tabId: 'overview',    Icon: BarChart2,     sectionLabel: 'Manage' },
  { id: 'team',        label: 'Team',         tabId: 'team',        Icon: Users },
  { id: 'campaigns',          label: 'Campaigns',         tabId: 'campaigns',          Icon: Gift },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: LineChart },
  { id: 'awards',            label: 'Awards',            tabId: 'awards',            Icon: Trophy },
  { id: 'mastersheet', label: 'Master Sheet', tabId: 'mastersheet', Icon: ClipboardList },
  { id: 'compliance',  label: 'Compliance',   tabId: 'compliance',  Icon: CheckCircle2 },
  { id: 'persistency', label: 'Persistency',  tabId: 'persistency', Icon: TrendingUp,    sectionLabel: 'Operations' },
  { id: 'goals',       label: 'Goals',        tabId: 'goals',       Icon: Award },
  { id: 'settlements', label: 'Settlements',  tabId: 'settlements', Icon: FileCheck },
  { id: 'leaderboard', label: 'Leaderboard',  tabId: 'leaderboard', Icon: Star,          sectionLabel: 'Tools' },
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

function StatCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`card flex items-start gap-4 ${accent ? 'border-l-4 border-primary' : ''}`}>
      <div className="p-2 rounded-lg bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-sm font-medium text-ink">{label}</p>
        {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();
  const [showWizard, setShowWizard]       = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const [selectedWeek, setSelectedWeek]   = useState(getMostRecentSunday());
  const [meetingActive, setMeetingActive] = useState(false);
  const [meetingSubmissions, setMeetingSubmissions] = useState([]);

  // Agent IDs for manager awards
  const [agentIds, setAgentIds] = useState([]);

  useEffect(() => {
    getTenantUsers()
      .then((userList) => {
        setAgentIds(userList.filter((u) => u.role === 'agent').map((u) => u.id));
      })
      .catch(console.error);
  }, []);

  // Goals sub-tab
  const [goalsSubTab, setGoalsSubTab]     = useState('self');
  const [managerGoals, setManagerGoals]   = useState(null);
  const [unitGoalsData, setUnitGoalsData] = useState({ agents: [], goalsMap: {} });

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    getGoals(tenantId, user.uid).then(setManagerGoals).catch(console.error);
  }, [user?.uid, tenantId]);

  const handleUnitGoalsLoaded = useCallback((agents, goalsMap) => {
    setUnitGoalsData({ agents, goalsMap });
  }, []);

  const unitAggregate = useMemo(() => {
    const { agents, goalsMap } = unitGoalsData;
    const withGoals = agents.filter((a) => parseFloat(goalsMap[a.id]?.targetAnnualAPI) > 0);
    const totalAPI  = withGoals.reduce((sum, a) => sum + (parseFloat(goalsMap[a.id]?.targetAnnualAPI) || 0), 0);
    const avg       = withGoals.length > 0 ? totalAPI / withGoals.length : 0;
    return { totalAPI, avg, count: withGoals.length, total: agents.length };
  }, [unitGoalsData]);

  const stats = useMemo(() => ({
    totalAgents: 8,
    submittedThisWeek: 5,
    pendingSubmissions: 3,
    teamYTDAPI: 384000,
    teamAPIGoal: 960000,
  }), []);

  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Manager';
  const roleLabel    = getRoleLabel(role);
  const complianceRate = Math.round((stats.submittedThisWeek / stats.totalAgents) * 100);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const handleStartMeeting = async () => {
    try {
      const [subs, userList] = await Promise.all([
        getWeeklySubmissions(selectedWeek),
        getTenantUsers().catch(() => []),
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
        getTenantUsers().catch(() => []),
        getAllYTDSubmissions().catch(() => []),
        getAllPersistencyForYear(year).catch(() => ({})),
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
          className="h-10 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Download size={16} />
          <span className="hidden md:inline">Export Branch Report</span>
        </button>
      )}
      <button
        type="button"
        onClick={handleStartMeeting}
        className="h-10 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Presentation size={16} />
        <span className="hidden md:inline">Start Meeting</span>
      </button>
    </>
  );

  return (
    <Shell
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
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
          <div>
            <div className="mb-4">
              <p className="text-ink-muted text-sm">Welcome back,</p>
              <h2 className="text-xl font-bold text-ink">{displayName}</h2>
            </div>

            {/* Motivational carousel */}
            <MotivationalCarousel
              role={role}
              submissions={[]}
              currentDate={new Date()}
            />

            <div className="card mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Team YTD API</p>
              <p className="text-3xl font-bold text-ink mb-1">{formatCurrency(stats.teamYTDAPI)}</p>
              <div className="w-full bg-surface rounded-full h-2 mb-1">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100), 100)}%` }}
                />
              </div>
              <p className="text-sm text-ink-muted">
                {Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100)}% of {formatCurrency(stats.teamAPIGoal)} goal
              </p>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <StatCard icon={Users} label="Total Agents" value={stats.totalAgents} />
              <StatCard
                icon={FileCheck} label="Reports Submitted"
                value={stats.submittedThisWeek}
                sub={`${complianceRate}% compliance`}
                accent
              />
              <StatCard
                icon={AlertCircle} label="Pending Reports"
                value={stats.pendingSubmissions}
                sub="Not yet submitted"
              />
              <StatCard
                icon={TrendingUp} label="Team API Goal"
                value={`${Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100)}%`}
                sub="YTD progress"
              />
            </div>

            <button className="btn-primary w-full" onClick={() => setShowWizard(true)}>
              Submit Weekly Report
            </button>
          </div>
        )}

        {activeTab === 'team' && <UserManagementPanel />}

        {activeTab === 'campaigns' && <CampaignPanel />}

        {activeTab === 'production-report' && <ProductionReportTab userRole={role} />}

        {activeTab === 'awards' && (
          <ManagerAwardsPanel
            agentIds={agentIds}
            currentDate={new Date()}
            role={role}
            tenantId={tenantId}
          />
        )}

        {activeTab === 'mastersheet' && (
          <MasterSheet selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'compliance' && (
          <CompliancePanel selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {activeTab === 'persistency' && <PersistencyPanel />}

        {activeTab === 'goals' && (
          <div className="flex flex-col gap-4">
            {/* Goals sub-tab bar */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
              {[
                { id: 'self', label: 'My Production' },
                { id: 'unit', label: 'My Unit'       },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setGoalsSubTab(t.id)}
                  className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
                    goalsSubTab === t.id
                      ? 'bg-[var(--color-surface)] text-primary shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* My Production */}
            {goalsSubTab === 'self' && (
              <div className="flex flex-col gap-4">
                <CommissionPlayground
                  agentId={user?.uid}
                  agentName={displayName}
                  isManagerSelf={true}
                  tenantId={tenantId}
                  submissions={[]}
                />

                {/* Personal annual target summary */}
                <div className="card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Your Personal Annual Target</p>
                  {managerGoals?.personalAnnualAPI ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-muted">Annual API</span>
                        <span className="text-sm font-semibold text-ink">{formatCurrency(parseFloat(managerGoals.personalAnnualAPI))}</span>
                      </div>
                      {parseFloat(managerGoals.personalAnnualApps) > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ink-muted">Annual Apps</span>
                          <span className="text-sm font-semibold text-ink">{Math.ceil(parseFloat(managerGoals.personalAnnualApps))}</span>
                        </div>
                      )}
                      {managerGoals.updatedAt && (
                        <p className="text-xs text-ink-muted">
                          Last updated: {managerGoals.updatedAt.toDate?.().toLocaleDateString('en-TT') ?? ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted italic">
                      No personal target set. Use the Commission Playground above to calculate and save your goals.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* My Unit */}
            {goalsSubTab === 'unit' && (
              <div className="flex flex-col gap-4">
                {/* Unit aggregate summary */}
                {unitGoalsData.agents.length > 0 && (
                  <div className="flex flex-wrap gap-6 px-4 py-3 rounded-xl bg-surface border border-border">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-ink-muted">Total Unit API Target</span>
                      <span className="text-sm font-semibold text-ink">{formatCurrency(unitAggregate.totalAPI)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-ink-muted">Avg per Advisor</span>
                      <span className="text-sm font-semibold text-ink">{formatCurrency(unitAggregate.avg)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-ink-muted">Advisors with Goals</span>
                      <span className="text-sm font-semibold text-ink">{unitAggregate.count} / {unitAggregate.total}</span>
                    </div>
                  </div>
                )}
                <GoalsPanel onGoalsLoaded={handleUnitGoalsLoaded} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'settlements' && <SettlementPanel />}

        {activeTab === 'leaderboard' && <Leaderboard />}

        {activeTab === 'profile' && <ProfileScreen />}
    </Shell>
  );
}
