/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import LedgerPageHeader from '../../../agent/policyLedger/LedgerPageHeader';
import LedgerExportMenu from '../../../agent/policyLedger/LedgerExportMenu';
import LedgerTable from '../../../agent/policyLedger/LedgerTable';
import { AwardSelector, AwardSummaryCard, AwardLensGroups } from '../../../agent/policyLedger/AwardLensView';
import { awardLensPeriods } from '../../../../utils/awardsEngine';
import { deriveAwardLens } from '../../../../lib/ledgerProduction';
import { awardLensSummary } from '../../../../lib/awardLensView';
import { sortRows, footerCounts, DEFAULT_SORT_KEY, builtInViews } from '../../../../lib/ledgerFilters';
import { formatCurrency } from '../../../../utils/formatters';
import { applyLedgerFilter } from '../../../../lib/policyLedgerDerivation';

/**
 * fr-fit-any-width W-1 — the Policy ledger list page (the FR `policy-ledger`
 * route below its FR header). Kyron's two reported breaks live here: the page
 * header ("HEAD OFFICE LIST AS OF 15 SEP 2026" one word per line) and the
 * Advisor-of-the-Month card (Settled / Submitted boxes squeezed).
 *
 * The REAL page pieces render with SAMPLE policies through the REAL engines
 * (awardLensPeriods → deriveAwardLens → awardLensSummary). Two pieces are
 * harness stand-ins because their real form needs Auth/Firestore:
 *   · the page actions (Import portfolio · New Policy) — same markup and
 *     classes as PolicyLedgerPanel's `pageActions`;
 *   · LedgerFilterSort's shell — the view chips row and the 230px filter rail
 *     (its saved views read user prefs), with the same classes and widths.
 * If PolicyLedgerPanel / LedgerFilterSort change their layout, change these
 * too. Placeholder clients only, never real ones. PolicyCard imports a
 * service module for a constant, so run the harness server with
 * FR_HARNESS_STUB_FIREBASE=1 (vite.config.js).
 */
const TODAY = '2026-09-20';
const HO = { statusSource: 'oipa_import', exportDate: '2026-09-15' };
const CAMPAIGN = {
  id: 'c1', name: '[Christmas Campaign 2026]', shortName: 'Christmas', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify', credit: {},
  tiers: [{ level: 1, name: 'Champion', api: 275000, apps: 35, cash: 7000 }, { level: 2, name: 'Elite', api: 400000, apps: 50, cash: 12000 }],
};
const POLICIES = [
  { id: 's1', ownerName: '[Client A]', policyNumber: '10020031', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 73946.28, dateIssued: '2026-09-05', ...HO },
  { id: 's2', ownerName: '[Client B with a much longer name than fits on a phone row]', policyNumber: '10020187', status: 'settled', productLine: 'life', newBusinessType: 'platinum_edge', settledAPI: 12000, dateIssued: '2026-09-11', statusSource: 'agent' },
  { id: 's3', ownerName: '[Client H]', policyNumber: '10020412', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 1200, dateIssued: '2026-09-14', ...HO },
  { id: 'w1', ownerName: '[Client C]', status: 'submitted', productLine: 'life', newBusinessType: 'nb_ordinary', proposedAPI: 18500, dateWritten: '2026-09-10', dateSubmitted: '2026-09-12', statusSource: 'agent' },
  { id: 'w2', ownerName: '[Client D]', policyNumber: '10020244', status: 'submitted', productLine: 'life', newBusinessType: 'nb_ordinary', proposedAPI: 123146, dateWritten: '2026-09-02', ...HO },
  { id: 'x1', ownerName: '[Client E]', policyNumber: '10019902', status: 'lapsed', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 8400, dateIssued: '2025-11-02', ...HO },
  { id: 'x2', ownerName: '[Client F]', policyNumber: '10019655', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 15200, dateIssued: '2026-03-10', ...HO },
  { id: 'x3', ownerName: '[Client G]', policyNumber: '10020300', status: 'settled', productLine: 'life', isSelfOrFamily: true, newBusinessType: 'nb_ordinary', settledAPI: 6000, dateIssued: '2026-09-02', statusSource: 'agent' },
];

const ACTION_CLS = 'flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-full text-ink transition-colors hover:bg-surface-muted lg:rounded-xl lg:border lg:border-border lg:px-4 lg:text-sm lg:font-semibold';

