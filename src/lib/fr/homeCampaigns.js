import { isTieredCampaign } from '../../utils/campaignEngine';

/**
 * A campaign the compact campaign card can render — the same test HomeV2
 * applies (tiered + "qualify" structure). Shared by FR Today and the FR Money
 * Overview so both show the same campaigns.
 */
export function isHomeCampaign(c) {
  return Boolean(c) && isTieredCampaign(c) && c.structure === 'qualify';
}
