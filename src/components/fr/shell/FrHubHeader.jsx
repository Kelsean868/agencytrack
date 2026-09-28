import React from 'react';
import { frFindByTab } from './frNav';

/**
 * FrHubHeader — the section chips for a hub (Money, Numbers). Rendered above
 * the existing screen when the active route belongs to a hub, so each
 * calculator / report keeps its own component and its own route (FR-D5:
 * wrap, don't rewrite). Horizontally scrollable on a phone.
 *
 * This is navigation (each chip is a route), so it is a <nav> with
 * aria-current — not a tablist.
 */
export default function FrHubHeader({ activeTab, onNavigate }) {
  const hit = frFindByTab(activeTab);
  if (!hit?.sub) return null;
  const { item } = hit;
  return (
    <nav aria-label={`${item.label} sections`} className="-mx-1 mb-4 overflow-x-auto px-1 pb-1" data-testid="fr-hub-header">
      <div className="flex w-max gap-1.5">
        {item.subs.map((s) => {
          const on = s.id === hit.sub.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onNavigate(s.tabId)}
              data-testid={`fr-hub-${item.id}-${s.id}`}
              className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors ${
                on ? 'bg-fr-accent text-fr-on-accent' : 'bg-fr-sunk text-ink-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
