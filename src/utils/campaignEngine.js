import { extractFields } from './extractFields';
import { aggregatePersistency } from '../lib/persistency/calculations';

const METRIC_LABELS = {
  apiSold:          'API',
  applicationsSold: 'Apps',
  ffiConducted:     'FFIs',
  ciConducted:      'CIs',
};

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns v2 — prize tiers · placement · persistency gate · projected payouts
//
// DISPLAY / DERIVATION ONLY. Nothing here writes, commits, or releases a payout.
// Projected amounts are what an advisor WOULD win at their current standing —
// never a commitment record. The AwardWinners "Confirm & release" close-flow
// from the mockup is intentionally NOT implemented.
// ─────────────────────────────────────────────────────────────────────────────

// The persistency gate — one source of truth, lifted from the real Christmas
// Campaign doc (campaigns-v2-shared.jsx). A tiered multiplier scaling every
// projected payout by the advisor's average persistency for the period.
//   `min` is an inclusive persistency PERCENTAGE floor (0–100).
//   `payout` is the multiplier applied to the tier/placement prize.
// Operator-tunable: edit these bands to retune the gate. Ordered high → low.
export const PERSISTENCY_GATE_BANDS = [
  { min: 90, payout: 1.0,  label: '100%', tone: 'success' },
  { min: 85, payout: 0.5,  label: '50%',  tone: 'gold'    },
  { min: 80, payout: 0.25, label: '25%',  tone: 'warning' },
  { min: 0,  payout: 0,    label: 'DQ',   tone: 'danger'  },
];

// Human-readable range labels aligned 1:1 with PERSISTENCY_GATE_BANDS order.
export const GATE_BAND_RANGE_LABELS = ['≥90%', '85–89%', '80–84%', '<80%'];

// ── The per-campaign gate contract (C-D1) ──────────────────────────────
//
// Last year's campaign graded persistency on four bands. The Christmas Campaign
// and Retreat 2026 does not: Rule 5 of the signed document has exactly two rows
// — ≥90% pays 100% of the prize, <90% is Disqualified. There is no 85–89 half
// band and no sliding scale.
//
// Rewriting PERSISTENCY_GATE_BANDS to match would silently re-grade every
// campaign still open on last year's rules, so the gate becomes PER-CAMPAIGN
// CONFIG instead, and a campaign that declares nothing keeps today's behaviour
// byte-for-byte.
//
//   campaign.persistencyGate = { mode, threshold, basis }
//     mode      'bands'  — today's four-band multiplier ladder (default)
//               'binary' — one cliff at `threshold`: 100% or DQ, nothing between
//     threshold inclusive percentage floor for binary mode (default 90)
//     basis     'periodAggregate' — SUM-aggregate across the campaign months
//                                   (default; what every campaign did before)
//               'finalMonth'      — the single record at the campaign's end month
//
// Absent → { mode: 'bands', threshold: 90, basis: 'periodAggregate' }.
export const DEFAULT_PERSISTENCY_GATE = Object.freeze({
  mode: 'bands',
  threshold: 90,
  basis: 'periodAggregate',
});

// The ONE place a campaign doc is turned into a resolved gate. Every consumer
// resolves through this — never by reading `campaign.persistencyGate` directly,
// because a consumer that reads the raw field misses the defaults and lands a
// legacy campaign on a different multiplier than the surface next door.
export function normalizeGate(campaign) {
  const raw = campaign?.persistencyGate;
  const mode = raw?.mode === 'binary' ? 'binary' : 'bands';
  const basis = raw?.basis === 'finalMonth' ? 'finalMonth' : 'periodAggregate';
  const parsed = Number(raw?.threshold);
  const threshold = Number.isFinite(parsed) ? parsed : DEFAULT_PERSISTENCY_GATE.threshold;
  return { mode, threshold, basis };
}

// The two rows of a binary gate, shaped exactly like a PERSISTENCY_GATE_BANDS
// entry so every band-rendering surface takes them without a second code path.
export function binaryGateBands(gate) {
  const threshold = normalizeGate({ persistencyGate: gate }).threshold;
  return [
    { min: threshold, payout: 1, label: '100%', tone: 'success' },
    { min: 0,         payout: 0, label: 'DQ',   tone: 'danger'  },
  ];
}

