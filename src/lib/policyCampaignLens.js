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

// ─── Rule 7 · the production-credit table (C3) ───────────────────────────────
//
// Page 3 of the signed Christmas Campaign and Retreat 2026 document, verbatim:
//
//   Production Category                    Applications   API
//   Net Settled Ordinary Business          100%           100%
//   Increase PPPs >= $2,400.00             100%           100%
//   Replacements (replacing UL for WL)     0%             Difference, old → new
//   S.P.I.A.                               0%             0%
//   Lump Sums                              0%             0%
//   Platinum Edge                          100%           0%
//
// Before this table, every counting policy was worth 1 app + 100% of its API.
// A Platinum Edge policy therefore contributed its full API to a target it is
// worth nothing toward, and a replacement contributed its whole new API rather
// than the difference. Both are confident wrong numbers about money.
//
// The table is applied ONLY when `campaign.credit` is present, so every campaign
// authored before this slice keeps its previous arithmetic exactly.
export const DEFAULT_INC_PPP_APP_THRESHOLD = 2400;

export const RULE_7_CREDIT_TABLE = Object.freeze({
  nb_ordinary:   { apps: 'full', api: 'full',       label: 'Net settled ordinary business' },
  inc_ppp:       { apps: 'threshold', api: 'full',  label: 'Increase PPP' },
  replacement:   { apps: 'none', api: 'difference', label: 'Replacement' },
  spia:          { apps: 'none', api: 'none',       label: 'S.P.I.A.' },
  lumpsum:       { apps: 'none', api: 'none',       label: 'Lump sum' },
  platinum_edge: { apps: 'full', api: 'none',       label: 'Platinum Edge' },
});

/** The campaign's credit config, with the Rule 7 defaults filled in. */
function creditConfig(campaign) {
  const c = campaign?.credit;
  if (!c) return null;
  const parsed = Number(c.incPppAppThreshold);
  return {
    table: c.table ?? RULE_7_CREDIT_TABLE,
    incPppAppThreshold: Number.isFinite(parsed) ? parsed : DEFAULT_INC_PPP_APP_THRESHOLD,
  };
}

/**
 * creditFor(policy, campaign) — the applications and API one policy earns under
 * the campaign's production-credit table.
 *
 * Returns `{ apps, api, reason }`. Callers must treat an absent or unknown
 * `newBusinessType` as an ABSTENTION (0/0 with a stated reason), never as
 * ordinary business: guessing "probably ordinary" on an unclassified record
 * inflates an advisor's standing with a number nobody can defend.
 *
 * Returns null when the campaign declares no credit table, so a legacy caller
 * can fall back to its previous 1-app/full-API behaviour.
 */
export function creditFor(policy, campaign) {
  const cfg = creditConfig(campaign);
  if (!cfg) return null;

  const type = policy?.newBusinessType;
  const row = type ? cfg.table[type] : null;
  if (!row) {
    return { apps: 0, api: 0, reason: 'Unclassified new-business type' };
  }

  const value = policyValue(policy);

  if (row.api === 'difference') {
    // Rule 4: credit is the DIFFERENCE between the new API and the API of the
    // policy it replaced, and it earns no application count at all.
    //
    // When replacedPolicyAPI is absent we do NOT assume zero was replaced. Zero
    // would credit the entire new API as though nothing was given up — the most
    // generous reading of a missing field, and the one most likely to be wrong.
    const base = policy?.replacedPolicyAPI;
    if (base == null || base === '') {
      return { apps: 0, api: 0, reason: 'Replaced API not recorded' };
    }
    const baseNum = Number(base);
    if (!Number.isFinite(baseNum)) {
      return { apps: 0, api: 0, reason: 'Replaced API not recorded' };
    }
    return {
      apps: 0,
      api: Math.max(0, value - baseNum),
      reason: 'Replacement — API difference only, no application credit',
    };
  }

  let apps = 0;
  let reason;
  if (row.apps === 'full') {
    apps = 1;
    reason = row.api === 'none'
      ? `${row.label} — counts as an application, no API credit`
      : `${row.label} — full application and API credit`;
  } else if (row.apps === 'threshold') {
    const clears = value >= cfg.incPppAppThreshold;
    apps = clears ? 1 : 0;
    reason = clears
      ? `${row.label} at or above the application threshold — full credit`
      : `${row.label} below the application threshold — API credit only`;
  } else {
    reason = `${row.label} — no application or API credit`;
  }

  return { apps, api: row.api === 'full' ? value : 0, reason };
}

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

/**
 * Contribution of one policy toward one campaign.
 *
 * TWO WINDOW TESTS LIVE HERE, and which one runs depends on whether the campaign
 * declares a production-credit table.
 *
 *   No `campaign.credit` — the original SUBMISSION window (dateSubmitted ??
 *   dateWritten), 1 app and 100% API per counting policy. Unchanged.
 *
 *   With `campaign.credit` — the SETTLEMENT window (C-D10). A policy counts only
 *   when its status is settled/confirmed AND its `dateIssued` falls inside
 *   [startDate, endDate]. That is what the signed document actually tests:
 *   Rule 2 ("All applications MUST be settled by 31 Dec 2026"), Rule 7
 *   ("in force as at 31 Dec 2026") and Close of Business ("all policies must be
 *   ISSUED by 31 Dec 2026; submitted-but-not-issued does NOT count").
 *
 * ELIGIBILITY IS NEVER DECIDED BY `importSource` (C-D10). PR #948 filtered
 * imported policies out of the campaign lens to stop a historical book earning
 * credit retroactively. The intent was right; the mechanism was wrong. The live
 * ledger query on 20 Sep 2026 found 229 policy docs, ALL of them imported and
 * none organic — so the origin filter hid 100% of the operator's campaign
 * production and the lens rendered TTD 0 against a real 3 apps / TTD 73,946.28.
 * That is the same class of defect as the ×0 multiplier fixed in #871: a
 * confident wrong number about money.
 *
 * The date window answers #948's actual risk completely. An imported policy
 * issued 15 Aug 2026 and in force counts; one issued in 2019 does not — because
 * of its DATE, not its origin. Origin was only ever a proxy for age; the date is
 * the thing itself. `excludeImported` remains in force, unchanged, for every
 * other aggregating reader.
 */
