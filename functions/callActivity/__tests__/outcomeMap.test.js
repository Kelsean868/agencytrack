'use strict';

/**
 * outcomeMap tests — the effect table made mechanical.
 *
 * The load-bearing test in this file is still the PARTITION property, and it is
 * MORE load-bearing than it was in slice B. Decision 1 says dialsByType is a
 * partition, not a set of tags: for ANY sequence of calls the four buckets sum
 * to dials.
 *
 * In slice B that was guaranteed by construction — the campaign was a total
 * function to exactly one bucket, so the property test confirmed a shape the
 * code could barely violate. The bucket is now an INPUT from another system, so
 * the invariant rests entirely on coherenceError rejecting the two combinations
 * that would break it. The property test is now the only thing standing between
 * a partition and a set of tags, which is exactly what the brief says it is.
 */

const fs = require('fs');
const path = require('path');

const {
  LANES,
  DIAL_BUCKETS,
  INGEST_BUCKETS,
  EFFECT_FLAGS,
  EFFECT_TABLE,
  LEGAL_EFFECT_SETS,
  WRITABLE_FIELDS,
  coherenceError,
  mapEffects,
} = require('../outcomeMap');

/** A legal effect set, defaulting to the plainest new-business cold call. */
const eff = (over = {}) => ({
  lane: 'newBusiness',
  bucket: 'cold',
  reached: false,
  booking: false,
  newName: false,
  ffi: false,
  ...over,
});

/** Apply a sequence of effect sets to a zeroed tally. */
function tally(calls) {
  const t = {
    dials: 0,
    telContacts: 0,
    serviceCalls: 0,
    serviceContacts: 0,
    appointmentsSet: 0,
    ffisScheduled: 0,
    newNamesAdded: 0,
    dialsByType: { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 },
  };
  for (const call of calls) {
    for (const [field, delta] of Object.entries(mapEffects(call).increments)) {
      if (field.startsWith('dialsByType.')) t.dialsByType[field.split('.')[1]] += delta;
      else t[field] += delta;
    }
  }
  return t;
}

