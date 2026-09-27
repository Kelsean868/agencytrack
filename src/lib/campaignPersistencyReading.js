/**
 * campaignPersistencyReading.js — the persistency ring's reading for a tiered
 * campaign card (Home's compact campaign card, mockups C1/C3; the Policy
 * Ledger's campaign card, mockups D1/D3).
 *
 * Extracted verbatim from CampaignHeroCard's compact branch so the ledger and
 * Home cannot show two different persistency figures for the same campaign.
 * The actual gate reading (`persistencyPctForGate`) wins whenever it exists;
 * only when it is still unknown does the reading fall back to the persistency
 * outlook's headline month, labelled with its own decimals so 89.6% is never
 * rounded up to a passing 90%.
 *
 * Pure. Nothing is stored.
 */
import { isTieredCampaign, normalizeGate, persistencyPctForGate } from '../utils/campaignEngine';
import { toDateStr } from './policyCampaignLens';
import { buildPersistencyOutlook, formatOutlookPct } from './persistency/persistencyOutlook';

/**
 * campaignPersistencyReading({ campaign, policies, records, today })
 *
 * @returns {null | {
 *   value: number|null,       // 0–100, null when not yet known
 *   label: string,            // "86.6%" or "—"
 *   below: boolean,           // under the campaign's gate threshold
 *   gateMonthKey: string|null, // YYYY-MM of a finalMonth gate
 *   threshold: number|null,
 * }}
 * Null when the campaign is not a tiered qualify campaign or its persistency
 * gate is switched off — the caller shows no persistency ring at all then.
 */
export function campaignPersistencyReading({ campaign, policies = [], records = [], today }) {
  if (!campaign || !isTieredCampaign(campaign) || campaign.structure !== 'qualify') return null;
  if (campaign.persistencyGateEnabled === false) return null;

  const gate = normalizeGate(campaign);
  const threshold = gate?.threshold ?? null;
  const persPct = persistencyPctForGate(records, campaign);
  const known = persPct != null;

  let preview = null;
  if (!known) {
    const { headline } = buildPersistencyOutlook({ policies, records, today });
    preview = headline && Number.isFinite(headline.persistency) ? headline : null;
  }

  const value = known ? persPct : preview ? preview.persistency * 100 : null;
  if (value == null) {
    return { value: null, label: '—', below: false, gateMonthKey: null, threshold };
  }
  const endKey = toDateStr(campaign.endDate);
  return {
    value,
    label: known ? `${persPct}%` : formatOutlookPct(preview.persistency),
    below: value < (threshold ?? 0),
    gateMonthKey: gate?.basis === 'finalMonth' && endKey ? endKey.slice(0, 7) : null,
    threshold,
  };
}
