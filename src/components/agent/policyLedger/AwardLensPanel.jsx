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
 * `toolbar` renders between the award card and the grouped list (mockup D1:
 * search + filter sit there). `visibleIds` narrows the grouped list to what the
 * ledger's existing filter/search shows; the totals never narrow — they are the
 * award's, not the filter's.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useLedgerTargetTier } from '../../../hooks/useLedgerTargetTier';
import { getActiveCampaignsForAgent } from '../../../services/campaignService';
import { awardLensPeriods } from '../../../utils/awardsEngine';
import { isTieredCampaign } from '../../../utils/campaignEngine';
import { deriveAwardLens } from '../../../lib/ledgerProduction';
import { awardLensSummary } from '../../../lib/awardLensView';
import { buildCampaignProofExport } from '../../../lib/policyCampaignLens';
import { buildCsvContent, downloadCsv, slugifyForFilename } from '../../../lib/csvExport';
import { getTodayTT } from '../../../utils/dateInputs';
import { DEFAULT_RULESET_2026 } from '../../../config/awardsRuleset/2026';
import { AwardSelector, AwardSummaryCard, AwardLensGroups } from './AwardLensView';

export default function AwardLensPanel({ policies, visibleIds = null, onOpen, ruleset = DEFAULT_RULESET_2026, toolbar = null }) {
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

  return (
    <div className="flex flex-col gap-3.5" data-testid="award-lens-panel">
      <AwardSelector
        current={periods.current}
        past={periods.past}
        selectedKey={selected.key}
        onSelect={setSelectedKey}
        campaignsLoading={campaignsOn && campaignsLoading}
        campaignsError={campaignsOn && campaignsError}
        onRetryCampaigns={loadCampaigns}
      />
      <AwardSummaryCard lens={lens} summary={summary} tierPicker={tierPicker} onExportProof={handleExportProof} />
      {toolbar}
      <AwardLensGroups lens={lens} visibleIds={visibleIds} onOpen={onOpen} />
    </div>
  );
}
