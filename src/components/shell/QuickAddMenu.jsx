import React, { useEffect, useRef } from 'react';
import { COMING_SOON_TABS } from '../../config/comingSoonTabs';

/**
 * Quick-Add menu — role-aware action picker (Nav redesign PR-3).
 *
 * Desktop:  popover anchored above the DailyFAB (fixed bottom-right).
 * Mobile:   bottom sheet from the center ＋ button.
 *
 * Variant is auto-detected from window.innerWidth at render time. The parent
 * mounts this component only when the menu is open, so detection is stable.
 *
 * a11y: focus-trapped, Escape-dismiss, returns focus to trigger on close,
 * 44px targets, focus-visible rings, SOON items non-activatable (disabled).
 *
 * @param {{ actions, onSelect, onClose, todayLogged }} props
 *   actions     — from getQuickAddActions(configKey)
 *   onSelect(key) — dispatches the chosen action key to the parent handler
 *   onClose     — unmounts the menu
 *   todayLogged — drives the amber dot on the "Log today" row
 */
export default function QuickAddMenu({ actions, onSelect, onClose, todayLogged }) {
  const containerRef = useRef(null);
  const prevFocusRef = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Focus trap — focus first focusable item on mount; restore trigger on close.
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    const first = containerRef.current?.querySelector('button:not([disabled])');
    first?.focus();
    return () => { prevFocusRef.current?.focus(); };
  }, []);

  // Keyboard handler on document so jsx-a11y/no-noninteractive-element-interactions
  // is never triggered (dialog is non-interactive per the rule's role list).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        containerRef.current?.querySelectorAll('button:not([disabled])') ?? []
      );
      if (!focusable.length) return;
      e.preventDefault();
      const idx = focusable.indexOf(document.activeElement);
      const next = e.shiftKey
        ? (idx - 1 + focusable.length) % focusable.length
        : (idx + 1) % focusable.length;
      focusable[next].focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleSelect(key) {
    onSelect(key);
    onClose();
  }

  function renderAction(action) {
    const isSoon = action.soon || COMING_SOON_TABS.has(action.key);
    const showDot = action.key === 'log-today' && !todayLogged;
    const Icon = action.Icon;
    return (
      <button
        key={action.key}
        type="button"
        disabled={isSoon}
        onClick={() => { if (!isSoon) handleSelect(action.key); }}
        className={[
          'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          isSoon
            ? 'text-ink-muted opacity-50 cursor-not-allowed'
            : action.primary
              ? 'bg-primary/10 text-primary dark:bg-primary-dark/15 dark:text-primary-dark font-semibold hover:bg-primary/15 dark:hover:bg-primary-dark/20'
              : 'text-ink hover:bg-surface-raised',
        ].join(' ')}
        aria-disabled={isSoon || undefined}
        data-testid={`quickadd-${action.key}`}
      >
        <span className="relative flex-shrink-0">
          <Icon size={18} aria-hidden="true" />
          {showDot && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warning border border-bg"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="flex-1 text-sm">{action.label}</span>
        {isSoon && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted bg-surface-raised px-1.5 py-0.5 rounded">
            Soon
          </span>
        )}
      </button>
    );
  }

  let teamDividerRendered = false;

  const menuContent = (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Quick add"
      aria-modal="true"
      tabIndex={-1}
      className={[
        'bg-card border border-border rounded-xl shadow-lg p-2 flex flex-col gap-0.5',
        isMobile ? 'w-full' : 'w-60',
      ].join(' ')}
    >
      {actions.map((action) => {
        const showDivider = action.group === 'team' && !teamDividerRendered;
        if (showDivider) teamDividerRendered = true;
        return (
          <React.Fragment key={action.key}>
            {showDivider && (
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                Team
              </div>
            )}
            {renderAction(action)}
          </React.Fragment>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {menuContent}
        </div>
      </>
    );
  }

  // Desktop popover: positioned above the DailyFAB (bottom-20 + h-14 + gap).
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-36 right-4 z-50">
        {menuContent}
      </div>
    </>
  );
}
