/**
 * policyLedgerDerivation.js — pure client-side aggregations for Policy Ledger v2.
 *
 * Tier-1 pipeline numbers, the Active-Book flow bar, the feed filters, and the
 * drawer lifecycle are ALL derived from the existing getOwnPolicies() list. No
 * new Firestore reads, no schema change. Pure functions only (no JSX, no SDK).
 *
 * Edge-status bucketing: `ntu`/`denied`/`lapsed` fold into the Closed tile (all
 * terminal exits); `postponed` folds into Submitted (earliest active). The
 * per-card pill still shows each policy's TRUE status/role, so no information is
 * lost — only the coarse tile grouping folds the edge statuses.
 *
 * SIX tiles, not five. The Rule 9 banked decision locked 5, and life-pipeline
 * slice 1A DELIBERATELY REVISES IT: `written` (D1) gets its own tile. Folding it
 * into Submitted would hide exactly the list the status exists to create — the
 * applications sitting unsigned, which is the agent's "waiting on signature"
 * queue. A tile the agent cannot see is a status that will not be kept current.
 */

import { isConfirmed, needsManagerConfirmation } from './policyStatusTokens';

/** Numeric value used for Σ aggregations — the most-confirmed figure available. */
export function policyValue(policy) {
  const v =
    policy?.managerSettledAPI ??
    policy?.settledAPI ??
    policy?.proposedAPI ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * pipelineStage — bucket a policy into exactly one of the 6 pipeline stages.
 * Partitions ALL statuses (no policy is dropped). See edge-status note above.
 */
export function pipelineStage(policy) {
  if (isConfirmed(policy)) return 'confirmed';
  switch (policy?.status) {
    case 'written':
      return 'written';
    case 'lapsed':
    case 'ntu':
    case 'denied':
      return 'closed';
    case 'settled':
      return 'settled';
    case 'rated':
      return 'rated';
    case 'submitted':
    case 'postponed':
    default:
      return 'submitted';
  }
}

// Stage definitions — order + label + semantic role (for statusToken()).
export const PIPELINE_STAGES = [
  { key: 'written',   label: 'Written',         role: 'in-flight' },
  { key: 'submitted', label: 'Submitted',       role: 'in-flight' },
  { key: 'rated',     label: 'Rated',           role: 'in-flight' },
  { key: 'settled',   label: 'Settled',         role: 'settled'  },
  { key: 'confirmed', label: 'Confirmed',       role: 'confirmed' },
  { key: 'closed',    label: 'Closed · Lapsed', role: 'closed'    },
];

/**
 * derivePipeline — Tier-1 strip + Active-Book flow bar, all client-derived.
 *
 * @returns {{
 *   stages: Array<{key,label,role,count,sum}>,
 *   totalSum: number,
 *   inFlightSum: number,
 *   flow: Array<{key,label,role,sum,pct}>,
 * }}
 */
export function derivePipeline(policies) {
  const list = Array.isArray(policies) ? policies : [];
  const byKey = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s.key, { ...s, count: 0, sum: 0 }]),
  );

  let totalSum = 0;
  for (const p of list) {
    const stage = byKey[pipelineStage(p)];
    const val = policyValue(p);
    stage.count += 1;
    stage.sum += val;
    totalSum += val;
  }

  // `written` counts as in-flight (its tile role says so). Leaving it out would
  // drop written policies from the Active-Book flow bar entirely — they are
  // neither confirmed nor settled — and the bar would silently under-report.
  const inFlightSum = byKey.written.sum + byKey.submitted.sum + byKey.rated.sum;

  // Active-Book flow bar: confirmed value · settled · in flight.
  // Excludes Closed (it has exited the active book). Percentages are of the
  // active-book total (the three segments), not the YTD total.
  const flowTotal = byKey.confirmed.sum + byKey.settled.sum + inFlightSum;
  const pct = (v) => (flowTotal > 0 ? Math.round((v / flowTotal) * 100) : 0);
  // Flow-segment fills use canonical solid tokens (gold = confirmed value,
  // primary = settled, ink-faint = in-flight "push these to settle").
  const flow = [
    { key: 'confirmed', label: 'Confirmed value',  solid: 'bg-gold',      sum: byKey.confirmed.sum, pct: pct(byKey.confirmed.sum) },
    { key: 'settled',   label: 'Settled',          solid: 'bg-primary',   sum: byKey.settled.sum,   pct: pct(byKey.settled.sum) },
    { key: 'inflight',  label: 'In flight',        solid: 'bg-ink-faint', sum: inFlightSum,         pct: pct(inFlightSum) },
  ];

  return {
    stages: PIPELINE_STAGES.map((s) => byKey[s.key]),
    totalSum,
    inFlightSum,
    flow,
  };
}

