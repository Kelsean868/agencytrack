/**
 * ledger-l1-fixture-harness.jsx — L1 design-check FIXTURE renderer.
 *
 * NOT a src/ route. Dev-server-only scratch page for the L1 design check
 * ritual (docs/briefs/ledger-lens-build.md § Deliverables), served by `vite`
 * in dev mode and screenshotted by ledger-l1-design-check.mjs. Renders the
 * REAL presentational components (AwardSelector / AwardSummaryCard /
 * AwardLensGroups / CampaignHeroCard screen variant) with the unit-test
 * fixtures (src/lib/__tests__/fixtures/awardLensFixtures.js) — placeholder
 * names and made-up numbers only — because the A11Y preview agent has no
 * policies and no campaign.
 *
 * `?case=<id>` renders one case; no param renders all of them.
 */
/* eslint-disable react-refresh/only-export-components -- scratch harness */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';

(() => {
  const themeMode = localStorage.getItem('agencytrack-theme');
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else dark = localStorage.getItem('agencytrack-dark') === '1';
  document.documentElement.classList.toggle('dark', dark);
})();

import { AwardSelector, AwardSummaryCard, AwardLensGroups } from '../../src/components/agent/policyLedger/AwardLensView.jsx';
import CampaignHeroCard from '../../src/components/campaigns/CampaignHeroCard.jsx';
import { awardLensPeriods } from '../../src/utils/awardsEngine.js';
import { deriveAwardLens } from '../../src/lib/ledgerProduction.js';
import { awardLensSummary } from '../../src/lib/awardLensView.js';
import { TODAY, CHRISTMAS, POLICIES } from '../../src/lib/__tests__/fixtures/awardLensFixtures.js';

const periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const find = (key) => [...periods.current, ...periods.past].find((a) => a.key === key);

function Lens({ awardKey, policies = POLICIES, groups = true, tier: initialTier = null }) {
  const [key, setKey] = useState(awardKey);
  const [tier, setTier] = useState(initialTier);
  const award = find(key);
  const lens = deriveAwardLens(policies, award, { targetTierName: award.kind === 'campaign' ? tier : null });
  const summary = awardLensSummary(lens, { today: TODAY });
  const tierPicker = award.kind === 'campaign' ? { value: lens.target.tier?.name ?? null, onChange: setTier } : null;
  return (
    <div className="flex flex-col gap-3.5">
      <AwardSelector current={periods.current} past={periods.past} selectedKey={key} onSelect={setKey} />
      <AwardSummaryCard lens={lens} summary={summary} tierPicker={tierPicker} onExportProof={award.kind === 'campaign' ? () => {} : null} />
      {groups && <AwardLensGroups lens={lens} visibleIds={null} onOpen={() => {}} />}
    </div>
  );
}

function CampaignScreenCase() {
  const [tier, setTier] = useState(null);
  return (
    <CampaignHeroCard
      variant="screen"
      campaign={CHRISTMAS}
      policies={POLICIES}
      targetTierName={tier}
      onTargetTierChange={setTier}
    />
  );
}

const CASES = [
  { id: 'campaign', title: 'Ledger — ★ campaign card (tier picker, ring, pace) + grouped list incl. HO flag, family, NTU', node: <Lens awardKey="campaign:xmas26" /> },
  { id: 'campaign-vip', title: 'Ledger — campaign card, target tier switched to VIP', node: <Lens awardKey="campaign:xmas26" tier="VIP" groups={false} /> },
  { id: 'month', title: 'Ledger — this month (ranked, Rule 10 recognition-only line)', node: <Lens awardKey="month:2026-09" groups={false} /> },
  { id: 'quarter', title: 'Ledger — this quarter (ranked, settle-by line)', node: <Lens awardKey="quarter:2026-Q3" groups={false} /> },
  { id: 'annual', title: 'Ledger — this year’s annual awards (ranked)', node: <Lens awardKey="annual:2026" groups={false} /> },
  { id: 'mdrt', title: 'Ledger — MDRT (ring, family counts) + grouped list', node: <Lens awardKey="mdrt:2026" /> },
  { id: 'closed', title: 'Ledger — closed past period (Aug 2026, final credit)', node: <Lens awardKey="month:2026-08" groups={false} /> },
  { id: 'empty', title: 'Ledger — empty states per group (no policies, Sep 2026)', node: <Lens awardKey="month:2026-09" policies={[]} /> },
  { id: 'campaign-screen', title: 'Campaign screen hero — My target tier picker', node: <CampaignScreenCase /> },
];

function App() {
  const only = new URLSearchParams(window.location.search).get('case');
  const shown = only ? CASES.filter((c) => c.id === only) : CASES;
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 bg-surface px-4 py-6">
      {shown.map((c) => (
        <section key={c.id} data-case={c.id} className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Local fixture — {c.title}</p>
          {c.node}
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
