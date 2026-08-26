'use strict';

/**
 * outcomeMap tests — the mapping table made mechanical.
 *
 * The load-bearing test in this file is the PARTITION property. Decision 1 says
 * dialsByType is a partition, not a set of tags: for ANY sequence of calls the
 * four buckets sum to dials. A mapping that tagged a call as both cold and
 * followUp would pass every single-call assertion and only fail here.
 */

const fs = require('fs');
const path = require('path');

const {
  CALL_OUTCOMES,
  OUTCOME_KEYS,
  CAMPAIGN_CODES,
  CAMPAIGN_LANES,
  DIAL_BUCKETS,
  WRITABLE_FIELDS,
  mapCall,
} = require('../outcomeMap');

/** Apply a sequence of calls to a zeroed tally. */
function tally(calls) {
  const t = { dials: 0, telContacts: 0, serviceCalls: 0, serviceContacts: 0, appointmentsSet: 0, ffisScheduled: 0, newNamesAdded: 0, dialsByType: { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 } };
  for (const [campaignCode, outcome] of calls) {
    for (const [field, delta] of Object.entries(mapCall(campaignCode, outcome).increments)) {
      if (field.startsWith('dialsByType.')) t.dialsByType[field.split('.')[1]] += delta;
      else t[field] += delta;
    }
  }
  return t;
}

const ALL_PAIRS = CAMPAIGN_CODES.flatMap((c) => OUTCOME_KEYS.map((o) => [c, o]));

describe('table integrity', () => {
  it('has no duplicate outcome keys', () => {
    expect(new Set(OUTCOME_KEYS).size).toBe(OUTCOME_KEYS.length);
  });

  it('is frozen all the way down — the table cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CALL_OUTCOMES)).toBe(true);
    expect(CALL_OUTCOMES.every((o) => Object.isFrozen(o))).toBe(true);
    expect(Object.isFrozen(CAMPAIGN_LANES)).toBe(true);
  });

  it('gives every campaign a lane, and a bucket iff it is new business', () => {
    for (const code of CAMPAIGN_CODES) {
      const { lane, bucket } = CAMPAIGN_LANES[code];
      expect(['newBusiness', 'servicing']).toContain(lane);
      if (lane === 'newBusiness') expect(DIAL_BUCKETS).toContain(bucket);
      else expect(bucket).toBeNull();
    }
  });

  it('reached is TRUE for "Not interested" — they answered and said no', () => {
    expect(CALL_OUTCOMES.find((o) => o.key === 'not_interested').reached).toBe(true);
    expect(CALL_OUTCOMES.find((o) => o.key === 'already_has_plan').reached).toBe(true);
    expect(CALL_OUTCOMES.find((o) => o.key === 'no_budget').reached).toBe(true);
    // ...and FALSE only for the three where nobody picked up.
    const notReached = CALL_OUTCOMES.filter((o) => !o.reached).map((o) => o.key);
    expect(notReached.sort()).toEqual(['no_answer', 'number_out_of_service', 'wrong_number']);
  });
});

