'use strict';

/**
 * outcomeMap — THE call-effect table. One table, one place.
 *
 * Slice C2, operator rulings 27 Aug 2026. This file NO LONGER KNOWS ANY KQM
 * VOCABULARY. It knows effects.
 *
 * ── WHY THE VOCABULARY LEFT THIS FILE ───────────────────────────────────────
 * Slice B put KQM's outcome names and campaign codes in here and mapped them to
 * effects internally. A live audit of the KQM database on 27 Aug found that
 * contract matched almost nothing real: every campaign carries a `_2026` suffix,
 * outcomes arrive as display labels ("No budget - parents pay"), and there are
 * about a hundred of them across five campaigns rather than nineteen. Worse than
 * the mismatch was the SHAPE of the mismatch — KQM can create a campaign freely
 * and a trigger seeds a fresh outcome vocabulary for each one, so any design
 * that pins KQM's words into AgencyTrack's source is a design that silently
 * stops counting calls the first time somebody adds a campaign.
 *
 * The operator ruled: KQM NORMALISES, AGENCYTRACK VALIDATES. The payload now
 * carries EFFECTS, not names. Each system owns its own vocabulary and neither
 * has to be redeployed when the other's changes.
 *
 * The file NAME is kept so this slice's diff stays inside its scope-lock
 * inventory. What it maps is effects.
 *
 * ── THE CONTRACT IS CLOSED, SO THE REJECTIONS GET STRICTER ──────────────────
 * An unrecognised outcome still counts the call — but that is handled KQM-side,
 * where the vocabulary lives. What arrives here is a small closed set of
 * booleans, so anything outside it is a defect in the caller and earns a loud
 * 400 rather than a generous interpretation. Ruling 2.
 *
 * ── LANE DECIDES WHICH CONTACT FIELD MOVES ──────────────────────────────────
 * Decision 4, and it survives MECHANICALLY rather than as a remembered special
 * case. A servicing call that reaches the client writes serviceContacts and
 * never telContacts — not because a rule says "if servicing then skip
 * telContacts", but because telContacts's row is predicated on the new-business
 * lane and there is no branch that could add it. telContacts keeps meaning
 * "people reached about NEW BUSINESS".
 *
 * ── dialsByType IS A PARTITION, NOT A SET OF TAGS ───────────────────────────
 * Decision 1. Every new-business call bumps `dials` by one and EXACTLY ONE
 * bucket by one, so the four buckets always sum to `dials`.
 *
 * In slice B that held because the campaign was a total function to one bucket.
 * The bucket is now an INPUT, so the invariant has moved to the boundary: the
 * bucket must be non-null exactly when the lane is new business, and null
 * exactly when it is servicing. `coherenceError` is the whole of that rule and
 * it is ASSERTED, never assumed — see the note there. Property-tested.
 *
 * `seminarTradeshow` is a real partition member of the schema and is
 * deliberately NOT accepted from KQM: no calling campaign feeds it, it stays an
 * agent-typed field, and zero is a correct partition member. Rejecting it at the
 * boundary preserves slice B's "never written by this endpoint" property now
 * that the bucket arrives from outside.
 *
 * ── followUp IS DECIDED KQM-SIDE ────────────────────────────────────────────
 * Ruling 3. KQM resolves a call against a due `next_at` in crm.activities and
 * sends `bucket: "followUp"`. AgencyTrack does not re-derive it and has no sight
 * of crm.activities to do so. A REDIAL of a no-answer is not a follow-up — a
 * follow-up is a promise kept, not a retry — and counting redials as follow-ups
 * inflates followUpCalls against coldCalls and destroys coldCalls as a measure
 * of new-name attempts. That is the ONE rule on this page the CALLER must honour
 * and this endpoint cannot verify.
 */

/** The two lanes. A call is new business or it is servicing; there is no third. */
const LANES = Object.freeze(['newBusiness', 'servicing']);

