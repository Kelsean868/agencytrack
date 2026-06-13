import { vi, describe, it, expect, beforeEach } from 'vitest';
import { commitPlan, BelowFloorError } from '../commitPlanService';

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

  mockGetCompanyMinimums.mockResolvedValue({
    tenureApiFloors: {
      band0_lt12: 150000,
      band12_to_24: 200000,
      band25_to_36: 250000,
      band37_to_48: 300000,
      band49_to_60: 400000,
      band_gt60: 500000,
    },
  });

  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ contractStartDate: null }),
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
  it('writes personalAnnualAPI and personalAnnualApps with merge:true', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 250000, annualApps: 50 });

    expect(mockTx.set).toHaveBeenCalledWith(
      expect.stringContaining('goals/uid'),
      { personalAnnualAPI: 250000, personalAnnualApps: 50 },
      { merge: true },
    );
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
});

describe('commitPlan — BelowFloorError', () => {
  it('throws BelowFloorError when annualAPI is below the flat fallback floor', async () => {
    // mockResolveAnnualAPIFloor returns 200000 (default)
    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 }),
    ).rejects.toBeInstanceOf(BelowFloorError);
  });

  it('carries floor and planTotal on the error', async () => {
    const err = await commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BelowFloorError);
    expect(err.floor).toBe(200000);
    expect(err.planTotal).toBe(150000);
  });

  it('throws BelowFloorError for a tenure-band floor (band_gt60 = 500k)', async () => {
    mockResolveAnnualAPIFloor.mockReturnValue(500000);

    await expect(
      commitPlan('tid', 'uid', 2026, { annualAPI: 400000, annualApps: 80 }),
    ).rejects.toBeInstanceOf(BelowFloorError);
  });

  it('does not call runTransaction when the floor check fails', async () => {
    await commitPlan('tid', 'uid', 2026, { annualAPI: 150000, annualApps: 30 }).catch(() => {});
    expect(mockRunTransaction).not.toHaveBeenCalled();
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
});
