import React, { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import MobileNavDrawer from './MobileNavDrawer';

/**
 * Mobile bottom-nav (Design System v2 — B4).
 *
 * Renders only at <768px (CSS @media in index.css). Mirrors the mock's
 * .bottom-nav per role (lines 2227 / 2306 / 2393 / 2477 / 2551).
 *
 * Items support two action types:
 *   - tabId: drives setActiveTab(tabId) and shows active highlight when
 *            activeTab matches.
 *   - action: drives onAction(actionName) for non-tab triggers (e.g. the
 *            agent's Submit Report → wizard).
 *
 * Touch targets are >=44px (min-height set in index.css). Active item gets
 * aria-current="page" and the .active class.
 *
 * drawerNavItems: optional list of sidebar-only items surfaced via a
 * slide-up "More" drawer. When provided, a 6th "More" button is appended.
 */
export default function MobileBottomNav({
  items, drawerNavItems, activeTab, setActiveTab, onAction, pinnedItems, frequentItems,
  showPinnedZone = true, showWorkspaceToggle = false, workspace, onWorkspaceChange,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!items || items.length === 0) return null;

  return (
    <>
      <nav aria-label="Quick navigation" className="bottom-nav">
        {items.map((item) => {
          const Icon = item.Icon;
          const isActive = item.tabId != null && activeTab === item.tabId;
          const isFab = item.fab === true;

          if (isFab) {
            return (
              <div key={item.id} className="bottom-nav-fab-wrap">
                <button
                  type="button"
                  className="bottom-nav-fab relative"
                  onClick={() => {
                    if (item.tabId != null) setActiveTab(item.tabId);
                    else if (item.action != null) onAction?.(item.action);
                  }}
                  aria-label={item.label}
                  data-testid={item.testId ?? `bottomnav-${item.id}`}
                >
                  <Plus size={24} strokeWidth={2.5} />
                  {item.dot && (
                    <span
                      className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-warning border-2 border-bg"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <span className="bottom-nav-fab-label">{item.label}</span>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              onClick={() => {
                if (item.tabId != null) setActiveTab(item.tabId);
                else if (item.action != null) onAction?.(item.action);
              }}
              aria-current={isActive ? 'page' : undefined}
              data-testid={item.testId ?? `bottomnav-${item.id}`}
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {drawerNavItems && drawerNavItems.length > 0 && (
          <button
            type="button"
            className="bottom-nav-item"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            data-testid="bottomnav-more"
          >
            <MoreHorizontal size={22} />
            <span>More</span>
          </button>
        )}
      </nav>

      {drawerOpen && drawerNavItems && (
        <MobileNavDrawer
          items={drawerNavItems}
          pinnedItems={pinnedItems}
          frequentItems={frequentItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAction={onAction}
          onClose={() => setDrawerOpen(false)}
          showPinnedZone={showPinnedZone}
          showWorkspaceToggle={showWorkspaceToggle}
          workspace={workspace}
          onWorkspaceChange={onWorkspaceChange}
        />
      )}
    </>
  );
}
