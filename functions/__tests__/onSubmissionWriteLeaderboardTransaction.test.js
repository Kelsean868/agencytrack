'use strict';

// BUG-08 (audit 2026-09-24) — the leaderboard read-modify-write
// (lbRef.get() → prevPoints + points → lbRef.set()) ran outside a
// transaction, which (a) lost updates when two submissions for the same
// agent were processed concurrently and (b) double-counted points on a
// revert-to-draft + resubmit cycle, since every resubmit re-added the FULL
// `points` rather than the delta from what that submission last awarded.
//
// These tests exercise the real handler end-to-end with a mock Firestore
// that has a real leaderboard doc store (so a "resubmit" test can chain two
// `.run()` calls and see the second read the first's write), and mock
// `computePoints` so the awarded amount per submission is set directly by
// the test instead of depending on real point-scoring math.

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

jest.mock('firebase-functions/v1', () => {
  const wrap = jest.fn((h) => ({ run: h }));
  const stub = jest.fn(() => ({ run: jest.fn() }));
  class HttpsError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  }
  const httpsStub = { onCall: stub, onRequest: stub, HttpsError };
  const pubsubStub = { schedule: jest.fn(() => ({ timeZone: jest.fn(() => ({ onRun: stub })), onRun: stub })) };
  return {
    firestore: { document: jest.fn(() => ({ onWrite: wrap, onCreate: wrap, onUpdate: stub, onDelete: stub })) },
    https: httpsStub,
    auth: { user: jest.fn(() => ({ onCreate: stub })) },
    pubsub: pubsubStub,
    runWith: jest.fn(() => ({ https: httpsStub, pubsub: pubsubStub })),
    config: jest.fn(() => ({})),
  };
});

// Decouple from real point-scoring math: each submission carries its own
// intended point award via `__points`.
jest.mock('../lib/computePoints', () => ({
  computePoints: jest.fn((after) => after.__points ?? 0),
}));

const admin = require('firebase-admin');
const { onSubmissionWrite } = require('../index');

/**
 * A leaderboard doc store (path → data) plus a submissions collection stub
 * (always empty — streak/YTD/badge reads are not the concern of this file).
 * `runTransaction` delegates get/set straight onto the leaderboard ref, same
 * as the real Admin SDK transaction object, so a real read-modify-write race
 * is reproducible: whatever is in the store when `tx.get()` runs is what the
 * handler computes its delta against.
 */
function makeFirestoreMock() {
  const lbStore = {};

  const emptyGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
  const limit1 = jest.fn(() => ({ get: emptyGet }));
  const q3 = jest.fn(() => ({ limit: limit1, get: emptyGet }));
  const q2 = jest.fn(() => ({ where: q3, get: emptyGet }));
  const q1 = jest.fn(() => ({ where: q2 }));

  const docFn = jest.fn((path) => {
    if (path.includes('/users/')) {
      return { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: 'agent' }) }) };
    }
    if (path.includes('/leaderboard/')) {
      return {
        get: jest.fn(async () => ({ exists: lbStore[path] !== undefined, data: () => lbStore[path] })),
        set: jest.fn((data, opts) => {
          lbStore[path] = opts && opts.merge ? { ...(lbStore[path] ?? {}), ...data } : data;
        }),
        delete: jest.fn().mockResolvedValue({}),
      };
    }
    return { set: jest.fn().mockResolvedValue({}) };
  });

  const collectionFn = jest.fn((path) => {
    if (path.includes('notifications')) return { add: jest.fn().mockResolvedValue({}) };
    return { where: q1 };
  });

  const runTransaction = jest.fn((cb) => cb({
    get: (ref) => ref.get(),
    set: (ref, data, opts) => ref.set(data, opts),
  }));

  admin.firestore.mockReturnValue({ doc: docFn, collection: collectionFn, runTransaction });
  admin.firestore.FieldValue = { serverTimestamp: jest.fn(() => null) };
  admin.firestore.Timestamp = { now: jest.fn(() => null) };

  return { lbStore, runTransaction };
}

function makeChange(afterData) {
  return { before: { exists: false, data: () => null }, after: { exists: true, data: () => afterData } };
}

const AGENT = 'agent-uid-001';
const LB_PATH = `tenants/test_tenant/leaderboard/${AGENT}`;

function submission({ subId, points }) {
  return {
    status: 'submitted',
    agentId: AGENT,
    agentName: 'Test Agent',
    weekStarting: '2026-06-08',
    __points: points,
    __subId: subId, // not read by the handler — subId comes from context.params
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('onSubmissionWrite leaderboard — BUG-08 transactional award tracking', () => {
  test('two different submissions processed together: both counted', async () => {
    const { lbStore } = makeFirestoreMock();

    await onSubmissionWrite.run(
      makeChange(submission({ subId: 'sub-A', points: 30 })),
      { params: { tenantId: 'test_tenant', subId: 'sub-A' } }
    );
    await onSubmissionWrite.run(
      makeChange(submission({ subId: 'sub-B', points: 20 })),
      { params: { tenantId: 'test_tenant', subId: 'sub-B' } }
    );

    expect(lbStore[LB_PATH].points).toBe(50);
    expect(lbStore[LB_PATH].awardedBySubmission).toEqual({ 'sub-A': 30, 'sub-B': 20 });
  });

  test('submit -> revert to draft -> resubmit with the SAME points: total unchanged (no double-count)', async () => {
    const { lbStore } = makeFirestoreMock();
    const ctx = { params: { tenantId: 'test_tenant', subId: 'sub-001' } };

    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 40 })), ctx);
    expect(lbStore[LB_PATH].points).toBe(40);

    // Revert to draft: after.status !== 'submitted' -> handler returns early, no leaderboard change.
    // (Reproduced directly: the guard at the top of the handler already covers this, so we
    // only need to reproduce the resubmit call that follows it.)

    // Resubmit with the identical points award.
    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 40 })), ctx);

    expect(lbStore[LB_PATH].points).toBe(40); // unchanged — not 80
    expect(lbStore[LB_PATH].awardedBySubmission).toEqual({ 'sub-001': 40 });
  });

  test('resubmit with HIGHER points: only the difference is added', async () => {
    const { lbStore } = makeFirestoreMock();
    const ctx = { params: { tenantId: 'test_tenant', subId: 'sub-001' } };

    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 40 })), ctx);
    expect(lbStore[LB_PATH].points).toBe(40);

    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 65 })), ctx);

    expect(lbStore[LB_PATH].points).toBe(65); // 40 + (65 - 40) = 65, not 40 + 65 = 105
    expect(lbStore[LB_PATH].awardedBySubmission).toEqual({ 'sub-001': 65 });
  });

  test('resubmit with LOWER points: the difference (negative) is applied, never floored at the old award', async () => {
    const { lbStore } = makeFirestoreMock();
    const ctx = { params: { tenantId: 'test_tenant', subId: 'sub-001' } };

    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 60 })), ctx);
    await onSubmissionWrite.run(makeChange(submission({ subId: 'sub-001', points: 20 })), ctx);

    expect(lbStore[LB_PATH].points).toBe(20); // 60 + (20 - 60) = 20
    expect(lbStore[LB_PATH].awardedBySubmission).toEqual({ 'sub-001': 20 });
  });

  test('the leaderboard read-modify-write happens inside runTransaction', async () => {
    const { runTransaction } = makeFirestoreMock();

    await onSubmissionWrite.run(
      makeChange(submission({ subId: 'sub-A', points: 10 })),
      { params: { tenantId: 'test_tenant', subId: 'sub-A' } }
    );

    expect(runTransaction).toHaveBeenCalledTimes(1);
  });
});
