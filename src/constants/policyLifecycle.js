/**
 * policyLifecycle.js — H1.2: agent-owned policy status model.
 * Source of truth for status enum, legal transition map, and per-transition fields.
 * Importable by service + UI; mirrors the Firestore rules encoding.
 *
 * `lapsed` (H2c): BM-only terminal status. Agent cannot set lapsed.
 */

/**
 * All statuses recognised in this slice.
 */
export const POLICY_STATUSES = ['submitted', 'rated', 'postponed', 'ntu', 'denied', 'settled', 'lapsed'];

/**
 * Agent-owned legal transitions (PRD §7).
 * Terminal statuses (ntu, denied, settled, lapsed) have no outbound entries.
 * settled → lapsed is BM-only (H2c), not an agent transition.
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
  submitted: [], // postponed → submitted re-entry; no new fields
  lapsed:    ['dateLapsed'],    // H2c — BM-only; dateLapsed (Firestore Timestamp)
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
  lapsed:    ['lapseReason'], // H2c — BM-only; free-text note from head-office circular
};

/** Human-readable labels for status values. */
export const POLICY_STATUS_LABELS = {
  submitted: 'Submitted',
  rated:     'Rated',
  postponed: 'Postponed',
  ntu:       'NTU',
  denied:    'Denied',
  settled:   'Settled',
  lapsed:    'Lapsed', // H2c — BM-only terminal status
};
