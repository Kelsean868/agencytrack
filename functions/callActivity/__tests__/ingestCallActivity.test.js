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
const { EFFECT_FLAGS, INGEST_BUCKETS, DIAL_BUCKETS } = require('../outcomeMap');
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
 */
