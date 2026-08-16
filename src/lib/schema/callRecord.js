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
 * ── THE TWO LANES ARE DISJOINT, AND A VERIFICATION IS A TRANSFER ────────────
 * Same shape as `activityLedger.js`: evidenced and declared are two POPULATIONS,
 * not two claims about one population. A call is in AT MOST ONE lane — never
 * both, and in NEITHER when no source claims a contact for it.
 *
 *   evidencedContacts     a machine confirmed it
 *   declaredOnlyContacts  the agent's word, and nothing has confirmed it YET
 *   total                 evidencedContacts + declaredOnlyContacts
 *
 * `declaredOnly` is named for what it is. `declaredContacts` would invite the
 * reading "all the contacts the agent claimed", which is a different and larger
 * quantity — and a figure that gets misread on a manager's screen is the exact
 * failure mode this module exists to prevent.
 *
 * Disjointness is what makes `total` honest to emit: it is the number of calls
 * claimed as a contact by either source, with no call counted twice. What
 * protects that is not the absence of a sum but DISJOINTNESS plus CONSERVATION,
 * and both are property-tested rather than asserted here.
 *
 * ── VERIFICATION ARRIVES LATE, AND CREDIT MUST NOT FALL ─────────────────────
 * Under a Microsoft-Graph-style source (the eventual upgrade IF Tatil moves to
 * Teams Phone — do not build it) a verification lands hours after the call.
 *
 * The guarantee an agent needs is NOT that every field is monotonic — it is that
 * CREDIT NEVER FALLS WHEN A MACHINE CONFIRMS THEIR WORK. So:
 *
 *   · `evidencedContacts` NEVER decreases.
 *   · `total` NEVER decreases.
 *   · `declaredOnlyContacts` MAY decrease — and only by exactly the amount
 *     `evidencedContacts` rises.
 *
 * That third clause is the real invariant: AN AGREEING VERIFICATION IS A
 * TRANSFER BETWEEN LANES, NOT AN ADDITION. Conservation is strictly stronger
 * than "nothing went down" — it catches double-counting and lane leakage in one
 * assertion, and a direction-only check sees neither.
 *
 * ── CONSERVATION IS SCOPED TO AGREEMENT, DELIBERATELY ───────────────────────
 * When a verification CONTRADICTS the disposition — the agent recorded no
 * answer, the machine reports 45 connected seconds — conservation does NOT hold,
 * because the machine is asserting a contact the agent never claimed. That case
 * is surfaced as `contestedContacts` and left unresolved.
 *
 * So the conservation property is CONDITIONED on agreement. Letting it range
 * over contradictions would force this module to decide which source wins in
 * order to keep the arithmetic balanced — answering the open question by
 * implementation, through a test, which is the quietest possible way to do it.
 *
 * ── AN UNRESOLVED DISPUTE MOVES NO CREDIT ───────────────────────────────────
 * READ THIS BEFORE "TIDYING" THE COUNTING LOOP. It reads as an inconsistency and
 * it is not one.
 *
 * THE RULE: while the two sources disagree, `total` does not move — IN EITHER
 * DIRECTION — because moving credit would settle the dispute, and the dispute is
 * not settled. A figure that shifts the moment a disagreement appears has
 * already picked a side. Holding it still is what "surfaced, not resolved" means
 * arithmetically.
 *
 * This is not a rule about who is believed. It falls out of each lane holding
 * exactly what its OWN source asserted, with neither source permitted to write
 * into the other's lane:
 *
 *   agent claims a contact, machine denies it
 *     → stays in `declaredOnly`, never promoted to evidenced. The machine
 *       withheld its confirmation; it did not withdraw the agent's claim.
 *
 *   machine claims a contact, the agent never did
 *     → lands in NO lane, never credited. The agent opened no claim for it to
 *       occupy, and the machine cannot open one on their behalf.
 *
 * Both directions are flagged in `contestedContacts`. Neither moves `total`.
 * Property-tested, because a comment is not a guard.
 *
 * The tempting simplification is to gate BOTH lanes on non-contradiction so
 * "contested counts in neither lane" is uniformly true. Do not. It makes `total`
 * fall from 1 to 0 the moment a machine disagrees — a manager-facing figure about
 * a named agent dropping because an external system said so, which is this
 * module's entire reason for existing. Arithmetically that is the machine
 * winning, and the machine winning is NOT a resolution of the open question: it
 * is the system behaving as though the question were already settled.
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
 * ── `declaredOnlyContacts` SHRINKS WHEN A VERIFICATION LANDS, BY DESIGN ─────
 * An agreeing verification MOVES a call from the declared-only lane to the
 * evidenced lane. It does not add one. `declaredOnly` therefore falls by exactly
 * one as `evidenced` rises by one, `total` is unchanged, and the agent's credit
 * is untouched — which is the guarantee that actually matters. Conservation is
 * property-tested; see the header for why it is scoped to agreement.
 *
 * @returns {{
 *   calls:number, evidencedContacts:number, declaredOnlyContacts:number,
 *   contestedContacts:number, total:number, pctEvidenced:(number|null)
 * }}
 *   · `calls` — attempts. Evidenced by the records themselves.
 *   · `evidencedContacts` — a source asserts a contact and does not contradict
 *     the agent.
 *   · `declaredOnlyContacts` — the agent's account says a person was reached and
 *     NOTHING HAS CONFIRMED IT YET. Not "every contact the agent claimed" — once
 *     a machine confirms one, it is counted in the evidenced lane instead.
 *   · `contestedContacts` — a source contradicts the agent. Its own figure, so
 *     the disagreement is visible rather than silently resolved. It OVERLAPS the
 *     lanes rather than replacing them: the call keeps whatever lane its own
 *     source's claim earned it, and `total` does not move in either direction.
 *     See "WHICH LANE A CONTESTED CALL SITS IN" in the header — the uniform-
 *     looking alternative deletes an agent's credit on a machine's say-so.
 *   · `total` — `evidencedContacts + declaredOnlyContacts`. Honest because the
 *     lanes are disjoint: no call is counted twice. This is the figure v3 rule 5
 *     needs as the denominator for the percentage evidenced.
 *   · `pctEvidenced` — `evidencedContacts / total` as a WHOLE-NUMBER
 *     PERCENTAGE, 0–100, rounded. A consumer appends "%" and must never
 *     multiply by 100 again. Null when nothing is claimed, so the surface
 *     renders "—" rather than a confident 0%. Same units and same null
 *     convention as `evidencedPct` in `activityLedger.js` — the two figures sit
 *     next to each other on the same row and must not disagree about scale.
 *     It is a RATIO, not a count, and it is deliberately NOT monotone: logging a
 *     fresh unverified contact correctly LOWERS the share that is evidenced. The
 *     monotonicity properties assert over the counts and exclude it by name.
 *     `Math.round` can return 100 short of completeness (it needs ~200 claimed
 *     contacts in one day to happen at all). That is the ledger's shipped
 *     convention and is matched deliberately: diverging to `Math.floor` here
 *     would make two adjacent percentages round differently, which is a worse
 *     defect than the one it fixes.
 */