/**
 * The four dialsByType partition members, in schema order. All four exist in
 * src/lib/schema/dailyActivity.js; only the first three may arrive here.
 */
const DIAL_BUCKETS = Object.freeze(['cold', 'referral', 'followUp', 'seminarTradeshow']);

/** The buckets KQM may send. seminarTradeshow is agent-typed — see header. */
const INGEST_BUCKETS = Object.freeze(['cold', 'referral', 'followUp']);

/** The four effect booleans. Every one is REQUIRED — see coherenceError. */
const EFFECT_FLAGS = Object.freeze(['reached', 'booking', 'newName', 'ffi']);

/**
 * THE LADDER FLAGS — what HAPPENED, as opposed to what was attempted.
 *
 * The four flags above describe a phone call. These five describe the selling
 * ladder in src/constants/activityMetadata.js — A.I, F.F.I, the solution
 * presentation, C.I, and the delivered policy. They arrive from KQM's meeting
 * and milestone events (sql/34), which record that a booked appointment was
 * actually held.
 *
 * ⚠ OPTIONAL, AND THE FOUR ABOVE STAY REQUIRED. Adding these to EFFECT_FLAGS
 * would have made every one of them mandatory, and the live KQM caller sends
 * exactly four booleans — so the next call logged after deploy would 400, the
 * outbox would mark it `rejected` (permanent, by design), and the dispatch would
 * stop dead. Absent means false. That asymmetry is not untidiness; it is the
 * only shape that lets this deploy before its caller changes.
 *
 * No `newBusiness.apps` / `newBusiness.api` row here, deliberately. Those feed
 * totalProductionCredit, which the awards engine and the new-agent financing
 * ruleset compute from — an API figure typed into a CRM panel reaching that
 * number unreviewed is a different proposition from a count reaching a points
 * total, and it is the operator's call, not this file's. Application taken still
 * flows to ApplyOn, which has a human gate in front of it.
 */
const LADDER_FLAGS = Object.freeze([
  'approachHeld',    // A.I  — the first interview happened  -> qualifiedApproaches
  'presented',       // the solution was presented           -> solutionPresentations
  'ffiHeld',         // F.F.I conducted                      -> ffiConducted
  'closingHeld',     // C.I conducted                        -> ciConducted
  'policyDelivered', // the policy was delivered             -> policiesDelivered
]);

/**
 * KINDS — is this request a CALL, or something that happened afterwards?
 *
 * ⚠ THE ROW THIS EXISTS FOR IS `dials`. Every call row below fires on the lane
 * alone, because until now every request WAS a call. A fact find arriving with
 * lane 'newBusiness' would therefore have bumped `dials` and a dialsByType
 * bucket as well as ffiConducted — inflating the dial count with meetings, and
 * inflating it invisibly, since the partition would still balance.
 *
 * `kind` is what stops that, and it defaults to 'call' so the existing caller's
 * payload means exactly what it meant before.
 */
const KINDS = Object.freeze(['call', 'ladder']);
const isCall = (e) => (e.kind || 'call') === 'call';
const isLadder = (e) => e.kind === 'ladder';

/**
 * ONE predicate per lane, referenced by every row that depends on it.
 *
 * `dials` and `dialsByType.<bucket>` share the SAME FUNCTION REFERENCE, so they
 * cannot be made to disagree by an edit to one of them. That is a stronger
 * guarantee than slice B's two adjacent lines, and it is the mechanical half of
 * the partition invariant — the other half is coherenceError.
 */
const isNewBusiness = (e) => e.lane === 'newBusiness';
const isServicing = (e) => e.lane === 'servicing';

/**
 * EFFECT_TABLE — the whole of the mapping, one row per line of the brief's
 * table. Adding an effect is an edit HERE AND NOWHERE ELSE: WRITABLE_FIELDS is
 * derived from it, and mapEffects does nothing but walk it.
 *
 *   field  the dailyActivity field to bump, or a function of the effects when
 *          the field NAME itself depends on them (the bucket, and only that)
 *   when   the predicate. The last three rows are lane-independent: an
 *          appointment is an appointment whether it came from a cold call or a
 *          portfolio review, and a name is a name.
 */
