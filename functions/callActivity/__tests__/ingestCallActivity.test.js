'use strict';

/**
 * ingestCallActivity tests.
 *
 * Three tests in here are load-bearing and the rest support them:
 *
 *  · THE CONCURRENT IDEMPOTENCY TEST. The sequential replay test passes against
 *    a check-then-write implementation, which is precisely the implementation
 *    that double-counts under the retry storm this endpoint is guaranteed to
 *    see. Only the concurrent one distinguishes them. See MUTATION VERIFICATION
 *    at the foot of this file.
 *
 *  · THE TT-BOUNDARY TEST. A call at 21:00 TT is already tomorrow in UTC, so a
 *    UTC-derived date silently files it on the wrong day — and at month end, in
 *    the wrong MONTH, moving a number out of the month a manager is reading.
 *
 *  · THE LANE/BUCKET COHERENCE TESTS (slice C2). The bucket used to be derived
 *    from a table in this repo and could not be wrong. It now arrives over HTTP
 *    from KQM, so the partition invariant rests on rejecting the two
 *    combinations that would break it. Both directions are tested at the HTTP
 *    boundary, not only in the pure mapper.
 */

const { FakeFirestore, Timestamp } = require('./fakeFirestore');

let mockDb = null;

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => mockDb),
    {
      FieldValue: require('./fakeFirestore').FieldValue,
      Timestamp: require('./fakeFirestore').Timestamp,
    },
  ),
}));

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  return {
    https: {
      onCall: (fn) => ({ _onCall: fn }),
      onRequest: (fn) => ({ _onRequest: fn }),
      HttpsError,
    },
  };
});

const { hashToken } = require('../../callSources/createCallSource');
const {
  EFFECT_FLAGS, LADDER_FLAGS, INGEST_BUCKETS, DIAL_BUCKETS, API_AMOUNT_MAX,
} = require('../outcomeMap');
const {
  ingestCallActivity,
  toTrinidadDateString,
  getSundayOf,
  setNested,
  validatePayload,
  applyCall,
  TENANT_ID,
  RATE_MAX_PER_WINDOW,
  RAW_FIELD_MAX_CHARS,
} = require('../ingestCallActivity');

const handler = ingestCallActivity._onRequest;

const RAW_TOKEN = 'a'.repeat(64);
const CREDIT_UID = 'agent_marlon';
const SOURCE_DOC_ID = 'src777';
const SOURCE_PATH = 'tenants/' + TENANT_ID + '/callSources/' + SOURCE_DOC_ID;
const INGEST_PATH = 'tenants/' + TENANT_ID + '/callActivity/kqm-calls__act-0001';
const dailyPath = (date, uid = CREDIT_UID) =>
  'tenants/' + TENANT_ID + '/users/' + uid + '/dailyActivity/' + date;
const weeklyPath = (week, uid = CREDIT_UID) =>
  'tenants/' + TENANT_ID + '/submissions/' + uid + '_' + week;

const NOW = new Date('2026-08-26T18:00:00Z');

function seedSource(over = {}) {
  mockDb.seed(SOURCE_PATH, {
    sourceId: SOURCE_DOC_ID,
    tenantId: TENANT_ID,
    sourceApp: 'kqm-calls',
    sourceUserId: 'kqm-user-77',
    creditUid: CREDIT_UID,
    label: 'Tracy-ann Nurse (assistant)',
    tokenHash: hashToken(RAW_TOKEN),
    active: true,
    revokedAt: null,
    expiresAt: Timestamp.fromDate(new Date('2027-08-26T00:00:00Z')),
    ...over,
  });
}

/**
 * The C2 contract. The default is a cold new-business call that reached somebody
 * and booked a meeting — dials +1, dialsByType.cold +1, telContacts +1,
 * appointmentsSet +1.
 *
 * rawOutcome and rawCampaign carry KQM's ACTUAL live values, suffix and display
 * casing included, because those are exactly the shapes slice B rejected.
 */
const body = (over = {}) => ({
  sourceApp: 'kqm-calls',
  sourceId: 'act-0001',
  occurredAt: '2026-08-26T14:05:00-04:00',
  lane: 'newBusiness',
  bucket: 'cold',
  reached: true,
  booking: true,
  newName: false,
  ffi: false,
  rawOutcome: 'Meeting booked',
  rawCampaign: 'schools_2026',
  durationSec: 132,
  ...over,
});

/**
 * A LADDER event — something that happened after the phone was put down.
 *
 * Spread into body() as an override, so every test below proves the SAME
 * endpoint accepts both shapes. Note what is explicit here and why: `bucket`
 * must be sent as a literal null (a meeting has no partition member, and absent
 * is not the same as null at this boundary), and all four call booleans must be
 * false (a meeting is not a dial and did not reach anybody by telephone).
 */
const ladder = (over = {}) => ({
  kind: 'ladder',
  bucket: null,
  reached: false,
  booking: false,
  newName: false,
  ffi: false,
  ffiHeld: true,
  rawOutcome: 'F.F.I held',
  rawCampaign: 'schools_2026',
  ...over,
});

function makeReq(over = {}) {
  const headers = { authorization: 'Bearer ' + RAW_TOKEN, ...(over.headers || {}) };
  return {
    method: 'POST',
    body: body(),
    rawBody: Buffer.from('{}'),
    get: (h) => headers[h.toLowerCase()],
    ...over,
    headers,
  };
}

function makeRes() {
  const res = { statusCode: null, payload: null };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (p) => {
    res.payload = p;
    return res;
  };
  res.send = res.json;
  return res;
}

/** Drive applyCall directly — the HTTP layer is exercised separately. */
function apply(payloadOver = {}, over = {}) {
  const parsed = validatePayload(body(payloadOver));
  if (!parsed.ok) throw new Error('test payload invalid: ' + parsed.error);
  return applyCall(mockDb, {
    sourceRef: mockDb.doc(SOURCE_PATH),
    source: mockDb.read(SOURCE_PATH),
    sourceId: SOURCE_DOC_ID,
    payload: parsed.value,
    now: NOW,
    ...over,
  });
}

