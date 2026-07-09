import React, { useState } from 'react';
import { BookOpen, UserCircle, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel } from '../../utils/formatters';
import Shell from '../shell/Shell';
import ProfileScreen from '../profile/ProfileScreen';
import SettingsScreen from '../settings/SettingsScreen';
import DeliveryRegisterPanel from '../cro/DeliveryRegisterPanel';

/**
 * CRODashboard — the Customer Relationship Officer (back-office) surface
 * (Tier-3 3.1). Routed from App.jsx for `role === 'cro'`.
 *
 * The CRO is the branch's operational hub at the ledger's point of entry. The
 * app-side scope shipped here is the Delivery Register (settled-policy delivery
 * confirmation + the 30-day clawback clock). Submissions / Settlements / Weekly
 * Report from the cro-v2 mockup are separate net-new surfaces (not in this
 * item's locked contract) and are deliberately NOT stubbed into the nav —
 * minimal honest set only.
 *
 * Reuses the Shell chrome idiom (Shell + navItems + TopBar) exactly like the
 * other dashboards; Settings is reached via the sidebar-foot gear (desktop) and
 * the More drawer (mobile), same as TenantAdminDashboard.
 */
const NAV_ITEMS = [
  { id: 'delivery', label: 'Delivery Register', tabId: 'delivery', Icon: BookOpen, sectionLabel: 'Operations' },
  { id: 'profile',  label: 'Profile',           tabId: 'profile',  Icon: UserCircle, sectionLabel: 'Account' },
];

const BOTTOM_NAV = [
  { id: 'delivery', label: 'Delivery', tabId: 'delivery', Icon: BookOpen },
  { id: 'profile',  label: 'Profile',  tabId: 'profile',  Icon: UserCircle },
];

// Mobile "More" drawer — Settings joins Profile's Account group (mirrors
// TenantAdminDashboard). Profile is already in the bottom nav, so only Settings.
const DRAWER_NAV = [
  { id: 'settings', label: 'Settings', tabId: 'settings', Icon: Settings },
];

export default function CRODashboard() {
  const { user, userProfile, role, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState('delivery');

  const displayName = userProfile?.name ?? userProfile?.email ?? 'CRO';
  const roleLabel = getRoleLabel(role);

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
      <div key={activeTab} className="screen-enter">
        {activeTab === 'delivery' && <DeliveryRegisterPanel />}

        {activeTab === 'profile' && <ProfileScreen />}

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