const EFFECT_TABLE = Object.freeze([
  // ── the call rows. Every one now also requires kind 'call' — see KINDS. ──
  Object.freeze({ field: 'dials', when: (e) => isCall(e) && isNewBusiness(e) }),
  Object.freeze({
    field: (e) => 'dialsByType.' + e.bucket,
    when: (e) => isCall(e) && isNewBusiness(e),
  }),
  Object.freeze({ field: 'telContacts', when: (e) => isCall(e) && isNewBusiness(e) && e.reached }),
  Object.freeze({ field: 'serviceCalls', when: (e) => isCall(e) && isServicing(e) }),
  Object.freeze({
    field: 'serviceContacts',
    when: (e) => isCall(e) && isServicing(e) && e.reached,
  }),
  // Lane-independent, and call-only: an appointment is set ON a call, a name is
  // given ON a call, an FFI is scheduled ON a call.
  Object.freeze({ field: 'appointmentsSet', when: (e) => isCall(e) && e.booking }),
  Object.freeze({ field: 'newNamesAdded', when: (e) => isCall(e) && e.newName }),
  Object.freeze({ field: 'ffisScheduled', when: (e) => isCall(e) && e.ffi }),

  // ── the ladder rows. What happened after the phone was put down. ─────────
  // Lane-independent for the same reason the three above are: a fact find is a
  // fact find whether the name came from a cold list or a portfolio review.
  Object.freeze({ field: 'qualifiedApproaches', when: (e) => isLadder(e) && e.approachHeld }),
  Object.freeze({ field: 'solutionPresentations', when: (e) => isLadder(e) && e.presented }),
  Object.freeze({ field: 'ffiConducted', when: (e) => isLadder(e) && e.ffiHeld }),
  Object.freeze({ field: 'ciConducted', when: (e) => isLadder(e) && e.closingHeld }),
  Object.freeze({ field: 'policiesDelivered', when: (e) => isLadder(e) && e.policyDelivered }),
]);

/**
 * coherenceError — the boundary assertion. Returns an error string, or null when
 * the effect set is one this endpoint may act on.
 *
 * ── ASSERT IT, DO NOT ASSUME KQM GETS IT RIGHT ──────────────────────────────
 * Every rule below used to be guaranteed by construction, because slice B
 * derived these values from its own frozen tables. They now arrive from another
 * system over HTTP, so each one is a thing that CAN be wrong and therefore a
 * thing that MUST be checked. A malformed effect set that is written rather than
 * rejected produces no error anywhere; it produces a number in a named agent's
 * report that no later run corrects.
 *
 * THE LANE/BUCKET PARTITION. A servicing call carrying a bucket would add to
 * dialsByType without adding to dials and break the sum. A new-business call
 * without one would move `dials` while every bucket stayed put, and break it the
 * other way. Both directions are rejected; neither is repaired, because a
 * repaired value is a guess about what the caller meant.
 *
 * FFI IMPLIES BOOKING. Scheduling a fact-finding interview IS setting an
 * appointment — an FFI is a KIND of appointment, not a parallel thing — so `ffi`
 * without `booking` would write ffisScheduled while appointmentsSet stayed put,
 * and a manager would read one FFI scheduled and no appointment set for it. That
 * is a half-state, so it is a 400. The converse IS legal and common: plenty of
 * booked meetings are not fact-finding interviews.
 *
 * THE BOOLEANS ARE STRICT. `reached: "false"` is a truthy STRING, and accepting
 * it would count a contact that never happened, silently, on every call a
 * serialiser mangled. All four are REQUIRED rather than defaulted to false for
 * the same reason: an absent `reached` defaulting to false undercounts contacts
 * an agent genuinely made, and an undercount looks exactly like a quiet week.
 */