describe('table integrity', () => {
  it('is frozen all the way down — the table cannot be mutated at runtime', () => {
    expect(Object.isFrozen(EFFECT_TABLE)).toBe(true);
    expect(EFFECT_TABLE.every((r) => Object.isFrozen(r))).toBe(true);
    expect(Object.isFrozen(LANES)).toBe(true);
    expect(Object.isFrozen(DIAL_BUCKETS)).toBe(true);
    expect(Object.isFrozen(INGEST_BUCKETS)).toBe(true);
  });

  it('the ingest buckets are the schema buckets minus the agent-typed one', () => {
    expect(INGEST_BUCKETS.every((b) => DIAL_BUCKETS.includes(b))).toBe(true);
    expect(DIAL_BUCKETS.filter((b) => !INGEST_BUCKETS.includes(b))).toEqual(['seminarTradeshow']);
  });

  it('the legal effect space is the cross-product less ffi-without-booking', () => {
    // CALLS. 3 new-business buckets + 1 servicing shape = 4, times 16 boolean
    // combinations of the four call flags, less the quarter where ffi is set
    // and booking is not. The five ladder flags must all be false on a call.
    const calls = 4 * (16 - 4);
    // LADDER. 2 lanes, bucket null in both, the four call flags all false, and
    // at least one ladder flag true: 2^6 - 1. Six, not five — appSubmitted is a
    // rung like the others, and the enumeration pairs it with an apiAmount, so
    // every one of the 63 combinations is legal in both lanes.
    const ladder = 2 * (2 ** 6 - 1);
    expect(LEGAL_EFFECT_SETS).toHaveLength(calls + ladder);
    expect(LEGAL_EFFECT_SETS.every((s) => coherenceError(s) === null)).toBe(true);
  });

  it('KQM has NO KQM vocabulary left in this module', () => {
    // The whole point of C2. If a campaign code or an outcome name reappears
    // here, the coupling that made every campaign 400 has come back.
    const src = fs.readFileSync(path.join(__dirname, '..', 'outcomeMap.js'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const dead of ['schools', 'portfolio', 'referrals', 'group_benefits',
      'religious_houses', 'due_callback', 'no_answer', 'meeting_booked',
      'not_interested', 'CALL_OUTCOMES', 'CAMPAIGN_LANES', 'mapCall']) {
      expect(code).not.toContain(dead);
    }
  });
});

describe('the effect model, row by row', () => {
  it('a new-business call bumps dials and its bucket', () => {
    expect(mapEffects(eff()).increments).toEqual({ dials: 1, 'dialsByType.cold': 1 });
  });

  it('a new-business call that reached somebody adds telContacts', () => {
    expect(mapEffects(eff({ reached: true })).increments).toEqual({
      dials: 1, 'dialsByType.cold': 1, telContacts: 1,
    });
  });

  it('a servicing call bumps serviceCalls only', () => {
    expect(mapEffects(eff({ lane: 'servicing', bucket: null })).increments)
      .toEqual({ serviceCalls: 1 });
  });

  it('a servicing call that reached somebody adds serviceContacts', () => {
    expect(mapEffects(eff({ lane: 'servicing', bucket: null, reached: true })).increments)
      .toEqual({ serviceCalls: 1, serviceContacts: 1 });
  });

  it('booking adds appointmentsSet in EITHER lane', () => {
    expect(mapEffects(eff({ reached: true, booking: true })).increments.appointmentsSet).toBe(1);
    expect(
      mapEffects(eff({ lane: 'servicing', bucket: null, reached: true, booking: true }))
        .increments.appointmentsSet,
    ).toBe(1);
  });

  it('newName adds newNamesAdded — NOT referralsObtained', () => {
    const inc = mapEffects(eff({ reached: true, newName: true })).increments;
    expect(inc.newNamesAdded).toBe(1);
    expect(inc.referralsObtained).toBeUndefined();
  });

  it('ffi adds ffisScheduled, and drags appointmentsSet with it', () => {
    const inc = mapEffects(eff({ reached: true, booking: true, ffi: true })).increments;
    expect(inc.ffisScheduled).toBe(1);
    expect(inc.appointmentsSet).toBe(1);
  });

  it('the bucket the caller sends is the bucket that moves', () => {
    for (const bucket of INGEST_BUCKETS) {
      expect(mapEffects(eff({ bucket })).increments['dialsByType.' + bucket]).toBe(1);
    }
  });

  it('every increment is +1 except the API figure — this endpoint counts events', () => {
    // The rule that used to be "always 1" now has exactly ONE exception, and
    // naming it here is the point: an amount arriving on any other field would
    // mean a weight had crept into a count, which is how a points total or a
    // ratio quietly stops meaning what its name says.
    for (const set of LEGAL_EFFECT_SETS) {
      for (const [field, delta] of Object.entries(mapEffects(set).increments)) {
        if (field === 'newBusiness.api') {
          expect(delta).toBe(set.apiAmount);
        } else {
          expect(delta).toBe(1);
        }
      }
    }
  });
});

describe('the ladder contract — what happened, not what was attempted', () => {
  const call = { lane: 'newBusiness', bucket: 'cold', reached: true, booking: false, newName: false, ffi: false };

  it('a payload that has never heard of kind or the ladder is unchanged', () => {
    // THE COMPATIBILITY GUARANTEE. The live KQM caller sends exactly these six
    // keys. If this ever fails, the next call logged after deploy 400s, the
    // outbox marks it rejected — permanent — and the dispatch stops dead.
    expect(coherenceError(call)).toBeNull();
    expect(mapEffects(call).increments).toEqual({
      dials: 1, 'dialsByType.cold': 1, telContacts: 1,
    });
  });

  it('a ladder event writes its own field and nothing else', () => {
    const ffi = { lane: 'newBusiness', bucket: null, kind: 'ladder',
      reached: false, booking: false, newName: false, ffi: false, ffiHeld: true };
    expect(coherenceError(ffi)).toBeNull();
    expect(mapEffects(ffi).increments).toEqual({ ffiConducted: 1 });
  });

  it('a ladder event on the servicing lane still counts — a fact find is a fact find', () => {
    const ci = { lane: 'servicing', bucket: null, kind: 'ladder',
      reached: false, booking: false, newName: false, ffi: false, closingHeld: true };
    expect(mapEffects(ci).increments).toEqual({ ciConducted: 1 });
  });

  it('rejects the four ways a caller could confuse the two vocabularies', () => {
    const base = { lane: 'newBusiness', bucket: null, kind: 'ladder',
      reached: false, booking: false, newName: false, ffi: false, ffiHeld: true };

    // a meeting carrying a dial bucket would break the partition invisibly
    expect(coherenceError({ ...base, bucket: 'cold' })).toMatch(/bucket must be null/);
    // a meeting claiming to be a contact would write telContacts off no call
    expect(coherenceError({ ...base, reached: true })).toMatch(/must be false when kind is ladder/);
    // a ladder event asserting nothing writes nothing — a caller defect
    expect(coherenceError({ ...base, ffiHeld: false })).toMatch(/requires at least one/);
    // and the reverse: a call cannot assert the ladder
    expect(coherenceError({ ...call, ffiHeld: true })).toMatch(/requires kind ladder/);
  });

  it('a mangled boolean is rejected rather than believed', () => {
    const bad = { lane: 'newBusiness', bucket: null, kind: 'ladder',
      reached: false, booking: false, newName: false, ffi: false, ffiHeld: 'true' };
    expect(coherenceError(bad)).toMatch(/must be a boolean when present/);
  });
});

describe('decision 1 — dialsByType is a PARTITION', () => {
  it('every single new-business call bumps dials and exactly one bucket', () => {
    for (const set of LEGAL_EFFECT_SETS) {
      // Ladder events are not dials and are asserted separately below. Without
      // this the partition would look broken the moment a fact find arrived on
      // the new-business lane — which is exactly the inflation `kind` prevents.
      if (set.kind === 'ladder') continue;
      const { increments, lane } = mapEffects(set);
      const buckets = Object.keys(increments).filter((f) => f.startsWith('dialsByType.'));
      if (lane === 'newBusiness') {
        expect(increments.dials).toBe(1);
        expect(buckets).toHaveLength(1);
      } else {
        expect(increments.dials).toBeUndefined();
        expect(buckets).toHaveLength(0);
      }
    }
  });

  it('a ladder event never touches dials, a bucket, or a contact field', () => {
    // The property that makes `kind` worth having. A meeting inflating the dial
    // count would still balance the partition, so it would be invisible.
    for (const set of LEGAL_EFFECT_SETS.filter((s) => s.kind === 'ladder')) {
      const { increments } = mapEffects(set);
      expect(increments.dials).toBeUndefined();
      expect(increments.telContacts).toBeUndefined();
      expect(increments.serviceCalls).toBeUndefined();
      expect(increments.serviceContacts).toBeUndefined();
      expect(increments.appointmentsSet).toBeUndefined();
      expect(Object.keys(increments).filter((f) => f.startsWith('dialsByType.'))).toHaveLength(0);
      expect(Object.keys(increments).length).toBeGreaterThan(0);
    }
  });

  it('PROPERTY: for any sequence of calls, the four buckets sum to dials', () => {
    // Deterministic pseudo-random sequences at the SAME SEED slice B used, so a
    // failure is reproducible from the seed rather than a story about one bad
    // night. The generator draws from LEGAL_EFFECT_SETS — the post-validation
    // input space — because an illegal set never reaches the mapper in
    // production. That the illegal ones are actually rejected is the separate
    // coherence property below, and the two together are the whole invariant.
    let seed = 20260826;
    const next = (n) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let trial = 0; trial < 300; trial += 1) {
      const calls = [];
      const len = next(40);
      for (let i = 0; i < len; i += 1) calls.push(LEGAL_EFFECT_SETS[next(LEGAL_EFFECT_SETS.length)]);

      const t = tally(calls);
      const bucketSum = DIAL_BUCKETS.reduce((s, b) => s + t.dialsByType[b], 0);
      expect(bucketSum).toBe(t.dials);
    }
  });

  it('the empty sequence is a partition too', () => {
    const t = tally([]);
    expect(DIAL_BUCKETS.reduce((s, b) => s + t.dialsByType[b], 0)).toBe(t.dials);
  });

  it('seminarTradeshow is never written by this endpoint', () => {
    for (const set of LEGAL_EFFECT_SETS) {
      expect(Object.keys(mapEffects(set).increments)).not.toContain('dialsByType.seminarTradeshow');
    }
  });
});

