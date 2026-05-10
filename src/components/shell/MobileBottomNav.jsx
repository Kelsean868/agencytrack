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
 */
export default function MobileBottomNav({ items, activeTab, setActiveTab, onAction }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Quick navigation" className="bottom-nav">
      {items.map((item) => {
        const Icon = item.Icon;
        const isActive = item.tabId != null && activeTab === item.tabId;
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
    </nav>
  );
}
