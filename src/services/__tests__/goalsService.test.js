import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));
const { mockGetDoc, mockSetDoc } = hoisted;

vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

import { getCompanyMinimums, setCompanyMinimums, getGoalHierarchy } from '../goalsService';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { DEFAULT_TENURE_API_FLOORS } from '../../utils/tenureFloors';

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
});

describe('getCompanyMinimums — weeklyActivityFloors defaults', () => {
  it('returns Appendix A defaults when no companyMinimums doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors).toEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS);
    expect(result.annualAPI).toBe(200000);
    expect(result.annualApps).toBe(42);
    expect(result.persistency).toBe(90);
  });

  it('preserves a fully-seeded weeklyActivityFloors block from Firestore', async () => {
    const seeded = {
      annualAPI: 250000,
      annualApps: 50,
      persistency: 92,
      updatedBy: 'kyron',
      updatedAt: '__TS__',
      weeklyActivityFloors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, callsMade: 80 },
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => seeded });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors.callsMade).toBe(80); // override preserved
    expect(result.weeklyActivityFloors.api).toBe(4800);     // default still in place
    expect(result.annualAPI).toBe(250000);
    expect(result.updatedBy).toBe('kyron');
  });

  it('shallow-merges: stored partial block keeps defaults for absent keys', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        annualAPI: 200000,
        weeklyActivityFloors: { callsMade: 100 }, // partial override
      }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors.callsMade).toBe(100);
    expect(result.weeklyActivityFloors.contactsMade).toBe(40);
    expect(result.weeklyActivityFloors.api).toBe(4800);
  });

  it('a stored companyMinimums doc without weeklyActivityFloors still gets defaults', async () => {
    // Pre-existing tenants seeded only with annualAPI/Apps/persistency (B5 era).
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ annualAPI: 200000, annualApps: 42, persistency: 90 }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors).toEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS);
  });
});

describe('getCompanyMinimums — tenureApiFloors defaults', () => {
  it('returns the brief seed table when no companyMinimums doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors).toEqual(DEFAULT_TENURE_API_FLOORS);
  });

  it('shallow-merges: stored partial tenureApiFloors keeps defaults for absent bands', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        annualAPI: 200000,
        tenureApiFloors: { band0_lt12: 175000 },
      }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors.band0_lt12).toBe(175000);
    expect(result.tenureApiFloors.band_gt60).toBe(500000);
  });

  it('a stored companyMinimums doc without tenureApiFloors still gets defaults', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ annualAPI: 200000, annualApps: 42, persistency: 90 }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors).toEqual(DEFAULT_TENURE_API_FLOORS);
  });
});

describe('getGoalHierarchy — companyFloor.api resolves per-agent from tenure', () => {
  // The hierarchy reads: getCompanyMinimums (companyMinimums doc),
  // getBranchGoals (branch year doc), getUnitGoals (unit year doc),
  // getGoals (agent goals doc), and the agent user doc. Order of getDoc()
  // calls is non-deterministic (Promise.all), so we drive by path.
  const wireDocs = (docsByPath) => {
    mockGetDoc.mockImplementation((ref) => {
      const path = ref?.__ref ?? '';
      const data = docsByPath[path];
      return Promise.resolve({
        exists: () => data !== undefined,
        data: () => data,
      });
    });
  };

  it('agent < 12 months → companyFloor.api = 150000', async () => {
    // Anchor against a contractStartDate close enough to "today" that
    // months-of-service is < 12 regardless of when this test runs.
    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { contractStartDate: startDate },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(150000);
    expect(result.companyFloor.apps).toBe(42);
  });

  it('agent > 60 months → companyFloor.api = 500000', async () => {
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { contractStartDate: '2015-01-01' },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(500000);
  });

  it('agent with missing contractStartDate → flat 200k fallback', async () => {
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { /* no contractStartDate */ },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(200000);
  });
});

describe('setCompanyMinimums — preserves weeklyActivityFloors via merge', () => {
  it('writes only the editable B5 fields; merge: true preserves the floors block', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setCompanyMinimums('tenant1', { annualAPI: 250000 }, 'kyron-uid');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant1/config/companyMinimums');
    expect(payload).toEqual({
      annualAPI: 250000,
      updatedBy: 'kyron-uid',
      updatedAt: '__SERVER_TIMESTAMP__',
    });
    expect(opts).toEqual({ merge: true });
    // Critically: the payload does NOT include weeklyActivityFloors, so a
    // pre-seeded floors block on the doc is preserved under merge: true.
    expect(payload).not.toHaveProperty('weeklyActivityFloors');
  });

  it('rejects non-positive annualAPI without writing', async () => {
    await expect(setCompanyMinimums('tenant1', { annualAPI: 0 }, 'kyron-uid'))
      .rejects.toThrow(/positive/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
