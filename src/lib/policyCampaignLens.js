/**
 * policyCampaignLens.js — pure derivation for the Policy Ledger campaign LENS
 * shell (item 3.4, flag `policyLedgerCampaignLens`).
 *
 * Given the agent's already-loaded policies (getOwnPolicies) and one campaign,
 * classify each policy's contribution toward that campaign:
 *
 *   COUNTS   — eligible, written inside the campaign window, and settled/
 *              confirmed (its settled API is banked toward the goal).
 *   PENDING  — eligible, written inside the window, but not yet settled
 *              (will count if it settles before the campaign ends).
 *   EXCLUDED — not eligible (non-Life or self/family), closed (lapsed/ntu/
 *              denied), or written outside the campaign window.
 *
 * Only the parts that are honestly derivable from the policy + campaign docs are
 * computed. The API TARGET is taken from the campaign's top tier when the
 * campaign is tiered (2.9's ladder shape); otherwise it is null and the strip
 * renders a documented pending target. No new Firestore reads live here — pure
 * functions only (no JSX, no SDK).
 */
import { policyValue } from './policyLedgerDerivation';
import { isTieredCampaign, getDaysRemaining } from '../utils/campaignEngine';

const COUNTING_STATUSES = new Set(['settled', 'confirmed']);
const CLOSED_STATUSES = new Set(['lapsed', 'ntu', 'denied']);
const IN_FLIGHT_STATUSES = new Set(['submitted', 'rated', 'postponed']);

/** Normalize a policy/campaign date (string or Firestore Timestamp) to YYYY-MM-DD. */
function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (typeof v.toDate === 'function') {
    try { return v.toDate().toISOString().slice(0, 10); } catch { return null; }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function policyIsEligible(policy) {
  const line = policy?.productLine ?? 'life';
  if (line !== 'life') return false;      // non-Life never counts toward Tatil Life
  if (policy?.isSelfOrFamily) return false; // self/family excluded from awards/campaigns
  return true;
}

function policyDate(policy) {
  return toDateStr(policy?.dateSubmitted) ?? toDateStr(policy?.dateWritten);
}

/** Contribution of one policy toward one campaign. */
export function policyContribution(policy, campaign) {
  const start = toDateStr(campaign?.startDate);
  const end = toDateStr(campaign?.endDate);
  const pDate = policyDate(policy);
  const inWindow = Boolean(start && end && pDate && pDate >= start && pDate <= end);

  if (!policyIsEligible(policy)) {
    const line = policy?.productLine ?? 'life';
    return {
      state: 'excluded',
      reason: policy?.isSelfOrFamily ? 'Self / family — excluded' : `${line === 'life' ? 'Non-Life' : line} — excluded`,
      value: 0,
    };
  }
  if (CLOSED_STATUSES.has(policy?.status)) {
    return { state: 'excluded', reason: 'Policy lapsed / closed', value: 0 };
  }
  if (!inWindow) {
    return { state: 'excluded', reason: 'Outside campaign window', value: 0 };
  }
  if (COUNTING_STATUSES.has(policy?.status)) {
    return { state: 'counts', reason: 'Settled — counts toward goal', value: policyValue(policy) };
  }
  if (IN_FLIGHT_STATUSES.has(policy?.status)) {
    return { state: 'pending', reason: 'Awaiting settlement', value: 0 };
  }
  return { state: 'excluded', reason: 'Not counting', value: 0 };
}

/**
 * derivePolicyLens(policies, campaign, { now }) — everything the lens strip +
 * per-policy list render. Returns null when there is no campaign.
 */
export function derivePolicyLens(policies, campaign, { now = new Date() } = {}) {
  if (!campaign) return null;
  const list = Array.isArray(policies) ? policies : [];
  const contributions = {};
  let coveredCount = 0;
  let trackedCount = 0; // counts + pending (the eligible-in-window set)
  let apiCurrent = 0;

  for (const p of list) {
    const c = policyContribution(p, campaign);
    contributions[p.id] = c;
    if (c.state === 'counts') { coveredCount += 1; trackedCount += 1; apiCurrent += c.value; }
    else if (c.state === 'pending') { trackedCount += 1; }
  }

  // API target from the campaign's top tier when tiered; otherwise pending.
  let apiTarget = null;
  if (isTieredCampaign(campaign) && Array.isArray(campaign.tiers) && campaign.tiers.length) {
    apiTarget = campaign.tiers.reduce((max, t) => Math.max(max, Number(t.api) || 0), 0) || null;
  }

  const progressPct = apiTarget
    ? Math.min(100, Math.round((apiCurrent / apiTarget) * 100))
    : (trackedCount > 0 ? Math.round((coveredCount / trackedCount) * 100) : 0);

  const daysLeft = getDaysRemaining(toDateStr(campaign.endDate), now);
  let endsIn = null;
  if (daysLeft != null) {
    if (daysLeft < 0) endsIn = 'Ended';
    else if (daysLeft === 0) endsIn = 'Ends today';
    else endsIn = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  }

  return {
    campaignId: campaign.id ?? null,
    name: campaign.name ?? 'Campaign',
    kind: campaign.scope?.type ? campaign.scope.type : 'campaign',
    contributions,
    counts: { covered: coveredCount, tracked: trackedCount },
    api: { current: apiCurrent, target: apiTarget },
    targetDerived: apiTarget != null,
    progressPct,
    endsIn,
  };
}

/** Per-state counts for the lens filter chips. */
export function lensFilterCounts(contributions) {
  const vals = Object.values(contributions ?? {});
  return {
    all: vals.length,
    counts: vals.filter((c) => c.state === 'counts').length,
    pending: vals.filter((c) => c.state === 'pending').length,
    excluded: vals.filter((c) => c.state === 'excluded').length,
  };
}

export const LENS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'counts', label: 'Counts' },
  { key: 'pending', label: 'Pending' },
  { key: 'excluded', label: 'Excluded' },
];

/**
 * buildCampaignProofExport(lens, policies) — shapes the CSV row data for the
 * lens's "Export proof" control (Run-7 banked follow-up, build-map Tier-2
 * #12 residual). Pure data shaping only — no DOM/Blob side effects, so it is
 * unit-testable like the rest of this module. Exports EVERY contribution
 * (not just the currently-filtered view) so the proof reflects the full
 * picture: counts, pending, AND excluded — an honest export, not a
 * cherry-picked one. Values are raw numbers (no currency prefix) so the CSV
 * stays spreadsheet-friendly; the header row names the unit.
 */
export function buildCampaignProofExport(lens, policies) {
  if (!lens) return null;
  const policyById = Object.fromEntries((policies ?? []).map((p) => [p.id, p]));
  const headers = ['Policy Owner', 'Plan / Class', 'Qualification', 'API (TTD)'];
  const rows = Object.entries(lens.contributions ?? {}).map(([id, c]) => {
    const p = policyById[id];
    return [
      p?.ownerName || 'Policy',
      p?.planName || p?.policyClass || '—',
      c.state.toUpperCase(),
      c.value,
    ];
  });
  return { headers, rows, campaignName: lens.name };
}
