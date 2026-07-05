'use strict';

// jest.mock is hoisted before all require() calls.
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// Comprehensive firebase-functions stub — covers all export styles in index.js.
// The onWrite path wraps the handler so onSubmissionWrite.run === the async handler.
jest.mock('firebase-functions', () => {
  const wrap = jest.fn((h) => ({ run: h }));
  const stub = jest.fn(() => ({ run: jest.fn() }));
  class HttpsError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  }
  const httpsStub = { onCall: stub, onRequest: stub, HttpsError };
  const pubsubStub = { schedule: jest.fn(() => ({ timeZone: jest.fn(() => ({ onRun: stub })), onRun: stub })) };
  return {
    firestore: {
      document: jest.fn(() => ({
        onWrite:   wrap,
        onCreate:  wrap,
        onUpdate:  stub,
        onDelete:  stub,
      })),
    },
    https:   httpsStub,
    auth:    { user: jest.fn(() => ({ onCreate: stub })) },
    pubsub:  pubsubStub,
    runWith: jest.fn(() => ({ https: httpsStub, pubsub: pubsubStub })),
    config:  jest.fn(() => ({})),
  };
});

const admin = require('firebase-admin');
const { onSubmissionWrite } = require('../index');

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeAdminMock({ isTestAccount = false, userDoc = null, exists = true } = {}) {
  const setFn    = jest.fn().mockResolvedValue({});
  const deleteFn = jest.fn().mockResolvedValue({});

  const resolvedUserDoc = userDoc ?? (isTestAccount ? { isTestAccount: true } : {});

  const docFn = jest.fn().mockImplementation((path) => {
    if (path.includes('/users/')) {
      return {
        get: jest.fn().mockResolvedValue({
          exists,
          data: () => resolvedUserDoc,
        }),
      };
    }
    if (path.includes('/leaderboard/')) {
      return {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        set: setFn,
        delete: deleteFn,
      };
    }
    return { set: jest.fn().mockResolvedValue({}) };
  });

  // Submissions query chain — supports both:
  //   .where().where().where().limit(1).get()  (streak loop)
  //   .where().where().get()                   (YTD)
  const emptyGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
  const limit1   = jest.fn(() => ({ get: emptyGet }));
  const q3       = jest.fn(() => ({ limit: limit1, get: emptyGet }));
  const q2       = jest.fn(() => ({ where: q3,     get: emptyGet }));
  const q1       = jest.fn(() => ({ where: q2 }));

  const collectionFn = jest.fn().mockImplementation((path) => {
    if (path.includes('notifications')) return { add: jest.fn().mockResolvedValue({}) };
    return { where: q1 };
  });

  admin.firestore.mockReturnValue({ doc: docFn, collection: collectionFn });
  admin.firestore.FieldValue = { serverTimestamp: jest.fn(() => null) };

  return { setFn, deleteFn, docFn };
}

function makeChange(afterData) {
  return {
    before: { exists: false, data: () => null },
    after:  { exists: true,  data: () => afterData },
  };
}

const BASE_SUBMISSION = {
  status:       'submitted',
  agentId:      'agent-uid-001',
  agentName:    'Test Agent',
  weekStarting: '2026-06-08',
};

const context = { params: { tenantId: 'test_tenant', subId: 'sub001' } };

// ─────────────────────────────────────────────────────────────────────────────

