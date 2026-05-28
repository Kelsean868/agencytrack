import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase stub + hoisted mocks ─────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  getDoc:        vi.fn(),
  runTransaction: vi.fn(),
  doc:           vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('firebase/firestore', () => ({
  getDoc:         hoisted.getDoc,
  runTransaction: hoisted.runTransaction,
  doc:            hoisted.doc,
  serverTimestamp: hoisted.serverTimestamp,
}));

import {
  getPolicyPlans,
  addPlan,
  updatePlan,
  deactivatePlan,
  promotePendingPlan,
  dismissPendingPlan,
} from '../planCatalogService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnap(exists, data = {}) {
  return { exists: () => exists, data: () => data };
}

function makeTxSnap(exists, data = {}) {
  return { exists: () => exists, data: () => data };
}

function makeTxFn(snapExists = true, snapData = {}) {
  const txUpdate = vi.fn();
  const txSet    = vi.fn();
  const txGet    = vi.fn().mockResolvedValue(makeTxSnap(snapExists, snapData));
  hoisted.runTransaction.mockImplementation(async (_db, fn) => {
    await fn({ get: txGet, update: txUpdate, set: txSet });
  });
  return { txGet, txUpdate, txSet };
}

const TENANT = 'tenant1';

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.doc.mockReturnValue('__docref__');
});

// ── getPolicyPlans ────────────────────────────────────────────────────────────

describe('getPolicyPlans', () => {
  it('returns empty when doc does not exist', async () => {
    hoisted.getDoc.mockResolvedValue(makeSnap(false));
    const result = await getPolicyPlans(TENANT);
    expect(result).toEqual({ plans: [], pendingReview: [] });
  });

  it('returns plans and pendingReview from doc', async () => {
    const data = {
      plans:         [{ id: 'a', name: 'Term Life', class: 'term', productLine: 'life', isActive: true }],
      pendingReview: [{ name: 'Mystery Plan', loggedByAgents: 2 }],
    };
    hoisted.getDoc.mockResolvedValue(makeSnap(true, data));
    const result = await getPolicyPlans(TENANT);
    expect(result.plans).toHaveLength(1);
    expect(result.pendingReview).toHaveLength(1);
  });

  it('tolerates missing plans/pendingReview keys (returns empty arrays)', async () => {
    hoisted.getDoc.mockResolvedValue(makeSnap(true, {}));
    const result = await getPolicyPlans(TENANT);
    expect(result).toEqual({ plans: [], pendingReview: [] });
  });
});

// ── addPlan ───────────────────────────────────────────────────────────────────

describe('addPlan', () => {
  it('creates doc with set when doc does not exist', async () => {
    const { txSet, txUpdate } = makeTxFn(false);
    await addPlan(TENANT, { name: 'Whole Life', class: 'whole_life', productLine: 'life' });
    expect(txSet).toHaveBeenCalledTimes(1);
    const [, setData] = txSet.mock.calls[0];
    expect(setData.plans).toHaveLength(1);
    expect(setData.plans[0].name).toBe('Whole Life');
    expect(setData.plans[0].isActive).toBe(true);
    expect(typeof setData.plans[0].id).toBe('string');
    expect(setData.pendingReview).toEqual([]);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('updates existing plans array when doc exists', async () => {
    const existing = [{ id: 'x1', name: 'Existing', class: 'term', productLine: 'life', isActive: true }];
    const { txUpdate } = makeTxFn(true, { plans: existing });
    await addPlan(TENANT, { name: 'New Plan', class: 'term', productLine: 'life' });
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.plans).toHaveLength(2);
    expect(updateData.plans[1].name).toBe('New Plan');
    expect(updateData.plans[1].id).toBeTruthy();
  });

  it('trims whitespace from plan name', async () => {
    const { txSet } = makeTxFn(false);
    await addPlan(TENANT, { name: '  Trimmed  ', class: 'term', productLine: 'life' });
    const [, setData] = txSet.mock.calls[0];
    expect(setData.plans[0].name).toBe('Trimmed');
  });
});

// ── updatePlan ────────────────────────────────────────────────────────────────

describe('updatePlan', () => {
  it('patches only the matching plan entry', async () => {
    const plans = [
      { id: 'p1', name: 'Old Name', class: 'term', productLine: 'life', isActive: true },
      { id: 'p2', name: 'Other Plan', class: 'whole_life', productLine: 'life', isActive: true },
    ];
    const { txUpdate } = makeTxFn(true, { plans });
    await updatePlan(TENANT, 'p1', { name: 'New Name', class: 'whole_life' });
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.plans[0].name).toBe('New Name');
    expect(updateData.plans[0].class).toBe('whole_life');
    expect(updateData.plans[1].name).toBe('Other Plan');
  });

  it('throws when doc does not exist', async () => {
    makeTxFn(false);
    await expect(updatePlan(TENANT, 'p1', { name: 'X' })).rejects.toThrow('not initialized');
  });

  it('throws when planId not found', async () => {
    makeTxFn(true, { plans: [{ id: 'other', name: 'Other', class: 'term', productLine: 'life', isActive: true }] });
    await expect(updatePlan(TENANT, 'missing', { name: 'X' })).rejects.toThrow('not found');
  });
});

