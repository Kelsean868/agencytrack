import { vi, describe, it, expect, beforeEach } from 'vitest';
import { commitPlan, BelowApiFloorError, BelowAppsFloorError, AvgPolicyMissingError } from '../commitPlanService';

// Hoisted so they can be referenced inside vi.mock() factory callbacks.
const {
  mockDoc,
  mockGetDoc,
  mockRunTransaction,
  mockServerTimestamp,
  mockGetCompanyMinimums,
  mockResolveAnnualAPIFloor,
} = vi.hoisted(() => ({
  mockDoc: vi.fn((_db, ...segments) => segments.join('/')),
  mockGetDoc: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockServerTimestamp: vi.fn(),
  mockGetCompanyMinimums: vi.fn(),
  mockResolveAnnualAPIFloor: vi.fn(),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../goalsService', () => ({
  getCompanyMinimums: (...args) => mockGetCompanyMinimums(...args),
}));

vi.mock('../../utils/tenureFloors', () => ({
  FLAT_ANNUAL_API_FALLBACK: 200000,
  resolveAnnualAPIFloor: (...args) => mockResolveAnnualAPIFloor(...args),
}));

const SENTINEL_TS = { _type: 'serverTimestamp' };

const mockTx = { get: vi.fn(), set: vi.fn(), update: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();

  mockServerTimestamp.mockReturnValue(SENTINEL_TS);

  // annualApps: 15 — low enough that happy-path tests (annualAPI: 250k, avgPolicy: 12k → ~21 apps) clear the floor.
  // Explicit apps-floor tests override this value.
  mockGetCompanyMinimums.mockResolvedValue({
    annualApps: 15,
    tenureApiFloors: {
      band0_lt12: 150000,
      band12_to_24: 200000,
      band25_to_36: 250000,
      band37_to_48: 300000,
      band49_to_60: 400000,
      band_gt60: 500000,
    },
  });

  // Differentiate users doc vs goals doc by path.
  mockGetDoc.mockImplementation((ref) => {
    const path = String(ref);
    if (path.includes('/goals/')) {
      return Promise.resolve({ exists: () => true, data: () => ({ playgroundAvgPolicyAPI: 12000 }) });
    }
    return Promise.resolve({ exists: () => true, data: () => ({ contractStartDate: null }) });
  });

  // Default floor: flat 200 000 fallback.
  mockResolveAnnualAPIFloor.mockReturnValue(200000);

  // Default tx.get: yearPlan exists, monthlyPlan exists.
  mockTx.get.mockImplementation((ref) => {
    if (String(ref).includes('monthlyPlan')) return Promise.resolve({ exists: () => true });
    return Promise.resolve({ exists: () => true });
  });

  mockRunTransaction.mockImplementation((_db, fn) => fn(mockTx));
});

describe('commitPlan — happy path writes', () => {
  it('writes personalAnnualAPI, personalAnnualApps, and gamePlanCommitted with merge:true', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });

    expect(mockTx.set).toHaveBeenCalledWith(
      expect.stringContaining('goals/uid'),
      { personalAnnualAPI: 250000, personalAnnualApps: 50, gamePlanCommitted: true },
      { merge: true },
    );
  });

  it('writes gamePlanCommitted: true to the goals doc on commit', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });
    const [, payload] = mockTx.set.mock.calls[0];
    expect(payload.gamePlanCommitted).toBe(true);
  });

  it('flips yearPlan status to committed with committedAt', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });

    expect(mockTx.update).toHaveBeenCalledWith(
      expect.stringContaining('yearPlan/2026'),
      { status: 'committed', committedAt: SENTINEL_TS },
    );
  });

  it('flips monthlyPlan status to committed when it exists', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });

    expect(mockTx.update).toHaveBeenCalledWith(
      expect.stringContaining('monthlyPlan/2026'),
      { status: 'committed', committedAt: SENTINEL_TS },
    );
  });

  it('skips monthlyPlan update when monthlyPlan does not exist', async () => {
    mockTx.get.mockImplementation((ref) => {
      if (String(ref).includes('monthlyPlan')) return Promise.resolve({ exists: () => false });
      return Promise.resolve({ exists: () => true });
    });

    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });

    const monthlyUpdates = mockTx.update.mock.calls.filter(
      ([ref]) => String(ref).includes('monthlyPlan'),
    );
    expect(monthlyUpdates).toHaveLength(0);
  });

  it('passes at exactly the floor value (boundary — not below)', async () => {
    mockResolveAnnualAPIFloor.mockReturnValue(250000);
    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).resolves.toBeUndefined();
  });

  it('falls back to flat 200K floor when contractStartDate is absent on the doc', async () => {
    mockGetDoc.mockImplementation((ref) => {
      const path = String(ref);
      if (path.includes('/goals/')) {
        return Promise.resolve({ exists: () => true, data: () => ({ playgroundAvgPolicyAPI: 12000 }) });
      }
      return Promise.resolve({ exists: () => true, data: () => ({}) });
    });

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).resolves.toBeUndefined();

    expect(mockResolveAnnualAPIFloor).toHaveBeenCalledWith(
      expect.objectContaining({ contractStartDate: null }),
    );
  });
});

