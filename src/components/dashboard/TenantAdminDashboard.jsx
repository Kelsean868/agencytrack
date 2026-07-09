import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid, Building2, Users, BookOpen, Send, UserCircle, TrendingUp, AlertTriangle, Plus, Settings, CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { listBranches } from '../../services/branchService';
import { extractFields } from '../../utils/extractFields';
import { Skeleton } from '../ui/PanelSkeleton';
import Shell from '../shell/Shell';
import CompanyConfigPanel from '../admin/CompanyConfigPanel';
import ActivityStandardsPanel from '../admin/ActivityStandardsPanel';
import AwardsRulesetPanel from '../admin/AwardsRulesetPanel';
import RoleDistributionCard from '../admin/RoleDistributionCard';
import BranchHealthCards from '../admin/BranchHealthCards';
import BranchesPanel from '../admin/BranchesPanel';
import UserManagementPanel from '../manager/UserManagementPanel';
import CampaignPanel from '../campaigns/CampaignPanel';
import TeamPlannerPanel from '../planner/manager/TeamPlannerPanel';
import ProfileScreen from '../profile/ProfileScreen';
import SettingsScreen from '../settings/SettingsScreen';
import QuickAddMenu from '../shell/QuickAddMenu';
import { getQuickAddActions } from '../shell/quickAddConfig';
import useNavOrder from '../../hooks/useNavOrder';

/**
 * TenantAdminDashboard (Design System v2 — B5, TA-CLEANUP).
 *
 * Routed to from App.jsx for `role === 'tenant_admin'`. Owns the tenant-
 * admin-specific sidebar nav, mobile bottom-nav, top-bar title/crumb, and
 * tab content. Wraps everything in <Shell> (B4-shipped).
 *
 * Dashboard tab and Company Config tab are split surfaces. Dashboard =
 * stats + users-by-role + branch overview. Company Config = config card
 * only.
 *
 * TA-CLEANUP overrides B5's "stub link with Coming soon affordance"
 * decision for Roles & Permissions / Audit Log / Billing / Settings.
 * Per the manager-portal audit's "no placeholder text in production"
 * recommendation, those four items are now removed from NAV_ITEMS
 * entirely. They can be re-introduced when real surfaces ship.
 *
 * Branches: real surface (Track C C1) — routes to <BranchesPanel />.
 * Mobile: Branches and Profile are reachable via the "More" drawer
 * (v2 nav reorder) — closes the former TA-MOBILE coverage gap.
 */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',      tabId: 'dashboard', Icon: LayoutGrid, sectionLabel: 'Company' },
  { id: 'branches',  label: 'Branches',       tabId: 'branches',  Icon: Building2 },
  { id: 'users',     label: 'All Users',      tabId: 'users',     Icon: Users },
  // D3: Team Planner — read-only tenant-wide team-week coaching view (getTeamWeek
  // rank≥3 arm serves TA tenant-wide; rules `allow list` arm admits tenant_admin).
  // Desktop sidebar-only (mirrors Branches): not in BOTTOM_NAV; auto-flows into the
  // mobile More drawer via DRAWER_NAV. No write affordance (upline is read-only).
  { id: 'planner',   label: 'Team Planner',   tabId: 'planner',   Icon: CalendarClock },

  { id: 'config',    label: 'Company Config', tabId: 'config',    Icon: BookOpen,   sectionLabel: 'Configuration' },
  { id: 'campaigns', label: 'Campaigns',      tabId: 'campaigns', Icon: Send },

  { id: 'profile',   label: 'Profile',        tabId: 'profile',   Icon: UserCircle, sectionLabel: 'Account' },
];

// Mobile bottom-nav — 5-slot v2 layout: 4 tabs + auto-appended "More". Profile
// folded into the More drawer (v2 nav reorder). No FAB for tenant admin.
const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Dashboard', tabId: 'dashboard', Icon: LayoutGrid },
  { id: 'config',    label: 'Config',    tabId: 'config',    Icon: BookOpen },
  { id: 'users',     label: 'Users',     tabId: 'users',     Icon: Users },
  { id: 'campaigns', label: 'Campaigns', tabId: 'campaigns', Icon: Send },
];

// Mobile "More" drawer — every sidebar item not already in the bottom nav
// (Branches + Profile). Wiring this drawer (previously TenantAdmin passed no
// drawerNavItems, so no "More" button rendered) both folds Profile in per the v2
// nav reorder and closes the latent TA-MOBILE gap where Branches was unreachable
// on mobile. Static: derived from the two module-level constants above.
const DRAWER_NAV = [
  ...NAV_ITEMS.filter((item) => item.tabId && !BOTTOM_NAV.find((b) => b.tabId === item.tabId)),
  // Settings v2 (Tier 2 · 2.4) — mobile More-drawer entry (desktop reaches Settings
  // via the sidebar-foot gear). No sectionLabel so it joins Profile's Account group.
  { id: 'settings', label: 'Settings', tabId: 'settings', Icon: Settings },
];

