import React, { Fragment, useMemo } from 'react';
import { LogOut, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import WorkspaceToggle from './WorkspaceToggle';

/**
 * Desktop primary navigation (Design System v2 — B4).
 *
 * Mock parity: lifts the .sidebar / .sidebar-link / .sidebar-foot markup
 * from mocks/concept-4-complete.html. Renders a `<nav>` landmark labelled
 * "Primary navigation" so the walkthrough's a11y assertions pass.
 *
 * Nav items are grouped by `sectionLabel` — items without a label inherit
 * the previous section. Active highlight is driven by `activeTab`; tabId
 * items call `setActiveTab(item.tabId)`, action items call
 * `onAction(item.action)` (used for non-tab triggers like the agent's
 * Submit Report → wizard).
 *
 * ★ Pinned zone (Nav redesign PR-2): when pinning is enabled (the dashboard
 * passes `pinnedItems` + `isPinned`/`onPin`/`onUnpin`), a ★ Pinned section
 * renders above the first group (hidden when empty), and every row gets a star
 * pin/unpin toggle. Roles that pass no pinning props render exactly as before.
 *
 * The collapse toggle only changes layout at >=1024px (the tablet
 * breakpoint forces 72px regardless). At <768px the whole sidebar
 * disappears — the bottom-nav owns mobile navigation.
 */
export default function Sidebar({
  navItems,
  activeTab,
  setActiveTab,
  onAction,
  userProfile,
  roleLabel,
  onSignOut,
  collapsed,
  toggleCollapse,
  pinnedItems = [],
  isPinned,
  onPin,
  onUnpin,
  showPinnedZone = true,
  showWorkspaceToggle = false,
  workspace,
  onWorkspaceChange,
}) {
  const sections = useMemo(() => groupBySection(navItems), [navItems]);
  const canPin = typeof onPin === 'function' && typeof onUnpin === 'function';
  // ★ Pinned zone shows for `pinned` + `both` layouts (PR-2 behavior); the
  // `workspace` layout passes showPinnedZone={false} to hide it (decision #5).
  const renderPinnedZone = canPin && pinnedItems.length > 0 && showPinnedZone;

  const initials = getInitials(userProfile);
  const displayName = userProfile?.name ?? userProfile?.email ?? 'AgencyTrack User';
  const photoURL = userProfile?.photoURL ?? null;

  const renderRow = (item, inPinnedZone = false) => {
    const Icon = item.Icon;
    const isActive = item.tabId != null && activeTab === item.tabId;
    const isDisabled = item.disabled === true;
    const isChild = item.child === true;
    const pinned = canPin && typeof isPinned === 'function' ? isPinned(item.id) : false;
    // Pinned-zone rows get a distinct testid so a seeded item that ALSO appears
    // in its group doesn't render the same data-testid twice (Playwright strict
    // mode + tooling). Group rows keep the canonical nav testid.
    const testId = inPinnedZone ? `pinned-${item.id}` : (item.testId ?? `nav-${item.id}`);
    return (
      <div className="sidebar-link-row" key={inPinnedZone ? `pin-${item.id}` : item.id}>
        <button
          type="button"
          className={`sidebar-link${isChild ? ' sidebar-link-child' : ''}${isActive ? ' active' : ''}${isDisabled ? ' sidebar-link-disabled' : ''}`}
          onClick={() => {
            if (isDisabled) return;
            if (item.tabId != null) setActiveTab(item.tabId);
            else if (item.action != null) onAction?.(item.action);
          }}
          aria-current={isActive ? 'page' : undefined}
          aria-disabled={isDisabled || undefined}
          tabIndex={isDisabled ? -1 : undefined}
          title={isDisabled ? `${item.label} · Coming soon` : item.label}
          data-testid={testId}
        >
          {isChild && <span className="sidebar-link-child-connector" aria-hidden="true" />}
          <Icon size={isChild ? 15 : 17} />
          <span>{item.label}</span>
          {item.scope && (
            <span className="sidebar-link-scope" data-scope={item.scope}>
              {item.scope}
            </span>
          )}
          {isDisabled && (
            <span className="badge badge-soon" aria-label="Coming soon">Soon</span>
          )}
          {!isDisabled && item.badgeNew && (
            <span className="badge badge-new" aria-label="New">New</span>
          )}
          {!isDisabled && item.badgeCount != null && item.badgeCount > 0 && (
            <span
              className={`badge${item.badgeVariant === 'warning' ? ' badge-warning' : ''}`}
              aria-label={`${item.badgeCount} ${item.badgeCountLabel ?? 'pending'}`}
            >
              {item.badgeCount}
            </span>
          )}
        </button>
        {canPin && (
          <button
            type="button"
            className={`sidebar-nav-star${pinned ? ' sidebar-nav-star-on' : ''}`}
            aria-pressed={pinned}
            aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`}
            onClick={() => (pinned ? onUnpin(item.id) : onPin(item.id))}
          >
            <Star size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <nav aria-label="Primary navigation" className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <img
            src="/icons.svg"
            alt=""
            width="28"
            height="28"
            style={{ display: 'block', borderRadius: 7, flexShrink: 0 }}
          />
        </div>
        <div className="sidebar-brand-name">AgencyTrack</div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ★ Pinned zone — above the toggle/first group; hidden when empty or for
          the workspace layout (showPinnedZone=false). For `both` it renders
          above the My Work ⇄ My Team toggle (decision #5). */}
      {renderPinnedZone && (
        <Fragment>
          <div className="sidebar-section">★ Pinned</div>
          {pinnedItems.map((item) => renderRow(item, true))}
        </Fragment>
      )}

      {/* My Work ⇄ My Team toggle — workspace + both layouts (producing managers). */}
      {showWorkspaceToggle && typeof onWorkspaceChange === 'function' && (
        <WorkspaceToggle workspace={workspace} onChange={onWorkspaceChange} idPrefix="sidebar-ws" />
      )}

      {sections.map((section, idx) => (
        <Fragment key={section.label ?? `s${idx}`}>
          {section.label && (
            <div className="sidebar-section">{section.label}</div>
          )}
          {section.items.map((item) => renderRow(item))}
        </Fragment>
      ))}

      <div className="sidebar-foot">
        <button
          type="button"
          className="sidebar-foot-avatar"
          onClick={() => setActiveTab('profile')}
          aria-label="Open profile"
        >
          {photoURL ? <img src={photoURL} alt="" /> : initials}
        </button>
        <div className="sidebar-foot-info">
          <div className="sidebar-foot-name">{displayName}</div>
          {roleLabel && <div className="sidebar-foot-role">{roleLabel}</div>}
        </div>
        <button
          type="button"
          className="sidebar-foot-action"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}

function groupBySection(items) {
  const sections = [];
  let current = null;
  for (const item of items) {
    if (item.sectionLabel || current == null) {
      current = { label: item.sectionLabel ?? null, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }
  return sections;
}

function getInitials(profile) {
  const source = profile?.name ?? profile?.email ?? '';
  if (!source) return 'A';
  const parts = source.trim().split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
