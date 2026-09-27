/**
 * AwardLensPanel — container for the Policy Ledger's "Counts toward" award
 * lens (L1, docs/briefs/ledger-lens-build.md § L1). Replaces the campaign-only
 * CampaignLensPanel: the same lens now covers the active campaign(s), this
 * month, this quarter, this year's annual awards, MDRT and closed past periods.
 *
 * Owns: the campaign fetch (still behind the `policyLedgerCampaignLens` flag,
 * as before — flag OFF ⇒ no campaign fetch and no campaign option), the
 * selected award, and the agent's target tier (shared with the Campaign
 * screen via `useLedgerTargetTier`). Everything it shows is derived by
 * `awardLensPeriods` → `deriveAwardLens` → `awardLensSummary`.
 *
 * LX (docs/briefs/ledger-layout-and-l3.md § LX) — this container now lays out
 * the whole list page in the D1 / D3 order: `renderHeader(exportMenu)` (the
 * page header, handed the L2 export menu so Export always exports exactly the
 * filtered rows below it), then LedgerFilterSort with the selector + award
 * card as its `summary` slot. `search` / `onSearchChange` are the container's
 * one search (header on desktop, search row on mobile). `visibleIds` narrows
 * the list to that search and any hand-off filter; the totals never narrow —
 * they are the award's, not the filter's.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useLedgerTargetTier } from '../../../hooks/useLedgerTargetTier';
import { getActiveCampaignsForAgent } from '../../../services/campaignService';
import { awardLensPeriods } from '../../../utils/awardsEngine';
import { isTieredCampaign } from '../../../utils/campaignEngine';
import { deriveAwardLens, awardWindowsForPolicy } from '../../../lib/ledgerProduction';
import { awardLensSummary } from '../../../lib/awardLensView';
import { buildCampaignProofExport } from '../../../lib/policyCampaignLens';
import { buildCsvContent, downloadCsv, slugifyForFilename } from '../../../lib/csvExport';
import { getTodayTT } from '../../../utils/dateInputs';
import { campaignPersistencyReading } from '../../../lib/campaignPersistencyReading';
import { DEFAULT_RULESET_2026 } from '../../../config/awardsRuleset/2026';
import { AwardSelector, AwardSummaryCard, AwardLensGroups } from './AwardLensView';
import LedgerFilterSort from './LedgerFilterSort';
import LedgerTable from './LedgerTable';
import LedgerExportMenu from './LedgerExportMenu';
import {
  buildFilterSections,
  emptyFilterState,
  filterRows,
  sortRows,
  DEFAULT_SORT_KEY,
  footerCounts,
} from '../../../lib/ledgerFilters';
import { formatCurrency } from '../../../utils/formatters';

export default function AwardLensPanel({
  policies,
  visibleIds = null,
  onOpen,
  ruleset = DEFAULT_RULESET_2026,
  renderHeader = null,
  search = '',
  onSearchChange = () => {},
  handoffChip = null,
  persistencyRecords = null,
}) {
  const campaignsOn = useFeatureFlag('policyLedgerCampaignLens');
  const { user, userProfile, tenantId } = useAuth();
  const today = getTodayTT();

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);

  const loadCampaigns = useCallback(() => {
    if (!campaignsOn || !tenantId || !user?.uid) return;
    setCampaignsLoading(true);
    setCampaignsError(false);
    getActiveCampaignsForAgent(tenantId, user.uid, userProfile?.unitId)
      .then((rows) => setCampaigns(Array.isArray(rows) ? rows : []))
      .catch(() => setCampaignsError(true))
      .finally(() => setCampaignsLoading(false));
  }, [campaignsOn, tenantId, user?.uid, userProfile?.unitId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const periods = useMemo(
    () => awardLensPeriods({ today, ruleset, campaigns: campaignsOn ? campaigns : [], agentProfile: userProfile ?? {} }),
    [today, ruleset, campaignsOn, campaigns, userProfile],
  );

  // L3 — "Counts toward" chips (docs/briefs/ledger-lens-build.md § L3). Every
  // policy's open award windows, from the SAME engine helper the lens itself
  // reads (`awardWindowsForPolicy`) against the same `periods.current` this
  // panel already derived for the selector above — computed once here, never
  // re-derived per card. Handed to both the mobile cards (AwardLensGroups)
  // and the drill drawer (via `openWithWindows`) so they can never disagree.
  const windowsById = useMemo(() => {
    const map = new Map();
    for (const policy of policies) {
      map.set(policy.id, awardWindowsForPolicy(policy, periods.current));
    }
    return map;
  }, [policies, periods]);

  const openWithWindows = useCallback(
    (policy) => onOpen(policy, windowsById.get(policy.id) ?? []),
    [onOpen, windowsById],
  );
  // No explicit choice ⇒ the first current option: the ★ campaign once loaded,
  // otherwise this month.
  const selected = [...periods.current, ...periods.past].find((a) => a.key === selectedKey) ?? periods.current[0];
  const campaign = selected.kind === 'campaign' ? selected.campaign : null;

  const { tierName, setTierName } = useLedgerTargetTier(campaign?.id ?? null);

  const lens = useMemo(
    () => deriveAwardLens(policies, selected, { targetTierName: campaign ? tierName : null }),
    [policies, selected, campaign, tierName],
  );
  const summary = useMemo(() => awardLensSummary(lens, { today }), [lens, today]);

  const tierPicker = campaign && isTieredCampaign(campaign) && Array.isArray(campaign.tiers) && campaign.tiers.length
    ? { value: lens.target.tier?.name ?? null, onChange: setTierName }
    : null;

  // Campaign proof CSV — carried over from CampaignLensPanel so replacing it
  // loses nothing. L2 adds the ledger-wide export.
  const proof = useMemo(
    () => (lens.campaignLens ? buildCampaignProofExport(lens.campaignLens, policies) : null),
    [lens, policies],
  );
  const handleExportProof = proof?.rows?.length
    ? () => {
      const csvRows = [['Campaign', proof.campaignName], ['Generated', today], [], proof.headers, ...proof.rows];
      downloadCsv(`campaign-proof-${slugifyForFilename(proof.campaignName)}-${today}.csv`, buildCsvContent(csvRows));
    }
    : null;

  // ── L2 — filter / sort / export (docs/briefs/ledger-lens-build.md § L2) ────
  //
  // Operates on `lens.rows`, narrowed first to whatever the existing
  // search/pipeline toolbar already shows (`visibleIds`), so L2's filter
  // options and counts never include a policy the agent has already searched
  // or pipeline-filtered away. `sortRows` runs before the grouped-card view
  // (AwardLensGroups) sees the ids, so mobile/tablet inherit the same order
  // the desktop table shows, with no second sort implementation.
  const [l2Filters, setL2Filters] = useState(emptyFilterState);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);

  const searchNarrowedRows = useMemo(
    () => lens.rows.filter((r) => !visibleIds || visibleIds.has(r.policy.id)),
    [lens.rows, visibleIds],
  );
  const l2Sections = useMemo(() => buildFilterSections(searchNarrowedRows), [searchNarrowedRows]);
  const l2FilteredRows = useMemo(
    () => filterRows(searchNarrowedRows, l2Filters, l2Sections),
    [searchNarrowedRows, l2Filters, l2Sections],
  );
  const l2Rows = useMemo(() => sortRows(l2FilteredRows, sortKey), [l2FilteredRows, sortKey]);
  const l2VisibleIds = useMemo(() => new Set(l2Rows.map((r) => r.policy.id)), [l2Rows]);
  const l2Footer = useMemo(() => footerCounts(l2Rows), [l2Rows]);

  // The persistency ring on the campaign card reads the SAME derivation as
  // Home's compact campaign card. No records handed in (e.g. a manager's own
  // ledger) → null → the ring is hidden, never shown as a guessed figure.
  const persistency = useMemo(
    () => (campaign && Array.isArray(persistencyRecords)
      ? campaignPersistencyReading({ campaign, policies, records: persistencyRecords, today })
      : null),
    [campaign, persistencyRecords, policies, today],
  );

  const exportMenu = <LedgerExportMenu rows={l2Rows} label={selected?.label ?? 'ledger'} />;

  return (
    <div className="flex flex-col gap-4" data-testid="award-lens-panel">
      {/* 1 — page header (title, HO date, desktop search, Export) */}
      {renderHeader ? renderHeader(exportMenu) : null}

      {/* 2–7 — view chips, [selector + award card], mobile search row, active
          chips, then the rail + list (LX order, mockups D1 / D3). */}
      <LedgerFilterSort
        rows={searchNarrowedRows}
        filters={l2Filters}
        onFiltersChange={setL2Filters}
        sortKey={sortKey}
        onSortChange={setSortKey}
        hasCampaign={Boolean(campaign)}
        campaignLabel={campaign?.shortName ? `${campaign.shortName} campaign` : campaign?.name}
        search={search}
        onSearchChange={onSearchChange}
        handoffChip={handoffChip}
        summary={(
          <div className="flex flex-col gap-3.5">
            <AwardSelector
              current={periods.current}
              past={periods.past}
              selectedKey={selected.key}
              onSelect={setSelectedKey}
              campaignsLoading={campaignsOn && campaignsLoading}
              campaignsError={campaignsOn && campaignsError}
              onRetryCampaigns={loadCampaigns}
            />
            <AwardSummaryCard
              lens={lens}
              summary={summary}
              tierPicker={tierPicker}
              onExportProof={handleExportProof}
              persistency={persistency}
            />
          </div>
        )}
      >
        <div className="lg:hidden">
          <AwardLensGroups lens={lens} visibleIds={l2VisibleIds} onOpen={openWithWindows} windowsById={windowsById} />
        </div>
        <LedgerTable rows={l2Rows} sortKey={sortKey} onSort={setSortKey} onOpen={openWithWindows} />
        <div className="hidden items-center justify-between rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-muted lg:flex" data-testid="ledger-footer-counts">
          <span>{l2Footer.total} polic{l2Footer.total === 1 ? 'y' : 'ies'} · {l2Footer.counting} counting · {l2Footer.pending} waiting · {l2Footer.notCounting} not counting</span>
          <span className="font-bold text-ink">Counting {formatCurrency(l2Footer.countingApi)}</span>
        </div>
      </LedgerFilterSort>
    </div>
  );
}
