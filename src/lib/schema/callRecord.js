/**
 * callRecord — the call evidence model (P0-G, ruling D3).
 *
 * PURE and a LEAF: no Firestore, no React, no imports. Every function takes its
 * inputs as arguments and returns a value.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Ruling D3 settled the dialer as `tel:`-only plus a captured outcome — no
 * telephony bridge. A bridge only ever sees calls routed through the app, so an
 * agent who made 36 real calls from their own mobile would show ZERO. That is
 * the source build's worst defect in new clothing: a manager-facing screen
 * reporting a false fact about a named agent, produced by a coverage gap rather
 * than a scoping bug. A declared outcome covers every call; a bridge covers only
 * the obedient ones.
 *
 * `activityLedger.js` documented the hole this fills: the dials-vs-contacts
 * distinction "is a property of the CALL RECORD's disposition, not of the block
 * that claimed it". The disposition defined here IS that property.
 *
 * ── THE SPLIT THAT MAKES THIS HONEST: ATTEMPT vs CONTACT ────────────────────
 * A DIAL is EVIDENCED BY THE RECORD ITSELF. A timestamped row attached to a
 * named lead is real evidence that an attempt was made. It is not proof of a
 * connection and does not claim to be.
 *
 * A CONTACT is DECLARED until something verifies it. Whether a human answered is
 * the agent's word, so it lives in the declared lane with the percentage
 * evidenced visible, like every other typed figure.
 *
 * That split is why `pcBreakdown` in `activityLedger.js` is UNTOUCHED by this
 * module and must stay that way: a dial counts identically whatever its
 * disposition. Disposition is purely additive — it feeds the contacts figures
 * here and nothing else. Needing to change `pcBreakdown` would mean the split is
 * wrong, not that the rule may be bent.
 *
 * ── EVIDENCED AND DECLARED ARE NEVER BLENDED, AND HERE IT IS LOAD-BEARING ───
 * In `activityLedger.js` evidenced and declared are DISJOINT populations (logged
 * blocks vs typed numbers), so their sum is at least arithmetically meaningful
 * even though the contract forbids emitting it.
 *
 * Here they are NOT disjoint: the same call can be both declared-reached by the
 * agent and verified-reached by a source. They are two provenance claims about
 * ONE record, not two populations. So a sum would DOUBLE-COUNT — the no-blend
 * rule is a correctness constraint on this module, not only a doctrine. There is
 * deliberately no field anywhere below holding declared + evidenced, and
 * `contactsClaimed` is a UNION count, not a sum (see `callCountsOn`).
 *
 * ── VERIFICATION ARRIVES LATE, AND COUNTS MAY RISE ──────────────────────────
 * Under a Microsoft-Graph-style source (the eventual upgrade IF Tatil moves to
 * Teams Phone — do not build it) a verification lands hours after the call. So a
 * past day's evidenced contact count must be able to go UP after the fact. That
 * is the monotonicity property this module's tests exist for.
 *
 * A verification NEVER invents a disposition the agent did not give, and never
 * silently overwrites one that disagrees. A verification that contradicts the
 * agent's account is a FINDING: it is recorded as `agreement: 'contradicts'` and
 * both claims stay readable side by side. Which of the two wins is a product
 * decision nobody has made, and it is not made here by implementation.
 *
 * ── KEY-NAMING NOTE ─────────────────────────────────────────────────────────
 * Every stored enum in this repo (`APPOINTMENT_STATUSES`, `POLICY_STATUSES`) is
 * lowercase and single-token, so there is no in-repo precedent for a multi-word
 * stored key. snake_case is chosen here so the key never needs a display
 * transform — `label` is the display form, as in `ACTIVITY_METADATA`.
 */

/**
 * CALL_DISPOSITIONS — the single source of truth for the call outcome
 * vocabulary (v3 rule 1, applied to the third vocabulary after activity codes
 * and appointment statuses).
 *
 * THIS TABLE IS NOT INVENTED HERE. The six values and the exact reached/not
 * split were already stated, in prose, in TWO places that could not see each
 * other — `src/lib/activityLedger.js` (the `ROW_CALLS` contract note) and
 * `src/actions/README.md` (the `logCallOutcome` consequence rules, which name
 * Callback Requested and Appointment Set as task-creating triggers). Two prose
 * statements of one vocabulary is exactly the twin class that produced every
 * regression in the v3 prototype. This file makes it a table and both of those
 * documents now point at it instead of restating it.
 *
 * ── Fields ──────────────────────────────────────────────────────────────────
 *   key      the stored enum value
 *   label    display form
 *   reached  a PERSON was reached. This is the ONE classifier, and it lives on
 *            the vocabulary rather than on the record. A `contacted: true` flag
 *            beside a disposition would be a twin of this column, and v3 rule 4
 *            / defect-class 2 is explicit: every consequence is a real object,
 *            never a boolean set alongside it.
 *
 * `reached` is TRUE for Not interested: the person answered and said no. That is
 * a contact — an unsuccessful one. Conflating "did not want it" with "did not
 * answer" would undercount contacts an agent genuinely made, which is the same
 * family of error as the coverage gap D3 rejected a bridge over.
 */