describe('onSubmissionWrite — isTestAccount guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('flagged uid: skips leaderboard write and deletes any existing entry', async () => {
    const { setFn, deleteFn } = makeAdminMock({ isTestAccount: true });
    const change = makeChange(BASE_SUBMISSION);

    await onSubmissionWrite.run(change, context);

    expect(setFn).not.toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  test('non-flagged uid: writes leaderboard doc (existing behavior preserved)', async () => {
    const { setFn, deleteFn } = makeAdminMock({ isTestAccount: false });
    const change = makeChange(BASE_SUBMISSION);

    await onSubmissionWrite.run(change, context);

    expect(setFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});

describe('onSubmissionWrite — participation gate (Slice 2.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['sales_manager',  { role: 'sales_manager' }],
    ['tenant_admin',   { role: 'tenant_admin' }],
    ['platform_admin', { role: 'platform_admin' }],
    ['branch_manager without opt-in', { role: 'branch_manager', appearOnLeaderboard: false }],
    ['branch_manager with no appearOnLeaderboard field', { role: 'branch_manager' }],
    ['provisioning account', { role: 'agent', provisioning: true }],
  ])('%s: skips leaderboard write and deletes any existing entry', async (_label, doc) => {
    const { setFn, deleteFn } = makeAdminMock({ userDoc: doc });
    const change = makeChange(BASE_SUBMISSION);

    await onSubmissionWrite.run(change, context);

    expect(setFn).not.toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['agent',                         { role: 'agent' }],
    ['unit_manager',                  { role: 'unit_manager' }],
    ['branch_manager opted-in',       { role: 'branch_manager', appearOnLeaderboard: true }],
  ])('%s: writes leaderboard doc', async (_label, doc) => {
    const { setFn, deleteFn } = makeAdminMock({ userDoc: doc });
    const change = makeChange(BASE_SUBMISSION);

    await onSubmissionWrite.run(change, context);

    expect(setFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  test('non-existent user document: skips leaderboard write and deletes any existing entry', async () => {
    const { setFn, deleteFn } = makeAdminMock({ exists: false });
    const change = makeChange(BASE_SUBMISSION);

    await onSubmissionWrite.run(change, context);

    expect(setFn).not.toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });
});

describe('onSubmissionWrite — YTD MDRT badge reads BOTH v2 and legacy API shapes (EFF-004)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Dedicated admin mock: the YTD scan (`.where(agentId).where(status).get()`) returns
  // `ytdDocs`, while the streak loop's terminal `.limit(1).get()` stays empty (streak = 1).
  // The two are distinguishable by query depth — YTD calls `.get()` after 2 wheres; the
  // streak calls it after 3 wheres + `.limit(1)`.
  function makeYtdAdminMock({ userDoc = { role: 'agent' }, ytdDocs = [] } = {}) {
    const setFn = jest.fn().mockResolvedValue({});
    const deleteFn = jest.fn().mockResolvedValue({});

    const streakGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const ytdGet    = jest.fn().mockResolvedValue({ docs: ytdDocs });

    const docFn = jest.fn().mockImplementation((path) => {
      if (path.includes('/users/')) {
        return { get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }) };
      }
      if (path.includes('/leaderboard/')) {
        return {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: setFn,
          delete: deleteFn,
        };
      }
      return { set: jest.fn().mockResolvedValue({}) };
    });

    const limit1 = jest.fn(() => ({ get: streakGet }));           // streak terminal
    const q3 = jest.fn(() => ({ limit: limit1, get: streakGet })); // after 3 wheres (streak)
    const q2 = jest.fn(() => ({ where: q3, get: ytdGet }));        // after 2 wheres → YTD .get
    const q1 = jest.fn(() => ({ where: q2 }));

    const collectionFn = jest.fn().mockImplementation((path) => {
      if (path.includes('notifications')) return { add: jest.fn().mockResolvedValue({}) };
      return { where: q1 };
    });

    admin.firestore.mockReturnValue({ doc: docFn, collection: collectionFn });
    admin.firestore.FieldValue = { serverTimestamp: jest.fn(() => null) };

    return { setFn };
  }

  const mkDoc = (data) => ({ data: () => data });
  const badgesFrom = (setFn) => setFn.mock.calls[0][0].badges;
  // Derive the current year so these YTD-year-matching assertions don't rot on Jan-1 rollover
  // (the reducer filters on `new Date().getFullYear()`).
  const YEAR = new Date().getFullYear();

  test('v2 submission (newBusiness.api) is counted toward YTD → earns mdrt_qualified', async () => {
    // Before the fix, `d.data().apiSold` was undefined on v2 docs → contributed 0 → no badge.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 600000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(setFn).toHaveBeenCalledTimes(1);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('v2 total production credit includes PPP increases + lumpsums (matches leaderboard ranking)', async () => {
    // 300k NB + 150k PPP + 60k lumpsum = 510k ≥ 500k. NB alone (300k) would NOT qualify —
    // proves the reducer uses the canonical total-production reader, not newBusiness.api only.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({
        weekStarting: `${YEAR}-02-02`,
        version: 2,
        newBusiness: { api: 300000 },
        pppIncreases: { apiIncrease: 150000 },
        lumpsums: { apiCredit: 60000 },
      })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('legacy v1 submission (flat apiSold) still counts toward YTD → earns mdrt_qualified', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, apiSold: 600000 })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('mixed v2 + legacy submissions sum together across the YTD window', async () => {
    // 300k (v2 newBusiness.api) + 300k (v1 apiSold) = 600k ≥ 500k. Neither alone qualifies.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [
        mkDoc({ weekStarting: `${YEAR}-03-01`, version: 2, newBusiness: { api: 300000 } }),
        mkDoc({ weekStarting: `${YEAR}-04-05`, apiSold: 300000 }),
      ],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('below-threshold v2 YTD does NOT earn mdrt_qualified (no false positive)', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 100000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });

  test('prior-year submissions are excluded from the YTD sum', async () => {
    // A 600k submission dated in a prior year must not count toward this year's MDRT.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR - 6}-06-08`, version: 2, newBusiness: { api: 600000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });
});
