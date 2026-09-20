'use strict';

// jest.mock is hoisted before all require() calls, so these run first.
// We mock firebase-admin so handleWarWrite's Firestore calls can be
// controlled per-test without hitting real infrastructure.
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// Mock the trigger registration chain so onWarWrite.run === handleWarWrite.
// firebase-functions gen-1 CloudFunctions normally expose .run, but mocking
// avoids any initialization side-effects in the test environment.
jest.mock('firebase-functions/v1', () => ({
  firestore: {
    document: jest.fn(() => ({
      onWrite: jest.fn((handler) => ({ run: handler })),
    })),
  },
}));

const admin = require('firebase-admin');
const { onWarWrite } = require('../war/recomputeJfwCount');

// Build a Firestore mock that returns the given joint-call docs.
// The query chain in handleWarWrite is:
//   admin.firestore()
//     .collectionGroup('jointCalls')
//     .where(...).where(...).where(...).where(...)
//     .get()
function makeAdminMock(jointCallDocs = []) {
  const updateFn = jest.fn().mockResolvedValue({});
  const docFn = jest.fn(() => ({ update: updateFn }));

  const getFn = jest.fn().mockResolvedValue({ docs: jointCallDocs });
  // Chain: collectionGroup → where → where → where → where → get
  const q4 = { get: getFn };
  const q3 = { where: jest.fn(() => q4) };
  const q2 = { where: jest.fn(() => q3) };
  const q1 = { where: jest.fn(() => q2) };
  const cg = { where: jest.fn(() => q1) };

  admin.firestore.mockReturnValue({
    collectionGroup: jest.fn(() => cg),
    doc: docFn,
  });

  return { updateFn, docFn, getFn };
}

function makeJointCallDocs(count, appointmentKept = true) {
  return Array.from({ length: count }, () => ({
    data: () => ({ appointmentKept }),
  }));
}

function makeChange(afterData, afterExists = true) {
  return {
    before: { exists: true, data: () => afterData },
    after: { exists: afterExists, data: () => afterData },
  };
}

const BASE_WAR = {
  managerId: 'mgr1',
  weekStart: '2026-05-18',
  tenantId: 'test_tenant',
};

describe('onWarWrite trigger handler', () => {
  const context = { params: { tenantId: 'test_tenant', warId: 'mgr1_2026-05-18' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('write-back: updates jfwCount when recomputed count differs from stored', async () => {
    const { updateFn } = makeAdminMock(makeJointCallDocs(2)); // 2 kept calls
    const change = makeChange({ ...BASE_WAR, jfwCount: 0 });  // stored = 0

    await onWarWrite.run(change, context);

    expect(updateFn).toHaveBeenCalledWith({ jfwCount: 2 });
  });

  test('loop-guard: skips update when recomputed count matches stored', async () => {
    const { updateFn } = makeAdminMock(makeJointCallDocs(2)); // computed = 2
    const change = makeChange({ ...BASE_WAR, jfwCount: 2 }); // stored = 2

    await onWarWrite.run(change, context);

    expect(updateFn).not.toHaveBeenCalled();
  });

  test('delete event: returns early without any Firestore reads or writes', async () => {
    const { getFn, updateFn } = makeAdminMock();
    const change = makeChange({}, false); // after.exists = false

    await onWarWrite.run(change, context);

    expect(getFn).not.toHaveBeenCalled();
    expect(updateFn).not.toHaveBeenCalled();
  });

  test('missing required fields: logs warning and skips all DB operations', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { getFn, updateFn } = makeAdminMock();
    const change = makeChange({}); // no managerId / weekStart / tenantId

    await onWarWrite.run(change, context);

    expect(getFn).not.toHaveBeenCalled();
    expect(updateFn).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
