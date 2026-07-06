import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import WorkspaceToggle from './WorkspaceToggle';

/**
 * Slide-up bottom-sheet drawer giving mobile users access to sidebar-only nav items.
 * Opened from the MobileBottomNav "More" button.
 *
 * Nav redesign PR-4: in the workspace/both layouts (producing managers) the drawer
 * hosts the My Work ⇄ My Team toggle at the top (parity with the desktop sidebar);
 * showPinnedZone={false} hides the pinned rows for the workspace layout.
 */
export default function MobileNavDrawer({
  items, activeTab, setActiveTab, onClose, onAction, pinnedItems = [],
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

      {/* Sheet */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-drawer-title"
        className="mobile-nav-drawer fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
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
            gated behind prefers-reduced-motion in index.css. */}
        <nav className="stagger" aria-label="More navigation options">
          {showWorkspaceToggle && typeof onWorkspaceChange === 'function' && (
            <div className="pt-2">
              <WorkspaceToggle workspace={workspace} onChange={onWorkspaceChange} idPrefix="drawer-ws" />
            </div>
          )}
          {showPinnedZone && pinnedItems.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                ★ Pinned
              </div>
              {pinnedItems.map((item) => renderRow(item, 'pin-'))}
              <div className="mx-5 my-2 border-t border-border" aria-hidden="true" />
            </>
          )}
          {items.map((item) => renderRow(item))}
        </nav>

        {/* Safe-area spacer */}
        <div className="mobile-nav-drawer-foot" />
      </div>
    </>
  );
}