// ── deactivatePlan ────────────────────────────────────────────────────────────

describe('deactivatePlan', () => {
  it('sets isActive=false on the matching plan; others unchanged', async () => {
    const plans = [
      { id: 'p1', name: 'Plan A', class: 'term', productLine: 'life', isActive: true },
      { id: 'p2', name: 'Plan B', class: 'whole_life', productLine: 'life', isActive: true },
    ];
    const { txUpdate } = makeTxFn(true, { plans });
    await deactivatePlan(TENANT, 'p1');
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.plans[0].isActive).toBe(false);
    expect(updateData.plans[1].isActive).toBe(true);
  });

  it('throws when doc does not exist', async () => {
    makeTxFn(false);
    await expect(deactivatePlan(TENANT, 'p1')).rejects.toThrow('not initialized');
  });
});

// ── promotePendingPlan ────────────────────────────────────────────────────────

describe('promotePendingPlan', () => {
  it('moves named entry from pendingReview to plans[]', async () => {
    const plans = [];
    const pendingReview = [
      { name: 'Mystery Plan', loggedByAgents: 3, firstLoggedAt: null, contributedPolicyIds: ['a', 'b', 'c'] },
      { name: 'Other Pending', loggedByAgents: 1, firstLoggedAt: null, contributedPolicyIds: ['d'] },
    ];
    const { txUpdate } = makeTxFn(true, { plans, pendingReview });
    await promotePendingPlan(TENANT, 'Mystery Plan', { policyClass: 'term', productLine: 'life' });
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.plans).toHaveLength(1);
    expect(updateData.plans[0].name).toBe('Mystery Plan');
    expect(updateData.plans[0].class).toBe('term');
    expect(updateData.plans[0].isActive).toBe(true);
    expect(updateData.pendingReview).toHaveLength(1);
    expect(updateData.pendingReview[0].name).toBe('Other Pending');
  });

  it('case-insensitive match for pendingName', async () => {
    const pendingReview = [{ name: 'Mystery Plan', loggedByAgents: 1, firstLoggedAt: null, contributedPolicyIds: ['x'] }];
    const { txUpdate } = makeTxFn(true, { plans: [], pendingReview });
    await promotePendingPlan(TENANT, 'mystery plan', { policyClass: 'term', productLine: 'life' });
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.plans[0].name).toBe('Mystery Plan');
    expect(updateData.pendingReview).toHaveLength(0);
  });

  it('throws when pending entry not found', async () => {
    makeTxFn(true, { plans: [], pendingReview: [] });
    await expect(
      promotePendingPlan(TENANT, 'NonExistent', { policyClass: 'term', productLine: 'life' })
    ).rejects.toThrow('not found');
  });
});

// ── dismissPendingPlan ────────────────────────────────────────────────────────

describe('dismissPendingPlan', () => {
  it('removes the named entry from pendingReview', async () => {
    const pendingReview = [
      { name: 'Plan A', loggedByAgents: 1 },
      { name: 'Plan B', loggedByAgents: 2 },
    ];
    const { txUpdate } = makeTxFn(true, { pendingReview });
    await dismissPendingPlan(TENANT, 'Plan A');
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.pendingReview).toHaveLength(1);
    expect(updateData.pendingReview[0].name).toBe('Plan B');
  });

  it('case-insensitive dismiss', async () => {
    const pendingReview = [{ name: 'Eagle Plan', loggedByAgents: 1 }];
    const { txUpdate } = makeTxFn(true, { pendingReview });
    await dismissPendingPlan(TENANT, 'EAGLE PLAN');
    const [, updateData] = txUpdate.mock.calls[0];
    expect(updateData.pendingReview).toHaveLength(0);
  });

  it('throws when doc does not exist', async () => {
    makeTxFn(false);
    await expect(dismissPendingPlan(TENANT, 'X')).rejects.toThrow('not initialized');
  });
});
