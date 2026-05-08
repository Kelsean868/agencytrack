import { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, Building2, Users, Shield, BookOpen, Send,
  ClipboardCheck, CreditCard, Settings as SettingsIcon, UserCircle,
  TrendingUp, Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { extractFields } from '../../utils/extractFields';
import Shell from '../shell/Shell';
import CompanyConfigPanel from '../admin/CompanyConfigPanel';
import RoleDistributionCard from '../admin/RoleDistributionCard';
import BranchHealthCards from '../admin/BranchHealthCards';
import UserManagementPanel from '../manager/UserManagementPanel';
import CampaignPanel from '../campaigns/CampaignPanel';
import ProfileScreen from '../profile/ProfileScreen';

/**
 * TenantAdminDashboard (Design System v2 — B5).
 *
 * Routed to from App.jsx for `role === 'tenant_admin'`. Owns the tenant-
 * admin-specific sidebar nav, mobile bottom-nav, top-bar title/crumb, and
 * tab content. Wraps everything in <Shell> (B4-shipped).
 *
 * Per locked Q5: Dashboard tab and Company Config tab are split surfaces.
 * Dashboard = stats + users-by-role + branch overview. Company Config =
 * config card only.
 *
 * Stub items (Branches, Roles & Permissions, Audit Log, Billing, Settings)
 * render as disabled sidebar links with "Coming soon" affordance — the
 * surfaces don't exist in the codebase, and per the locked stub-vs-defer
 * matrix we don't fabricate routes to non-existent destinations.
 */
const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',           tabId: 'dashboard',  Icon: LayoutGrid,    sectionLabel: 'Company' },
  { id: 'branches',   label: 'Branches',            disabled: true,      Icon: Building2 },
  { id: 'users',      label: 'All Users',           tabId: 'users',      Icon: Users },
  { id: 'roles',      label: 'Roles & Permissions', disabled: true,      Icon: Shield },

  { id: 'config',     label: 'Company Config',      tabId: 'config',     Icon: BookOpen,      sectionLabel: 'Configuration' },
  { id: 'campaigns',  label: 'Campaigns',           tabId: 'campaigns',  Icon: Send },
  { id: 'audit',      label: 'Audit Log',           disabled: true,      Icon: ClipboardCheck },
  { id: 'billing',    label: 'Billing',             disabled: true,      Icon: CreditCard },

  { id: 'settings',   label: 'Settings',            disabled: true,      Icon: SettingsIcon,  sectionLabel: 'System' },
  { id: 'profile',    label: 'Profile',             tabId: 'profile',    Icon: UserCircle },
];

const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Dashboard', tabId: 'dashboard', Icon: LayoutGrid },
  { id: 'config',    label: 'Config',    tabId: 'config',    Icon: BookOpen },
  { id: 'users',     label: 'Users',     tabId: 'users',     Icon: Users },
  { id: 'campaigns', label: 'Campaigns', tabId: 'campaigns', Icon: Send },
  { id: 'profile',   label: 'Profile',   tabId: 'profile',   Icon: UserCircle },
];

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
  const { userProfile, role, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [ytdAPI, setYtdAPI] = useState(null);
  const [ytdLoading, setYtdLoading] = useState(true);

  // Load tenant users once. Shared between RoleDistributionCard,
  // BranchHealthCards, and the Active Users / Active Branches stat tiles.
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    getTenantUsers()
      .then((u) => { if (!cancelled) setUsers(u); })
      .catch((err) => { if (!cancelled) console.error('Failed to load users:', err); })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  // Aggregate YTD API. Pure derivation from existing service — no new
  // collection or query.
  useEffect(() => {
    let cancelled = false;
    setYtdLoading(true);
    getAllYTDSubmissions()
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
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={`${roleLabel} · Tatil Life`}
      onSignOut={handleSignOut}
    >
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              value={usersLoading ? '—' : `${userStats.branchCount} / ${userStats.branchCount}`}
              sub={usersLoading ? 'Loading…' : 'All operational'}
              Icon={Building2}
            />
            <StatCard
              label="System Health"
              value="—"
              sub="Uptime monitoring · Coming soon"
              Icon={Activity}
            />
          </div>

          <div className="tenant-admin-grid-2col">
            <RoleDistributionCard users={users} loading={usersLoading} />
            <BranchHealthCards     users={users} loading={usersLoading} />
          </div>
        </div>
      )}

      {activeTab === 'config' && <CompanyConfigPanel />}

      {activeTab === 'users' && <UserManagementPanel />}

      {activeTab === 'campaigns' && <CampaignPanel />}

      {activeTab === 'profile' && <ProfileScreen />}
    </Shell>
  );
}
