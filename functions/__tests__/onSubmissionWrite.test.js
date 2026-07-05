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
  // Qualifying values sit above the L1-1 corrected MDRT threshold (688,800), not the
  // old 500k floor — see the dedicated threshold describe block below.

  test('v2 submission (newBusiness.api) is counted toward YTD → earns mdrt_qualified', async () => {
    // Before the fix, `d.data().apiSold` was undefined on v2 docs → contributed 0 → no badge.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 700000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(setFn).toHaveBeenCalledTimes(1);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('v2 total production credit includes PPP increases + lumpsums (matches leaderboard ranking)', async () => {
    // 400k NB + 200k PPP + 100k lumpsum = 700k ≥ 688,800. NB alone (400k) would NOT qualify —
    // proves the reducer uses the canonical total-production reader, not newBusiness.api only.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({
        weekStarting: `${YEAR}-02-02`,
        version: 2,
        newBusiness: { api: 400000 },
        pppIncreases: { apiIncrease: 200000 },
        lumpsums: { apiCredit: 100000 },
      })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('legacy v1 submission (flat apiSold) still counts toward YTD → earns mdrt_qualified', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, apiSold: 700000 })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('mixed v2 + legacy submissions sum together across the YTD window', async () => {
    // 350k (v2 newBusiness.api) + 350k (v1 apiSold) = 700k ≥ 688,800. Neither alone qualifies.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [
        mkDoc({ weekStarting: `${YEAR}-03-01`, version: 2, newBusiness: { api: 350000 } }),
        mkDoc({ weekStarting: `${YEAR}-04-05`, apiSold: 350000 }),
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
    // A 700k submission (≥ MDRT threshold) dated in a prior year must not count toward this
    // year's MDRT — proves exclusion is the reason, not the amount.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR - 6}-06-08`, version: 2, newBusiness: { api: 700000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);

    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });
});

describe('onSubmissionWrite — MDRT threshold corrected to 688,800 (L1-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Reuse the same YTD-aware mock shape as the EFF-004 block above.
  function makeYtdAdminMock({ userDoc = { role: 'agent' }, ytdDocs = [] } = {}) {
    const setFn = jest.fn().mockResolvedValue({});
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
          delete: jest.fn().mockResolvedValue({}),
        };
      }
      return { set: jest.fn().mockResolvedValue({}) };
    });
    const limit1 = jest.fn(() => ({ get: streakGet }));
    const q3 = jest.fn(() => ({ limit: limit1, get: streakGet }));
    const q2 = jest.fn(() => ({ where: q3, get: ytdGet }));
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
  const YEAR = new Date().getFullYear();
  // Bind the assertion to the source constant so it tracks the annual MDRT bump.
  const { MDRT_QUALIFIED_API } = require('../lib/badgeThresholds');

  test('540,554 YTD (real smoke-agent value, ≥ old 500k) does NOT earn mdrt_qualified', async () => {
    // The pre-fix 500k threshold wrongly qualified this agent 148,246 short of MDRT.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 540554 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });

  test('exactly 688,800 YTD earns mdrt_qualified (threshold is inclusive)', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: MDRT_QUALIFIED_API } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('one TTD below the threshold does NOT earn mdrt_qualified', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: MDRT_QUALIFIED_API - 1 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });
});