function coherenceError(effects) {
  if (effects === null || typeof effects !== 'object' || Array.isArray(effects)) {
    return 'effects must be an object';
  }

  if (!LANES.includes(effects.lane)) {
    return 'lane must be one of ' + LANES.join(', ');
  }

  for (const flag of EFFECT_FLAGS) {
    if (typeof effects[flag] !== 'boolean') {
      return flag + ' must be a boolean (true or false), and is required';
    }
  }

  // kind is OPTIONAL and defaults to 'call', so a payload written before this
  // existed still means exactly what it meant. Present-but-wrong is still a 400.
  if (effects.kind !== undefined && !KINDS.includes(effects.kind)) {
    return 'kind must be one of ' + KINDS.join(', ');
  }

  // The ladder flags are optional; absent means false. Present-but-not-a-boolean
  // is rejected for the same reason the required four are: `"false"` is a truthy
  // string, and a serialiser that mangles one would silently credit a meeting
  // that never happened.
  for (const flag of LADDER_FLAGS) {
    if (effects[flag] !== undefined && typeof effects[flag] !== 'boolean') {
      return flag + ' must be a boolean when present';
    }
  }

  if (isLadder(effects)) {
    // A ladder event is not a dial, so it has no bucket to belong to. Allowing
    // one would let a fact find carry a partition member that nothing increments
    // — the buckets would stop summing to dials, invisibly.
    if (effects.bucket !== null) {
      return 'bucket must be null when kind is ladder';
    }
    // A request that claims to be a ladder event and asserts nothing about the
    // ladder writes NOTHING. That is a caller defect, not a quiet no-op.
    if (!LADDER_FLAGS.some((f) => effects[f] === true)) {
      return 'kind ladder requires at least one of ' + LADDER_FLAGS.join(', ');
    }
    // The call flags describe a phone call and cannot be true of a meeting.
    // Accepting them would write appointmentsSet or telContacts off an event
    // that was not a call — the exact inflation `kind` exists to prevent.
    for (const flag of EFFECT_FLAGS) {
      if (effects[flag] === true) {
        return flag + ' must be false when kind is ladder';
      }
    }
    return null;
  }

  if (effects.lane === 'servicing') {
    if (effects.bucket !== null) {
      return 'bucket must be null when lane is servicing';
    }
  } else if (!INGEST_BUCKETS.includes(effects.bucket)) {
    return 'bucket must be one of ' + INGEST_BUCKETS.join(', ') + ' when lane is newBusiness';
  }

  if (effects.ffi && !effects.booking) {
    return 'ffi requires booking — scheduling an FFI is setting an appointment';
  }

  // A call cannot assert the ladder. The two vocabularies describe different
  // events and mixing them in one request means the caller has confused them.
  for (const flag of LADDER_FLAGS) {
    if (effects[flag] === true) {
      return flag + ' requires kind ladder';
    }
  }

  return null;
}

/**
 * mapEffects — one effect set in, the exact set of dailyActivity increments out.
 *
 * PURE. No Firestore, no clock, no I/O, and — deliberately — NO SIGHT OF
 * rawOutcome OR rawCampaign. Those are stored on the ingest record so a disputed
 * number can be traced back to what the agent actually clicked, and the way to
 * guarantee nothing branches on them is to keep them out of the only function
 * that decides anything. They are not a parameter here and cannot become one
 * without an edit that is obvious in review.
 *
 * Returns a FLAT map of dotted field paths -> +1, ready for FieldValue.increment.
 * Dotted paths ('dialsByType.cold') are the canonical name of the field, and
 * keeping the map flat means the caller never rebuilds a nested object and never
 * has to read the doc first. See setNested() in the endpoint for the
 * set()-versus-update() trap that shape creates.
 *
 * THROWS on an incoherent effect set rather than returning a partial map. The
 * endpoint validates first and so never reaches the throw; it exists so that a
 * future caller which forgets to validate fails loudly at the door instead of
 * writing a half-state that looks like a rounding error for months.
 *
 * @param {{lane: string, bucket: (string|null), reached: boolean, booking: boolean,
 *          newName: boolean, ffi: boolean}} effects
 * @returns {{increments: Object, lane: string, bucket: (string|null), reached: boolean}}
 */
