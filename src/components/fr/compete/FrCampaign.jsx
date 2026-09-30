import React from 'react';
import CampaignScreenWithTier from '../../campaigns/CampaignScreenWithTier';
import FrCampaignView from './FrCampaignView';

/**
 * CONTAINER for the FR Campaign route (FR-5). No reads of its own: the
 * active campaigns, the UNFILTERED ledger (the same raw list the Awards tab's
 * campaign hero gets — campaign rules decide what counts) and persistency are
 * what AgentDashboard already holds.
 */
export default function FrCampaign({ activeCampaigns, campaignPolicies, ledgerError, persistency, onOpenAwards, onOpenPolicy = null }) {
  const pending = campaignPolicies == null && !ledgerError;
  const renderCampaign = (c) => (
    <CampaignScreenWithTier
      campaign={c}
      policies={campaignPolicies ?? []}
      persistencyRecords={persistency}
      loading={pending}
      error={ledgerError}
      onOpenPolicy={onOpenPolicy}
    />
  );
  return <FrCampaignView campaigns={activeCampaigns} onOpenAwards={onOpenAwards} renderCampaign={renderCampaign} />;
}