describe('onSubmissionWrite — 5-year tenure floor marker (L1-1 Commit 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Same YTD-aware mock; userDoc carries contractStartDate so the floor marker can
  // read the agent's tenure from the (already-loaded) user doc.
  function makeYtdAdminMock({ userDoc = { role: 'agent' }, ytdDocs = [] } = {}) {
    const setFn = jest.fn().mockResolvedValue({});
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
          delete: jest.fn().mockResolvedValue({}),
        };
      }
      return { set: jest.fn().mockResolvedValue({}) };
    });
    const limit1 = jest.fn(() => ({ get: streakGet }));
    const q3 = jest.fn(() => ({ limit: limit1, get: streakGet }));
    const q2 = jest.fn(() => ({ where: q3, get: ytdGet }));
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
  const YEAR = new Date().getFullYear();
  const { TENURE_FLOOR_API, TENURE_FLOOR_YEARS } = require('../lib/badgeThresholds');
  // Derive contract dates dynamically so they never rot across a year boundary.
  const TENURED    = `${YEAR - (TENURE_FLOOR_YEARS + 1)}-01-01`; // safely > 5 yrs
  const BOUNDARY   = `${YEAR - TENURE_FLOOR_YEARS}-01-01`;        // exactly 5 yrs (inclusive)
  const NOT_TENURED = `${YEAR - (TENURE_FLOOR_YEARS - 3)}-01-01`; // ~2 yrs, well under 5

  test('tenured agent (5+ yrs) at the TTD 500k floor earns tenure_floor_met', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent', contractStartDate: TENURED },
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: TENURE_FLOOR_API } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).toContain('tenure_floor_met');
  });

  test('exactly 5 years since contract counts (inclusive boundary)', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent', contractStartDate: BOUNDARY },
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: TENURE_FLOOR_API } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).toContain('tenure_floor_met');
  });

  test('agent under 5 years at the SAME API does NOT earn tenure_floor_met', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent', contractStartDate: NOT_TENURED },
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: TENURE_FLOOR_API } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).not.toContain('tenure_floor_met');
  });

  test('tenured agent below the 500k floor does NOT earn tenure_floor_met', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent', contractStartDate: TENURED },
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: TENURE_FLOOR_API - 1 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).not.toContain('tenure_floor_met');
  });

  test('agent with no contractStartDate does NOT earn tenure_floor_met (safe default)', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent' }, // contractStartDate absent
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: TENURE_FLOOR_API } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    expect(badgesFrom(setFn)).not.toContain('tenure_floor_met');
  });

  test('tenured agent at MDRT level earns BOTH mdrt_qualified and tenure_floor_met (distinct goals)', async () => {
    const { setFn } = makeYtdAdminMock({
      userDoc: { role: 'agent', contractStartDate: TENURED },
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 700000 } })],
    });
    await onSubmissionWrite.run(makeChange(BASE_SUBMISSION), context);
    const badges = badgesFrom(setFn);
    expect(badges).toContain('mdrt_qualified');
    expect(badges).toContain('tenure_floor_met');
  });
});