export const CALL_DISPOSITIONS = Object.freeze([
  Object.freeze({ key: 'appointment_set',    label: 'Appointment set',    reached: true }),
  Object.freeze({ key: 'callback_requested', label: 'Callback requested', reached: true }),
  Object.freeze({ key: 'not_interested',     label: 'Not interested',     reached: true }),
  Object.freeze({ key: 'left_voicemail',     label: 'Left voicemail',     reached: false }),
  Object.freeze({ key: 'no_answer',          label: 'No answer',          reached: false }),
  Object.freeze({ key: 'bad_number',         label: 'Bad number',         reached: false }),
]);

/** Ordered enum keys, table order. */
export const DISPOSITION_KEYS = Object.freeze(CALL_DISPOSITIONS.map((d) => d.key));

/** Dispositions in which a person was reached. Derived — never write a literal. */
export const REACHED_DISPOSITIONS = Object.freeze(
  new Set(CALL_DISPOSITIONS.filter((d) => d.reached).map((d) => d.key)),
);

/** True when `key` is a known disposition. */
export function isKnownDisposition(key) {
  return DISPOSITION_KEYS.includes(key);
}

/**
 * Did the AGENT's own account say a person was reached?
 *
 * Returns `null` — not `false` — for an absent or unknown disposition. A call
 * with no outcome captured yet is not a call where nobody answered, and the two
 * must not collapse: `false` would let an un-dispositioned call read as an
 * evidenced non-contact on a manager-facing figure. Absence is abstention.
 */
export function dispositionReached(disposition) {
  if (disposition == null) return null;
  if (!isKnownDisposition(disposition)) return null;
  return REACHED_DISPOSITIONS.has(disposition);
}

/**
 * How a verification stands against the agent's own account. Recorded, never
 * resolved — see the header.
 */
export const VERIFICATION_AGREEMENT = Object.freeze({
  AGREES: 'agrees',
  CONTRADICTS: 'contradicts',
  UNDETERMINED: 'undetermined',
});

/**
 * newCall — THE ONLY WAY A CALL RECORD IS CREATED (v3 rule 4, one factory per
 * entity). Two ad-hoc call sites once built the same entity differently and a
 * manager-facing figure was wrong about a named agent as a result.
 *
 * `id`, `date` and `atHour` are unchanged from what `activityLedger.js` already
 * reads — those three and nothing else — because `pcBreakdown` and
 * `attributeCalls` depend on exactly them and are property-tested against them.
 * Everything else on the record is additive and invisible to that arithmetic.
 *
 * @param {object} input
 * @param {string} input.id
 * @param {string} input.date            'YYYY-MM-DD'
 * @param {number} [input.atHour]        hour-of-day; null when unknown
 * @param {string} [input.leadId]        who was called
 * @param {string} [input.agentId]       who called
 * @param {string} [input.disposition]   a CALL_DISPOSITIONS key, or null
 * @returns {object} a new call record. `verification` is ALWAYS absent (null) at
 *   creation — nothing verifies a call at the moment it is logged.
 */
export function newCall({
  id,
  date,
  atHour = null,
  leadId = null,
  agentId = null,
  disposition = null,
} = {}) {
  return {
    id,
    date,
    atHour,
    leadId,
    agentId,
    disposition: isKnownDisposition(disposition) ? disposition : null,
    verification: null,
  };
}

/**
 * applyVerification — attach a later source's account of one call. PURE: returns
 * a NEW call and never mutates its input.
 *
 * It never invents a disposition the agent did not give (`disposition` is passed
 * through untouched, always) and never silently overwrites one that disagrees.
 * Disagreement is recorded as `agreement: 'contradicts'` and BOTH claims remain
 * readable — resolving it is a product decision nobody has made.
 *
 * ── `reached` COMES FROM THE SOURCE, IT IS NOT DERIVED FROM `connectedSeconds`
 * Deriving "a person answered" from a duration threshold would invent a constant
 * nobody has ruled on, and it would be wrong on the obvious case: a voicemail
 * connects and accrues seconds. `connectedSeconds` and `direction` are recorded
 * as evidence of WHAT the source saw; `reached` is the source's own assertion,
 * and `null` when it makes none.
 *
 * ── ADD-ONLY, AND WHY ───────────────────────────────────────────────────────
 * A call that ALREADY carries a verification is returned UNCHANGED. Replacing
 * one source's `reached: true` with another's `reached: false` would make an
 * evidenced count go DOWN, which is the one thing this module promises cannot
 * happen. Reconciling two disagreeing sources is a later decision; declining to
 * make it here is not the same as making it.
 *
 * @param {object} call
 * @param {object} verification
 * @param {string} verification.source              who asserted it, e.g. 'msgraph'
 * @param {boolean|null} [verification.reached]     the source's own assertion
 * @param {number|null} [verification.connectedSeconds]
 * @param {string|null} [verification.direction]    'outbound' | 'inbound'
 * @returns {object} a new call record
 */