// ── Feed filters (Tier 2) ────────────────────────────────────────────────────
// Non-partitioning chips — a policy may satisfy more than one (e.g. a settled
// policy is both "In flight" book-wise and "Action needed").

export const LEDGER_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'inflight', label: 'In flight' },
  { key: 'action',   label: 'Action needed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'closed',   label: 'Closed' },
  { key: 'lapsed',   label: 'Lapsed' },
];

function matchesFilter(policy, filter) {
  const confirmed = isConfirmed(policy);
  const s = policy?.status;
  switch (filter) {
    case 'all':
      return true;
    case 'inflight':
      // Active, not yet exited. A settled policy belongs here only while a manager
      // confirmation is still outstanding; a head-office settled policy has already
      // landed and is not in flight.
      return !confirmed && (
        ['written', 'submitted', 'rated', 'postponed'].includes(s)
        || (s === 'settled' && needsManagerConfirmation(policy))
      );
    case 'action':
      // Settled AND actually waiting on a manager. A head-office status has no
      // manager step, so there is no action for the agent to chase.
      return !confirmed && s === 'settled' && needsManagerConfirmation(policy);
    case 'confirmed':
      return confirmed;
    case 'closed':
      return !confirmed && ['lapsed', 'ntu', 'denied'].includes(s);
    case 'lapsed':
      // Lapsed only — excludes NTU and denied (used by persistency playground D4 link).
      return !confirmed && s === 'lapsed';
    default:
      return true;
  }
}

function matchesSearch(policy, term) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [policy?.ownerName, policy?.insuredName, policy?.planName, policy?.policyNumber]
    .some((f) => typeof f === 'string' && f.toLowerCase().includes(q));
}

/** applyLedgerFilter — Tier-2 chip + search filter over the policy list. */
export function applyLedgerFilter(policies, { filter = 'all', search = '' } = {}) {
  const list = Array.isArray(policies) ? policies : [];
  return list.filter((p) => matchesFilter(p, filter) && matchesSearch(p, search));
}

/** Per-filter counts for the chip badges. */
export function filterCounts(policies) {
  const list = Array.isArray(policies) ? policies : [];
  return Object.fromEntries(
    LEDGER_FILTERS.map((f) => [f.key, list.filter((p) => matchesFilter(p, f.key)).length]),
  );
}

// ── Drawer lifecycle (Tier 3) ────────────────────────────────────────────────

const LIFECYCLE_ORDER = ['written', 'submitted', 'rated', 'settled', 'confirmed'];
const LIFECYCLE_LABELS = { written: 'Written', submitted: 'Submitted', rated: 'Rated', settled: 'Settled', confirmed: 'Confirmed' };

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * lifecycleNodes — the 5-node happy-path bar for the drill drawer.
 * Each node: { key, label, state: 'done'|'cur'|'future', date: Date|null, derived?: boolean }.
 * `confirmed` carries `derived: true`. Off-path statuses (postponed/ntu/denied)
 * resolve their reached index from the underlying status; the true status is
 * still surfaced by the drawer's status pill.
 */
export function lifecycleNodes(policy) {
  const confirmed = isConfirmed(policy);
  let reached;
  if (confirmed) reached = 4;
  else
    switch (policy?.status) {
      case 'settled': reached = 3; break;
      case 'rated': reached = 2; break;
      case 'ntu':
      case 'denied': reached = 2; break;   // exited after at least submission/rating
      case 'lapsed': reached = 4; break;    // was settled+confirmed before lapse
      case 'submitted':
      case 'postponed': reached = 1; break;
      case 'written':
      default: reached = 0; break;
    }

  const dateFor = {
    written:   tsToDate(policy?.dateWritten),
    submitted: tsToDate(policy?.dateSubmitted) ?? tsToDate(policy?.dateWritten),
    rated:     null, // no dedicated rated-date field on the policy doc
    settled:   tsToDate(policy?.dateIssued),
    confirmed: tsToDate(policy?.confirmedAt),
  };

  // A head-office status has no confirmation step, so the bar ends at Settled
  // rather than drawing a fifth node the policy will never reach.
  const order = (!confirmed && !needsManagerConfirmation(policy))
    ? LIFECYCLE_ORDER.slice(0, 4)
    : LIFECYCLE_ORDER;

  return order.map((key, i) => ({
    key,
    label: LIFECYCLE_LABELS[key],
    state: i < reached ? 'done' : i === reached ? 'cur' : 'future',
    date: dateFor[key],
    derived: key === 'confirmed',
  }));
}
