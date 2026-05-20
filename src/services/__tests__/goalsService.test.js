import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));
const { mockGetDoc, mockSetDoc } = hoisted;

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

import { getCompanyMinimums, setCompanyMinimums } from '../goalsService';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';

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
