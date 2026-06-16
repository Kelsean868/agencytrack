import { Fragment, useMemo } from 'react';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

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
}) {
  const sections = useMemo(() => groupBySection(navItems), [navItems]);

  const initials = getInitials(userProfile);
  const displayName = userProfile?.name ?? userProfile?.email ?? 'AgencyTrack User';
  const photoURL = userProfile?.photoURL ?? null;

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

      {sections.map((section, idx) => (
        <Fragment key={section.label ?? `s${idx}`}>
          {section.label && (
            <div className="sidebar-section">{section.label}</div>
          )}
          {section.items.map((item) => {
            const Icon = item.Icon;
            const isActive = item.tabId != null && activeTab === item.tabId;
            const isDisabled = item.disabled === true;
            const isChild = item.child === true;
            return (
              <button
                key={item.id}
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
                data-testid={item.testId ?? `nav-${item.id}`}
              >
                {isChild && <span className="sidebar-link-child-connector" aria-hidden="true" />}
                <Icon size={isChild ? 15 : 17} />
                <span>{item.label}</span>
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
            );
          })}
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
