/**
 * policyLifecycle.js — H1.2: agent-owned policy status model.
 * Source of truth for status enum, legal transition map, and per-transition fields.
 * Importable by service + UI; mirrors the Firestore rules encoding.
 *
 * `lapsed` (H2c): BM-only terminal status. Agent cannot set lapsed.
 */

/**
 * All statuses recognised in this slice.
 *
 * `written` (life-pipeline phase 1, D1) is the REAL starting status: a policy
 * record opens when the application is WRITTEN, not when it is submitted. It has
 * NO inbound edge — nothing transitions into it, `createPolicy` is the only way a
 * policy enters it — which is why slice 1A needs no migration.
 */
export const POLICY_STATUSES = ['written', 'submitted', 'rated', 'postponed', 'ntu', 'denied', 'settled', 'lapsed'];

/**
 * Agent-owned legal transitions (PRD §7).
 * Terminal statuses (ntu, denied, settled, lapsed) have no outbound entries.
 * settled → lapsed is BM-only (H2c), not an agent transition.
 * `written` (D1) exits to `submitted` or `ntu` ONLY. An application that is
 * written and then abandoned is an NTU, not a denial — nobody underwrote it.
 */
export const LEGAL_AGENT_TRANSITIONS = {
  written:   ['submitted', 'ntu'],
  submitted: ['rated', 'postponed', 'ntu', 'denied', 'settled'],
  rated:     ['settled', 'ntu'],
  postponed: ['submitted', 'settled', 'denied'],
  ntu:       [],
  denied:    [],
  settled:   [],
};

/**
 * isLegalAgentTransition — JS mirror of the Firestore rules helper.
 * Returns true iff the agent may move a policy from `from` to `to`.
 * `lapsed` is BM-only (H2c) — explicitly rejected for agent callers.
 */
export function isLegalAgentTransition(from, to) {
  if (to === 'lapsed') return false;
  return Boolean(LEGAL_AGENT_TRANSITIONS[from]?.includes(to));
}

/**
 * Per-transition required fields (PRD §7.4).
 * Keys are the target status; values are arrays of field names
 * that MUST be present and valid before the transition is accepted.
 */
export const TRANSITION_REQUIRED_FIELDS = {
  rated:     ['ratedPremium'],
  postponed: [],
  ntu:       [],
  denied:    [],
  settled:   ['dateIssued', 'settledAPI', 'issuedCoverage', 'initialPremium', 'earnedCommission'],
  submitted: [], // postponed → submitted re-entry; no new fields (see EDGE_REQUIRED_FIELDS)
  lapsed:    ['dateLapsed'],    // H2c — BM-only; dateLapsed (Firestore Timestamp)
};

/**
 * Per-EDGE required fields (life-pipeline phase 1, slice 1A). Keyed `${from}->${to}`.
 *
 * This exists so `written → submitted` can require `dateSubmitted` WITHOUT
 * widening TRANSITION_REQUIRED_FIELDS.submitted, which is ALSO the target of the
 * field-free `postponed → submitted` re-entry. Widening the per-target map would
 * break that re-entry — the same trap the Firestore rules avoid by branching
 * Arm B on `resource.data.status` rather than on the target alone.
 */
export const EDGE_REQUIRED_FIELDS = {
  'written->submitted': ['dateSubmitted'],
};

/**
 * requiredFieldsForTransition — the fields an agent must supply for ONE edge:
 * the union of the per-target set and the per-edge set. Prefer this over reading
 * TRANSITION_REQUIRED_FIELDS directly, or the per-edge requirement is missed.
 */
export function requiredFieldsForTransition(from, to) {
  const perTarget = TRANSITION_REQUIRED_FIELDS[to] ?? [];
  const perEdge   = EDGE_REQUIRED_FIELDS[`${from}->${to}`] ?? [];
  return [...new Set([...perTarget, ...perEdge])];
}

/**
 * Per-transition optional fields (PRD §7.4).
 */
export const TRANSITION_OPTIONAL_FIELDS = {
  rated:     ['rateReason'],
  postponed: ['pendingReason'],
  ntu:       ['reason'],
  denied:    ['reason'],
  settled:   [],
  submitted: [],
  lapsed:    ['lapseReason'], // H2c — BM-only; free-text note from head-office circular
};

/** Human-readable labels for status values. */
export const POLICY_STATUS_LABELS = {
  written:   'Written',   // D1 — the starting status; application taken, not yet submitted
  submitted: 'Submitted',
  rated:     'Rated',
  postponed: 'Postponed',
  ntu:       'NTU',
  denied:    'Denied',
  settled:   'Settled',
  lapsed:    'Lapsed', // H2c — BM-only terminal status
};