// The band ladder for a resolved gate — four rows for `bands`, two for `binary`.
export function gateBands(gate) {
  const g = gate ?? DEFAULT_PERSISTENCY_GATE;
  return g.mode === 'binary' ? binaryGateBands(g) : PERSISTENCY_GATE_BANDS;
}

// Range labels for a resolved gate, aligned 1:1 with gateBands(gate).
//
// GATE_BAND_RANGE_LABELS stays exported as the four-row constant: the company
// config parity test indexes it (`GATE_BAND_RANGE_LABELS[i]`) to pin the four
// rec.gate.* rows, so it must remain an array.
export function gateBandRangeLabels(gate) {
  const g = gate ?? DEFAULT_PERSISTENCY_GATE;
  return g.mode === 'binary'
    ? [`≥${g.threshold}%`, `<${g.threshold}%`]
    : GATE_BAND_RANGE_LABELS;
}

// Resolve a persistency percentage (0–100) to its gate band. Returns null when
// persistency is unknown (no persistency record on file) so the UI can render a
// "no data" pill rather than silently disqualifying an advisor.
//
// `gate` is optional: omitted → the four-band default, i.e. every pre-existing
// call site keeps its exact previous result.
export function gateBandFor(persPct, gate) {
  if (persPct == null || !Number.isFinite(persPct)) return null;
  const bands = gateBands(gate);
  return bands.find((b) => persPct >= b.min) ?? bands[bands.length - 1];
}

// Highest qualifying prize tier for a value. A tier is cleared only when BOTH
// the API and the apps minimums are met (apps minimum keeps a campaign honest).
// `tiers` may be in any order; evaluated high → low by API then apps.
export function resolveTier(apiValue, appsValue, tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const ordered = [...tiers].sort(
    (a, b) => (Number(b.api) || 0) - (Number(a.api) || 0) || (Number(b.apps) || 0) - (Number(a.apps) || 0),
  );
  for (const tr of ordered) {
    if (apiValue >= (Number(tr.api) || 0) && appsValue >= (Number(tr.apps) || 0)) return tr;
  }
  return null;
}

// ── Accommodation ─ the retreat room a tier carries (C2) ──────────────────
//
// Table 1 of the signed document gives every level a cash prize AND a room:
// Double (bring a guest), Single (the qualifier only), Shared (paired with
// another Shared qualifier). The room is NOT money and must never be scaled by
// the gate multiplier — Rule 5 either grants it whole or removes it entirely.
export const ACCOMMODATION_LABELS = Object.freeze({
  shared: 'Shared',
  single: 'Single',
  double: 'Double',
});

/** Display label for a tier's accommodation, or null when it carries none. */
export function accommodationLabel(value) {
  return ACCOMMODATION_LABELS[value] ?? null;
}

// ── The ONE tier derivation both agent surfaces resolve through (C2 item 7) ──
//
// There are two agent-facing campaign surfaces and they read different
// collections: HomeV2's CampaignCard totals WEEKLY SUBMISSIONS, while the policy
// ledger's CampaignLensPanel totals the SETTLED POLICY LEDGER. They answer
// different questions, which is tolerable — but an advisor who sees a retreat
// room on one screen and a different level implied on the other has been told
// two things. So the inputs may differ; the DERIVATION may not. Both call this.
//
// It returns TWO tiers, not one:
//
//   tierReached — the highest tier both current figures clear, or null when
//                 none is cleared yet. This is what the advisor has earned.
//   tierNext    — the next rung up, or null once tierReached is the top tier.
//                 This is what the advisor is working toward.
//
// `progressTarget` is tierNext when one exists, and the top tier itself at
// Pioneer where there is nothing above. It is deliberately NOT the ladder's
// ceiling: on live data today the operator sits at TTD 73,946 of Champion's
// 275,000 — 27% of the level that decides whether he travels at all — which a
// ceiling-based bar renders as 9% of Pioneer's 825,000, a level he has never
// been shown. Never render a percentage against a tier the advisor cannot see.
export function resolveTierProgress(apiValue, appsValue, tiers) {
  const list = Array.isArray(tiers) ? tiers.filter(Boolean) : [];
  if (list.length === 0) {
    return { tierReached: null, tierNext: null, progressTarget: null, apiToGo: null, appsToGo: null, atTop: false };
  }

  // Ascending by API then apps — the ladder as an advisor climbs it.
  const ordered = [...list].sort(
    (a, b) => (Number(a.api) || 0) - (Number(b.api) || 0) || (Number(a.apps) || 0) - (Number(b.apps) || 0),
  );
  const clears = (t) => apiValue >= (Number(t.api) || 0) && appsValue >= (Number(t.apps) || 0);

  // resolveTier already answers "highest cleared"; reuse it rather than writing
  // a second version of the same comparison that can drift from it.
  const tierReached = resolveTier(apiValue, appsValue, list);

  let tierNext;
  if (tierReached == null) {
    tierNext = ordered[0];
  } else {
    const idx = ordered.findIndex((t) => t === tierReached);
    tierNext = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  }

  const atTop = tierReached != null && tierNext == null;
  const progressTarget = tierNext ?? tierReached ?? null;

  return {
    tierReached,
    tierNext,
    progressTarget,
    atTop,
    apiToGo: progressTarget ? Math.max(0, (Number(progressTarget.api) || 0) - apiValue) : null,
    appsToGo: progressTarget ? Math.max(0, (Number(progressTarget.apps) || 0) - appsValue) : null,
    // Exposed so a caller never has to re-derive "did I clear this one".
    clearsProgressTarget: progressTarget ? clears(progressTarget) : false,
  };
}

