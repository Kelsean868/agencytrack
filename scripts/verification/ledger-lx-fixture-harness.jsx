/**
 * ledger-lx-fixture-harness.jsx — LX design-check FIXTURE renderer
 * (docs/briefs/ledger-layout-and-l3.md § LX). NOT a src/ route.
 *
 * Renders the REAL PolicyLedgerPanel — the whole page, in the order the app
 * renders it — not a re-composition of its parts, so the screenshot is
 * evidence of the shipped layout. The design-check script's Vite server
 * aliases AuthContext, policiesService, planCatalogService, campaignService,
 * userPrefsService, useFeatureFlag and src/firebase.js to offline doubles
 * (scripts/verification/fixtures/lx/, src/__mocks__/firebase.js), so this
 * page never reaches real Firebase. Placeholder names, made-up numbers only.
 *
 * `?case=campaign|empty|error|loading`. At `lg` a 232 px column stands in for
 * the app sidebar (as in mockup D3) so the ledger gets the same content width.
 */
/* eslint-disable react-refresh/only-export-components -- scratch harness */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import PolicyLedgerPanel from '../../src/components/agent/PolicyLedgerPanel.jsx';

(() => {
  const themeMode = localStorage.getItem('agencytrack-theme');
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else dark = localStorage.getItem('agencytrack-dark') === '1';
  document.documentElement.classList.toggle('dark', dark);
})();

// 86.6% in September against the fixture campaign's 90% December gate — the
// same record CampaignHeroCompact's tests use, so the persistency ring shows a
// real reading rather than "—".
const PERSISTENCY = [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 86_600 }];

function App() {
  const c = new URLSearchParams(window.location.search).get('case') ?? 'campaign';
  return (
    <div className="flex min-h-screen bg-surface" data-case={c}>
      <aside className="hidden w-[232px] shrink-0 border-r border-border bg-card p-4 lg:block" aria-hidden="true">
        <p className="font-mono text-[11px] uppercase text-ink-muted">App sidebar — not rendered in this fixture</p>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-3 lg:px-8 lg:py-6">
        <PolicyLedgerPanel persistency={PERSISTENCY} />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
