/**
 * ledger-l2-fixture-harness.jsx — L2 design-check FIXTURE renderer
 * (docs/briefs/ledger-lens-build.md § L2 Deliverables). NOT a src/ route —
 * dev-server-only scratch page for ledger-l2-design-check.mjs.
 *
 * Renders the REAL L2 components (LedgerFilterSort, LedgerTable,
 * LedgerExportMenu) composed the same way AwardLensPanel wires them, over the
 * SAME award-lens fixtures L1's harness uses
 * (src/lib/__tests__/fixtures/awardLensFixtures.js) — placeholder names, made-
 * up numbers only. `useAuth()` is aliased (by the design-check script's own
 * Vite server config) to a fixture double that returns `tenantId: null`, so
 * `useLedgerSavedViews` never reaches real Firestore even when "Save view" is
 * exercised in this harness.
 *
 * `?case=<id>` renders one case; no param renders all of them.
 */
/* eslint-disable react-refresh/only-export-components -- scratch harness */
import { StrictMode, useMemo, useState } from 'react';
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
import LedgerFilterSort from '../../src/components/agent/policyLedger/LedgerFilterSort.jsx';
import LedgerTable from '../../src/components/agent/policyLedger/LedgerTable.jsx';
import LedgerExportMenu from '../../src/components/agent/policyLedger/LedgerExportMenu.jsx';
import { awardLensPeriods } from '../../src/utils/awardsEngine.js';
import { deriveAwardLens } from '../../src/lib/ledgerProduction.js';
import { awardLensSummary } from '../../src/lib/awardLensView.js';
import { buildFilterSections, emptyFilterState, filterRows, sortRows, DEFAULT_SORT_KEY, footerCounts } from '../../src/lib/ledgerFilters.js';
import { formatCurrency } from '../../src/utils/formatters.js';
import { TODAY, CHRISTMAS, POLICIES } from '../../src/lib/__tests__/fixtures/awardLensFixtures.js';

const periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const find = (key) => [...periods.current, ...periods.past].find((a) => a.key === key);

function LedgerWithL2({ awardKey, policies = POLICIES, initialFilters = null, initialSort = DEFAULT_SORT_KEY }) {
  const [key, setKey] = useState(awardKey);
  const [tier, setTier] = useState(null);
  const [filters, setFilters] = useState(initialFilters ?? emptyFilterState());
  const [sortKey, setSortKey] = useState(initialSort);
  const award = find(key);
  const campaign = award.kind === 'campaign' ? award.campaign : null;
  const lens = deriveAwardLens(policies, award, { targetTierName: campaign ? tier : null });
  const summary = awardLensSummary(lens, { today: TODAY });
  const tierPicker = campaign ? { value: lens.target.tier?.name ?? null, onChange: setTier } : null;

  const sections = useMemo(() => buildFilterSections(lens.rows), [lens.rows]);
  const filtered = useMemo(() => filterRows(lens.rows, filters, sections), [lens.rows, filters, sections]);
  const sorted = useMemo(() => sortRows(filtered, sortKey), [filtered, sortKey]);
  const visibleIds = useMemo(() => new Set(sorted.map((r) => r.policy.id)), [sorted]);
  const footer = footerCounts(sorted);

  return (
    <div className="flex flex-col gap-3.5">
      <AwardSelector current={periods.current} past={periods.past} selectedKey={key} onSelect={setKey} />
      <AwardSummaryCard lens={lens} summary={summary} tierPicker={tierPicker} onExportProof={campaign ? () => {} : null} />
      <LedgerFilterSort
        rows={lens.rows}
        filters={filters}
        onFiltersChange={setFilters}
        sortKey={sortKey}
        onSortChange={setSortKey}
        hasCampaign={Boolean(campaign)}
        campaignLabel={campaign?.name}
        actions={<LedgerExportMenu rows={sorted} label={award.label} />}
      >
        <div className="lg:hidden">
          <AwardLensGroups lens={lens} visibleIds={visibleIds} onOpen={() => {}} />
        </div>
        <LedgerTable rows={sorted} sortKey={sortKey} onSort={setSortKey} onOpen={() => {}} />
        <div className="hidden items-center justify-between rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-muted lg:flex">
          <span>{footer.total} polic{footer.total === 1 ? 'y' : 'ies'} · {footer.counting} counting · {footer.pending} waiting · {footer.notCounting} not counting</span>
          <span className="font-bold text-ink">Counting {formatCurrency(footer.countingApi)}</span>
        </div>
      </LedgerFilterSort>
    </div>
  );
}

const CASES = [
  { id: 'rail-default', title: 'Desktop rail + table — campaign, no filters active', node: <LedgerWithL2 awardKey="campaign:xmas26" /> },
  {
    id: 'rail-filtered',
    title: 'Desktop rail + table — Status=Settled, Source=Head office active (chips row)',
    node: <LedgerWithL2 awardKey="campaign:xmas26" initialFilters={{ ...emptyFilterState(), status: new Set(['settled']), source: new Set(['ho']) }} />,
  },
  {
    id: 'sheet-open',
    title: 'Mobile filter sheet open (resize to 390 to see the sheet trigger + open state below)',
    node: <LedgerWithL2 awardKey="month:2026-09" />,
  },
  {
    id: 'empty-filters',
    title: 'Empty state — a filter combination that matches nothing',
    node: <LedgerWithL2 awardKey="campaign:xmas26" initialFilters={{ ...emptyFilterState(), status: new Set(['denied']) }} />,
  },
  { id: 'no-policies', title: 'Empty ledger — no policies at all', node: <LedgerWithL2 awardKey="month:2026-09" policies={[]} /> },
];

function SheetOpener({ children }) {
  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">Auto-opens the filter sheet on mount for this case (mobile viewport only shows the trigger + sheet; desktop shows the rail instead).</p>
      {children}
    </div>
  );
}

function App() {
  const only = new URLSearchParams(window.location.search).get('case');
  const shown = only ? CASES.filter((c) => c.id === only) : CASES;
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 bg-surface px-4 py-6">
      {shown.map((c) => (
        <section key={c.id} data-case={c.id} className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Local fixture — {c.title}</p>
          {c.id === 'sheet-open' ? <SheetOpener>{c.node}</SheetOpener> : c.node}
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