// A campaign is "tiered" (activates the v2 standings/ladder/podium/gate UI) iff
// it declares a qualify structure with tiers OR a placement structure with
// placements. Legacy flat-threshold campaigns return false and render exactly
// as they did before (backward-compatible).
export function isTieredCampaign(campaign) {
  if (!campaign) return false;
  if (campaign.structure === 'placement') return Array.isArray(campaign.placements) && campaign.placements.length > 0;
  if (campaign.structure === 'qualify')   return Array.isArray(campaign.tiers) && campaign.tiers.length > 0;
  return false;
}

// Distinct calendar years spanned by [startDate, endDate] (YYYY-MM-DD strings).
//
// Lives here, not in a component, because it is HALF of the gate contract: a
// caller that feeds `persistencyPctForPeriod` a record set narrower than these
// years computes the gate over a partial period and can land the advisor in a
// different payout band than the surface next door. Both campaign surfaces
// (CampaignPanel, MeetingMode's CampaignScene) load through this.
export function campaignYears(startDate, endDate) {
  const s = parseInt(String(startDate).slice(0, 4), 10);
  const e = parseInt(String(endDate).slice(0, 4), 10);
  if (!Number.isFinite(s)) return [new Date().getFullYear()];
  const end = Number.isFinite(e) ? e : s;
  const out = [];
  for (let y = s; y <= end; y++) out.push(y);
  return out;
}

// Persistency (as a whole-number percentage) for the campaign period, derived
// from an agent's monthly E3 persistency records. Uses the SUM-based aggregate
// (never an average of percentages — see calculations.js).
//
// Returns null when NO record falls inside the period. It does NOT fall back to
// the caller's whole record set: this number scales a payout, and an aggregate
// computed over the wrong months is a confident wrong multiplier. `gateBandFor`
// maps null to a "no data" pill and `computeStandings` maps a null band to a ×1
// multiplier — i.e. the advisor is neither paid on a fabricated figure nor
// disqualified by one. Abstaining is the safe direction; guessing is not.
export function persistencyPctForPeriod(records, startDate, endDate) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const startKey = String(startDate ?? '').slice(0, 7); // YYYY-MM
  const endKey   = String(endDate ?? '').slice(0, 7);
  const inRange = records.filter(
    (r) => r && r.monthKey && String(r.monthKey) >= startKey && String(r.monthKey) <= endKey,
  );
  if (!inRange.length) return null;
  const { aggregatedPersistency, sumGrossSettled } = aggregatePersistency(inRange);
  if (!(sumGrossSettled > 0)) return null;
  return Math.round(aggregatedPersistency * 100);
}

// Persistency at the campaign's FINAL MONTH — the basis Rule 5 of the signed
// Christmas 2026 document actually names ("24-Month Persistency at the Final
// Month (December 2026)").
//
// Reads exactly ONE monthly record, the one whose monthKey equals the campaign's
// end month, and returns null when it is absent. It NEVER falls back to the
// period aggregate: the two numbers are different numbers, and on a binary gate
// they can land an advisor on opposite sides of the cliff. null renders the
// existing "no data" pill at ×1 — neither paid on a fabricated figure nor
// disqualified by one.
export function persistencyPctAtFinalMonth(records, endDate) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const key = String(endDate ?? '').slice(0, 7); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(key)) return null;
  const rec = records.find((r) => r && String(r.monthKey) === key);
  if (!rec) return null;
  // `== null` is deliberate and load-bearing. Number(null) is 0 and
  // Number.isFinite(0) is true, so a record that exists but carries no
  // persistency figure would otherwise read as 0% — and on a binary gate 0%
  // DISQUALIFIES. A missing figure must abstain, never disqualify.
  if (rec.persistency == null || rec.persistency === '') return null;
  const value = Number(rec.persistency);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

