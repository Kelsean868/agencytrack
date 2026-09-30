/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useState } from 'react';
import FrSidebar from '../../shell/FrSidebar';
import FrHubHeader from '../../shell/FrHubHeader';
import { frIconComponent } from '../../shell/frIconComponent';
import { FR_TABBAR, frFlatItems, frTitleFor } from '../../shell/frNav';
import MobileBottomNav from '../../../shell/MobileBottomNav';

/**
 * FR-1 harness scene: the real FR shell pieces (FrSidebar, FrHubHeader, the
 * existing MobileBottomNav dressed by the FR CSS) around placeholder content.
 * The real TopBar is not rendered here — it needs the notification context
 * (Firebase) — so a plain header stands in for it.
 */
function ShellScene() {
  const [activeTab, setActiveTab] = useState('commission');
  const items = frFlatItems().map((i) => ({ ...i, Icon: frIconComponent(i.frIcon) }));
  const onBar = new Set(FR_TABBAR.flatMap((b) => [b.tabId, ...(b.matchTabs ?? [])]).filter(Boolean));
  const drawer = items.filter((i) => !onBar.has(i.tabId));
  const bottom = FR_TABBAR.map((i) => ({ ...i, Icon: frIconComponent(i.frIcon), ...(i.fab ? { dot: true } : {}) }));
  return (
    <div className="shell">
      <FrSidebar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onAction={() => {}}
        report={{ done: false, title: 'Weekly report', sub: 'Submit when your week is done' }}
        user={{ name: 'Kyron Marchan', roleLabel: 'Agent' }}
        onSignOut={() => {}}
      />
      <div className="shell-main">
        <header className="flex min-h-[56px] items-center border-b border-border px-6">
          <h1 className="font-display text-[20px] font-bold">{frTitleFor(activeTab)}</h1>
          <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness header</span>
        </header>
        <main className="shell-content" id="main-content">
          <FrHubHeader activeTab={activeTab} onNavigate={setActiveTab} />
          <section className="rounded-[18px] border border-border bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Route</p>
            <p className="mt-1 font-display text-[22px] font-bold" data-testid="harness-route">{activeTab}</p>
            <p className="mt-2 max-w-prose text-[14px] text-ink-muted">
              The existing screen for this route renders here in the app. Money and Numbers show their section chips above it.
            </p>
          </section>
        </main>
      </div>
      <MobileBottomNav items={bottom} drawerNavItems={drawer} activeTab={activeTab} setActiveTab={setActiveTab} onAction={() => {}} showPinnedZone={false} />
    </div>
  );
}

export const SHELL_SCENES = [
  { id: 'shell', title: 'FR shell (sidebar, hub chips, tab bar)', slice: 'FR-1', viewport: 'desktop,tablet,phone', frame: false, render: ShellScene },
];
