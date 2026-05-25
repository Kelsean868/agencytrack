import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mockSetDoc     = vi.fn().mockResolvedValue(undefined);
  const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));

  const makeDocSnap = (exists, data) => ({
    exists: () => exists,
    id: exists ? '2026' : undefined,
    data: () => (exists ? data : undefined),
  });

  return {
    mockDoc:              vi.fn((...args) => ({ _ref: args })),
    mockGetDoc:           vi.fn(),
    mockSetDoc,
    mockServerTimestamp,
    makeDocSnap,
  };
});

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import { createMoneyNeeds, getMoneyNeeds } from '../moneyNeedsService';

const TENANT_ID = 'tenant-1';
const UID       = 'agent-1';
const YEAR      = 2026;

const EXISTING_DOC_DATA = {
  year: YEAR,
  visibility: 'private',
  expenseGroups: {
    fixedExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));
  hoisted.mockSetDoc.mockResolvedValue(undefined);
});

// ── createMoneyNeeds ──────────────────────────────────────────────────────────

describe('createMoneyNeeds', () => {
  it('writes blank doc with visibility:private when no existing doc', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    const result = await createMoneyNeeds(TENANT_ID, UID, YEAR);

    expect(hoisted.mockSetDoc).toHaveBeenCalledOnce();
    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.visibility).toBe('private');
    expect(payload.shareWithSm).toBe(false);
    expect(result.visibility).toBe('private');
    expect(result.id).toBe('2026');
  });

  it('scaffolds all 5 expense groups with empty lineItems', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    await createMoneyNeeds(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    const groups = payload.expenseGroups;
    expect(Object.keys(groups)).toEqual([
      'fixedExpenses', 'livingExpenses', 'businessExpenses',
      'savingsAccumulation', 'miscellaneous',
    ]);
    for (const g of Object.values(groups)) {
      expect(g.lineItems).toEqual([]);
      expect(g.groupAnnualTotal).toBe(0);
    }
  });

  it('scaffolds all 3 sub-calculators', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    await createMoneyNeeds(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    const sc = payload.subCalculators;
    expect(Object.keys(sc)).toEqual(['insuranceIndustry', 'carExpenses', 'loansDebt']);
    expect(sc.insuranceIndustry.annualTotal).toBe(0);
    expect(sc.carExpenses.personalSharePct).toBe(33);
    expect(sc.loansDebt.annualTotal).toBe(0);
  });

  it('stores tenantId and uid on the doc', async () => {
    await createMoneyNeeds(TENANT_ID, UID, YEAR);
    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.tenantId).toBe(TENANT_ID);
    expect(payload.uid).toBe(UID);
    expect(payload.createdBy).toBe(UID);
  });

  it('idempotent: returns existing doc without calling setDoc', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await createMoneyNeeds(TENANT_ID, UID, YEAR);

    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
    expect(result.id).toBe('2026');
    expect(result.visibility).toBe('private');
  });

  it('throws for an out-of-range year (pre-2020)', async () => {
    await expect(createMoneyNeeds(TENANT_ID, UID, 2000)).rejects.toThrow();
  });

  it('throws for a non-numeric year', async () => {
    await expect(createMoneyNeeds(TENANT_ID, UID, 'bad')).rejects.toThrow();
  });

  it('parses year from string', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));
    const result = await createMoneyNeeds(TENANT_ID, UID, '2026');
    expect(result.id).toBe('2026');
    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.year).toBe(2026);
  });
});

// ── getMoneyNeeds ─────────────────────────────────────────────────────────────

describe('getMoneyNeeds', () => {
  it('returns shaped doc when it exists', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await getMoneyNeeds(TENANT_ID, UID, YEAR);

    expect(result).not.toBeNull();
    expect(result.id).toBe('2026');
    expect(result.visibility).toBe('private');
  });

  it('returns null when the doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    const result = await getMoneyNeeds(TENANT_ID, UID, YEAR);

    expect(result).toBeNull();
  });

  it('returns null for a non-numeric year without throwing', async () => {
    const result = await getMoneyNeeds(TENANT_ID, UID, 'bad');
    expect(result).toBeNull();
    expect(hoisted.mockGetDoc).not.toHaveBeenCalled();
  });
});