export function callCountsOn(state, day) {
  const calls = (state?.calls ?? []).filter((c) => c && c.date === day);

  let evidencedContacts = 0;
  let declaredOnlyContacts = 0;
  let contestedContacts = 0;

  for (const call of calls) {
    const declared = dispositionReached(call.disposition) === true;
    const evidenced = verificationEvidencesContact(call.verification);

    // The lanes are exclusive at the point of counting, which is what makes
    // `total` a sum rather than an over-count. `declaredOnly` is the residue.
    if (evidenced) evidencedContacts += 1;
    else if (declared) declaredOnlyContacts += 1;

    if (call.verification?.agreement === VERIFICATION_AGREEMENT.CONTRADICTS) {
      contestedContacts += 1;
    }
  }

  const total = evidencedContacts + declaredOnlyContacts;

  return {
    calls: calls.length,
    evidencedContacts,
    declaredOnlyContacts,
    contestedContacts,
    total,
    pctEvidenced: total === 0 ? null : Math.round((evidencedContacts / total) * 100),
  };
}

/**
 * The count fields of `callCountsOn`. Named once so the properties iterate over
 * a list pinned to the return shape rather than a literal that could drift from
 * it. `pctEvidenced` is absent BY DESIGN — it is a ratio, not a count.
 */
export const CALL_COUNT_KEYS = Object.freeze([
  'calls',
  'evidencedContacts',
  'declaredOnlyContacts',
  'contestedContacts',
  'total',
]);

/**
 * The counts that may never fall when a VERIFICATION arrives.
 *
 * `declaredOnlyContacts` is the one exclusion, and it is not a weakening: an
 * agreeing verification moves a call OUT of that lane by design, so asserting it
 * never decreases would assert the transfer never happens. What replaces the
 * missing direction-check is the conservation property, which is stronger —
 * `declaredOnly` may fall, and ONLY by exactly the amount `evidenced` rises.
 *
 * Derived, so the drift guard on `CALL_COUNT_KEYS` covers this list too.
 */
export const VERIFICATION_MONOTONE_KEYS = Object.freeze(
  CALL_COUNT_KEYS.filter((k) => k !== 'declaredOnlyContacts'),
);
