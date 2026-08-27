'use strict';

/**
 * outcomeMap — THE KQM Calls to AgencyTrack mapping. One table, one place.
 *
 * Slice B, operator rulings 26 Aug 2026. Every colour of this endpoint's
 * behaviour derives from the two frozen tables below. Adding a KQM outcome or a
 * campaign must require an edit HERE AND NOWHERE ELSE — the v3 rule-1 discipline
 * that ACTIVITY_METADATA established, applied to the fourth vocabulary in this
 * repo (after activity codes, appointment statuses and CALL_DISPOSITIONS).
 *
 * ── WHY THIS IS NOT src/lib/schema/callRecord.js ────────────────────────────
 * CALL_DISPOSITIONS is AgencyTrack's OWN six-value outcome vocabulary, typed by
 * an agent in Daily Capture. The table here is the EXTERNAL vocabulary KQM Calls
 * emits — nineteen values, a different and larger set. They are two vocabularies
 * about the same subject, not one vocabulary in two files, and collapsing them
 * would force one of the two products to speak the other's language.
 *
 * What IS shared is the `reached` RULING, and it is deliberately consistent:
 * `reached` is TRUE for Not interested. They answered and said no. That is a
 * contact, an unsuccessful one. Conflating "did not want it" with "did not
 * answer" undercounts contacts the agent genuinely made.
 *
 * Cloud Functions run CJS and cannot import from the ESM src/ tree, so even a
 * genuinely shared value would have to be restated here. Restating a DIFFERENT
 * vocabulary is honest; restating the SAME one is the twin class that produced
 * every regression in the v3 prototype.
 *
 * ── CAMPAIGN DECIDES THE LANE, OUTCOME DECIDES THE EFFECT ───────────────────
 * The two tables are orthogonal on purpose, and that orthogonality is what makes
 * decision 4 mechanical rather than a special case someone has to remember:
 *
 *   the OUTCOME says WHAT HAPPENED   — was a person reached, was something
 *                                      booked, was a new name produced
 *   the CAMPAIGN says WHICH LANE     — new-business (dials / telContacts) or
 *                                      servicing (serviceCalls / serviceContacts)
 *
 * A Portfolio call that reaches the client therefore writes serviceContacts and
 * NOT telContacts — not because a rule says "if portfolio then skip
 * telContacts", but because telContacts is not in the servicing lane at all.
 * telContacts keeps meaning "people reached about NEW BUSINESS". Decision 4.
 *
 * ── dialsByType IS A PARTITION, NOT A SET OF TAGS ───────────────────────────
 * Decision 1. Every new-business call bumps `dials` by one and EXACTLY ONE
 * bucket by one, so the four buckets always sum to `dials`. That is why the
 * bucket is a total function of campaignCode and never of the outcome: a value
 * that could be two things would break the sum. Property-tested.
 *
 * `seminarTradeshow` is never written by this endpoint — no KQM campaign feeds
 * it, and it stays an agent-typed field. Zero is a correct partition member and
 * the sum holds regardless.
 *
 * ── followUp MEANS A DUE CALLBACK, AND NOTHING ELSE ─────────────────────────
 * Decision 2. `due_callback` is the campaign KQM Calls uses when the call
 * fulfils a scheduled callback in crm.activities. A REDIAL of a no-answer stays
 * in its own campaign bucket and must never arrive here as `due_callback`. A
 * follow-up is a promise kept, not a retry. Counting redials as follow-ups
 * inflates followUpCalls against coldCalls and quietly destroys coldCalls as a
 * measure of new-name attempts.
 *
 * This is the ONE rule on this page the CALLER must honour and this endpoint
 * cannot verify — AgencyTrack has no sight of crm.activities. It is stated here
 * because slice C is written against this file.
 */

/**
 * CALL_OUTCOMES — the KQM Calls outcome vocabulary.
 *
 *   key      the stored enum value. snake_case, matching the key-naming note in
 *            src/lib/schema/callRecord.js, so the stored form never needs a
 *            display transform.
 *   label    display form, and the row of the operator's mapping table it came
 *            from, so brief and code can be diffed by eye.
 *   reached  a PERSON was reached. THE one classifier; a `contacted` boolean
 *            beside it would be a twin of this column.
 *   booking  an appointment was set                 -> appointmentsSet
 *   ffi      a fact-finding interview was scheduled -> ffisScheduled
 *   newName  a new prospect name was produced       -> newNamesAdded
 *
 * booking / ffi / newName default to false and are stated only where true, so
 * the exceptional rows are the ones that catch the eye.
 */