export function applyVerification(call, verification) {
  if (call == null || verification == null) return call;
  if (call.verification != null) return call;

  const reached = typeof verification.reached === 'boolean' ? verification.reached : null;
  const declared = dispositionReached(call.disposition);

  let agreement = VERIFICATION_AGREEMENT.UNDETERMINED;
  if (reached !== null && declared !== null) {
    agreement = reached === declared
      ? VERIFICATION_AGREEMENT.AGREES
      : VERIFICATION_AGREEMENT.CONTRADICTS;
  }

  const connectedSeconds = Number.isFinite(verification.connectedSeconds)
    ? verification.connectedSeconds
    : null;

  return {
    ...call,
    verification: {
      source: verification.source ?? null,
      reached,
      connectedSeconds,
      direction: verification.direction ?? null,
      agreement,
    },
  };
}

/**
 * Does a verification EVIDENCE a contact?
 *
 * Requires the source to assert `reached: true` AND not to contradict the
 * agent. A contradicted claim is a finding, not evidence — counting it as
 * evidenced would resolve the dispute in the source's favour, which is exactly
 * the product decision this module refuses to make by implementation.
 */
function verificationEvidencesContact(verification) {
  return Boolean(
    verification
    && verification.reached === true
    && verification.agreement !== VERIFICATION_AGREEMENT.CONTRADICTS,
  );
}

/**
 * callCountsOn — the contact arithmetic for one day. Attempts, and the two
 * provenance lanes over them, kept apart by the SHAPE of the return value.
 *
 * Reads `state.calls` on `day`, exactly as `activityLedger.js` does, so the two
 * modules always describe the same population.
 *
 * ── WHY `declaredContacts` DOES NOT SHRINK WHEN A VERIFICATION LANDS ────────
 * The agent's account is a fact about what the agent said, and a machine
 * confirming it later does not retract it. So a call verified as reached stays
 * counted in `declaredContacts` and ALSO appears in `evidencedContacts`. That is
 * what keeps every count monotone under verification (the whole point of the
 * late-arrival case) — and it is precisely why the sum is forbidden: adding the
 * two lanes would double-count the calls that are in both.
 *
 * @returns {{
 *   calls:number, declaredContacts:number, evidencedContacts:number,
 *   contestedContacts:number, contactsClaimed:number, pctEvidenced:(number|null)
 * }}
 *   · `calls` — attempts. Evidenced by the records themselves.
 *   · `declaredContacts` — the agent's account says a person was reached.
 *   · `evidencedContacts` — a source asserts it and does not contradict them.
 *   · `contestedContacts` — a source contradicts the agent. Surfaced as its own
 *     figure so a disagreement is visible rather than absorbed into one lane.
 *   · `contactsClaimed` — the number of DISTINCT calls either lane claims as a
 *     contact. A UNION, NOT A SUM: a call claimed by both is counted once. It
 *     exists because v3 rule 5 requires the percentage evidenced to be visible,
 *     and a percentage needs an honest denominator.
 *   · `pctEvidenced` — `evidencedContacts / contactsClaimed`, or null when
 *     nothing is claimed so a consumer renders "—" rather than a confident 0%.
 *     It is a RATIO, not a count, and it is deliberately NOT monotone: logging a
 *     fresh unverified contact correctly LOWERS the share that is evidenced. The
 *     monotonicity properties assert over the counts and exclude it by name.
 *
 * There is no `total` field, and no function in this module returns one.
 */
export function callCountsOn(state, day) {
  const calls = (state?.calls ?? []).filter((c) => c && c.date === day);

  let declaredContacts = 0;
  let evidencedContacts = 0;
  let contestedContacts = 0;
  let contactsClaimed = 0;

  for (const call of calls) {
    const declared = dispositionReached(call.disposition) === true;
    const evidenced = verificationEvidencesContact(call.verification);

    if (declared) declaredContacts += 1;
    if (evidenced) evidencedContacts += 1;
    if (call.verification?.agreement === VERIFICATION_AGREEMENT.CONTRADICTS) {
      contestedContacts += 1;
    }
    if (declared || evidenced) contactsClaimed += 1;
  }

  return {
    calls: calls.length,
    declaredContacts,
    evidencedContacts,
    contestedContacts,
    contactsClaimed,
    pctEvidenced: contactsClaimed === 0
      ? null
      : Math.round((evidencedContacts / contactsClaimed) * 100),
  };
}

/**
 * The count fields of `callCountsOn`, named once so the monotonicity properties
 * iterate over a derived list rather than a literal that could drift from the
 * return shape. `pctEvidenced` is absent BY DESIGN — see `callCountsOn`.
 */
export const CALL_COUNT_KEYS = Object.freeze([
  'calls',
  'declaredContacts',
  'evidencedContacts',
  'contestedContacts',
  'contactsClaimed',
]);