function mapEffects(effects) {
  const problem = coherenceError(effects);
  if (problem) throw new RangeError('incoherent effects: ' + problem);

  const increments = Object.create(null);
  for (const row of EFFECT_TABLE) {
    if (!row.when(effects)) continue;
    const field = typeof row.field === 'function' ? row.field(effects) : row.field;
    increments[field] = 1;
  }

  return {
    increments,
    lane: effects.lane,
    bucket: effects.bucket,
    reached: effects.reached,
  };
}

/**
 * LEGAL_EFFECT_SETS — every effect set this endpoint will ever accept.
 *
 * The full cross-product of lane × bucket × the four booleans, filtered by
 * coherenceError ITSELF, so the enumeration and the validator cannot disagree.
 * Small enough to enumerate exhaustively (4 lane/bucket shapes × 16 boolean
 * combinations, less the illegal ffi-without-booking quarter), which is why
 * WRITABLE_FIELDS below can be a derivation rather than a sample.
 */
const LEGAL_EFFECT_SETS = Object.freeze(
  (() => {
    const out = [];
    const shapes = [
      // kind 'call' — the four original shapes, unchanged. `kind` is left
      // ABSENT rather than set to 'call' so the enumeration also proves the
      // default still works for a caller that has never heard of it.
      ...INGEST_BUCKETS.map((bucket) => ({ lane: 'newBusiness', bucket })),
      { lane: 'servicing', bucket: null },
      // kind 'ladder' — no bucket in either lane, because a meeting is not a
      // dial and has no partition member.
      { lane: 'newBusiness', bucket: null, kind: 'ladder' },
      { lane: 'servicing', bucket: null, kind: 'ladder' },
    ];
    const ALL = [...EFFECT_FLAGS, ...LADDER_FLAGS];
    for (const shape of shapes) {
      for (let mask = 0; mask < 1 << ALL.length; mask += 1) {
        const set = { ...shape };
        ALL.forEach((flag, i) => {
          set[flag] = Boolean(mask & (1 << i));
        });
        if (coherenceError(set) === null) out.push(Object.freeze(set));
      }
    }
    return out;
  })(),
);

/**
 * WRITABLE_FIELDS — every dailyActivity field this endpoint may EVER touch.
 *
 * DERIVED by running every legal effect set through mapEffects, so it cannot
 * drift from what mapEffects actually emits. A hand-written literal here would
 * be a twin of the table above.
 *
 * ⚠ IT IS A DRIFT GUARD, NOT A RUNTIME ALLOW-LIST. Slice B's comment claimed the
 * endpoint used it to gate writes; it never did — ingestCallActivity.js does not
 * import it, and did not in slice B either. What it ACTUALLY does is fail a test
 * in outcomeMap.test.js if this mapping ever grows a field that is absent from
 * src/lib/schema/dailyActivity.js, or reaches outside the call surface. That is
 * real value and worth keeping; the claim that it guarded the write path was not
 * true, and it has been removed rather than made true, because wiring it into
 * the transaction is a behaviour change this slice was not scoped to make.
 * Banked as a follow-up instead.
 */
const WRITABLE_FIELDS = Object.freeze(
  Array.from(
    LEGAL_EFFECT_SETS.reduce((set, effects) => {
      for (const f of Object.keys(mapEffects(effects).increments)) set.add(f);
      return set;
    }, new Set()),
  ).sort(),
);

module.exports = {
  LANES,
  DIAL_BUCKETS,
  INGEST_BUCKETS,
  EFFECT_FLAGS,
  LADDER_FLAGS,
  KINDS,
  EFFECT_TABLE,
  LEGAL_EFFECT_SETS,
  WRITABLE_FIELDS,
  coherenceError,
  mapEffects,
};