// The ONLY persistency function a gate consumer calls. Dispatches on the
// campaign's declared basis so that the campaign card, the standings table, the
// kiosk leaderboard and MeetingMode cannot drift onto different bases.
//
// `persistencyPctForPeriod` stays exported for its own tests and for callers
// that genuinely want the period figure irrespective of any gate.
export function persistencyPctForGate(records, campaign) {
  const gate = normalizeGate(campaign);
  return gate.basis === 'finalMonth'
    ? persistencyPctAtFinalMonth(records, campaign?.endDate)
    : persistencyPctForPeriod(records, campaign?.startDate, campaign?.endDate);
}

// API + apps totals for a set of submissions, read through extractFields — the
// single source of truth for submission KPI fields.
//
// Exported because CampaignCard needs one agent's totals to resolve a tier, and
// a second hand-rolled `parseFloat(s.apiSold)` on that surface is exactly how
// two campaign screens start disagreeing. `computeStandings` routes through it
// too, so there is one adder, not two.
export function submissionTotals(submissions) {
  let apiTotal = 0;
  let appsTotal = 0;
  for (const s of Array.isArray(submissions) ? submissions : []) {
    if (!s) continue;
    const f = extractFields(s);
    apiTotal  += parseFloat(f.apiSold) || 0;
    appsTotal += parseFloat(f.applicationsSold) || 0;
  }
  return { apiTotal, appsTotal };
}

// Ranked, resolved campaign standings — the shared derivation behind the
// StandingsTable, TierLadder and PlacementPodium. Pure function.
//
//   campaign            — the campaign doc (structure, tiers|placements,
//                          standingsMetric, persistencyGateEnabled)
//   submissions         — campaign-period submissions (already scoped to dates)
//   participants        — [{ id, name, unit? }] eligible advisors
//   persistencyByAgent  — { [agentId]: persPct|null } (percentage 0–100)
//
// Every returned row carries its rank, metric total, gate band + multiplier,
// tier/placement, and PROJECTED (gated) payout. Nothing is persisted.
export function computeStandings(campaign, submissions = [], participants = [], persistencyByAgent = {}) {
  const structure  = campaign?.structure === 'placement' ? 'placement' : 'qualify';
  const rankMetric = campaign?.standingsMetric === 'applicationsSold' ? 'applicationsSold' : 'apiSold';
  const gateEnabled = campaign?.persistencyGateEnabled !== false; // default ON
  // Resolved ONCE per standings computation and threaded into every band
  // lookup, so a single campaign can never be graded on two different gates.
  const gate = normalizeGate(campaign);

  // Per-participant API + apps totals over the campaign period.
  const totals = {};
  for (const p of participants) totals[p.id] = { apiTotal: 0, appsTotal: 0 };
  for (const s of submissions) {
    const aid = s.agentId ?? s.userId ?? '';
    if (!aid || !(aid in totals)) continue;
    const t = submissionTotals([s]);
    totals[aid].apiTotal  += t.apiTotal;
    totals[aid].appsTotal += t.appsTotal;
  }

  const entries = participants.map((p) => {
    const { apiTotal, appsTotal } = totals[p.id] ?? { apiTotal: 0, appsTotal: 0 };
    const persPct = persistencyByAgent[p.id] ?? null;
    const band = gateEnabled ? gateBandFor(persPct, gate) : null;
    const multiplier = band ? band.payout : 1;
    return {
      agentId: p.id,
      name: p.name ?? 'Agent',
      unit: p.unit ?? null,
      apiTotal,
      appsTotal,
      metricValue: rankMetric === 'applicationsSold' ? appsTotal : apiTotal,
      persPct,
      band,
      multiplier,
      gateEnabled,
      gate,
    };
  });

  entries.sort((a, b) => (b.metricValue - a.metricValue) || a.name.localeCompare(b.name));
  entries.forEach((e, i) => { e.rank = i + 1; });

  if (structure === 'placement') {
    const placements = Array.isArray(campaign?.placements) ? campaign.placements : [];
    return entries.map((e) => {
      const place = placements.find((p) => Number(p.rank) === e.rank) ?? null;
      const grossCash = place ? (parseFloat(place.prize) || 0) : 0;
      const gatedToZero = !!e.band && e.band.payout === 0;
      return {
        ...e,
        tier: null,
        place,
        won: !!place,
        qualified: !!place && !gatedToZero,
        grossCash,
        grossVoucher: 0,
        projectedCash: place ? Math.round(grossCash * e.multiplier) : 0,
        projectedVoucher: 0,
        disqualified: !!place && gatedToZero,
      };
    });
  }

  // qualify structure (default)
  const tiers = Array.isArray(campaign?.tiers) ? campaign.tiers : [];
  return entries.map((e) => {
    const tier = resolveTier(e.apiTotal, e.appsTotal, tiers);
    const grossCash    = tier ? (parseFloat(tier.cash) || 0) : 0;
    const grossVoucher = tier ? (parseFloat(tier.voucher) || 0) : 0;
    const gatedToZero = !!e.band && e.band.payout === 0;
    return {
      ...e,
      tier,
      place: null,
      won: !!tier,
      qualified: !!tier && !gatedToZero,
      grossCash,
      grossVoucher,
      projectedCash: Math.round(grossCash * e.multiplier),
      projectedVoucher: Math.round(grossVoucher * e.multiplier),
      disqualified: !!tier && gatedToZero,
    };
  });
}

