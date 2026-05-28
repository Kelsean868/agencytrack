'use strict';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore:     jest.fn(),
}));

jest.mock('firebase-functions', () => ({
  firestore: {
    document: jest.fn(() => ({
      onCreate: jest.fn((handler) => ({ run: handler })),
    })),
  },
}));

const admin = require('firebase-admin');
const { aggregatePendingPlan } = require('../policyPlans/aggregatePendingPlan');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnap(data) {
  return { data: () => data };
}

function makeContext(tenantId = 'tenant1', policyId = 'policy1') {
  return { params: { tenantId, policyId } };
}

function buildAdminMock({ cfgExists = true, cfgData = {}, txFn } = {}) {
  const txUpdate = jest.fn();
  const txGet    = jest.fn().mockResolvedValue({
    exists: cfgExists,
    data:   () => cfgData,
  });

  const runTransaction = jest.fn().mockImplementation(async (fn) => {
    if (txFn) return txFn(fn);
    await fn({ get: txGet, update: txUpdate });
  });

  const cfgSnap = { exists: cfgExists, data: () => cfgData };
  const cfgDocRef = { get: jest.fn().mockResolvedValue(cfgSnap) };
  const docFn = jest.fn().mockReturnValue(cfgDocRef);

  admin.firestore.mockReturnValue({ doc: docFn, runTransaction });

  return { txUpdate, txGet, runTransaction, cfgDocRef };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('aggregatePendingPlan', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    admin.firestore.FieldValue = { serverTimestamp: jest.fn().mockReturnValue('SERVER_TIMESTAMP') };
    admin.firestore.Timestamp  = { now: jest.fn().mockReturnValue({ toMillis: jest.fn().mockReturnValue(1234567890) }) };
  });

  it('returns null when planId is set (catalog plan used)', async () => {
    const { runTransaction } = buildAdminMock();
    const result = await aggregatePendingPlan.run(
      makeSnap({ planId: 'plan-123', planName: 'Whole Life Plus' }),
      makeContext()
    );
    expect(result).toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('returns null when planName is absent', async () => {
    const { runTransaction } = buildAdminMock();
    const result = await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: '' }),
      makeContext()
    );
    expect(result).toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('returns null when planName is only whitespace', async () => {
    const { runTransaction } = buildAdminMock();
    const result = await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: '   ' }),
      makeContext()
    );
    expect(result).toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('returns null when config doc does not exist', async () => {
    const { runTransaction } = buildAdminMock({ cfgExists: false });
    const result = await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'Custom Plan' }),
      makeContext()
    );
    expect(result).toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('returns null when active catalog plan matches (case-insensitive)', async () => {
    const { runTransaction } = buildAdminMock({
      cfgData: {
        plans: [{ id: 'p1', name: 'Whole Life Plus', isActive: true }],
        pendingReview: [],
      },
    });
    const result = await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'whole life plus' }),
      makeContext()
    );
    expect(result).toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('appends new pendingReview entry when name is unknown', async () => {
    let capturedUpdate;
    const txGet    = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [] }),
    });
    const txUpdate = jest.fn().mockImplementation((_ref, data) => { capturedUpdate = data; });
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });

    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'Eagle Rider Plan' }),
      makeContext('t1', 'p42')
    );

    expect(runTransaction).toHaveBeenCalled();
    expect(capturedUpdate.pendingReview).toHaveLength(1);
    expect(capturedUpdate.pendingReview[0].name).toBe('Eagle Rider Plan');
    expect(capturedUpdate.pendingReview[0].loggedByAgents).toBe(1);
    expect(capturedUpdate.pendingReview[0].contributedPolicyIds).toEqual(['p42']);
  });

  it('firstLoggedAt is a Timestamp value, not a server-sentinel', async () => {
    let capturedUpdate;
    const txGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [] }),
    });
    const txUpdate = jest.fn().mockImplementation((_ref, data) => { capturedUpdate = data; });
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });
    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'New Pending Plan' }),
      makeContext('t1', 'p99')
    );

    const entry = capturedUpdate.pendingReview[0];
    // Real Timestamps expose .toMillis(); FieldValue sentinels do not.
    expect(typeof entry.firstLoggedAt.toMillis).toBe('function');
    expect(admin.firestore.FieldValue.serverTimestamp).not.toHaveBeenCalled();
  });

  it('increments loggedByAgents for existing pendingReview entry', async () => {
    let capturedUpdate;
    const existing = {
      name: 'Eagle Rider Plan',
      loggedByAgents: 1,
      firstLoggedAt: null,
      contributedPolicyIds: ['p1'],
    };
    const txGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    });
    const txUpdate = jest.fn().mockImplementation((_ref, data) => { capturedUpdate = data; });
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });

    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'eagle rider plan' }),
      makeContext('t1', 'p2')
    );

    const updated = capturedUpdate.pendingReview[0];
    expect(updated.loggedByAgents).toBe(2);
    expect(updated.contributedPolicyIds).toContain('p1');
    expect(updated.contributedPolicyIds).toContain('p2');
  });

  it('does NOT double-count when same policyId seen again', async () => {
    const existing = {
      name: 'Eagle Rider Plan',
      loggedByAgents: 1,
      firstLoggedAt: null,
      contributedPolicyIds: ['p42'],
    };
    const txGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    });
    const txUpdate = jest.fn();
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });

    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'Eagle Rider Plan' }),
      makeContext('t1', 'p42')
    );

    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('case-insensitive match on existing pendingReview increments correctly', async () => {
    let capturedUpdate;
    const existing = {
      name: 'Smart Life Plan',
      loggedByAgents: 2,
      firstLoggedAt: null,
      contributedPolicyIds: ['p1', 'p2'],
    };
    const txGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    });
    const txUpdate = jest.fn().mockImplementation((_ref, data) => { capturedUpdate = data; });
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });

    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [existing] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'SMART LIFE PLAN' }),
      makeContext('t1', 'p3')
    );

    expect(capturedUpdate.pendingReview[0].loggedByAgents).toBe(3);
    expect(capturedUpdate.pendingReview[0].name).toBe('Smart Life Plan');
  });

  it('re-checks active plans inside transaction before writing', async () => {
    const txGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        plans: [{ id: 'p1', name: 'New Plan', isActive: true }],
        pendingReview: [],
      }),
    });
    const txUpdate = jest.fn();
    const runTransaction = jest.fn().mockImplementation(async (fn) => {
      await fn({ get: txGet, update: txUpdate });
    });

    const cfgDocRef = { get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ plans: [], pendingReview: [] }),
    })};
    admin.firestore.mockReturnValue({ doc: jest.fn().mockReturnValue(cfgDocRef), runTransaction });

    await aggregatePendingPlan.run(
      makeSnap({ planId: null, planName: 'New Plan' }),
      makeContext('t1', 'p5')
    );

    expect(txUpdate).not.toHaveBeenCalled();
  });
});