export function policyContribution(policy, campaign) {
  const start = toDateStr(campaign?.startDate);
  const end = toDateStr(campaign?.endDate);
  const credit = campaign?.credit ? creditFor(policy, campaign) : null;

  if (!policyIsEligible(policy)) {
    const line = policy?.productLine ?? 'life';
    return {
      state: 'excluded',
      reason: policy?.isSelfOrFamily ? 'Self / family — excluded' : `${line === 'life' ? 'Non-Life' : line} — excluded`,
      value: 0,
      apps: 0,
    };
  }
  if (CLOSED_STATUSES.has(policy?.status)) {
    return { state: 'excluded', reason: 'Policy lapsed / closed', value: 0, apps: 0 };
  }

  // ── Settlement-window path (campaign declares a credit table) ──────────────
  if (credit) {
    const issued = toDateStr(policy?.dateIssued);
    const settled = COUNTING_STATUSES.has(policy?.status);

    if (!issued) {
      return settled
        ? { state: 'excluded', reason: 'No issue date recorded', value: 0, apps: 0 }
        : { state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0 };
    }
    if (start && issued < start) {
      return { state: 'excluded', reason: 'Issued before the campaign', value: 0, apps: 0 };
    }
    if (end && issued > end) {
      return { state: 'excluded', reason: 'Issued after cut-off', value: 0, apps: 0 };
    }
    if (!settled) {
      // The pending bucket keeps its present meaning: in the window, but the
      // money is not banked yet.
      return { state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0 };
    }
    if (credit.apps === 0 && credit.api === 0) {
      return { state: 'excluded', reason: credit.reason, value: 0, apps: 0 };
    }
    return { state: 'counts', reason: credit.reason, value: credit.api, apps: credit.apps };
  }

  // ── Legacy submission-window path — untouched ──────────────────────────────
  const pDate = policyDate(policy);
  const inWindow = Boolean(start && end && pDate && pDate >= start && pDate <= end);
  if (!inWindow) {
    return { state: 'excluded', reason: 'Outside campaign window', value: 0, apps: 0 };
  }
  if (COUNTING_STATUSES.has(policy?.status)) {
    return { state: 'counts', reason: 'Settled — counts toward goal', value: policyValue(policy), apps: 1 };
  }
  if (IN_FLIGHT_STATUSES.has(policy?.status)) {
    return { state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0 };
  }
  return { state: 'excluded', reason: 'Not counting', value: 0, apps: 0 };
}

/**
 * The portfolio export date the lens is standing on (C-D11).
 *
 * Read off the policy docs themselves rather than configured, so the lens can
 * never claim a date the data does not carry — the same provenance the
 * persistency card already reads. Newest wins when a ledger holds two.
 *
 * This matters more here than it looks. On the operator's tenant the ledger
 * holds ZERO organic policies and nothing in flight, so the campaign figure is
 * a snapshot, not a live feed: business sold after the export simply does not
 * exist in it. A campaign figure shown without its as-at date invites the
 * advisor to read a stale number as current, and to conclude they are further
 * from Champion than they are — or closer.
 */
export function ledgerExportDate(policies) {
  const list = Array.isArray(policies) ? policies : [];
  const dates = [...new Set(list.map((p) => p?.exportDate).filter(Boolean))].sort();
  return dates.length ? dates[dates.length - 1] : null;
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
  let appsCurrent = 0;

  for (const p of list) {
    const c = policyContribution(p, campaign);
    contributions[p.id] = c;
    if (c.state === 'counts') {
      coveredCount += 1;
      trackedCount += 1;
      apiCurrent += c.value;
      appsCurrent += c.apps ?? 1;
    } else if (c.state === 'pending') { trackedCount += 1; }
  }

  // API target from the campaign's top tier when tiered; otherwise pending.
  //
  // APPS AND API ARE SUMMED AND SHOWN SEPARATELY, and that is not cosmetic. On
  // the operator's live ledger the three counted policies average TTD 24,649 of
  // API each while the lowest level (Champion) needs an average of 7,857 across
  // 35 applications — so APPLICATIONS, not API, are the binding constraint. A
  // surface leading with an API bar alone points the advisor at the wrong
  // number. The apps target is the tier's, not a derived figure.
  //
  // BOTH TARGETS COME FROM THE SAME TIER. Pairing an apps figure from one level
  // with an API figure from another reads as a single goal and is not one — the
  // advisor sees "3 of 35 apps" beside "73,946 of 825,000" and has no way to
  // know those belong to different prizes. The top tier is the ladder's ceiling
  // and is what `apiTarget` has always been, so apps is taken from it too.
  let apiTarget = null;
  let appsTarget = null;
  if (isTieredCampaign(campaign) && Array.isArray(campaign.tiers) && campaign.tiers.length) {
    const topTier = campaign.tiers.reduce(
      (best, t) => ((Number(t.api) || 0) > (Number(best?.api) || 0) ? t : best),
      campaign.tiers[0],
    );
    apiTarget = (Number(topTier?.api) || 0) || null;
    appsTarget = (Number(topTier?.apps) || 0) || null;
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
    apps: { current: appsCurrent, target: appsTarget },
    creditTableApplied: Boolean(campaign.credit),
    exportDate: ledgerExportDate(list),
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