const CALL_OUTCOMES = Object.freeze([
  // Not reached — an attempt, and nothing more.
  Object.freeze({ key: 'no_answer',             label: 'No answer',             reached: false }),
  Object.freeze({ key: 'wrong_number',          label: 'Wrong number',          reached: false }),
  Object.freeze({ key: 'number_out_of_service', label: 'Number out of service', reached: false }),

  // Reached, no further consequence.
  Object.freeze({ key: 'gatekeeper_blocked',    label: 'Gatekeeper blocked',    reached: true }),
  Object.freeze({ key: 'not_interested',        label: 'Not interested',        reached: true }),
  Object.freeze({ key: 'already_has_plan',      label: 'Already has a plan',    reached: true }),
  Object.freeze({ key: 'no_budget',             label: 'No budget',             reached: true }),
  Object.freeze({ key: 'callback_scheduled',    label: 'Callback scheduled',    reached: true }),
  Object.freeze({ key: 'send_info_email',       label: 'Send info by email',    reached: true }),
  Object.freeze({ key: 'principal_interested',  label: 'Principal interested',  reached: true }),
  Object.freeze({ key: 'approved_in_principle', label: 'Approved in principle', reached: true }),
  Object.freeze({ key: 'parent_list_promised',  label: 'Parent list promised',  reached: true }),
  Object.freeze({ key: 'do_not_call',           label: 'Do not call requested', reached: true }),

  // Reached, and an appointment came out of it.
  Object.freeze({ key: 'meeting_booked',           label: 'Meeting booked',           reached: true, booking: true }),
  Object.freeze({ key: 'orientation_slot_offered', label: 'Orientation slot offered', reached: true, booking: true }),

  // Reached, and a NAME came out of it. A referral produces a new prospect to
  // approach, so it is newNamesAdded. It is NOT `referralsObtained` — that field
  // counts referrals credited on the weekly report and still has NO daily
  // writer. See the half-retired guard in functions/aggregators/dailyToWeekly.js.
  Object.freeze({ key: 'referred_to_board_pta', label: 'Referred to Board/PTA',      reached: true, newName: true }),
  Object.freeze({ key: 'referred_to_person',    label: 'Referred to another person', reached: true, newName: true }),
  Object.freeze({ key: 'not_decision_maker',    label: 'Not the decision maker',     reached: true, newName: true }),

  // Servicing. Books a portfolio review, which IS a fact-finding interview.
  Object.freeze({ key: 'portfolio_review_booked', label: 'Portfolio - review booked', reached: true, booking: true, ffi: true }),
]);

/** key -> row. Derived, so the lookup can never disagree with the table. */
const OUTCOMES_BY_KEY = Object.freeze(
  CALL_OUTCOMES.reduce((acc, o) => {
    acc[o.key] = o;
    return acc;
  }, Object.create(null)),
);

/** Ordered enum keys, table order. */
const OUTCOME_KEYS = Object.freeze(CALL_OUTCOMES.map((o) => o.key));

/**
 * CAMPAIGN_LANES — campaignCode -> where its calls land.
 *
 *   lane    'newBusiness' | 'servicing'
 *   bucket  the dialsByType partition member. NEW-BUSINESS ONLY — a servicing
 *           call is not a dial and belongs to no bucket, which is why this is
 *           null there rather than a fourth-and-a-half bucket value.
 */
const CAMPAIGN_LANES = Object.freeze({
  schools:          Object.freeze({ lane: 'newBusiness', bucket: 'cold' }),
  group_benefits:   Object.freeze({ lane: 'newBusiness', bucket: 'cold' }),
  religious_houses: Object.freeze({ lane: 'newBusiness', bucket: 'cold' }),
  referrals:        Object.freeze({ lane: 'newBusiness', bucket: 'referral' }),
  due_callback:     Object.freeze({ lane: 'newBusiness', bucket: 'followUp' }),
  portfolio:        Object.freeze({ lane: 'servicing',   bucket: null }),
});

