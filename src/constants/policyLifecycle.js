/**
 * policyLifecycle.js — H1.2: agent-owned policy status model.
 * Source of truth for status enum, legal transition map, and per-transition fields.
 * Importable by service + UI; mirrors the Firestore rules encoding.
 *
 * Lapsed status is DEFERRED to H2 (BM-only path).
 */

/**
 * All statuses recognised in this slice. `lapsed` is H2.
 */
export const POLICY_STATUSES = ['submitted', 'rated', 'postponed', 'ntu', 'denied', 'settled'];

/**
 * Agent-owned legal transitions (PRD §7).
 * Terminal statuses (ntu, denied, settled) have no outbound entries.
 * settled → lapsed is H2.
 */
export const LEGAL_AGENT_TRANSITIONS = {
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
 * Explicitly rejects `lapsed` (H2).
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
  submitted: [], // postponed → submitted re-entry; no new fields
};

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
};

/** Human-readable labels for status values. */
export const POLICY_STATUS_LABELS = {
  submitted: 'Submitted',
  rated:     'Rated',
  postponed: 'Postponed',
  ntu:       'NTU',
  denied:    'Denied',
  settled:   'Settled',
};