describe('decision 4 — a servicing call never touches telContacts', () => {
  it('NO servicing effect set can produce telContacts, dials or a bucket', () => {
    for (const set of LEGAL_EFFECT_SETS.filter((s) => s.lane === 'servicing')) {
      const fields = Object.keys(mapEffects(set).increments);
      expect(fields).not.toContain('telContacts');
      expect(fields).not.toContain('dials');
      expect(fields.some((f) => f.startsWith('dialsByType.'))).toBe(false);
    }
  });

  it('an unreached servicing call is an ATTEMPT and not a CONTACT', () => {
    expect(mapEffects(eff({ lane: 'servicing', bucket: null })).increments)
      .toEqual({ serviceCalls: 1 });
  });

  it('and NO new-business set can produce serviceCalls or serviceContacts', () => {
    for (const set of LEGAL_EFFECT_SETS.filter((s) => s.lane === 'newBusiness')) {
      const fields = Object.keys(mapEffects(set).increments);
      expect(fields).not.toContain('serviceCalls');
      expect(fields).not.toContain('serviceContacts');
    }
  });
});

describe('coherence — the invariant moved to the boundary', () => {
  it('accepts every legal lane/bucket pairing', () => {
    for (const bucket of INGEST_BUCKETS) {
      expect(coherenceError(eff({ bucket }))).toBeNull();
    }
    expect(coherenceError(eff({ lane: 'servicing', bucket: null }))).toBeNull();
  });

  it('PROPERTY: bucket is non-null EXACTLY when the lane is newBusiness', () => {
    // The full cross-product of lane × every bucket value a caller could send,
    // including null and the agent-typed one. Exactly the two legal shapes pass.
    const candidates = [...DIAL_BUCKETS, null, undefined, '', 'cold ', 'COLD', 0, false];
    for (const lane of LANES) {
      for (const bucket of candidates) {
        const legal = lane === 'newBusiness'
          ? INGEST_BUCKETS.includes(bucket)
          : bucket === null;
        expect(coherenceError(eff({ lane, bucket })) === null).toBe(legal);
      }
    }
  });

  it('REJECTS servicing with a bucket — it would break the sum', () => {
    for (const bucket of DIAL_BUCKETS) {
      expect(coherenceError(eff({ lane: 'servicing', bucket })))
        .toMatch(/bucket must be null when lane is servicing/);
    }
  });

  it('REJECTS newBusiness without a bucket — dials and dialsByType would disagree', () => {
    expect(coherenceError(eff({ bucket: null }))).toMatch(/bucket must be one of/);
    expect(coherenceError(eff({ bucket: undefined }))).toMatch(/bucket must be one of/);
  });

  it('REJECTS seminarTradeshow — no calling campaign feeds it', () => {
    expect(coherenceError(eff({ bucket: 'seminarTradeshow' }))).toMatch(/bucket must be one of/);
  });

  it('REJECTS an unknown lane', () => {
    for (const lane of ['coaching', '', null, undefined, 'newbusiness', 0]) {
      expect(coherenceError(eff({ lane }))).toMatch(/lane must be one of/);
    }
  });

  it('REJECTS ffi without booking — scheduling an FFI IS setting an appointment', () => {
    expect(coherenceError(eff({ reached: true, ffi: true, booking: false })))
      .toMatch(/ffi requires booking/);
    // ...and the converse is legal: plenty of booked meetings are not FFIs.
    expect(coherenceError(eff({ reached: true, booking: true, ffi: false }))).toBeNull();
  });

  it('REJECTS a non-boolean flag — "false" is a TRUTHY STRING', () => {
    for (const flag of EFFECT_FLAGS) {
      for (const bad of ['false', 'true', 0, 1, null, undefined, '', 'yes']) {
        expect(coherenceError(eff({ [flag]: bad }))).toMatch(new RegExp('^' + flag + ' must be a boolean'));
      }
    }
  });

  it('REJECTS a non-object', () => {
    for (const bad of [null, undefined, 'newBusiness', 42, [1, 2]]) {
      expect(coherenceError(bad)).toMatch(/effects must be an object/);
    }
  });
});