function StatCard({ label, value, sub, Icon, loading }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Icon size={16} aria-hidden="true" />
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col gap-1.5" role="status" aria-label={`Loading ${label}`}>
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-ink">{value}</p>
          {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function TenantAdminDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // ★ Sidebar drag-reorder (Fable Tier 1 · 1.4) — persisted per-config order.
  const { orderIds: navOrderIds, reorder: onNavReorder } = useNavOrder({
    tenantId, uid: user?.uid, configKey: 'tenantAdmin',
  });

  // Quick-Add (Tier 1 · 1.3) — ＋ FAB fires the real create flows rather than
  // just routing to a tab. Each signal is a bump counter; BranchesPanel /
  // UserManagementPanel watch their own openCreateSignal prop (change-only,
  // initial mount skipped) and open their existing create modal.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [branchCreateSignal, setBranchCreateSignal] = useState(0);
  const [userCreateSignal, setUserCreateSignal] = useState(0);

  // Reset each create-signal back to its neutral baseline (0) right after
  // firing. BranchesPanel / UserManagementPanel mount fresh whenever their
  // tab activates (see the activeTab === 'branches' / 'users' conditionals
  // below) — a signal left non-zero would incorrectly reopen the create
  // modal on a later plain tab click. React fires child passive effects
  // before parent passive effects within the same commit, so the panel's
  // own openCreateSignal effect always observes the non-zero value first;
  // this reset lands one render later and is inert once already consumed.
  useEffect(() => {
    if (branchCreateSignal !== 0) setBranchCreateSignal(0);
  }, [branchCreateSignal]);
  useEffect(() => {
    if (userCreateSignal !== 0) setUserCreateSignal(0);
  }, [userCreateSignal]);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState(false);
  const [ytdAPI, setYtdAPI] = useState(null);
  const [ytdLoading, setYtdLoading] = useState(true);
  const [ytdError, setYtdError] = useState(false);

  // Guards setState-after-unmount without re-litigating cancellation per
  // retry — a single mount-scoped flag covers the initial load and any
  // number of manual retries.
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Load tenant users once. Shared between RoleDistributionCard,
  // BranchHealthCards, and the Active Users / Active Branches stat tiles.
  // Retry-able: extracted so the error card's Retry button re-invokes the
  // same fetch (§1 states contract — never a silent console.error swallow).
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(false);
    try {
      const u = await getTenantUsers(tenantId);
      if (isMountedRef.current) setUsers(u);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to load users:', err);
      setUsersError(true);
    } finally {
      if (isMountedRef.current) setUsersLoading(false);
    }
  }, [tenantId]);

  // Load branches once for display-name resolution in BranchHealthCards.
  const loadBranches = useCallback(async () => {
    setBranchesError(false);
    try {
      const b = await listBranches(tenantId);
      if (isMountedRef.current) setBranches(b);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to load branches:', err);
      setBranchesError(true);
    }
  }, [tenantId]);

  // Aggregate YTD API. Pure derivation from existing service — no new
  // collection or query.
  const loadYtd = useCallback(async () => {
    setYtdLoading(true);
    setYtdError(false);
    try {
      const subs = await getAllYTDSubmissions(tenantId);
      if (isMountedRef.current) {
        const total = subs.reduce((sum, s) => sum + (extractFields(s).apiSold || 0), 0);
        setYtdAPI(total);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to load YTD submissions:', err);
      setYtdError(true);
    } finally {
      if (isMountedRef.current) setYtdLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => { loadYtd(); }, [loadYtd]);

  // Retry only the fetches that actually failed — used by both the
  // full-failure error card and the partial-failure warning banner.
  const retryFailed = useCallback(() => {
    if (usersError) loadUsers();
    if (branchesError) loadBranches();
    if (ytdError) loadYtd();
  }, [usersError, branchesError, ytdError, loadUsers, loadBranches, loadYtd]);

  const failedCount = [usersError, branchesError, ytdError].filter(Boolean).length;

  const userStats = useMemo(() => {
    if (!Array.isArray(users) || users.length === 0) {
      return { active: 0, total: 0, branchCount: 0 };
    }
    const total = users.length;
    const active = users.filter((u) => u.active !== false).length;
    const branchSet = new Set();
    for (const u of users) {
      if (u.branchId) branchSet.add(u.branchId);
    }
    return { active, total, branchCount: branchSet.size };
  }, [users]);

  const displayName = userProfile?.name ?? userProfile?.email ?? 'Tenant Admin';
  const roleLabel   = getRoleLabel(role);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  // Quick-Add action dispatch (Tier 1 · 1.3). 'quick-add' opens the menu;
  // 'new-branch' / 'new-user' route to the owning tab AND bump that panel's
  // create-signal so the real create modal opens (not just tab navigation).
  const handleAction = (action) => {
    if (action === 'quick-add') {
      setShowQuickAdd(true);
    } else if (action === 'new-branch') {
      setActiveTab('branches');
      setBranchCreateSignal((n) => n + 1);
    } else if (action === 'new-user') {
      setActiveTab('users');
      setUserCreateSignal((n) => n + 1);
    }
  };

  return (
    <Shell
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
      drawerNavItems={DRAWER_NAV}
      navScopeId={user?.uid}
      navOrderIds={navOrderIds}
      onNavReorder={onNavReorder}
      quickAddActions={getQuickAddActions('tenantAdmin')}
      onAction={handleAction}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={`${roleLabel} · Tatil Life`}
      onSignOut={handleSignOut}
    >
      {/* Quick-Add ＋ FAB — create-focused (not DailyFAB's "log today" pencil).
          Visible at all viewport widths: TenantAdminDashboard's BOTTOM_NAV is a
          locked 4-tab v2 layout (existing mobile-nav-reorder tests assert its
          exact contents/order), so — unlike the producing-manager center-FAB
          bottom-nav slot — the ＋ affordance here does not swap into that array.
          Kept visible on mobile too (no `hidden md:flex`) so reachability holds
          without touching the tested bottom-nav shape. See PR description for
          the SKIP-AND-LOG on the bottom-nav-slot alternative. */}
      <button
        type="button"
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 flex items-center justify-center rounded-full bg-primary dark:bg-primary-dark text-white shadow-lg hover:bg-primary/90 dark:hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2"
        aria-label="Quick add"
        data-testid="tenant-admin-quick-add-fab"
      >
        <Plus size={22} aria-hidden="true" />
      </button>

      {showQuickAdd && (
        <QuickAddMenu
          actions={getQuickAddActions('tenantAdmin')}
          onSelect={handleAction}
          onClose={() => setShowQuickAdd(false)}
        />
      )}

      {/* ── Screen-enter (redesign-addendum §2): tab-content fades + rises 8px
          on tab navigation. Keyed on activeTab. No fixed overlays in this
          dashboard's children. Gated + degrades in index.css. */}
      <div key={activeTab} className="screen-enter">
      {activeTab === 'dashboard' && failedCount === 3 && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
          data-testid="tenant-dashboard-error"
        >
          <AlertTriangle size={28} className="text-danger-ink" aria-hidden="true" />
          <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load dashboard data — check your connection and try again.</p>
          <button
            type="button"
            onClick={retryFailed}
            className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && failedCount > 0 && failedCount < 3 && (
        <div
          role="alert"
          className="p-3 mb-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-center justify-between gap-3 flex-wrap"
          data-testid="tenant-dashboard-partial"
        >
          <span>{failedCount} of 3 data sources failed to load — showing what&apos;s available.</span>
          <button
            type="button"
            onClick={retryFailed}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && failedCount < 3 && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard
              label="Total API · YTD"
              loading={ytdLoading}
              value={ytdAPI != null ? formatCurrency(ytdAPI) : '—'}
              sub={ytdError ? 'Failed to load' : 'Across all branches, all agents'}
              Icon={TrendingUp}
            />
            <StatCard
              label="Active Users"
              loading={usersLoading}
              value={usersError ? '—' : `${userStats.active} / ${userStats.total}`}
              sub={usersError ? 'Failed to load' : `${userStats.total - userStats.active} inactive`}
              Icon={Users}
            />
            <StatCard
              label="Active Branches"
              loading={usersLoading}
              value={usersError ? '—' : `${userStats.branchCount}`}
              sub={usersError ? 'Failed to load' : (userStats.branchCount === 1 ? 'Active branch' : 'Active branches')}
              Icon={Building2}
            />
          </div>

          <div className="tenant-admin-grid-2col">
            <RoleDistributionCard users={users} loading={usersLoading} />
            <BranchHealthCards     users={users} branches={branches} loading={usersLoading} />
          </div>
        </div>
      )}

      {activeTab === 'branches' && <BranchesPanel openCreateSignal={branchCreateSignal} />}

      {activeTab === 'config' && (
        <>
          <CompanyConfigPanel />
          <ActivityStandardsPanel />
          <AwardsRulesetPanel />
        </>
      )}

      {activeTab === 'users' && <UserManagementPanel openCreateSignal={userCreateSignal} />}

      {/* ── D3: TEAM PLANNER — read-only tenant-wide team-week (rank≥3 arm) ── */}
      {activeTab === 'planner' && (
        <TeamPlannerPanel
          tenantId={tenantId}
          callerRole={role}
          uid={user?.uid}
          branchId={userProfile?.branchId ?? null}
        />
      )}

      {activeTab === 'campaigns' && <CampaignPanel />}

      {activeTab === 'profile' && <ProfileScreen />}

      {/* ── SETTINGS TAB (Tier 2 · 2.4) ── */}
      {activeTab === 'settings' && (
        <SettingsScreen
          role={role}
          roleLabel={roleLabel}
          userProfile={userProfile}
          tenantId={tenantId}
          uid={user?.uid}
          onOpenProfile={() => setActiveTab('profile')}
        />
      )}
      </div>
    </Shell>
  );
}
