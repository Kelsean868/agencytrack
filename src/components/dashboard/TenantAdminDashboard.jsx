import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, Building2, Users, BookOpen, Send, UserCircle, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { listBranches } from '../../services/branchService';
import { extractFields } from '../../utils/extractFields';
import Shell from '../shell/Shell';
import CompanyConfigPanel from '../admin/CompanyConfigPanel';
import ActivityStandardsPanel from '../admin/ActivityStandardsPanel';
import AwardsRulesetPanel from '../admin/AwardsRulesetPanel';
import RoleDistributionCard from '../admin/RoleDistributionCard';
import BranchHealthCards from '../admin/BranchHealthCards';
import BranchesPanel from '../admin/BranchesPanel';
import UserManagementPanel from '../manager/UserManagementPanel';
import CampaignPanel from '../campaigns/CampaignPanel';
import ProfileScreen from '../profile/ProfileScreen';

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
const DRAWER_NAV = NAV_ITEMS.filter(
  (item) => item.tabId && !BOTTOM_NAV.find((b) => b.tabId === item.tabId)
);

function StatCard({ label, value, sub, Icon }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Icon size={16} aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function TenantAdminDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [ytdAPI, setYtdAPI] = useState(null);
  const [ytdLoading, setYtdLoading] = useState(true);

  // Load tenant users once. Shared between RoleDistributionCard,
  // BranchHealthCards, and the Active Users / Active Branches stat tiles.
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    getTenantUsers(tenantId)
      .then((u) => { if (!cancelled) setUsers(u); })
      .catch((err) => { if (!cancelled) console.error('Failed to load users:', err); })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  // Load branches once for display-name resolution in BranchHealthCards.
  // Failure is non-fatal — the card falls back to humanise/Unnamed-branch.
  useEffect(() => {
    let cancelled = false;
    listBranches(tenantId)
      .then((b) => { if (!cancelled) setBranches(b); })
      .catch((err) => { if (!cancelled) console.error('Failed to load branches:', err); });
    return () => { cancelled = true; };
  }, [tenantId]);

  // Aggregate YTD API. Pure derivation from existing service — no new
  // collection or query.
  useEffect(() => {
    let cancelled = false;
    setYtdLoading(true);
    getAllYTDSubmissions(tenantId)
      .then((subs) => {
        if (cancelled) return;
        const total = subs.reduce((sum, s) => sum + (extractFields(s).apiSold || 0), 0);
        setYtdAPI(total);
      })
      .catch((err) => { if (!cancelled) console.error('Failed to load YTD submissions:', err); })
      .finally(() => { if (!cancelled) setYtdLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

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

  return (
    <Shell
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
      drawerNavItems={DRAWER_NAV}
      navScopeId={user?.uid}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={`${roleLabel} · Tatil Life`}
      onSignOut={handleSignOut}
    >
      {/* ── Screen-enter (redesign-addendum §2): tab-content fades + rises 8px
          on tab navigation. Keyed on activeTab. No fixed overlays in this
          dashboard's children. Gated + degrades in index.css. */}
      <div key={activeTab} className="screen-enter">
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard
              label="Total API · YTD"
              value={ytdLoading ? '—' : (ytdAPI != null ? formatCurrency(ytdAPI) : '—')}
              sub={ytdLoading ? 'Loading…' : 'Across all branches, all agents'}
              Icon={TrendingUp}
            />
            <StatCard
              label="Active Users"
              value={usersLoading ? '—' : `${userStats.active} / ${userStats.total}`}
              sub={usersLoading ? 'Loading…' : `${userStats.total - userStats.active} inactive`}
              Icon={Users}
            />
            <StatCard
              label="Active Branches"
              value={usersLoading ? '—' : `${userStats.branchCount}`}
              sub={usersLoading ? 'Loading…' : (userStats.branchCount === 1 ? 'Active branch' : 'Active branches')}
              Icon={Building2}
            />
          </div>

          <div className="tenant-admin-grid-2col">
            <RoleDistributionCard users={users} loading={usersLoading} />
            <BranchHealthCards     users={users} branches={branches} loading={usersLoading} />
          </div>
        </div>
      )}

      {activeTab === 'branches' && <BranchesPanel />}

      {activeTab === 'config' && (
        <>
          <CompanyConfigPanel />
          <ActivityStandardsPanel />
          <AwardsRulesetPanel />
        </>
      )}

      {activeTab === 'users' && <UserManagementPanel />}

      {activeTab === 'campaigns' && <CampaignPanel />}

      {activeTab === 'profile' && <ProfileScreen />}
      </div>
    </Shell>
  );
}