describe('unknown values fail LOUDLY, never as a silent zero', () => {
  it('mapEffects THROWS on an incoherent set rather than returning a partial map', () => {
    expect(() => mapEffects(eff({ lane: 'servicing', bucket: 'cold' })))
      .toThrow(/incoherent effects: bucket must be null/);
    expect(() => mapEffects(eff({ bucket: null }))).toThrow(/incoherent effects/);
    expect(() => mapEffects(eff({ reached: 'false' }))).toThrow(/incoherent effects/);
    expect(() => mapEffects(eff({ ffi: true }))).toThrow(/incoherent effects: ffi requires booking/);
    expect(() => mapEffects(undefined)).toThrow();
  });
});

describe('the write allow-list agrees with the dailyActivity schema', () => {
  // Drift guard. functions/ is CJS and cannot import the ESM src/ tree, so the
  // schema is read as TEXT. If a field is renamed there and not here, this test
  // fails instead of the endpoint silently writing a field nobody reads.
  const schemaSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'src', 'lib', 'schema', 'dailyActivity.js'),
    'utf8',
  );

  it('every writable field exists in createEmptyDailyEntry', () => {
    for (const field of WRITABLE_FIELDS) {
      const leaf = field.includes('.') ? field.split('.')[1] : field;
      expect(schemaSrc).toMatch(new RegExp('\\b' + leaf + ':\\s'));
    }
  });

  it('does not include referralsObtained — that guard stays', () => {
    // If this mapping ever writes referralsObtained, the scope of the aggregator
    // guard retirement changes.
    expect(WRITABLE_FIELDS).not.toContain('referralsObtained');
  });

  it('touches nothing outside the call surface', () => {
    // Nothing else on the weekly report comes from a phone call.
    for (const forbidden of ['api', 'apps', 'lives', 'f2fAttempts', 'prospectingLettersSent',
      'seminarsConducted', 'oldNamesWorked', 'socialMediaPosts']) {
      expect(WRITABLE_FIELDS).not.toContain(forbidden);
    }
  });

  it('is exactly the seventeen fields the effect table can emit', () => {
    // Ten were the call surface. Five arrived with the ladder rows and two with
    // the submitted application — every one of them already exists in
    // src/lib/schema/dailyActivity.js, is summed by both aggregator twins and
    // appears on the weekly report. No field was invented for this; the ladder
    // was already there and simply unfed.
    expect(WRITABLE_FIELDS).toEqual([
      'appointmentsSet',
      'ciConducted',
      'dials',
      'dialsByType.cold',
      'dialsByType.followUp',
      'dialsByType.referral',
      'ffiConducted',
      'ffisScheduled',
      'newBusiness.api',
      'newBusiness.apps',
      'newNamesAdded',
      'policiesDelivered',
      'qualifiedApproaches',
      'serviceCalls',
      'serviceContacts',
      'solutionPresentations',
      'telContacts',
    ]);
  });

  it('the two production fields are reachable ONLY through appSubmitted', () => {
    // They were held back until the operator ruled, and the ruling was specific:
    // the weekly report IS the submitted number, and awards rank on SETTLED
    // business, which awardsEngine.js takes from settlement docs and never from
    // here. So a figure arriving through this endpoint moves the estimate and
    // cannot move an award.
    //
    // This test is what keeps that narrow. Every OTHER rung must stay incapable
    // of touching production credit, so a future flag cannot acquire the power
    // by accident.
    const production = ['newBusiness.apps', 'newBusiness.api'];
    for (const set of LEGAL_EFFECT_SETS) {
      const fields = Object.keys(mapEffects(set).increments);
      const touchesProduction = production.some((f) => fields.includes(f));
      expect(touchesProduction).toBe(set.appSubmitted === true);
    }
  });

  it('the API increment is the FIGURE, and every other increment is one', () => {
    const { increments } = mapEffects({
      kind: 'ladder', lane: 'newBusiness', bucket: null,
      reached: false, booking: false, newName: false, ffi: false,
      appSubmitted: true, apiAmount: 4800,
    });
    expect(increments['newBusiness.apps']).toBe(1);
    expect(increments['newBusiness.api']).toBe(4800);
  });

  it('still writes nothing that reaches SETTLED business', () => {
    // Awards rank on settled, and settlement docs are written by a different
    // path entirely. This endpoint must never learn to write one.
    for (const held of ['settledAPI', 'settledApps', 'persistency', 'apiSold', 'applicationsSold']) {
      expect(WRITABLE_FIELDS).not.toContain(held);
    }
  });
});
