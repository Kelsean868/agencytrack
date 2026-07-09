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

// Resolve a persistency percentage (0–100) to its gate band. Returns null when
// persistency is unknown (no persistency record on file) so the UI can render a
// "no data" pill rather than silently disqualifying an advisor.
export function gateBandFor(persPct) {
  if (persPct == null || !Number.isFinite(persPct)) return null;
  return (
    PERSISTENCY_GATE_BANDS.find((b) => persPct >= b.min) ??
    PERSISTENCY_GATE_BANDS[PERSISTENCY_GATE_BANDS.length - 1]
  );
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

// Average persistency (as a whole-number percentage) for the campaign period,
// derived from an agent's monthly E3 persistency records. Uses the SUM-based
// aggregate (never an average of percentages — see calculations.js). Returns
// null when there is no usable record in the period.
export function persistencyPctForPeriod(records, startDate, endDate) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const startKey = String(startDate ?? '').slice(0, 7); // YYYY-MM
  const endKey   = String(endDate ?? '').slice(0, 7);
  const inRange = records.filter(
    (r) => r && r.monthKey && String(r.monthKey) >= startKey && String(r.monthKey) <= endKey,
  );
  const pool = inRange.length ? inRange : records;
  const { aggregatedPersistency, sumGrossSettled } = aggregatePersistency(pool);
  if (!(sumGrossSettled > 0)) return null;
  return Math.round(aggregatedPersistency * 100);
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

  // Per-participant API + apps totals over the campaign period.
  const totals = {};
  for (const p of participants) totals[p.id] = { apiTotal: 0, appsTotal: 0 };
  for (const s of submissions) {
    const aid = s.agentId ?? s.userId ?? '';
    if (!aid || !(aid in totals)) continue;
    const f = extractFields(s);
    totals[aid].apiTotal  += parseFloat(f.apiSold) || 0;
    totals[aid].appsTotal += parseFloat(f.applicationsSold) || 0;
  }

  const entries = participants.map((p) => {
    const { apiTotal, appsTotal } = totals[p.id] ?? { apiTotal: 0, appsTotal: 0 };
    const persPct = persistencyByAgent[p.id] ?? null;
    const band = gateEnabled ? gateBandFor(persPct) : null;
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
