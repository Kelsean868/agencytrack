// Explicit React default import alongside the hooks — required for Vitest
// compatibility per banked rule; surfaced when Shell.palette.test.jsx first
// mounted Shell directly (Tier 1 · 1.1).
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileBottomNav from './MobileBottomNav';
import CommandPalette from './CommandPalette';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { buildSectionMap } from './navSections';
import useFrequentNav from '../../hooks/useFrequentNav';

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
  drawerNavItems,
  activeTab,
  setActiveTab,
  onAction,
  userProfile,
  roleLabel,
  topbarTitle,
  topbarCrumb,
  topbarActions,
  onSignOut,
  onPullRefresh,
  pinnedItems,
  isPinned,
  onPin,
  onUnpin,
  navScopeId,
  quickAddActions,
  showPinnedZone = true,
  showWorkspaceToggle = false,
  workspace,
  onWorkspaceChange,
  children,
}) {
  const mainRef = useRef(null);
  const ptrState = usePullToRefresh(mainRef, onPullRefresh ?? null);

  // Command palette (Fable Tier 1 · 1.1). Cmd/Ctrl-K toggles it; the TopBar
  // search button also opens it. Lives here so every Shell-based dashboard gets
  // it, driven by that dashboard's own navItems + quickAddActions (role-scoped).
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // More sheet v2 — annotate the (already-filtered) drawer items with their
  // resolved section label, filled forward from the FULL role nav so a
  // filtered-out section lead never orphans its section (navSections). The drawer
  // groups by this label into sidebar-mirroring sections.
  const groupedDrawerItems = useMemo(() => {
    if (!drawerNavItems) return drawerNavItems;
    const sectionMap = buildSectionMap(navItems ?? []);
    return drawerNavItems.map((item) => ({
      ...item,
      sectionLabel: sectionMap.get(item.id) ?? item.sectionLabel ?? null,
    }));
  }, [drawerNavItems, navItems]);

  // Auto **Frequent** row (redesign-addendum §3) — most-visited destinations that
  // aren't already one tap away in the bottom nav or shown in the ★ Pinned row.
  const frequentExcludeTabIds = useMemo(() => {
    const s = new Set();
    (bottomNavItems ?? []).forEach((i) => { if (i?.tabId) s.add(i.tabId); });
    (pinnedItems ?? []).forEach((i) => { if (i?.tabId) s.add(i.tabId); });
    return [...s];
  }, [bottomNavItems, pinnedItems]);

  const frequentItems = useFrequentNav({
    scopeId: navScopeId,
    activeTab,
    navItems,
    excludeTabIds: frequentExcludeTabIds,
    limit: 3,
  });

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
      {/* First focusable element on every screen — lets keyboard users bypass
          the ~20-item sidebar and jump straight to content (A11Y-103,
          WCAG 2.4.1). Visually hidden until focused (see .skip-link in index.css). */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
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
        pinnedItems={pinnedItems}
        isPinned={isPinned}
        onPin={onPin}
        onUnpin={onUnpin}
        showPinnedZone={showPinnedZone}
        showWorkspaceToggle={showWorkspaceToggle}
        workspace={workspace}
        onWorkspaceChange={onWorkspaceChange}
      />
      <div className="shell-main">
        <TopBar
          title={topbarTitle}
          crumb={topbarCrumb}
          actions={topbarActions}
          onOpenSearch={() => setPaletteOpen(true)}
        />
        <main ref={mainRef} id="main-content" tabIndex={-1} className="shell-content">
          {(ptrState === 'pulling' || ptrState === 'refreshing') && (
            <div className="flex justify-center pt-3 pb-1" aria-live="polite" aria-label="Refreshing content">
              <div
                className={`w-6 h-6 rounded-full border-2 border-primary dark:border-primary-dark border-t-transparent ${ptrState === 'refreshing' ? 'animate-spin' : 'opacity-50'}`}
                aria-hidden="true"
              />
            </div>
          )}
          {children}
        </main>
      </div>
      <MobileBottomNav
        items={bottomNavItems}
        drawerNavItems={groupedDrawerItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAction={onAction}
        pinnedItems={pinnedItems}
        frequentItems={frequentItems}
        showPinnedZone={showPinnedZone}
        showWorkspaceToggle={showWorkspaceToggle}
        workspace={workspace}
        onWorkspaceChange={onWorkspaceChange}
      />
      {paletteOpen && (
        <CommandPalette
          navItems={navItems}
          quickAddActions={quickAddActions}
          setActiveTab={setActiveTab}
          onAction={onAction}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
