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

function makeAdminMock({ isTestAccount = false } = {}) {
  const setFn    = jest.fn().mockResolvedValue({});
  const deleteFn = jest.fn().mockResolvedValue({});

  const docFn = jest.fn().mockImplementation((path) => {
    if (path.includes('/users/')) {
      return {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => (isTestAccount ? { isTestAccount: true } : {}),
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
