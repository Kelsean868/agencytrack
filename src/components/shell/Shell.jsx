import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileBottomNav from './MobileBottomNav';

/**
 * Desktop sidebar shell + mobile bottom-nav (Design System v2 — B4).
 *
 * Wraps every dashboard. Owns:
 *   - the single <main> landmark (per the walkthrough's single-<main> invariant)
 *   - sidebar collapse state (persisted to localStorage.agencytrack-sidebar-collapsed)
 *   - topbar chrome (title, crumb, search, dark-mode toggle, notifications, sync)
 *   - bottom-nav at <768px
 *
 * Each dashboard keeps its own activeTab state and passes it through as a
 * prop pair (per locked Decision A). The shell drives setActiveTab on
 * sidebar / bottom-nav clicks; the dashboard consumes activeTab to decide
 * which tab content to render inside `children`.
 *
 * The wizard and meeting-mode overlays render BEFORE the shell in the
 * dashboard's render tree (early-return), so the shell never renders
 * over those — preserving the existing fullscreen UX.
 */
export default function Shell({
  navItems,
  bottomNavItems,
  activeTab,
  setActiveTab,
  onAction,
  userProfile,
  roleLabel,
  topbarTitle,
  topbarCrumb,
  topbarActions,
  onSignOut,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('sidebar-collapsed');
  });

  const toggleCollapse = useCallback(() => {
    const next = !document.documentElement.classList.contains('sidebar-collapsed');
    document.documentElement.classList.toggle('sidebar-collapsed', next);
    try {
      localStorage.setItem('agencytrack-sidebar-collapsed', next ? '1' : '0');
    } catch {
      /* localStorage may be unavailable (private mode); collapse still works for the session */
    }
    setCollapsed(next);
  }, []);

  return (
    <div className="shell">
      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAction={onAction}
        userProfile={userProfile}
        roleLabel={roleLabel}
        onSignOut={onSignOut}
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
      />
      <div className="shell-main">
        <TopBar
          title={topbarTitle}
          crumb={topbarCrumb}
          actions={topbarActions}
        />
        <main className="shell-content">{children}</main>
      </div>
      <MobileBottomNav
        items={bottomNavItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAction={onAction}
      />
    </div>
  );
}
