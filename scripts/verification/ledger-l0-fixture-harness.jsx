/**
 * ledger-l0-fixture-harness.jsx — L0 design-check FIXTURE renderer.
 *
 * NOT a src/ route. Dev-server-only scratch page for the L0 design check
 * ritual (docs/briefs/ledger-lens-build.md § Deliverables), imported directly
 * by ledger-l0-fixture-harness.html and served by `vite` in dev mode. Renders
 * the real components (HeroCard / CampaignHeroCompact / ProgressBlock) with
 * unit-test-shaped fixtures — no live data, no client names, no real policy
 * numbers — covering the scenarios the A11Y preview agent cannot (0 settled
 * policies, no campaign): pending present, pending = 0, and pending pushing
 * the ring past 100%.
 */
/* eslint-disable react-refresh/only-export-components -- scratch harness,
   never hot-reloaded as part of the app; not a src/ route. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';

// Same no-FOUC theme bootstrap as src/main.jsx (kept inline, no import, so it
// runs before React mounts) — this harness is not served through main.jsx, so
// without this the `dark` class is never applied and setTheme()'s localStorage
// write has nothing to act on.
(() => {
  const themeMode = localStorage.getItem('agencytrack-theme');
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else dark = localStorage.getItem('agencytrack-dark') === '1';
  document.documentElement.classList.toggle('dark', dark);
})();
import HeroCard from '../../src/components/dashboard/HomeV2/HeroCard.jsx';
import CampaignHeroCompact from '../../src/components/campaigns/CampaignHeroCompact.jsx';
import { ProgressBlock } from '../../src/components/campaigns/CampaignScreenBlocks.jsx';
import { derivePolicyLens } from '../../src/lib/policyCampaignLens.js';

const CAMPAIGN = {
  id: 'fixture', name: 'Fixture Campaign', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify',
  tiers: [{ level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000 }],
};

const settledPolicy = (over) => ({
  id: 'settled', productLine: 'life', status: 'settled', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 73_946, dateIssued: '2026-08-15',
  dateSubmitted: '2026-08-01', ...over,
});
const pendingPolicy = (over) => ({
  id: 'pending', productLine: 'life', status: 'submitted', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 36_000, dateSubmitted: '2026-09-01', ...over,
});

const lensWithPending = derivePolicyLens([settledPolicy(), pendingPolicy()], CAMPAIGN, {});
const lensNoPending = derivePolicyLens([settledPolicy()], CAMPAIGN, {});
// Pending pushes the ring past 100%: settled 73,946 + pending 240,000 > 275,000 target.
const lensPastFull = derivePolicyLens(
  [settledPolicy(), pendingPolicy({ id: 'p2', proposedAPI: 240_000 })],
  CAMPAIGN,
  {},
);

const productionWithPending = {
  year: 2026,
  settled: { api: 87146.28, apps: 5, count: 5, fromHeadOffice: 5, selfConfirmed: 0 },
  submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: false, weekApi: 0 },
  pending: { api: 36000, apps: 2, count: 2 },
  weekly: { ytdApi: 30000, weekApi: 4800 },
  mismatch: { ytd: 30000 - 123146.28, week: 4800 },
};
const productionNoPending = { ...productionWithPending, pending: { api: 0, apps: 0, count: 0 } };
// Pending pushes the hero ring past 100% of a 200,000 personal goal.
const productionPastFull = { ...productionWithPending, pending: { api: 250000, apps: 4, count: 4 } };

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 12, color: '#666' }}>
        FIXTURE — {title}
      </h2>
      {children}
    </section>
  );
}

function App() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <Section title="Home hero — pending present">
        <HeroCard personalAnnualAPI={200000} onSubmit={() => {}} production={productionWithPending} />
      </Section>
      <Section title="Home hero — pending = 0 (no faint arc, no legend)">
        <HeroCard personalAnnualAPI={200000} onSubmit={() => {}} production={productionNoPending} />
      </Section>
      <Section title="Home hero — pending pushes past 100% of goal (clamped)">
        <HeroCard personalAnnualAPI={200000} onSubmit={() => {}} production={productionPastFull} />
      </Section>
      <Section title="Home campaign card — pending present">
        <CampaignHeroCompact lens={lensWithPending} daysLeft={96} gate={null} gateEnabled={false} persistency={{ value: null, label: '—', below: false, gateMonthKey: null }} onOpenDetails={() => {}} />
      </Section>
      <Section title="Home campaign card — pending = 0">
        <CampaignHeroCompact lens={lensNoPending} daysLeft={96} gate={null} gateEnabled={false} persistency={{ value: null, label: '—', below: false, gateMonthKey: null }} onOpenDetails={() => {}} />
      </Section>
      <Section title="Home campaign card — pending pushes past 100% of target (clamped)">
        <CampaignHeroCompact lens={lensPastFull} daysLeft={96} gate={null} gateEnabled={false} persistency={{ value: null, label: '—', below: false, gateMonthKey: null }} onOpenDetails={() => {}} />
      </Section>
      <Section title="Campaign screen — API + Applications rows, pending present (persistency ring unaffected)">
        <ProgressBlock lens={lensWithPending} threshold={90} persistencyDisplayPct={95} persistencyLabel="95%" persistencyBelow={false} gateMonthShort="Dec" />
      </Section>
      <Section title="Campaign screen — pending = 0">
        <ProgressBlock lens={lensNoPending} threshold={90} persistencyDisplayPct={95} persistencyLabel="95%" persistencyBelow={false} gateMonthShort="Dec" />
      </Section>
      <Section title="Campaign screen — pending pushes past 100% (clamped)">
        <ProgressBlock lens={lensPastFull} threshold={90} persistencyDisplayPct={95} persistencyLabel="95%" persistencyBelow={false} gateMonthShort="Dec" />
      </Section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