// ─── Table 2 · manager accommodation (C4) ────────────────────────────────────
//
// Page 7 of the signed document. Managers are Agency Managers, Unit Managers and
// the Direct Sales Team Leader; Trainee UMs are excluded. Two things about it
// are easy to get wrong and both are money:
//
//   1. A manager is paid CASH only as an ADVISOR (Table 1). Table 2 grants a
//      ROOM, never cash. `cash` below is the advisor tier's and nothing else.
//   2. A manager takes the HIGHER accommodation of Table 1 and Table 2, not the
//      sum and not the manager row alone.
//
// `team_leader` rows are carried in config and skipped on screen with a stated
// reason: no such role exists in this system (C-D5), and inventing one for a
// single campaign was ruled out.
const ACCOMMODATION_RANK = { shared: 1, single: 2, double: 3 };

/** The better of two accommodations; null when neither grants a room. */
export function higherAccommodation(a, b) {
  const ra = ACCOMMODATION_RANK[a] ?? 0;
  const rb = ACCOMMODATION_RANK[b] ?? 0;
  if (ra === 0 && rb === 0) return null;
  return ra >= rb ? a ?? null : b ?? null;
}

/**
 * deriveManagerQualification(campaign, standings, managers, usersByUnit)
 *
 *   managers     — [{ id, name, role, branchId?, unitId? }]
 *   usersByUnit  — { [unitId]: [agentId, ...] } for unit scoping
 *
 * A QUALIFYING AGENT is a standings row with `qualified === true` — the tier was
 * reached AND the persistency gate passed — scoped to the manager's branch or
 * unit, EXCLUDING the manager themselves (general rule 2: a manager does not
 * count as one of their own qualifying agents).
 *
 * Display-only, like everything else in this engine. Nothing is written.
 */