describe('decision 1 — dialsByType is a PARTITION', () => {
  it('every single new-business call bumps dials and exactly one bucket', () => {
    for (const [c, o] of ALL_PAIRS) {
      const { increments, lane } = mapCall(c, o);
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

  it('PROPERTY: for any sequence of calls, the four buckets sum to dials', () => {
    // Deterministic pseudo-random sequences — no Math.random, so a failure is
    // reproducible from the seed rather than a story about one bad night.
    let seed = 20260826;
    const next = (n) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let trial = 0; trial < 300; trial += 1) {
      const calls = [];
      const len = next(40);
      for (let i = 0; i < len; i += 1) calls.push(ALL_PAIRS[next(ALL_PAIRS.length)]);

      const t = tally(calls);
      const bucketSum = DIAL_BUCKETS.reduce((s, b) => s + t.dialsByType[b], 0);
      expect(bucketSum).toBe(t.dials);
    }
  });

  it('the empty sequence is a partition too', () => {
    const t = tally([]);
    expect(DIAL_BUCKETS.reduce((s, b) => s + t.dialsByType[b], 0)).toBe(t.dials);
  });
});

describe('decision 4 — a Portfolio call never touches telContacts', () => {
  it('writes the servicing lane and stops there', () => {
    expect(mapCall('portfolio', 'portfolio_review_booked').increments).toEqual({
      serviceCalls: 1,
      serviceContacts: 1,
      appointmentsSet: 1,
      ffisScheduled: 1,
    });
  });

  it('an unreached Portfolio call is an ATTEMPT and not a CONTACT', () => {
    expect(mapCall('portfolio', 'no_answer').increments).toEqual({ serviceCalls: 1 });
  });

  it('NO portfolio outcome can produce telContacts, dials or a bucket', () => {
    for (const o of OUTCOME_KEYS) {
      const fields = Object.keys(mapCall('portfolio', o).increments);
      expect(fields).not.toContain('telContacts');
      expect(fields).not.toContain('dials');
      expect(fields.some((f) => f.startsWith('dialsByType.'))).toBe(false);
    }
  });
});

describe('the operator mapping table, row by row', () => {
  const cold = (o) => mapCall('schools', o).increments;

  it('not reached: dials only', () => {
    for (const o of ['no_answer', 'wrong_number', 'number_out_of_service']) {
      expect(cold(o)).toEqual({ dials: 1, 'dialsByType.cold': 1 });
    }
  });

  it('reached, no consequence: dials + telContacts', () => {
    for (const o of ['gatekeeper_blocked', 'not_interested', 'already_has_plan', 'no_budget',
      'callback_scheduled', 'send_info_email', 'principal_interested',
      'approved_in_principle', 'parent_list_promised', 'do_not_call']) {
      expect(cold(o)).toEqual({ dials: 1, 'dialsByType.cold': 1, telContacts: 1 });
    }
  });

  it('a booking adds appointmentsSet', () => {
    for (const o of ['meeting_booked', 'orientation_slot_offered']) {
      expect(cold(o)).toEqual({ dials: 1, 'dialsByType.cold': 1, telContacts: 1, appointmentsSet: 1 });
    }
  });

  it('a referral outcome adds newNamesAdded — NOT referralsObtained', () => {
    for (const o of ['referred_to_board_pta', 'referred_to_person', 'not_decision_maker']) {
      expect(cold(o)).toEqual({ dials: 1, 'dialsByType.cold': 1, telContacts: 1, newNamesAdded: 1 });
    }
  });

  it('campaign decides the bucket', () => {
    expect(mapCall('schools', 'no_answer').increments['dialsByType.cold']).toBe(1);
    expect(mapCall('group_benefits', 'no_answer').increments['dialsByType.cold']).toBe(1);
    expect(mapCall('religious_houses', 'no_answer').increments['dialsByType.cold']).toBe(1);
    expect(mapCall('referrals', 'no_answer').increments['dialsByType.referral']).toBe(1);
    expect(mapCall('due_callback', 'no_answer').increments['dialsByType.followUp']).toBe(1);
  });

  it('seminarTradeshow is never written by this endpoint', () => {
    for (const [c, o] of ALL_PAIRS) {
      expect(Object.keys(mapCall(c, o).increments)).not.toContain('dialsByType.seminarTradeshow');
    }
  });
});

describe('unknown values fail LOUDLY, never as a silent zero', () => {
  it('throws on an unknown outcome', () => {
    expect(() => mapCall('schools', 'sold_them_a_boat')).toThrow(/unknown outcome/);
  });

  it('throws on an unknown campaign', () => {
    expect(() => mapCall('carnival', 'no_answer')).toThrow(/unknown campaignCode/);
  });

  it('throws rather than returning {} for undefined input', () => {
    expect(() => mapCall(undefined, undefined)).toThrow();
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
    // The brief's STOP trigger: if this mapping ever writes referralsObtained,
    // the scope of the aggregator guard retirement changes.
    expect(WRITABLE_FIELDS).not.toContain('referralsObtained');
  });

  it('touches nothing outside the call surface', () => {
    // Nothing else on the weekly report comes from a phone call.
    for (const forbidden of ['api', 'apps', 'lives', 'f2fAttempts', 'prospectingLettersSent',
      'seminarsConducted', 'oldNamesWorked', 'socialMediaPosts']) {
      expect(WRITABLE_FIELDS).not.toContain(forbidden);
    }
  });
});
