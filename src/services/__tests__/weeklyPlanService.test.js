import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture Firestore writes without a live backend. The global firebase stub
// handles src/firebase init; we mock firebase/firestore to spy the I/O.
const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db, path) => ({ path }),
  setDoc: mocks.setDoc,
  getDoc: mocks.getDoc,
  deleteDoc: mocks.deleteDoc,
  serverTimestamp: () => '__SERVER_TS__',
  Timestamp: { fromDate: (d) => ({ __ts: d.toISOString() }) },
}));

import {
  PLAN_METRIC_KEYS,
} from '../../utils/weeklyPlanAssembly';
import {
  weeklyPlanDocId,
  getWeeklyPlan,
  commitWeeklyPlan,
  deleteWeeklyPlan,
} from '../weeklyPlanService';

const TENANT = 'tenant-1';
const AGENT = 'agent-1';
const SUNDAY = '2026-06-07';     // verified Sunday
const NOT_SUNDAY = '2026-06-08'; // Monday

const FLOORS = {
  callsMade: 100, contactsMade: 40, factFindsCompleted: 8,
  closingInterviewsKept: 5, applicationsSubmitted: 3,
};

function validPlan() {
  return {
    targets: { callsMade: 150, contactsMade: 40, factFindsCompleted: 8, closingInterviewsKept: 12, applicationsSubmitted: 6 },
    provenance: { callsMade: 'derived', contactsMade: 'floor', factFindsCompleted: 'floor', closingInterviewsKept: 'derived', applicationsSubmitted: 'agent' },
    anchorAPIAtCommit: 200000,
  };
}

beforeEach(() => {
  mocks.setDoc.mockClear();
  mocks.getDoc.mockClear();
  mocks.deleteDoc.mockClear();
});

describe('weeklyPlanService — weeklyPlanDocId', () => {
  it('is the deterministic {agentId}_{weekStart} composite', () => {
    expect(weeklyPlanDocId(AGENT, SUNDAY)).toBe('agent-1_2026-06-07');
  });
});

describe('weeklyPlanService — commitWeeklyPlan', () => {
  it('writes exactly the 8 locked keys with a TT-safe weekStart Timestamp + serverTimestamps', async () => {
    await commitWeeklyPlan(TENANT, AGENT, SUNDAY, validPlan(), FLOORS);
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = mocks.setDoc.mock.calls[0];
    expect(ref.path).toBe(`tenants/${TENANT}/weeklyPlans/agent-1_2026-06-07`);
    expect(Object.keys(data).sort()).toEqual(
      ['agentId', 'anchorAPIAtCommit', 'committedAt', 'provenance', 'targets', 'tenantId', 'updatedAt', 'weekStart'].sort(),
    );
    expect(data.agentId).toBe(AGENT);
    expect(data.tenantId).toBe(TENANT);
    // TT-safe: parseDateOnlyTT → 04:00Z on the calendar day.
    expect(data.weekStart).toEqual({ __ts: '2026-06-07T04:00:00.000Z' });
    expect(data.committedAt).toBe('__SERVER_TS__');
    expect(data.updatedAt).toBe('__SERVER_TS__');
  });

  it('Number()-enforces integer targets (no strings, no floats stored)', async () => {
    const plan = validPlan();
    plan.targets.callsMade = '150';   // string
    plan.targets.closingInterviewsKept = 12.7; // float
    await commitWeeklyPlan(TENANT, AGENT, SUNDAY, plan, FLOORS);
    const [, data] = mocks.setDoc.mock.calls[0];
    PLAN_METRIC_KEYS.forEach((k) => expect(Number.isInteger(data.targets[k])).toBe(true));
    expect(data.targets.callsMade).toBe(150);
    expect(data.targets.closingInterviewsKept).toBe(13);
  });

  it('coerces a non-numeric anchor to null', async () => {
    const plan = { ...validPlan(), anchorAPIAtCommit: undefined };
    await commitWeeklyPlan(TENANT, AGENT, SUNDAY, plan, FLOORS);
    const [, data] = mocks.setDoc.mock.calls[0];
    expect(data.anchorAPIAtCommit).toBeNull();
  });

  it('throws when weekStart is not a Sunday (never writes)', async () => {
    await expect(commitWeeklyPlan(TENANT, AGENT, NOT_SUNDAY, validPlan(), FLOORS)).rejects.toThrow(/Sunday/);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('re-validates the floor: a below-floor target rejects (never writes)', async () => {
    const plan = validPlan();
    plan.targets.callsMade = 50; // floor is 100
    await expect(commitWeeklyPlan(TENANT, AGENT, SUNDAY, plan, FLOORS)).rejects.toThrow(/below the resolved floor/);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('throws on an invalid provenance value (never writes)', async () => {
    const plan = validPlan();
    plan.provenance.callsMade = 'personal';
    await expect(commitWeeklyPlan(TENANT, AGENT, SUNDAY, plan, FLOORS)).rejects.toThrow(/invalid provenance/);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('commits with no floors map (floor re-validation is skipped)', async () => {
    await commitWeeklyPlan(TENANT, AGENT, SUNDAY, validPlan(), null);
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });
});

describe('weeklyPlanService — getWeeklyPlan', () => {
  it('returns null when the doc does not exist', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getWeeklyPlan(TENANT, AGENT, SUNDAY)).toBeNull();
  });

  it('returns the doc with its id when it exists', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, id: 'agent-1_2026-06-07', data: () => ({ agentId: AGENT }) });
    expect(await getWeeklyPlan(TENANT, AGENT, SUNDAY)).toEqual({ id: 'agent-1_2026-06-07', agentId: AGENT });
  });
});

describe('weeklyPlanService — deleteWeeklyPlan', () => {
  it('deletes the deterministic doc', async () => {
    await deleteWeeklyPlan(TENANT, AGENT, SUNDAY);
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = mocks.deleteDoc.mock.calls[0];
    expect(ref.path).toBe(`tenants/${TENANT}/weeklyPlans/agent-1_2026-06-07`);
  });
});