describe('onSubmissionWrite — mdrt_pace 344,400 threshold + YTD weekStarting-year attribution (L1-1/L1-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function makeYtdAdminMock({ userDoc = { role: 'agent' }, ytdDocs = [] } = {}) {
    const setFn = jest.fn().mockResolvedValue({});
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
          delete: jest.fn().mockResolvedValue({}),
        };
      }
      return { set: jest.fn().mockResolvedValue({}) };
    });
    const limit1 = jest.fn(() => ({ get: streakGet }));
    const q3 = jest.fn(() => ({ limit: limit1, get: streakGet }));
    const q2 = jest.fn(() => ({ where: q3, get: ytdGet }));
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
  const { MDRT_PACE_API } = require('../lib/badgeThresholds');
  // The pace time-gate reads Date.now()/new Date() directly (not injectable via the
  // mock), so pin the clock: H1 = week <= 26 (gate OPEN), H2 = week > 26 (gate SHUT).
  // The mocked year fixes the YTD-attribution year too, so ytdDocs use the same year.
  const MOCK_YEAR = 2026;
  const setH1 = () => { jest.useFakeTimers(); jest.setSystemTime(new Date(`${MOCK_YEAR}-03-01T12:00:00Z`)); };
  const setH2 = () => { jest.useFakeTimers(); jest.setSystemTime(new Date(`${MOCK_YEAR}-09-01T12:00:00Z`)); };
  const paceSub = { ...BASE_SUBMISSION, weekStarting: `${MOCK_YEAR}-02-01` };

  test('legacy 250k–344,399 range NO LONGER earns mdrt_pace (threshold moved to 344,400)', async () => {
    setH1();
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${MOCK_YEAR}-02-01`, version: 2, newBusiness: { api: 300000 } })],
    });
    await onSubmissionWrite.run(makeChange(paceSub), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_pace');
  });

  test('exactly 344,400 (below MDRT, within the H1 time gate) earns mdrt_pace, not mdrt_qualified', async () => {
    setH1();
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${MOCK_YEAR}-02-01`, version: 2, newBusiness: { api: MDRT_PACE_API } })],
    });
    await onSubmissionWrite.run(makeChange(paceSub), context);
    const badges = badgesFrom(setFn);
    expect(badges).toContain('mdrt_pace');
    expect(badges).not.toContain('mdrt_qualified'); // 344,400 < 688,800
  });

  test('one TTD below 344,400 does NOT earn mdrt_pace', async () => {
    setH1();
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${MOCK_YEAR}-02-01`, version: 2, newBusiness: { api: MDRT_PACE_API - 1 } })],
    });
    await onSubmissionWrite.run(makeChange(paceSub), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_pace');
  });

  test('time gate preserved: after week 26, YTD >= 344,400 still does NOT earn mdrt_pace', async () => {
    setH2();
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${MOCK_YEAR}-02-01`, version: 2, newBusiness: { api: 400000 } })],
    });
    await onSubmissionWrite.run(makeChange(paceSub), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_pace');
  });

  const YEAR = new Date().getFullYear();
  const withWeek = (weekStarting) => ({ ...BASE_SUBMISSION, weekStarting });

  test('a December week entered in January attributes to the December year (not the entry year)', async () => {
    // Trigger submission is a prior-Dec week; the agent has 700k of prior-year YTD.
    // OLD code used new Date().getFullYear() (the entry year, ~this YEAR) and would
    // sum the wrong year → no badge. The fix attributes to the weekStarting year.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR - 1}-12-28`, version: 2, newBusiness: { api: 700000 } })],
    });
    await onSubmissionWrite.run(makeChange(withWeek(`${YEAR - 1}-12-28`)), context);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('a year-straddle week (weekStarting Dec 29) attributes ENTIRELY to the weekStarting year', async () => {
    // 400k (straddle week) + 300k (mid prior-year) = 700k, all in YEAR-1.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [
        mkDoc({ weekStarting: `${YEAR - 1}-12-29`, version: 2, newBusiness: { api: 400000 } }),
        mkDoc({ weekStarting: `${YEAR - 1}-06-01`, version: 2, newBusiness: { api: 300000 } }),
      ],
    });
    await onSubmissionWrite.run(makeChange(withWeek(`${YEAR - 1}-12-29`)), context);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });

  test('submissions from a DIFFERENT year do not leak into the attribution-year sum', async () => {
    // Processing a prior-year week: only prior-year docs count. The current-year
    // 400k doc must NOT be summed → 400k < 688,800 → no MDRT.
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [
        mkDoc({ weekStarting: `${YEAR - 1}-11-30`, version: 2, newBusiness: { api: 400000 } }),
        mkDoc({ weekStarting: `${YEAR}-01-04`,     version: 2, newBusiness: { api: 400000 } }),
      ],
    });
    await onSubmissionWrite.run(makeChange(withWeek(`${YEAR - 1}-11-30`)), context);
    expect(badgesFrom(setFn)).not.toContain('mdrt_qualified');
  });

  test('normal current-year case is unchanged (weekStarting year == entry year)', async () => {
    const { setFn } = makeYtdAdminMock({
      ytdDocs: [mkDoc({ weekStarting: `${YEAR}-06-08`, version: 2, newBusiness: { api: 700000 } })],
    });
    await onSubmissionWrite.run(makeChange(withWeek(`${YEAR}-06-08`)), context);
    expect(badgesFrom(setFn)).toContain('mdrt_qualified');
  });
});
