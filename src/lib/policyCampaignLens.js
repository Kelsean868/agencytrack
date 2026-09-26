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
import { isTieredCampaign, getDaysRemaining, resolveTierProgress } from '../utils/campaignEngine';

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

  // `api` is 'full', 'none', or a FRACTION of the policy's API. The fraction
  // exists for the general production table (ledgerProduction.js), where a lump
  // sum earns 10% API; Rule 7 itself uses no fraction, so no campaign changes.
  const fraction = typeof row.api === 'number' && Number.isFinite(row.api) ? row.api : null;

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
  } else if (fraction !== null) {
    reason = `${row.label} — ${Math.round(fraction * 100)}% API credit, no application`;
  } else {
    reason = `${row.label} — no application or API credit`;
  }

  let api = 0;
  if (row.api === 'full') api = value;
  else if (fraction !== null) api = value * fraction;
  return { apps, api, reason };
}

/** Normalize a policy/campaign date (string or Firestore Timestamp) to YYYY-MM-DD. */
export function toDateStr(v) {
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
// L0 — the two-layer ring's "pending" arc. The would-be credit a pending
// policy WOULD earn if it settled today: the campaign's own credit table when
// one is declared (the settlement-window path already computes this as
// `credit`, regardless of whether the policy has actually settled), or the
// legacy 1-app/full-API rule otherwise. These are NEW fields added onto a
// 'pending' contribution — `value`/`apps`/`state` of every contribution
// (pending included) are unchanged, so no existing lens test moves.
function pendingCreditFor(policy, campaign, precomputedCredit) {
  if (precomputedCredit) return { value: precomputedCredit.api, apps: precomputedCredit.apps };
  return { value: policyValue(policy), apps: 1 };
}

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
    const pendingCredit = pendingCreditFor(policy, campaign, credit);

    if (!issued) {
      return settled
        ? { state: 'excluded', reason: 'No issue date recorded', value: 0, apps: 0 }
        : {
          state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0,
          pendingValue: pendingCredit.value, pendingApps: pendingCredit.apps,
        };
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
      return {
        state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0,
        pendingValue: pendingCredit.value, pendingApps: pendingCredit.apps,
      };
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
    const pendingCredit = pendingCreditFor(policy, campaign, null);
    return {
      state: 'pending', reason: 'Awaiting settlement', value: 0, apps: 0,
      pendingValue: pendingCredit.value, pendingApps: pendingCredit.apps,
    };
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

// ─── Rule 9 · the claw-back flag (C4, ruling R7) ─────────────────────────────
//
// Rule 9: policies lapsed, terminated or not taken within three months after the
// campaign (by March 2027) trigger a recalculation of the category and a
// claw-back of the prize. The app NEVER re-ranks and never zeroes a prize — the
// recalculation is Sales Administration’s, on Tatil’s books. This flags, so
// that nobody is surprised in March.
//
// `denied` is deliberately NOT an exit here. A denied application never went in
// force, so there is no credit to claw back.
const CLAWBACK_EXIT_STATUSES = new Set(['lapsed', 'ntu']);

/**
 * The GENUINE exit date of a policy, or null when the ledger does not carry one.
 *
 * `dateLapsed` is operator-supplied and `lapsePolicy()` REQUIRES it, so it is
 * the real-world event date — when the policy actually exited, not when somebody
 * keyed it.
 *
 * ── R7.2 — `statusAsOf` IS FORBIDDEN AS A CLAW-BACK INPUT ──────────────────
 * It is tempting: it is present on all 109 exit docs in the live tenant while
 * `dateLapsed` is present on none of them. It is also the OIPA EXPORT DATE.
 * `buildImportPlan.js` says so in its own words — "`statusAsOf` is the export
 * date, so it moves on EVERY policy" at EVERY import. Every one of those 109
 * docs reads `2026-09-15`, which is the day the export ran.
 *
 * Using it would be harmless today only by accident, because 2026-09-15 falls
 * BEFORE `endDate`. The first export to land after 31 Dec 2026 would stamp every
 * re-imported exit inside `(endDate, clawbackUntil]` at once, and an advisor
 * would be told that 87 policies lapsed in his claw-back window. Large,
 * plausible, and entirely wrong.
 *
 * Behind a correct counted-gate it would still flag nothing — but the field is
 * named and refused HERE so that a later reader looking for "the date on the
 * exit docs" cannot mistake it for one. `statusUpdatedAt` is refused for the
 * same reason: it is a serverTimestamp written at transition time, i.e. the
 * recording moment, not the event.
 */
export function genuineExitDate(policy) {
  const lapsed = toDateStr(policy?.dateLapsed);
  if (lapsed) return { date: lapsed, basis: 'event', field: 'dateLapsed' };
  // No fallback. See R7.2 above: statusAsOf and statusUpdatedAt are NOT exit
  // dates and must never be substituted to fill this gap.
  return null;
}

/**
 * The credit a policy WOULD have earned, ignoring the fact that it has since
 * exited.
 *
 * A policy that counted and then lapsed now carries `status: 'lapsed'`, so
 * `policyContribution` correctly excludes it from today’s totals. The claw-back
 * question is the opposite one: did this policy ever EARN credit? Rule 7 tests
 * issuance ("in force as at 31 Dec 2026", "issued by 31 Dec 2026"), so issuance
 * inside the window plus a non-zero credit is what "it counted" means here.
 */
function creditIfItCounted(policy, campaign) {
  if (!campaign?.credit) return null;
  if (!policyIsEligible(policy)) return null;

  const issued = toDateStr(policy?.dateIssued);
  const start = toDateStr(campaign?.startDate);
  const end = toDateStr(campaign?.endDate);
  if (!issued || !start || !end) return null;
  if (issued < start || issued > end) return null;

  const credit = creditFor(policy, campaign);
  if (!credit) return null;
  if (credit.apps === 0 && credit.api === 0) return null;

  // ── Was it SETTLED and in force as at endDate? ───────────────────────────
  //
  // Rule 7 credits policies "in force as at 31 Dec 2026". That is the whole
  // test, and it needs no reasoning about export dates or about what a future
  // import might say.
  //
  // AN EXIT ON OR BEFORE `endDate` IS A RULE 7 EXCLUSION, NOT A RULE 9
  // CLAW-BACK. The policy was simply not in force at the close, so it never
  // earned credit and there is nothing to recalculate. Only exits AFTER
  // `endDate` reach the claw-back window at all.
  //
  //   ntu                    — never taken up, so it never went in force and
  //                            never counted. No date reasoning required or
  //                            possible; an NTU has no event date ever.
  //   lapsed, on/before end  — was in force once, but not at the close.
  //                            Rule 7 exclusion.
  //   lapsed, after end      — in force at the close, so it counted. The
  //                            claw-back window test then applies.
  //   lapsed, no date        — it was in force once and we cannot tell when it
  //                            left. It counted; the caller routes it to
  //                            `clawbackUnassessable[]` rather than guessing.
  if (policy?.status === 'ntu') return null;

  const exit = genuineExitDate(policy);
  if (exit && end && exit.date <= end) return null;

  return credit;
}

/**
 * deriveClawback(policies, campaign) -> { risk[], unassessable[] }
 *
 * ── R7.1 — THE COUNTED-GATE RUNS FIRST, BEFORE ANY DATE LOGIC ──────────────
 * This ordering is the primary defence and it is not a style choice.
 *
 * Rule 9 claws back "a recalculation of the campaign category", so only a policy
 * that EARNED credit can be clawed back. The live tenant holds 109 exited
 * policies (87 lapsed, 22 ntu); exactly ONE was issued inside the campaign
 * window; three policies counted; and ZERO counted policies have exited. The 87
 * lapses sit outside 1 Jul – 31 Dec 2026 and can never be clawed back at any
 * date, because they never counted in the first place.
 *
 * A scan that reaches them has applied the DATE filter before the COUNTED
 * filter. That is the defect — not the dates. Reversing these two blocks would
 * turn an empty, correct list into 87 accusations.
 */
export function deriveClawback(policies, campaign) {
  const empty = { risk: [], unassessable: [] };
  const end = toDateStr(campaign?.endDate);
  const until = toDateStr(campaign?.clawbackUntil);
  if (!campaign?.credit || !end || !until) return empty;

  const risk = [];
  const unassessable = [];

  for (const policy of Array.isArray(policies) ? policies : []) {
    if (!policy) continue;

    // ── 1. Did it exit at all? ───────────────────────────────────────────────
    if (!CLAWBACK_EXIT_STATUSES.has(policy.status)) continue;

    // ── 2. THE COUNTED GATE (R7.1). Nothing below this line runs for a policy
    //       that never earned credit. Do not move a date test above it. ───────
    const credit = creditIfItCounted(policy, campaign);
    if (!credit) continue;

    // ── 3. Only now do dates matter. ────────────────────────────────────────
    const exit = genuineExitDate(policy);
    if (!exit) {
      // R7.3: absence is STATED, never assumed and never silently dropped.
      unassessable.push({
        id: policy.id ?? null,
        ownerName: policy.ownerName ?? null,
        status: policy.status,
        apps: credit.apps,
        api: credit.api,
        dateBasis: 'none',
        reason: policy.status === 'ntu'
          ? 'Not-taken-up date is never recorded — cannot assess, check with Sales Administration'
          : 'Exit date not recorded — cannot assess, check with Sales Administration',
      });
      continue;
    }

    if (exit.date > end && exit.date <= until) {
      risk.push({
        id: policy.id ?? null,
        ownerName: policy.ownerName ?? null,
        status: policy.status,
        apps: credit.apps,
        api: credit.api,
        exitDate: exit.date,
        dateBasis: exit.basis,
        reason: `Lapsed ${exit.date}, inside the claw-back window — Sales Admin will recalculate your level`,
      });
    }
    // Outside the window: it counted, it exited, but not in the claw-back
    // period. Nothing to say.
  }

  return { risk, unassessable };
}

/**
 * derivePolicyLens(policies, campaign, { now }) — everything the lens strip +
 * per-policy list render. Returns null when there is no campaign.
 */
export function derivePolicyLens(policies, campaign, { now = new Date(), targetTierName = null } = {}) {
  if (!campaign) return null;
  const list = Array.isArray(policies) ? policies : [];
  const contributions = {};
  let coveredCount = 0;
  let trackedCount = 0; // counts + pending (the eligible-in-window set)
  let apiCurrent = 0;
  let appsCurrent = 0;
  let pendingApi = 0;
  let pendingApps = 0;
  let pendingCount = 0;

  for (const p of list) {
    const c = policyContribution(p, campaign);
    contributions[p.id] = c;
    if (c.state === 'counts') {
      coveredCount += 1;
      trackedCount += 1;
      apiCurrent += c.value;
      appsCurrent += c.apps ?? 1;
    } else if (c.state === 'pending') {
      trackedCount += 1;
      pendingApi += c.pendingValue ?? 0;
      pendingApps += c.pendingApps ?? 0;
      pendingCount += 1;
    }
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
  // BOTH TARGETS COME FROM THE SAME TIER — AND IT IS THE LEVEL IN REACH, NOT THE
  // LADDER'S CEILING (C2 item 6, amending C3).
  //
  // Pairing the two was right: an apps figure from one level beside an API
  // figure from another reads as a single goal and is not one. But taking both
  // from the TOP tier made the denominator a level the advisor has never been
  // shown. On live data today the operator sits at TTD 73,946 — 27% of the way
  // to Champion's 275,000, the lowest level and the one that decides whether he
  // travels at all — which a ceiling-based bar renders as 9% of Pioneer's
  // 825,000. Same number, and it reads as failing rather than as a quarter of
  // the way to the thing that matters.
  //
  // So progress is measured against `tierNext`: the next rung up, which is the
  // entry level until one is cleared. At the top there is nothing above, so
  // progress is against the top tier itself and `atTop` lets the panel say so.
  // Never render a percentage against a tier the advisor cannot see.
  const tierProgress = isTieredCampaign(campaign) && Array.isArray(campaign.tiers) && campaign.tiers.length
    ? resolveTierProgress(apiCurrent, appsCurrent, campaign.tiers)
    : null;
  // L1 — "My target tier" (docs/briefs/ledger-lens-build.md § L1 item 2). When
  // the agent has chosen a tier, targets are measured against THAT tier; an
  // unknown name (a tier renamed since the choice was saved) falls back to the
  // level in reach above — never to a guess. No choice ⇒ unchanged behaviour.
  const chosenTier = tierProgress && targetTierName
    ? (campaign.tiers.find((t) => t?.name === targetTierName) ?? null)
    : null;
  const progressTier = chosenTier ?? tierProgress?.progressTarget ?? null;
  const apiTarget = (Number(progressTier?.api) || 0) || null;
  const appsTarget = (Number(progressTier?.apps) || 0) || null;

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
    // L0 — the two-layer ring's faint arc: policies in the window, would-be
    // credit if they settled today. Never touches api/apps.current above.
    pending: { api: cents(pendingApi), apps: pendingApps, count: pendingCount },
    creditTableApplied: Boolean(campaign.credit),
    exportDate: ledgerExportDate(list),
    // Rule 9 (R7). Both lists are empty on today's live data and the panel says
    // so plainly rather than rendering nothing — an absent section reads as
    // "not implemented", which is a different claim from "nothing to report".
    ...(() => {
      const { risk, unassessable } = deriveClawback(list, campaign);
      return { clawbackRisk: risk, clawbackUnassessable: unassessable };
    })(),
    // The tier pair, resolved through campaignEngine's shared helper so this
    // panel and HomeV2's CampaignCard cannot imply two different levels.
    tierReached: tierProgress?.tierReached ?? null,
    tierNext: tierProgress?.tierNext ?? null,
    atTop: tierProgress?.atTop ?? false,
    // The tier the targets above are measured against: the agent's choice when
    // one is set and still exists, otherwise the level in reach (tierNext, or
    // the top tier once reached).
    targetTier: progressTier,
    targetTierChosen: chosenTier != null,
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