const CAMPAIGN_CODES = Object.freeze(Object.keys(CAMPAIGN_LANES));

/** The four dialsByType partition members, in schema order. */
const DIAL_BUCKETS = Object.freeze(['cold', 'referral', 'followUp', 'seminarTradeshow']);

function isKnownOutcome(key) {
  return Object.prototype.hasOwnProperty.call(OUTCOMES_BY_KEY, key);
}

function isKnownCampaign(key) {
  return Object.prototype.hasOwnProperty.call(CAMPAIGN_LANES, key);
}

/**
 * mapCall — one call in, the exact set of dailyActivity increments out.
 *
 * PURE. No Firestore, no clock, no I/O. Every branch of this endpoint's KPI
 * arithmetic is decided here and can be tested without a database.
 *
 * Returns a FLAT map of dotted field paths -> +1, ready to hand to
 * FieldValue.increment. Dotted paths ('dialsByType.cold') are what Firestore
 * wants for a nested field, and keeping the map flat means the caller never
 * rebuilds a nested object and never has to read the doc first.
 *
 * THROWS on an unknown outcome or campaign rather than returning an empty map.
 * An unmapped outcome silently counted as nothing — or worse, as a plain dial —
 * is a data defect that looks like a rounding error for months. Fail loudly at
 * the door instead.
 *
 * @param {string} campaignCode a CAMPAIGN_LANES key
 * @param {string} outcome      a CALL_OUTCOMES key
 * @returns {{increments: Object, lane: string, bucket: (string|null), reached: boolean}}
 */
function mapCall(campaignCode, outcome) {
  if (!isKnownCampaign(campaignCode)) {
    throw new RangeError('unknown campaignCode: ' + String(campaignCode));
  }
  if (!isKnownOutcome(outcome)) {
    throw new RangeError('unknown outcome: ' + String(outcome));
  }

  const { lane, bucket } = CAMPAIGN_LANES[campaignCode];
  const row = OUTCOMES_BY_KEY[outcome];
  const increments = Object.create(null);

  if (lane === 'servicing') {
    // Decision 4. The attempt and the reach, and NOTHING in the new-business
    // lane. dials, dialsByType and telContacts are absent BY CONSTRUCTION —
    // there is no branch in here that could add them.
    increments.serviceCalls = 1;
    if (row.reached) increments.serviceContacts = 1;
  } else {
    // Decision 1: +1 to the total AND +1 to exactly one bucket, always
    // together. The partition holds because these two lines are inseparable.
    increments.dials = 1;
    increments['dialsByType.' + bucket] = 1;
    if (row.reached) increments.telContacts = 1;
  }

  // Lane-independent consequences. An appointment is an appointment whether it
  // came from a cold call or a portfolio review, and a name is a name.
  if (row.booking) increments.appointmentsSet = 1;
  if (row.ffi) increments.ffisScheduled = 1;
  if (row.newName) increments.newNamesAdded = 1;

  return { increments, lane, bucket, reached: Boolean(row.reached) };
}

/**
 * WRITABLE_FIELDS — every dailyActivity field this endpoint may EVER touch.
 *
 * DERIVED by running every legal (campaign, outcome) pair through mapCall, so it
 * cannot drift from what mapCall actually emits. A hand-written literal here
 * would be a twin of the tables above.
 *
 * The endpoint uses it as a write allow-list. Nothing else on the weekly report
 * comes from a phone call — API, apps, lives, hours, F2F, social and letters are
 * out of scope and must stay untouched. Asserted against
 * src/lib/schema/dailyActivity.js in the tests, so a schema rename breaks a test
 * rather than silently writing a field that no longer exists.
 */
const WRITABLE_FIELDS = Object.freeze(
  Array.from(
    CAMPAIGN_CODES.reduce((set, c) => {
      for (const o of OUTCOME_KEYS) {
        for (const f of Object.keys(mapCall(c, o).increments)) set.add(f);
      }
      return set;
    }, new Set()),
  ).sort(),
);

module.exports = {
  CALL_OUTCOMES,
  OUTCOME_KEYS,
  CAMPAIGN_LANES,
  CAMPAIGN_CODES,
  DIAL_BUCKETS,
  WRITABLE_FIELDS,
  isKnownOutcome,
  isKnownCampaign,
  mapCall,
};