beforeEach(() => {
  mockDb = new FakeFirestore();
  seedSource();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe('the TT date trap', () => {
  it('a 21:00 TT call lands on that TT date, not the following UTC date', () => {
    // 21:00 TT on the 26th is 01:00 UTC on the 27th.
    expect(toTrinidadDateString('2026-08-26T21:00:00-04:00')).toBe('2026-08-26');
    expect(new Date('2026-08-26T21:00:00-04:00').toISOString().slice(0, 10)).toBe('2026-08-27');
  });

  it('MONTH END: 31 Aug 21:00 TT must not land in September', () => {
    expect(toTrinidadDateString('2026-08-31T21:00:00-04:00')).toBe('2026-08-31');
    expect(toTrinidadDateString('2026-08-31T23:59:59-04:00')).toBe('2026-08-31');
    // ...and the very next minute IS September.
    expect(toTrinidadDateString('2026-09-01T00:00:30-04:00')).toBe('2026-09-01');
  });

  it('YEAR END behaves the same way', () => {
    expect(toTrinidadDateString('2026-12-31T22:30:00-04:00')).toBe('2026-12-31');
  });

  it('accepts a UTC-stamped instant and converts it', () => {
    // 01:00Z on the 27th IS 21:00 TT on the 26th.
    expect(toTrinidadDateString('2026-08-27T01:00:00Z')).toBe('2026-08-26');
  });

  it('the daily doc id is the TT date', async () => {
    await apply({ occurredAt: '2026-08-31T21:00:00-04:00' });
    expect(mockDb.exists(dailyPath('2026-08-31'))).toBe(true);
    expect(mockDb.exists(dailyPath('2026-09-01'))).toBe(false);
  });

  it('rejects an unparseable occurredAt rather than guessing', () => {
    expect(toTrinidadDateString('yesterday evening')).toBeNull();
    expect(toTrinidadDateString('')).toBeNull();
    expect(toTrinidadDateString(null)).toBeNull();
  });

  it('weekStarting is the Sunday of the TT date, UTC-noon anchored', () => {
    expect(getSundayOf('2026-08-26')).toBe('2026-08-23'); // Wed -> Sun
    expect(getSundayOf('2026-08-23')).toBe('2026-08-23'); // Sun -> itself
    expect(getSundayOf('2026-08-29')).toBe('2026-08-23'); // Sat -> Sun
    expect(getSundayOf('2026-08-30')).toBe('2026-08-30'); // next Sun
  });

  it('the daily doc CARRIES weekStarting — the aggregator queries on it', async () => {
    await apply();
    expect(mockDb.read(dailyPath('2026-08-26')).weekStarting).toBe('2026-08-23');
  });
});

// ---------------------------------------------------------------------------
describe('idempotency', () => {
  it('a sequential replay of the SAME sourceId moves the KPI exactly once', async () => {
    const first = await apply();
    const second = await apply();

    expect(first).toMatchObject({ applied: true, duplicate: false });
    expect(second).toMatchObject({ applied: false, duplicate: true });

    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(1);
    expect(daily.telContacts).toBe(1);
    expect(daily.appointmentsSet).toBe(1);
    expect(daily.dialsByType.cold).toBe(1);
  });

  it('a third and fourth replay still move nothing', async () => {
    await apply();
    await apply();
    await apply();
    await apply();
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(1);
  });

  it('CONCURRENT: two simultaneous deliveries of one sourceId count ONCE', async () => {
    // THE test. Both callbacks read the ingest record as absent before either
    // commits; the loser's version check fails and it re-runs against the
    // committed state. A check-then-write implementation double-counts here and
    // passes every other test in this file.
    const results = await Promise.all([apply(), apply()]);

    const applied = results.filter((r) => r.applied).length;
    const duplicates = results.filter((r) => r.duplicate).length;
    expect(applied).toBe(1);
    expect(duplicates).toBe(1);

    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(1);
    // Proof the race actually happened rather than the fake serialising it.
    expect(mockDb.retries).toBeGreaterThanOrEqual(1);
  });

  it('CONCURRENT: five simultaneous deliveries still count ONCE', async () => {
    const results = await Promise.all([apply(), apply(), apply(), apply(), apply()]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(1);
  });

  it('DIFFERENT sourceIds both count — the guard is per call, not per day', async () => {
    await apply({ sourceId: 'act-0001' });
    await apply({ sourceId: 'act-0002' });
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(2);
  });

  it('CONCURRENT distinct calls both count — increment, not read-modify-write', async () => {
    await Promise.all([
      apply({ sourceId: 'act-a' }),
      apply({ sourceId: 'act-b' }),
      apply({ sourceId: 'act-c' }),
    ]);
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(3);
    expect(daily.dialsByType.cold).toBe(3);
  });

  it('the same sourceId from a DIFFERENT app is a different call', async () => {
    // The key is sourceApp + sourceId, so two apps may use the same local id.
    await apply({ sourceId: 'shared-1' });
    const parsed = validatePayload(body({ sourceId: 'shared-1' }));
    parsed.value.sourceApp = 'other-app'; // bypasses the allow-list deliberately
    const r = await applyCall(mockDb, {
      sourceRef: mockDb.doc(SOURCE_PATH),
      source: mockDb.read(SOURCE_PATH),
      sourceId: SOURCE_DOC_ID,
      payload: parsed.value,
      now: NOW,
    });
    expect(r.applied).toBe(true);
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(2);
  });

  it('records the call under sourceApp + sourceId', async () => {
    await apply();
    expect(mockDb.read(INGEST_PATH)).toMatchObject({
      creditUid: CREDIT_UID,
      callSourceId: SOURCE_DOC_ID,
      date: '2026-08-26',
      weekStarting: '2026-08-23',
      lane: 'newBusiness',
      dialBucket: 'cold',
      reached: true,
      booking: true,
      newName: false,
      ffi: false,
    });
  });
});

// ---------------------------------------------------------------------------
describe('the KPI write itself', () => {
  it('increments, and creates the daily doc on the first call of the day', async () => {
    expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    await apply({ sourceId: 'c1', reached: false, booking: false });
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily).toMatchObject({ version: 2, date: '2026-08-26', agentId: CREDIT_UID, dials: 1 });
    expect(daily.telContacts).toBeUndefined();
  });

  it('NESTS dialsByType — a literal dotted key would be invisible to the aggregator', async () => {
    await apply({ sourceId: 'c1' });
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dialsByType).toEqual({ cold: 1 });
    expect(daily['dialsByType.cold']).toBeUndefined();
  });

  it('adds onto an agent-entered daily doc without clobbering the rest of it', async () => {
    mockDb.seed(dailyPath('2026-08-26'), {
      version: 2,
      date: '2026-08-26',
      weekStarting: '2026-08-23',
      agentId: CREDIT_UID,
      agentName: 'Marlon Baptiste',
      dials: 4,
      dialsByType: { cold: 4, referral: 0, followUp: 0, seminarTradeshow: 0 },
      f2fAttempts: 9,
      prospectingLettersSent: 3,
    });
    await apply({ sourceId: 'c1', bucket: 'referral', reached: false, booking: false });

    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(5);
    expect(daily.dialsByType).toEqual({ cold: 4, referral: 1, followUp: 0, seminarTradeshow: 0 });
    // Untouched — nothing else on the weekly report comes from a phone call.
    expect(daily.f2fAttempts).toBe(9);
    expect(daily.prospectingLettersSent).toBe(3);
    expect(daily.agentName).toBe('Marlon Baptiste');
  });

  it('each ingest bucket moves its own partition member and no other', async () => {
    let n = 0;
    for (const bucket of INGEST_BUCKETS) {
      n += 1;
      await apply({ sourceId: 'b' + n, bucket, reached: false, booking: false });
    }
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(INGEST_BUCKETS.length);
    expect(daily.dialsByType).toEqual({ cold: 1, referral: 1, followUp: 1 });
    expect(daily.dialsByType.seminarTradeshow).toBeUndefined();
  });

  it('credits the token owner, never anyone named in the payload', async () => {
    await apply();
    expect(mockDb.exists(dailyPath('2026-08-26', CREDIT_UID))).toBe(true);
    expect(mockDb.exists(dailyPath('2026-08-26', 'somebody_else'))).toBe(false);
  });

  it('stamps lastUsedAt on the source doc', async () => {
    await apply();
    expect(mockDb.read(SOURCE_PATH).lastUsedAt).toBe('<ts>');
  });
});

// ---------------------------------------------------------------------------
describe('decision 4 — the servicing lane, mechanically', () => {
  const servicing = (over = {}) => ({
    lane: 'servicing',
    bucket: null,
    rawCampaign: 'portfolio_2026',
    ...over,
  });

  it('a servicing call that REACHED the client does not move telContacts', async () => {
    await apply(servicing({ sourceId: 'p1', reached: true, booking: false }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.serviceCalls).toBe(1);
    expect(daily.serviceContacts).toBe(1);
    // The whole of decision 4, in two lines.
    expect(daily.telContacts).toBeUndefined();
    expect(daily.dials).toBeUndefined();
    expect(daily.dialsByType).toBeUndefined();
  });

  it('a portfolio review books an FFI, in the servicing lane', async () => {
    await apply(servicing({
      sourceId: 'p2', reached: true, booking: true, ffi: true, rawOutcome: 'Portfolio - review booked',
    }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.serviceCalls).toBe(1);
    expect(daily.serviceContacts).toBe(1);
    expect(daily.appointmentsSet).toBe(1);
    expect(daily.ffisScheduled).toBe(1);
    expect(daily.telContacts).toBeUndefined();
  });

  it('an unreached servicing call is an ATTEMPT and not a CONTACT', async () => {
    await apply(servicing({ sourceId: 'p3', reached: false, booking: false }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.serviceCalls).toBe(1);
    expect(daily.serviceContacts).toBeUndefined();
  });

  it('mixing lanes on one day keeps the two contact fields separate', async () => {
    await apply({ sourceId: 'n1', reached: true, booking: false });
    await apply(servicing({ sourceId: 's1', reached: true, booking: false }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(1);
    expect(daily.telContacts).toBe(1);
    expect(daily.serviceCalls).toBe(1);
    expect(daily.serviceContacts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
/**
 * THE LADDER. AgencyTrack's selling ladder existed before this slice and was
 * simply never fed — nothing in the product wrote ffiConducted or ciConducted,
 * so P.C → S.C → A.I → F.F.I → C.I → SALE was a report of zeros.
 *
 * The load-bearing test in this block is the LAST one: a ladder event must move
 * NO dial-shaped field. A fact find counted as a dial inflates the dial count
 * invisibly, because dialsByType would still sum to dials and every existing
 * consistency check would stay green.
 */
describe('the ladder — events that are NOT calls', () => {
  it('a fact find held moves ffiConducted and NOTHING dial-shaped', async () => {
    await apply(ladder({ sourceId: 'L1' }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.ffiConducted).toBe(1);
    // THE assertion of this block.
    expect(daily.dials).toBeUndefined();
    expect(daily.dialsByType).toBeUndefined();
    expect(daily.telContacts).toBeUndefined();
    expect(daily.serviceCalls).toBeUndefined();
    expect(daily.appointmentsSet).toBeUndefined();
    expect(daily.ffisScheduled).toBeUndefined();
  });

  it('SCHEDULED and CONDUCTED are different fields — the call sets one, the meeting the other', async () => {
    // The call that booked it.
    await apply({ sourceId: 'L2a', booking: true, ffi: true });
    // The meeting that then happened.
    await apply(ladder({ sourceId: 'L2b' }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.ffisScheduled).toBe(1);
    expect(daily.ffiConducted).toBe(1);
    // ...and the call still counted as a call, exactly once.
    expect(daily.dials).toBe(1);
  });

  it('a closing interview moves ciConducted', async () => {
    await apply(ladder({ sourceId: 'L3', ffiHeld: false, closingHeld: true }));
    expect(mockDb.read(dailyPath('2026-08-26')).ciConducted).toBe(1);
  });

  it('a policy delivered moves policiesDelivered', async () => {
    await apply(ladder({ sourceId: 'L4', ffiHeld: false, policyDelivered: true }));
    expect(mockDb.read(dailyPath('2026-08-26')).policiesDelivered).toBe(1);
  });

  it('the approach and the presentation are the unscored rungs, and still recorded', async () => {
    await apply(ladder({ sourceId: 'L5', ffiHeld: false, approachHeld: true, presented: true }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.qualifiedApproaches).toBe(1);
    expect(daily.solutionPresentations).toBe(1);
  });

  it('one meeting may assert several rungs at once', async () => {
    await apply(ladder({ sourceId: 'L6', ffiHeld: true, closingHeld: true }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.ffiConducted).toBe(1);
    expect(daily.ciConducted).toBe(1);
  });

  it('a ladder event in the SERVICING lane counts the same — a fact find is a fact find', async () => {
    await apply(ladder({ sourceId: 'L7', lane: 'servicing', rawCampaign: 'portfolio_2026' }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.ffiConducted).toBe(1);
    expect(daily.serviceCalls).toBeUndefined();
    expect(daily.serviceContacts).toBeUndefined();
  });

  it('a mixed day keeps calls and meetings in their own fields', async () => {
    await apply({ sourceId: 'M1' });
    await apply(ladder({ sourceId: 'M2' }));
    const daily = mockDb.read(dailyPath('2026-08-26'));
    expect(daily.dials).toBe(1);
    expect(daily.dialsByType.cold).toBe(1);
    expect(daily.telContacts).toBe(1);
    expect(daily.appointmentsSet).toBe(1);
    expect(daily.ffiConducted).toBe(1);
  });

  describe('a submitted application — the only rows that carry money', () => {
    const app = (over = {}) => ladder({
      ffiHeld: false, appSubmitted: true, apiAmount: 4800,
      rawOutcome: 'Application submitted', ...over,
    });

    it('moves newBusiness.apps by ONE and newBusiness.api by the FIGURE', async () => {
      await apply(app({ sourceId: 'A1' }));
      const daily = mockDb.read(dailyPath('2026-08-26'));
      expect(daily.newBusiness).toEqual({ apps: 1, api: 4800 });
      // Still not a call, and still not a meeting-shaped rung.
      expect(daily.dials).toBeUndefined();
      expect(daily.ffiConducted).toBeUndefined();
    });

    it('two applications in a day add up', async () => {
      await apply(app({ sourceId: 'A2', apiAmount: 4800 }));
      await apply(app({ sourceId: 'A3', apiAmount: 1200.5 }));
      expect(mockDb.read(dailyPath('2026-08-26')).newBusiness)
        .toEqual({ apps: 2, api: 6000.5 });
    });

    it('an API of zero is accepted — a free-look or a nil-premium case', async () => {
      await apply(app({ sourceId: 'A4', apiAmount: 0 }));
      expect(mockDb.read(dailyPath('2026-08-26')).newBusiness).toEqual({ apps: 1, api: 0 });
    });

    it('may ride with another rung on the same event', async () => {
      await apply(app({ sourceId: 'A5', closingHeld: true }));
      const daily = mockDb.read(dailyPath('2026-08-26'));
      expect(daily.ciConducted).toBe(1);
      expect(daily.newBusiness.apps).toBe(1);
    });

    it('the ingest record keeps the figure beside the increment', async () => {
      await apply(app());
      const rec = mockDb.read(INGEST_PATH);
      expect(rec.apiAmount).toBe(4800);
      expect(rec.appSubmitted).toBe(true);
      expect(rec.increments['newBusiness.api']).toBe(4800);
    });

    it('every other event records apiAmount as null, not absent', async () => {
      await apply();
      expect(mockDb.read(INGEST_PATH).apiAmount).toBeNull();
    });

    describe('the pairing is enforced in BOTH directions', () => {
      async function post(over = {}) {
        const res = makeRes();
        await handler(makeReq(over), res);
        return res;
      }

      it('appSubmitted without apiAmount is a 400, never a zero', async () => {
        // A zero would look like a real application worth nothing, which is
        // harder to notice than a wrong figure and just as wrong.
        const b = body(ladder({ ffiHeld: false, appSubmitted: true }));
        const res = await post({ body: b });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/appSubmitted requires apiAmount/);
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
      });

      it('apiAmount without appSubmitted is a 400, never a silent drop', async () => {
        const res = await post({ body: body(ladder({ ffiHeld: true, apiAmount: 4800 })) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/apiAmount requires appSubmitted/);
      });

      it('a CALL may not carry either', async () => {
        expect((await post({ body: body({ appSubmitted: true, apiAmount: 1 }) })).statusCode)
          .toBe(400);
        expect((await post({ body: body({ apiAmount: 1 }) })).statusCode).toBe(400);
      });

      it('a non-numeric or non-finite apiAmount is a 400', async () => {
        for (const bad of ['4800', '', null, true, {}, [], NaN, Infinity, -Infinity]) {
          const res = await post({ body: body(app({ apiAmount: bad })) });
          expect(res.statusCode).toBe(400);
          expect(res.payload.error).toContain('apiAmount');
        }
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
      });

      it('a negative apiAmount is a 400 — a reversal is not an ingest', async () => {
        const res = await post({ body: body(app({ apiAmount: -100 })) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/must not be negative/);
      });

      it('an apiAmount above the cap is refused as a typo', async () => {
        // The weekly API target for one agent is TT$4,800. A single application
        // above a million is a units error, and it would land in the figure
        // awards are estimated from.
        const res = await post({ body: body(app({ apiAmount: API_AMOUNT_MAX + 1 })) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/probable typo/);
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
      });

      it('...and exactly the cap is accepted', async () => {
        const res = await post({ body: body(app({ apiAmount: API_AMOUNT_MAX })) });
        expect(res.statusCode).toBe(200);
      });
    });
  });

  describe('the ingest record', () => {
    it('a ladder event records kind ladder and its flags', async () => {
      await apply(ladder({ closingHeld: true }));
      expect(mockDb.read(INGEST_PATH)).toMatchObject({
        kind: 'ladder',
        lane: 'newBusiness',
        dialBucket: null,
        ffiHeld: true,
        closingHeld: true,
        approachHeld: false,
        presented: false,
        policyDelivered: false,
      });
    });

    it('a CALL records kind call and all five ladder flags false', async () => {
      // Materialised rather than absent, so "count the calls" never needs a
      // special case for records written before the ladder existed.
      await apply();
      const rec = mockDb.read(INGEST_PATH);
      expect(rec.kind).toBe('call');
      for (const flag of LADDER_FLAGS) expect(rec[flag]).toBe(false);
    });
  });

  describe('BACKWARDS COMPATIBILITY — the deployed KQM caller sends none of this', () => {
    it('the exact six-key body in production today is still accepted', async () => {
      // If this ever goes red, deploying this function breaks the live feed:
      // KQM would 400, the outbox row would be marked rejected permanently, and
      // dispatch would stop. It is the reason kind and the ladder flags are
      // optional rather than required.
      const b = body();
      for (const key of ['kind', ...LADDER_FLAGS]) expect(b[key]).toBeUndefined();

      const res = makeRes();
      await handler(makeReq({ body: b }), res);
      expect(res.statusCode).toBe(200);
      expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(1);
      expect(mockDb.read(INGEST_PATH).kind).toBe('call');
    });

    it('an explicit kind "call" behaves identically to an absent one', async () => {
      await apply({ sourceId: 'K1' });
      const withoutKind = JSON.stringify(mockDb.read(dailyPath('2026-08-26')));
      mockDb = new FakeFirestore();
      seedSource();
      await apply({ sourceId: 'K1', kind: 'call' });
      expect(JSON.stringify(mockDb.read(dailyPath('2026-08-26')))).toBe(withoutKind);
    });
  });

  describe('the two vocabularies may never be mixed — every confusion is a 400', () => {
    async function post(over = {}) {
      const res = makeRes();
      await handler(makeReq(over), res);
      return res;
    }

    it('a ladder event carrying a dial bucket is a 400', async () => {
      for (const bucket of DIAL_BUCKETS) {
        const res = await post({ body: body(ladder({ bucket })) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/bucket must be null when kind is ladder/);
      }
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });

    it('a ladder event with the bucket key ABSENT is a 400 — send an explicit null', async () => {
      const b = body(ladder());
      delete b.bucket;
      const res = await post({ body: b });
      expect(res.statusCode).toBe(400);
    });

    it('a ladder event asserting NO rung is a 400, not a quiet no-op', async () => {
      const res = await post({ body: body(ladder({ ffiHeld: false })) });
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toMatch(/requires at least one of/);
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });

    it('a ladder event asserting a CALL flag is a 400', async () => {
      for (const flag of EFFECT_FLAGS) {
        const over = { [flag]: true };
        // ffi alone is illegal without booking for a different reason; assert
        // both so the failure under test is the ladder rule, not that one.
        if (flag === 'ffi') over.booking = true;
        const res = await post({ body: body(ladder(over)) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/must be false when kind is ladder/);
      }
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });

    it('a CALL asserting a ladder flag is a 400', async () => {
      for (const flag of LADDER_FLAGS) {
        const over = { [flag]: true };
        // appSubmitted is illegal without apiAmount for a different reason;
        // supply it so the failure under test is the kind rule, not that one.
        if (flag === 'appSubmitted') over.apiAmount = 4800;
        const res = await post({ body: body(over) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(new RegExp(flag + ' requires kind ladder'));
      }
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });

    it('an unknown kind is a 400 — including null, which a broken normaliser sends', async () => {
      for (const kind of ['ladder ', 'Ladder', 'meeting', '', null, 7, true]) {
        const res = await post({ body: body({ kind }) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/kind must be one of/);
      }
    });

    it('a non-boolean ladder flag is a 400 — "false" is a TRUTHY STRING', async () => {
      for (const flag of LADDER_FLAGS) {
        for (const bad of ['false', 'true', 1, 0, null]) {
          const res = await post({ body: body(ladder({ ffiHeld: true, [flag]: bad })) });
          expect(res.statusCode).toBe(400);
          expect(res.payload.error).toContain(flag);
        }
      }
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
describe('rawOutcome and rawCampaign are STORED and NEVER SCORED', () => {
  it('stores them verbatim, suffix and display casing intact', async () => {
    await apply({ rawOutcome: 'No budget - parents pay', rawCampaign: 'religious_houses_2026' });
    expect(mockDb.read(INGEST_PATH)).toMatchObject({
      rawOutcome: 'No budget - parents pay',
      rawCampaign: 'religious_houses_2026',
    });
  });

  it('THE POINT: varying them across otherwise identical calls changes NO KPI', async () => {
    // Three calls, identical effects, three wildly different KQM vocabularies —
    // including values slice B would have mapped to something else entirely, and
    // one that names a different campaign than the lane implies. If any of them
    // reached the arithmetic, these deltas would differ.
    const raws = [
      { rawOutcome: 'Meeting booked', rawCampaign: 'schools_2026' },
      { rawOutcome: 'portfolio_review_booked', rawCampaign: 'portfolio_2026' },
      { rawOutcome: '¯\\_(ツ)_/¯ whatever KQM calls it', rawCampaign: 'due_callback' },
    ];

    const deltas = [];
    for (let i = 0; i < raws.length; i += 1) {
      mockDb = new FakeFirestore();
      seedSource();
      await apply({ sourceId: 'raw-' + i, ...raws[i] });
      const daily = mockDb.read(dailyPath('2026-08-26'));
      deltas.push(JSON.stringify({
        dials: daily.dials,
        dialsByType: daily.dialsByType,
        telContacts: daily.telContacts,
        serviceCalls: daily.serviceCalls,
        serviceContacts: daily.serviceContacts,
        appointmentsSet: daily.appointmentsSet,
        ffisScheduled: daily.ffisScheduled,
        newNamesAdded: daily.newNamesAdded,
      }));
    }

    expect(new Set(deltas).size).toBe(1);
  });

  it('the increments recorded on the ingest doc are identical too', async () => {
    const seen = [];
    for (const rawCampaign of ['schools_2026', 'portfolio_2026', 'anything at all']) {
      mockDb = new FakeFirestore();
      seedSource();
      await apply({ rawCampaign });
      seen.push(JSON.stringify(mockDb.read(INGEST_PATH).increments));
    }
    expect(new Set(seen).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('decision 3 — a late arrival never moves a submitted weekly', () => {
  beforeEach(() => {
    mockDb.seed(weeklyPath('2026-08-23'), {
      status: 'submitted',
      agentId: CREDIT_UID,
      weekStarting: '2026-08-23',
      dials: 40,
      coldCalls: 40,
      submittedAt: 'earlier',
    });
  });

  it('writes the daily doc — that is the truth of the day', async () => {
    const r = await apply();
    expect(r.applied).toBe(true);
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(1);
  });

  it('leaves the submitted weekly EXACTLY as the agent signed it', async () => {
    const before = JSON.stringify(mockDb.read(weeklyPath('2026-08-23')));
    await apply();
    expect(JSON.stringify(mockDb.read(weeklyPath('2026-08-23')))).toBe(before);
  });

  it('RECORDS the discrepancy so it is visible rather than silent', async () => {
    await apply();
    expect(mockDb.read(INGEST_PATH).landedInSubmittedWeek).toBe(true);
  });

  it('a draft week is not flagged', async () => {
    mockDb.seed(weeklyPath('2026-08-23'), { status: 'draft', agentId: CREDIT_UID });
    await apply();
    expect(mockDb.read(INGEST_PATH).landedInSubmittedWeek).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('rejections — every one fails CLOSED', () => {
  async function post(over = {}) {
    const res = makeRes();
    await handler(makeReq(over), res);
    return res;
  }

  it('accepts a good call', async () => {
    const res = await post();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, applied: true, date: '2026-08-26' });
  });

  it('rejects a non-POST', async () => {
    const res = await post({ method: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  it('rejects an oversized body before doing anything else', async () => {
    const res = await post({ rawBody: Buffer.alloc(9 * 1024) });
    expect(res.statusCode).toBe(413);
    expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
  });

  describe('token failures are INDISTINGUISHABLE to the caller', () => {
    const cases = {
      'unknown token': () => ({ headers: { authorization: 'Bearer ' + 'b'.repeat(64) } }),
      'expired token': () => {
        seedSource({ expiresAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) });
        return {};
      },
      'revoked token': () => {
        seedSource({ revokedAt: 'yesterday' });
        return {};
      },
      'deactivated source': () => {
        seedSource({ active: false });
        return {};
      },
      'no Authorization header': () => ({ headers: { authorization: undefined } }),
      'malformed Authorization header': () => ({ headers: { authorization: 'Token abc' } }),
      'source with no creditUid': () => {
        seedSource({ creditUid: null });
        return {};
      },
    };

    const seen = [];
    for (const [name, setup] of Object.entries(cases)) {
      it('rejects: ' + name, async () => {
        const res = await post(setup());
        expect(res.statusCode).toBe(401);
        expect(res.payload).toEqual({ ok: false, error: 'unauthorized' });
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
        seen.push(JSON.stringify([res.statusCode, res.payload]));
      });
    }

    it('...and all of them returned the SAME status and body', () => {
      // Runs last. Any branch that grew a chattier message shows up as >1.
      expect(new Set(seen).size).toBe(1);
    });
  });

  // ── THE C2 BOUNDARY. Both directions, at the HTTP layer. ─────────────────
  describe('lane/bucket coherence is a 400, in BOTH directions', () => {
    it('servicing + a non-null bucket is a 400 — it would break the sum', async () => {
      for (const bucket of DIAL_BUCKETS) {
        const res = await post({ body: body({ lane: 'servicing', bucket }) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toMatch(/bucket must be null when lane is servicing/);
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
      }
    });

    it('newBusiness + a null bucket is a 400 — dials and dialsByType would disagree', async () => {
      const res = await post({ body: body({ lane: 'newBusiness', bucket: null }) });
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toMatch(/bucket must be one of/);
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });

    it('newBusiness with the bucket key ABSENT is a 400 too', async () => {
      // Saying nothing is not the same as saying no. See validatePayload.
      const b = body();
      delete b.bucket;
      const res = await post({ body: b });
      expect(res.statusCode).toBe(400);
    });

    it('servicing with the bucket key ABSENT is a 400 — send an explicit null', async () => {
      const b = body({ lane: 'servicing' });
      delete b.bucket;
      const res = await post({ body: b });
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toMatch(/bucket must be null when lane is servicing/);
    });

    it('seminarTradeshow is refused — no calling campaign feeds it', async () => {
      const res = await post({ body: body({ bucket: 'seminarTradeshow' }) });
      expect(res.statusCode).toBe(400);
    });

    it('an unknown lane is a 400', async () => {
      for (const lane of ['coaching', 'newbusiness', '', null, 7]) {
        expect((await post({ body: body({ lane }) })).statusCode).toBe(400);
      }
    });
  });

  it('ffi without booking is a 400, never a half-state', async () => {
    const res = await post({ body: body({ ffi: true, booking: false }) });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/ffi requires booking/);
    expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
  });

  it('booking without ffi is FINE — not every meeting is a fact-find', async () => {
    const res = await post({ body: body({ booking: true, ffi: false }) });
    expect(res.statusCode).toBe(200);
    expect(mockDb.read(dailyPath('2026-08-26')).ffisScheduled).toBeUndefined();
  });

  it('a non-boolean effect flag is a 400 — "false" is a TRUTHY STRING', async () => {
    for (const flag of EFFECT_FLAGS) {
      for (const bad of ['false', 'true', 1, 0, null]) {
        const res = await post({ body: body({ [flag]: bad }) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toContain(flag);
      }
      const missing = body();
      delete missing[flag];
      expect((await post({ body: missing })).statusCode).toBe(400);
    }
    expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
  });

  describe('rawOutcome / rawCampaign', () => {
    for (const name of ['rawOutcome', 'rawCampaign']) {
      it('rejects a missing ' + name + ' — traceability is not optional', async () => {
        const b = body();
        delete b[name];
        const res = await post({ body: b });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toContain(name);
      });

      it('rejects a non-string or empty ' + name, async () => {
        for (const bad of [42, null, true, {}, '', '   ']) {
          expect((await post({ body: body({ [name]: bad }) })).statusCode).toBe(400);
        }
      });

      it('rejects an over-long ' + name, async () => {
        const res = await post({ body: body({ [name]: 'x'.repeat(RAW_FIELD_MAX_CHARS + 1) }) });
        expect(res.statusCode).toBe(400);
      });

      it('accepts ' + name + ' at exactly the cap', async () => {
        const res = await post({ body: body({ [name]: 'x'.repeat(RAW_FIELD_MAX_CHARS) }) });
        expect(res.statusCode).toBe(200);
      });
    }
  });

  describe('the retired slice-B contract is named, not merely rejected', () => {
    for (const retired of ['campaignCode', 'outcome']) {
      it('names ' + retired + ' in the error', async () => {
        const res = await post({ body: body({ [retired]: 'schools' }) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toContain(retired);
        expect(res.payload.error).toMatch(/retired slice-B contract/);
      });
    }

    it('a whole slice-B body is refused with the useful message', async () => {
      const res = await post({
        body: {
          sourceApp: 'kqm-calls',
          sourceId: 'act-0001',
          occurredAt: '2026-08-26T14:05:00-04:00',
          campaignCode: 'schools',
          outcome: 'meeting_booked',
          durationSec: 132,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toMatch(/retired slice-B contract/);
      expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
    });
  });

  it('rejects an unknown sourceApp', async () => {
    const res = await post({ body: body({ sourceApp: 'some-other-dialer' }) });
    expect(res.statusCode).toBe(400);
  });

  describe('an identity field in the payload is a 400, never ignored', () => {
    for (const field of ['creditUid', 'agentEmail', 'uid', 'tenantId', 'agentId']) {
      it('rejects a body carrying ' + field, async () => {
        const res = await post({ body: body({ [field]: 'agent_someone_else' }) });
        expect(res.statusCode).toBe(400);
        expect(res.payload.error).toContain(field);
        expect(mockDb.exists(dailyPath('2026-08-26'))).toBe(false);
      });
    }

    it('rejects it even when the value equals the legitimate owner', async () => {
      const res = await post({ body: body({ creditUid: CREDIT_UID }) });
      expect(res.statusCode).toBe(400);
    });

    it('IDENTITY IS CHECKED BEFORE THE RETIRED-FIELD MESSAGE', async () => {
      // A-prime's principle outranks a convenience message: a body carrying both
      // must report the identity refusal, not the friendlier contract hint.
      const res = await post({ body: body({ creditUid: 'x', campaignCode: 'schools' }) });
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toContain('creditUid');
    });
  });

  it('rejects a sourceId that could escape the document path', async () => {
    for (const bad of ['../../evil', 'a/b', '.', '..', '', 'x'.repeat(200)]) {
      const res = await post({ body: body({ sourceId: bad }) });
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects a bad occurredAt', async () => {
    for (const bad of ['not a date', '', null, undefined, 42]) {
      const res = await post({ body: body({ occurredAt: bad }) });
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects a negative or non-numeric durationSec', async () => {
    expect((await post({ body: body({ durationSec: -5 }) })).statusCode).toBe(400);
    expect((await post({ body: body({ durationSec: 'long' }) })).statusCode).toBe(400);
  });

  it('accepts an absent durationSec — it is optional evidence, not a KPI', async () => {
    const b = body();
    delete b.durationSec;
    const res = await post({ body: b });
    expect(res.statusCode).toBe(200);
  });

  it('durationSec NEVER overrules reached — a voicemail accrues seconds', async () => {
    // F4, carried forward and made mechanical. `reached: false` with a long
    // duration is a voicemail, and it must NOT produce telContacts. `reached:
    // true` with zero seconds is still a contact.
    await apply({ sourceId: 'vm', reached: false, booking: false, durationSec: 600 });
    expect(mockDb.read(dailyPath('2026-08-26')).telContacts).toBeUndefined();

    await apply({ sourceId: 'brief', reached: true, booking: false, durationSec: 0 });
    expect(mockDb.read(dailyPath('2026-08-26')).telContacts).toBe(1);
  });

  it('rejects a non-object body', async () => {
    for (const bad of [null, 'a string', [1, 2, 3], 7]) {
      const res = await post({ body: bad });
      expect(res.statusCode).toBe(400);
    }
  });

  it('AUTH IS CHECKED BEFORE THE PAYLOAD — a bad token never leaks a 400', async () => {
    // Otherwise "bucket must be null" vs "unauthorized" tells a prober their
    // token resolved, which is the enumeration oracle this endpoint must not be.
    const res = await post({
      headers: { authorization: 'Bearer ' + 'c'.repeat(64) },
      body: body({ lane: 'nonsense', creditUid: 'x' }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('never echoes the raw token in any response', async () => {
    const responses = [];
    responses.push((await post()).payload);
    responses.push((await post({ headers: { authorization: 'Bearer ' + 'd'.repeat(64) } })).payload);
    responses.push((await post({ body: body({ lane: 'bad' }) })).payload);
    for (const p of responses) {
      expect(JSON.stringify(p)).not.toContain(RAW_TOKEN);
      expect(JSON.stringify(p)).not.toContain('d'.repeat(64));
    }
  });

  it('never logs the raw token', async () => {
    await post({ headers: { authorization: 'Bearer ' + RAW_TOKEN.replace('a', 'z') } });
    const logged = console.warn.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain(RAW_TOKEN);
  });

  it('answers 500 without leaking internals when Firestore fails', async () => {
    mockDb.runTransaction = () => Promise.reject(new Error('boom at tenants/x/users/y'));
    const res = await post();
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ ok: false, error: 'internal' });
  });
});

// ---------------------------------------------------------------------------
describe('rate limiting is per source doc', () => {
  it('rejects past the window cap and writes no KPI', async () => {
    for (let i = 0; i < RATE_MAX_PER_WINDOW; i += 1) {
      const r = await apply({ sourceId: 'burst-' + i });
      expect(r.applied).toBe(true);
    }
    const over = await apply({ sourceId: 'burst-over' });
    expect(over.rateLimited).toBe(true);
    expect(mockDb.read(dailyPath('2026-08-26')).dials).toBe(RATE_MAX_PER_WINDOW);
  });

  it('the window rolls — a later call is accepted again', async () => {
    mockDb.seed(SOURCE_PATH, {
      ...mockDb.read(SOURCE_PATH),
      ingestWindowStart: NOW.getTime() - 5 * 60 * 1000,
      ingestWindowCount: RATE_MAX_PER_WINDOW + 50,
    });
    const r = await apply({ sourceId: 'after-window' });
    expect(r.applied).toBe(true);
    expect(mockDb.read(SOURCE_PATH).ingestWindowCount).toBe(1);
  });

  it('the HTTP layer answers 429', async () => {
    mockDb.seed(SOURCE_PATH, {
      ...mockDb.read(SOURCE_PATH),
      ingestWindowStart: NOW.getTime(),
      ingestWindowCount: RATE_MAX_PER_WINDOW,
    });
    const res = makeRes();
    // Freeze the clock inside the handler by pinning Date to the seeded window.
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) return new RealDate(NOW.getTime());
        return new RealDate(...args);
      }

      static now() {
        return NOW.getTime();
      }
    };
    try {
      await handler(makeReq(), res);
    } finally {
      global.Date = RealDate;
    }
    expect(res.statusCode).toBe(429);
  });
});

// ---------------------------------------------------------------------------
describe('setNested', () => {
  it('expands a dotted path into real nesting', () => {
    expect(setNested({}, 'dialsByType.cold', 1)).toEqual({ dialsByType: { cold: 1 } });
  });

  it('leaves an undotted field alone', () => {
    expect(setNested({}, 'dials', 1)).toEqual({ dials: 1 });
  });

  it('does not clobber a sibling already written into the same map', () => {
    const t = {};
    setNested(t, 'dialsByType.cold', 1);
    setNested(t, 'dialsByType.referral', 2);
    expect(t).toEqual({ dialsByType: { cold: 1, referral: 2 } });
  });
});

/**
 * ── MUTATION VERIFICATION — the idempotency guard ───────────────────────────
 *
 * RE-RUN 27 Aug 2026 against the C2 contract, because the suite that certified
 * this guard was rewritten and a rewritten suite is exactly where the safety
 * quietly leaks out. Observed counts below, not asserted ones.
 *
 * The guard is the early return in applyCall():
 *
 *     const ingestSnap = await tx.get(ingestRef);
 *     if (ingestSnap.exists) return { applied: false, duplicate: true, ... };
 *
 * Command, both mutations:
 *   npx jest callActivity/__tests__/outcomeMap.test.js \
 *            callActivity/__tests__/ingestCallActivity.test.js
 * Baseline before either mutation: 122 passed, 122 total (both suites).
 * (The full `npx jest callActivity` run is 136, adding resolveCallSource.test.js
 * — untouched by this slice and unmoved by either mutation.)
 *
 * MUTATION 1 — DELETE the guard (the early return never fires).
 *   OBSERVED: Tests: 4 failed, 118 passed, 122 total. The four, all in this
 *   file's idempotency block and nowhere else:
 *     · a sequential replay of the SAME sourceId moves the KPI exactly once
 *     · a third and fourth replay still move nothing
 *     · CONCURRENT: two simultaneous deliveries of one sourceId count ONCE
 *     · CONCURRENT: five simultaneous deliveries still count ONCE
 *   GREEN and untouched: every TT-date test, every rejection test, the whole
 *   lane/bucket coherence block, the raw-fields block, the servicing-lane block,
 *   the late-arrival block, the rate-limit block, and outcomeMap.test.js in
 *   full. Exactly the idempotency tests went red and nothing else.
 *
 * MUTATION 2 — move the check OUTSIDE the transaction: read the ingest doc with
 *   a plain ingestRef.get() before runTransaction and keep the write inside.
 *   This is the plausible-looking implementation the brief warns about, and the
 *   result is the whole argument for the concurrent variant.
 *   OBSERVED: Tests: 2 failed, 120 passed, 122 total.
 *     · a sequential replay ...............................  STILL GREEN
 *     · a third and fourth replay .........................  STILL GREEN
 *     · CONCURRENT: two simultaneous deliveries ...........  RED
 *     · CONCURRENT: five simultaneous deliveries ..........  RED
 *   A suite carrying only the sequential test would have certified a
 *   double-counting endpoint as correct — under the new contract exactly as
 *   under the old one.
 *
 * ── MUTATION VERIFICATION — the ladder wiring (30 Aug 2026) ─────────────────
 *
 * The wiring under test is six lines in validatePayload():
 *
 *     for (const key of ['kind', ...LADDER_FLAGS]) {
 *       if (Object.prototype.hasOwnProperty.call(body, key)) effects[key] = body[key];
 *     }
 *
 * It is the ONLY route by which a ladder request's own words reach
 * coherenceError. Its absence is what this slice was written to fix, and its
 * absence FAILS QUIETLY IN THE WORST WAY — outcomeMap.test.js stays 100% green,
 * because the mapper is perfect and simply never sees the fields.
 *
 * MUTATION — empty the key list (`for (const key of [])`), leaving everything
 *   else, including outcomeMap.js, untouched.
 *   Command: npx jest callActivity
 *   Baseline: 162 passed, 162 total (3 suites).
 *   OBSERVED: Tests: 15 failed, 147 passed, 162 total. Suites: 1 failed,
 *   2 passed — outcomeMap.test.js and resolveCallSource.test.js BOTH STILL
 *   GREEN, which is the whole point: the mapper's 110 legal effect sets prove
 *   nothing about whether the endpoint hands it the effects.
 *   Every failure was in the ladder block; every call test, TT-date test,
 *   idempotency test and rejection test outside it stayed green, so the
 *   backwards-compatibility claim is not resting on the same wiring it certifies.
 *   The four ladder rejection tests that stayed green did so for the WRONG
 *   reason — a dropped `kind` makes a ladder body look like a newBusiness call
 *   with a null bucket, which 400s on the bucket rule instead. Rejection tests
 *   are weak evidence here by construction; the counting tests are the evidence.
 */
