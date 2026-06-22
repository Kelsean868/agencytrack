import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * Slide-up bottom-sheet drawer giving mobile users access to sidebar-only nav items.
 * Opened from the MobileBottomNav "More" button.
 */
export default function MobileNavDrawer({ items, activeTab, setActiveTab, onClose }) {
  const modalRef = useFocusTrap({ onEscape: onClose });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
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

        <nav aria-label="More navigation options">
          {items.map((item) => {
            const Icon = item.Icon;
            const isActive = item.tabId != null && activeTab === item.tabId;
            const isDisabled = item.disabled === true;
            const isChild = item.child === true;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  if (item.tabId != null) setActiveTab(item.tabId);
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
          })}
        </nav>

        {/* Safe-area spacer */}
        <div className="mobile-nav-drawer-foot" />
      </div>
    </>
  );
}
