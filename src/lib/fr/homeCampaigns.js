import { isTieredCampaign } from '../../utils/campaignEngine';
import { outlookGateFor } from '../persistency/persistencyOutlook';

/**
 * A campaign the compact campaign card can render — the same test HomeV2
 * applies (tiered + "qualify" structure). Shared by FR Today and the FR Money
 * Overview so both show the same campaigns.
 */
export function isHomeCampaign(c) {
  return Boolean(c) && isTieredCampaign(c) && c.structure === 'qualify';
}

/**
 * The persistency gate the FR screens plan against: the first Home campaign
 * with a gate (outlookGateFor), else null (then the current month at 90%).
 * One rule for Money, Focus · Win-back and the Ledger lens.
 */
export function campaignGate(activeCampaigns) {
  const c = (Array.isArray(activeCampaigns) ? activeCampaigns : []).filter(isHomeCampaign).find((x) => outlookGateFor(x));
  return c ? outlookGateFor(c) : null;
}