describe('commitPlan — BelowApiFloorError', () => {
  it('throws BelowApiFloorError when annualAPI is below the flat fallback floor', async () => {
    // mockResolveAnnualAPIFloor returns 200000 (default)
    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 }),
    ).rejects.toBeInstanceOf(BelowApiFloorError);
  });

  it('carries floor and planTotal on the error', async () => {
    const err = await commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BelowApiFloorError);
    expect(err.floor).toBe(200000);
    expect(err.planTotal).toBe(150000);
  });

  it('throws BelowApiFloorError for a tenure-band floor (band_gt60 = 500k)', async () => {
    mockResolveAnnualAPIFloor.mockReturnValue(500000);

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 400000, annualApps: 80 }),
    ).rejects.toBeInstanceOf(BelowApiFloorError);
  });

  it('does not call runTransaction when the floor check fails', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 }).catch(() => {});
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

describe('commitPlan — apps floor', () => {
  it('throws AvgPolicyMissingError when goals doc has no playgroundAvgPolicyAPI', async () => {
    mockGetDoc.mockImplementation((ref) => {
      const path = String(ref);
      if (path.includes('/goals/')) {
        return Promise.resolve({ exists: () => true, data: () => ({}) });
      }
      return Promise.resolve({ exists: () => true, data: () => ({ contractStartDate: null }) });
    });

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toBeInstanceOf(AvgPolicyMissingError);
  });

  it('throws AvgPolicyMissingError when goals doc does not exist', async () => {
    mockGetDoc.mockImplementation((ref) => {
      const path = String(ref);
      if (path.includes('/goals/')) {
        return Promise.resolve({ exists: () => false, data: () => ({}) });
      }
      return Promise.resolve({ exists: () => true, data: () => ({ contractStartDate: null }) });
    });

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toBeInstanceOf(AvgPolicyMissingError);
  });

  it('throws BelowAppsFloorError when derived apps are below the company floor', async () => {
    mockGetCompanyMinimums.mockResolvedValue({
      annualApps: 42,
      tenureApiFloors: {
        band0_lt12: 150000, band12_to_24: 200000, band25_to_36: 250000,
        band37_to_48: 300000, band49_to_60: 400000, band_gt60: 500000,
      },
    });
    // annualAPI = 250000, avgPolicyAPI = 12000 → appsCount = 20.83 < 42
    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toBeInstanceOf(BelowAppsFloorError);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('carries floor, actual, and avgPolicyAPI on BelowAppsFloorError', async () => {
    mockGetCompanyMinimums.mockResolvedValue({
      annualApps: 42,
      tenureApiFloors: {
        band0_lt12: 150000, band12_to_24: 200000, band25_to_36: 250000,
        band37_to_48: 300000, band49_to_60: 400000, band_gt60: 500000,
      },
    });
    const err = await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }).catch((e) => e);
    expect(err).toBeInstanceOf(BelowAppsFloorError);
    expect(err.floor).toBe(42);
    expect(err.avgPolicyAPI).toBe(12000);
  });

  it('passes when API floor and apps floor are both cleared', async () => {
    mockGetCompanyMinimums.mockResolvedValue({
      annualApps: 42,
      tenureApiFloors: {
        band0_lt12: 150000, band12_to_24: 200000, band25_to_36: 250000,
        band37_to_48: 300000, band49_to_60: 400000, band_gt60: 500000,
      },
    });
    // annualAPI = 504000, avgPolicyAPI = 12000 → appsCount = 42.0 (boundary, passes)
    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 504000, annualApps: 42 }),
    ).resolves.toBeUndefined();
  });
});

describe('commitPlan — transaction / guard errors', () => {
  it('propagates transaction errors (all-or-nothing)', async () => {
    mockRunTransaction.mockRejectedValue(new Error('Firestore unavailable'));

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toThrow('Firestore unavailable');
  });

  it('throws when yearPlan doc does not exist', async () => {
    mockTx.get.mockResolvedValue({ exists: () => false });

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toThrow('Year plan not found');
  });

  it('propagates agent doc read error — no writes, no floor bypass', async () => {
    mockGetDoc.mockRejectedValue(new Error('Network error'));

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 }),
    ).rejects.toThrow('Network error');

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
