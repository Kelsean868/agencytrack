import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import WorkspaceToggle from './WorkspaceToggle';
import { groupBySectionLabel } from './navSections';

/**
 * Slide-up bottom-sheet drawer giving mobile users access to sidebar-only nav items.
 * Opened from the MobileBottomNav "More" button.
 *
 * More sheet v2 (redesign-addendum §3) — the sheet is a designed surface, not a
 * flat overflow list:
 *   • Items are **grouped into labelled sections** mirroring the desktop sidebar
 *     (Shell fills section labels forward so a filtered-out section lead never
 *     orphans its section — see navSections.buildSectionMap).
 *   • Above the catalog sit two shortcut rows: **★ Pinned** (user-pinned) and an
 *     auto **Frequent** (most-visited, via useFrequentNav).
 *   • A filled primary **Done** button is pinned at the sheet bottom (thumb reach);
 *     the catalog scrolls between the header and the Done footer.
 *
 * Nav redesign PR-4: in the workspace/both layouts (producing managers) the drawer
 * hosts the My Work ⇄ My Team toggle at the top; showPinnedZone={false} hides the
 * pinned rows for the workspace layout.
 */
export default function MobileNavDrawer({
  items = [], activeTab, setActiveTab, onClose, onAction, pinnedItems = [], frequentItems = [],
  showPinnedZone = true, showWorkspaceToggle = false, workspace, onWorkspaceChange,
}) {
  const modalRef = useFocusTrap({ onEscape: onClose });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Read-only on mobile (Nav redesign PR-2 decision #7): pins render at top; no
  // star edit affordance here. Disabled pins stay non-navigable.
  const renderRow = (item, keyPrefix = '') => {
    const Icon = item.Icon;
    const isActive = item.tabId != null && activeTab === item.tabId;
    const isDisabled = item.disabled === true;
    const isChild = item.child === true;
    return (
      <button
        key={`${keyPrefix}${item.id}`}
        type="button"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          if (item.tabId != null) setActiveTab(item.tabId);
          else if (item.action != null) onAction?.(item.action);
          onClose();
        }}
        className={`w-full flex items-center gap-4 ${isChild ? 'pl-10 pr-5' : 'px-5'} min-h-[44px] text-sm font-medium motion-safe:transition-colors focus-visible:outline-none ${
          isDisabled
            ? 'text-ink-muted cursor-not-allowed'
            : isActive
              ? 'text-primary bg-primary/5'
              : 'text-ink hover:bg-card-raised focus-visible:bg-card-raised'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={isChild ? 16 : 18} />
        <span>{item.label}</span>
        {item.scope && (
          <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-card-raised text-ink-muted">
            {item.scope}
          </span>
        )}
        {isDisabled && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-card-raised text-ink-muted">
            Soon
          </span>
        )}
      </button>
    );
  };

  const sectionHeader = (label, key) => (
    <div
      key={key}
      data-testid="nav-section-header"
      className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted"
    >
      {label}
    </div>
  );

  // Group the (Shell-annotated) items into labelled sections mirroring the sidebar.
  const groups = groupBySectionLabel(items);

  return (
    <>
      {/* Backdrop — §2 sheet: fades in (paired with the sheet's spring slide).
          .sheet-backdrop is gated behind prefers-reduced-motion in index.css. */}
      <div
        className="sheet-backdrop fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="nav-drawer-backdrop"
      />

      {/* Sheet — flex column: fixed header · scrolling catalog · fixed Done footer. */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-drawer-title"
        className="mobile-nav-drawer fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl flex flex-col max-h-[85vh]"
      >
        <div className="flex-none flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h2 id="mobile-nav-drawer-title" className="text-sm font-semibold text-ink">
            More options
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-card-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* .stagger — §2 sheet "lightly staggered items"; transform-only rise,
            gated behind prefers-reduced-motion in index.css. flex-1 + scroll so a
            long catalog scrolls between the header and the Done footer. */}
        <nav className="stagger flex-1 overflow-y-auto" aria-label="More navigation options">
          {showWorkspaceToggle && typeof onWorkspaceChange === 'function' && (
            <div className="pt-2">
              <WorkspaceToggle workspace={workspace} onChange={onWorkspaceChange} idPrefix="drawer-ws" />
            </div>
          )}
          {showPinnedZone && pinnedItems.length > 0 && (
            <>
              {sectionHeader('★ Pinned', 'hdr-pinned')}
              {pinnedItems.map((item) => renderRow(item, 'pin-'))}
              <div className="mx-5 my-2 border-t border-border" aria-hidden="true" />
            </>
          )}
          {frequentItems.length > 0 && (
            <>
              {sectionHeader('Frequent', 'hdr-frequent')}
              {frequentItems.map((item) => renderRow(item, 'freq-'))}
              <div className="mx-5 my-2 border-t border-border" aria-hidden="true" />
            </>
          )}
          {groups.map((group, gi) => (
            <React.Fragment key={group.label ?? `__nolabel-${gi}`}>
              {group.label && sectionHeader(group.label, `hdr-${group.label}`)}
              {group.items.map((item) => renderRow(item))}
            </React.Fragment>
          ))}
        </nav>

        {/* Done — filled primary at thumb reach (redesign-addendum §3). Sits above
            the safe-area padding baked into .mobile-nav-drawer. */}
        <div className="flex-none px-4 pt-3 pb-1 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            data-testid="nav-drawer-done"
            className="w-full min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center justify-center transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