export function deriveManagerQualification(campaign, standings = [], managers = [], usersByUnit = {}) {
  const rows = Array.isArray(campaign?.managerQualification) ? campaign.managerQualification : [];
  const byAgent = new Map((standings ?? []).map((s) => [s.agentId, s]));

  // Highest accommodation first, so the first row a manager clears is the best
  // one they are entitled to.
  const ordered = [...rows].sort(
    (a, b) => (ACCOMMODATION_RANK[b.accommodation] ?? 0) - (ACCOMMODATION_RANK[a.accommodation] ?? 0),
  );

  return (managers ?? []).map((mgr) => {
    const own = byAgent.get(mgr.id) ?? null;

    // Personal production is the manager's OWN standings row when they produce,
    // else 0/0 — a non-producing manager is not disqualified, they simply clear
    // only the rows that ask for no personal production.
    const personalApi = own?.apiTotal ?? 0;
    const personalApps = own?.appsTotal ?? 0;

    const scoped = (standings ?? []).filter((s) => {
      if (s.agentId === mgr.id) return false;         // R2: never count yourself
      if (!s.qualified) return false;                 // tier reached AND gate passed
      if (mgr.role === 'unit_manager') {
        const members = usersByUnit?.[mgr.unitId] ?? [];
        return members.includes(s.agentId);
      }
      if (mgr.role === 'branch_manager') return true; // branch-scoped standings
      return false;
    });
    const agentsQualifying = scoped.length;

    const notModelled = mgr.role === 'team_leader';
    const asManager = notModelled ? null : (ordered.find((r) => (
      r.role === mgr.role
      && agentsQualifying >= (Number(r.agentsQualifying) || 0)
      && personalApi >= (Number(r.personalApi) || 0)
      && personalApps >= (Number(r.personalApps) || 0)
    )) ?? null);

    const asAdvisor = own?.tier ?? null;
    // Rule 5 removes the ROOM as well as the cash, so a disqualified manager
    // keeps neither — on either table.
    const disqualified = Boolean(own?.disqualified);

    return {
      managerId: mgr.id,
      name: mgr.name ?? 'Manager',
      role: mgr.role,
      agentsQualifying,
      personalApi,
      personalApps,
      asAdvisor,
      asManager,
      accommodation: disqualified
        ? null
        : higherAccommodation(asAdvisor?.accommodation, asManager?.accommodation),
      // CASH IS ONLY EVER THE ADVISOR CASH. Table 2 grants a room, not money.
      cash: disqualified ? 0 : (Number(asAdvisor?.cash) || 0),
      disqualified,
      notModelled,
      notModelledReason: notModelled ? 'Direct Sales Team Leader is not modelled' : null,
    };
  });
}

function getMetricValue(fields, metric) {
  return parseFloat(fields[metric]) || 0;
}

function getParticipantIds(campaign, submissions) {
  const { type, unitIds = [], agentIds = [] } = campaign.scope ?? {};
  if (type === 'branch') {
    return [...new Set(submissions.map((s) => s.agentId ?? s.userId ?? '').filter(Boolean))];
  }
  if (type === 'unit') {
    return [...new Set(
      submissions
        .filter((s) => unitIds.includes(s.unitId))
        .map((s) => s.agentId ?? s.userId ?? '')
        .filter(Boolean)
    )];
  }
  if (type === 'agent') {
    return agentIds.filter(Boolean);
  }
  return [];
}

export function computeCampaignProgress(campaign, submissions, agentId) {
  const targets = campaign.targets ?? [];
  const primaryMetric = targets[0]?.metric ?? null;

  // Build per-agent totals for ranking
  const participantIds = getParticipantIds(campaign, submissions);

  const totalsByAgent = {};
  for (const s of submissions) {
    const aid = s.agentId ?? s.userId ?? '';
    if (!aid) continue;
    if (!participantIds.includes(aid)) continue;
    if (!totalsByAgent[aid]) totalsByAgent[aid] = { agentName: s.agentName ?? s.displayName ?? 'Agent', totals: {} };
    const f = extractFields(s);
    for (const { metric } of targets) {
      totalsByAgent[aid].totals[metric] = (totalsByAgent[aid].totals[metric] ?? 0) + getMetricValue(f, metric);
    }
  }

  const totalParticipants = participantIds.length;

  // Rank by primary metric
  let rank = null;
  if (primaryMetric && participantIds.length > 0) {
    const sorted = Object.entries(totalsByAgent)
      .map(([aid, { agentName, totals }]) => ({ aid, agentName, primary: totals[primaryMetric] ?? 0 }))
      .sort((a, b) => b.primary !== a.primary ? b.primary - a.primary : a.agentName.localeCompare(b.agentName));

    const idx = sorted.findIndex((e) => e.aid === agentId);
    rank = idx >= 0 ? idx + 1 : null;
  }

  // Metrics for this agent
  const agentTotals = totalsByAgent[agentId]?.totals ?? {};
  const metrics = targets.map(({ metric, threshold }) => {
    const current = agentTotals[metric] ?? 0;
    const pct = threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0;
    return {
      metric,
      label: METRIC_LABELS[metric] ?? metric,
      threshold,
      current,
      pct,
      achieved: pct >= 100,
    };
  });

  const allAchieved = metrics.length > 0 && metrics.every((m) => m.achieved);

  return { metrics, allAchieved, rank, totalParticipants };
}

export function getDaysRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate + 'T12:00:00Z');
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
