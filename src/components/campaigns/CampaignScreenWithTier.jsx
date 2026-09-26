import React from 'react';
import CampaignHeroCard from './CampaignHeroCard';
import { useLedgerTargetTier } from '../../hooks/useLedgerTargetTier';

/**
 * CampaignScreenWithTier — the Campaign screen (CampaignHeroCard
 * `variant="screen"`) with the agent's "My target tier" wired in (L1). Reads
 * and writes the same pref as the Policy Ledger's campaign card, so choosing a
 * tier on either screen moves the other.
 */
export default function CampaignScreenWithTier(props) {
  const { tierName, setTierName } = useLedgerTargetTier(props.campaign?.id ?? null);
  return (
    <CampaignHeroCard
      {...props}
      variant="screen"
      targetTierName={tierName}
      onTargetTierChange={setTierName}
    />
  );
}