function PageActions() {
  return (
    <>
      <button type="button" aria-label="Import portfolio" className={ACTION_CLS}>
        <Upload size={18} aria-hidden="true" />
        <span className="hidden lg:inline" aria-hidden="true">Import portfolio</span>
      </button>
      <button type="button" aria-label="New Policy" className={ACTION_CLS}>
        <Plus size={18} aria-hidden="true" />
        <span className="hidden lg:inline" aria-hidden="true">New Policy</span>
      </button>
    </>
  );
}

function LedgerScene({ initial }) {
  const periods = useMemo(() => awardLensPeriods({ today: TODAY, campaigns: [CAMPAIGN] }), []);
  const [selectedKey, setSelectedKey] = useState(
    () => periods.current.find((a) => a.kind === initial)?.key ?? periods.current[0].key,
  );
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('Champion');
  const selected = [...periods.current, ...periods.past].find((a) => a.key === selectedKey) ?? periods.current[0];
  const campaign = selected.kind === 'campaign' ? selected.campaign : null;
  const lens = useMemo(
    () => deriveAwardLens(POLICIES, selected, { targetTierName: campaign ? tier : null }),
    [selected, campaign, tier],
  );
  const summary = useMemo(() => awardLensSummary(lens, { today: TODAY }), [lens]);
  // The page's one search (header on desktop), through the ledger's own predicate.
  const rows = useMemo(() => {
    const visible = new Set(applyLedgerFilter(POLICIES, { search }).map((p) => p.id));
    return sortRows(lens.rows.filter((r) => visible.has(r.policy.id)), DEFAULT_SORT_KEY);
  }, [lens, search]);
  const ids = useMemo(() => new Set(rows.map((r) => r.policy.id)), [rows]);
  const footer = footerCounts(rows);
  const views = builtInViews({ hasCampaign: true, campaignLabel: 'Christmas campaign' });

  return (
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      <div className="flex flex-col gap-4">
        <LedgerPageHeader
          exportDate="2026-09-15"
          search={search}
          onSearchChange={setSearch}
          showSearch
          exportMenu={<LedgerExportMenu rows={rows} label={selected.label} />}
          actions={<PageActions />}
        />
        <div className="flex flex-col gap-3">
          {/* stand-in: LedgerFilterSort view chips */}
          <nav aria-label="Saved views" className="flex flex-wrap items-center gap-1.5 lg:gap-x-1 lg:gap-y-0 lg:border-b lg:border-border">
            {views.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-current={i === 0 ? 'page' : undefined}
                className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-border px-3 text-[13px] font-semibold text-ink lg:-mb-px lg:h-10 lg:rounded-none lg:border-0 lg:border-b-2 lg:px-3.5 lg:text-sm"
              >
                {v.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-3.5">
            <AwardSelector
              current={periods.current}
              past={periods.past}
              selectedKey={selected.key}
              onSelect={setSelectedKey}
              campaignsLoading={false}
              campaignsError={false}
              onRetryCampaigns={() => {}}
            />
            <AwardSummaryCard
              lens={lens}
              summary={summary}
              tierPicker={campaign ? { value: lens.target.tier?.name ?? null, onChange: setTier } : null}
              onExportProof={campaign ? () => {} : null}
              persistency={null}
            />
          </div>
          {/* stand-in: LedgerFilterSort rail + list row (same widths) */}
          <div className="flex items-start gap-5">
            <aside aria-label="Filters" className="hidden w-[230px] shrink-0 rounded-[18px] border border-border bg-card px-4 py-3 lg:block">
              <span className="text-sm font-bold text-ink">Filters</span>
              <p className="mt-2 text-xs text-ink-muted">Sort, status, source, product, date and API filters render here in the app.</p>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="lg:hidden">
                <AwardLensGroups lens={lens} visibleIds={ids} onOpen={() => {}} />
              </div>
              <LedgerTable rows={rows} sortKey={DEFAULT_SORT_KEY} onSort={() => {}} onOpen={() => {}} />
              <div className="hidden items-center justify-between rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-muted lg:flex">
                <span>{footer.total} policies · {footer.counting} counting · {footer.pending} waiting · {footer.notCounting} not counting</span>
                <span className="font-bold text-ink">Counting {formatCurrency(footer.countingApi)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScenePage>
  );
}

export const LEDGER_SCENES = [
  { id: 'ledger-aotm', title: 'Numbers · Policy ledger (Advisor of the Month)', slice: 'W-1', viewport: 'desktop,tablet,phone', render: () => <LedgerScene initial="month" /> },
  { id: 'ledger-campaign', title: 'Numbers · Policy ledger (campaign)', slice: 'W-1', viewport: 'desktop,tablet,phone', render: () => <LedgerScene initial="campaign" /> },
];
