import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mockSetDoc       = vi.fn().mockResolvedValue(undefined);
  const mockUpdateDoc    = vi.fn().mockResolvedValue(undefined);
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
    mockUpdateDoc,
    mockServerTimestamp,
    makeDocSnap,
  };
});

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  createMoneyNeeds, getMoneyNeeds,
  annualizeAmount, computeGroupTotal, computeWorksheetRollup,
  updateExpenseGroup, mergeSubCalcRef, updateSubCalculator,
  updateCommissionTargets,
  FREQUENCY_MULTIPLIERS, PAYE_BRACKETS_VERSION,
} from '../moneyNeedsService';

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

// ── annualizeAmount ───────────────────────────────────────────────────────────

describe('annualizeAmount', () => {
  it('A → ×1 (annual, no change)', () => {
    expect(annualizeAmount(12000, 'A')).toBe(12000);
  });

  it('S → ×2 (semi-annual)', () => {
    expect(annualizeAmount(5000, 'S')).toBe(10000);
  });

  it('Q → ×4 (quarterly)', () => {
    expect(annualizeAmount(2500, 'Q')).toBe(10000);
  });

  it('M → ×12 (monthly)', () => {
    expect(annualizeAmount(1000, 'M')).toBe(12000);
  });

  it('parses float string amount', () => {
    expect(annualizeAmount('1500', 'M')).toBe(18000);
  });

  it('unknown frequency falls back to ×12', () => {
    expect(annualizeAmount(1000, 'W')).toBe(12000);
  });

  it('non-numeric amount returns 0', () => {
    expect(annualizeAmount('abc', 'M')).toBe(0);
  });

  it('FREQUENCY_MULTIPLIERS exports correct keys', () => {
    expect(FREQUENCY_MULTIPLIERS).toEqual({ A: 1, S: 2, Q: 4, M: 12 });
  });
});

// ── computeGroupTotal ─────────────────────────────────────────────────────────

describe('computeGroupTotal', () => {
  it('sums annualizedAmounts from lineItems', () => {
    const group = {
      lineItems: [
        { annualizedAmount: 12000 },
        { annualizedAmount: 6000 },
      ],
      subCalculatorRefs: [],
    };
    expect(computeGroupTotal(group)).toBe(18000);
  });

  it('adds subCalculatorRefs annualTotal to lineItems total', () => {
    const group = {
      lineItems: [{ annualizedAmount: 5000 }],
      subCalculatorRefs: [{ annualTotal: 3000 }],
    };
    expect(computeGroupTotal(group)).toBe(8000);
  });

  it('returns 0 for empty lineItems and subCalculatorRefs', () => {
    expect(computeGroupTotal({ lineItems: [], subCalculatorRefs: [] })).toBe(0);
  });

  it('handles missing lineItems or subCalculatorRefs gracefully', () => {
    expect(computeGroupTotal({})).toBe(0);
    expect(computeGroupTotal({ lineItems: null })).toBe(0);
  });
});

// ── computeWorksheetRollup ────────────────────────────────────────────────────

describe('computeWorksheetRollup', () => {
  it('sums groupAnnualTotal across all groups for totalAnnualAfterTax', () => {
    const groups = {
      fixedExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 60000 },
      livingExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 40000 },
      businessExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
      savingsAccumulation: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
      miscellaneous: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    };
    const result = computeWorksheetRollup(groups);
    expect(result.totalAnnualAfterTax).toBe(100000);
  });

  it('returns totalAnnualPreTax >= totalAnnualAfterTax (tax adds to gross)', () => {
    const groups = { a: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 150000 } };
    const result = computeWorksheetRollup(groups);
    expect(result.totalAnnualPreTax).toBeGreaterThanOrEqual(result.totalAnnualAfterTax);
  });

  it('computedPAYE = totalAnnualPreTax - totalAnnualAfterTax (approximately)', () => {
    const groups = { a: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 200000 } };
    const result = computeWorksheetRollup(groups);
    expect(result.computedPAYE).toBeCloseTo(result.totalAnnualPreTax - result.totalAnnualAfterTax, 0);
  });

  it('returns zero rollup for empty/zero groups', () => {
    const result = computeWorksheetRollup({ a: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 } });
    expect(result.totalAnnualAfterTax).toBe(0);
    expect(result.totalAnnualPreTax).toBe(0);
    expect(result.computedPAYE).toBe(0);
  });
});

// ── updateExpenseGroup ────────────────────────────────────────────────────────

const BLANK_GROUPS = {
  fixedExpenses:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  livingExpenses:      { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  businessExpenses:    { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  savingsAccumulation: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  miscellaneous:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
};

describe('updateExpenseGroup', () => {
  const UPDATED_GROUP = { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 12000 };
  const FULL_GROUPS = { ...BLANK_GROUPS, fixedExpenses: UPDATED_GROUP };

  it('calls updateDoc (not setDoc)', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('uses field-path key expenseGroups.{groupKey}', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'livingExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect('expenseGroups.livingExpenses' in payload).toBe(true);
  });

  it('writes updatedGroup to the field-path key', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload['expenseGroups.fixedExpenses']).toEqual(UPDATED_GROUP);
  });

  it('includes totalAnnualAfterTax from fullExpenseGroups rollup', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.totalAnnualAfterTax).toBe(12000);
  });

  it('includes totalAnnualPreTax (>= afterTax for non-zero income)', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.totalAnnualPreTax).toBeGreaterThanOrEqual(12000);
  });

  it('includes computedPAYE', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(typeof payload.computedPAYE).toBe('number');
    expect(payload.computedPAYE).toBeGreaterThanOrEqual(0);
  });

  it('stamps payeBracketsVersionId', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.payeBracketsVersionId).toBe(PAYE_BRACKETS_VERSION);
  });

  it('includes updatedAt serverTimestamp', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.updatedAt).toEqual({ _type: 'serverTimestamp' });
  });

  it('includes updatedBy uid', async () => {
    await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.updatedBy).toBe(UID);
  });

  it('returns the rollup object', async () => {
    const result = await updateExpenseGroup(TENANT_ID, UID, YEAR, 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS);
    expect(result).toHaveProperty('totalAnnualAfterTax');
    expect(result).toHaveProperty('totalAnnualPreTax');
    expect(result).toHaveProperty('computedPAYE');
  });

  it('throws for invalid year', async () => {
    await expect(
      updateExpenseGroup(TENANT_ID, UID, 'bad', 'fixedExpenses', UPDATED_GROUP, FULL_GROUPS),
    ).rejects.toThrow();
  });
});

// ── mergeSubCalcRef ───────────────────────────────────────────────────────────

describe('mergeSubCalcRef', () => {
  it('inserts new ref when key absent', () => {
    const group = { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 };
    const result = mergeSubCalcRef(group, 'insuranceIndustry', 5000);
    expect(result.subCalculatorRefs).toEqual([{ key: 'insuranceIndustry', annualTotal: 5000 }]);
  });

  it('updates existing ref by key', () => {
    const group = {
      lineItems: [],
      subCalculatorRefs: [{ key: 'insuranceIndustry', annualTotal: 3000 }],
      groupAnnualTotal: 3000,
    };
    const result = mergeSubCalcRef(group, 'insuranceIndustry', 7000);
    expect(result.subCalculatorRefs).toHaveLength(1);
    expect(result.subCalculatorRefs[0].annualTotal).toBe(7000);
  });

  it('recomputes groupAnnualTotal including subCalcTotal', () => {
    const group = {
      lineItems: [{ annualizedAmount: 12000 }],
      subCalculatorRefs: [],
      groupAnnualTotal: 12000,
    };
    const result = mergeSubCalcRef(group, 'carExpenses', 6000);
    expect(result.groupAnnualTotal).toBe(18000);
  });

  it('removes ref when annualTotal is 0', () => {
    const group = {
      lineItems: [],
      subCalculatorRefs: [{ key: 'insuranceIndustry', annualTotal: 5000 }],
      groupAnnualTotal: 5000,
    };
    const result = mergeSubCalcRef(group, 'insuranceIndustry', 0);
    expect(result.subCalculatorRefs).toHaveLength(0);
    expect(result.groupAnnualTotal).toBe(0);
  });
});

// ── updateSubCalculator ───────────────────────────────────────────────────────

const WORKSHEET_DOC = {
  year: YEAR,
  expenseGroups: {
    fixedExpenses:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    livingExpenses:      { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    businessExpenses:    { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    savingsAccumulation: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    miscellaneous:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  },
  subCalculators: {
    insuranceIndustry: { lineItems: [], annualTotal: 0 },
    carExpenses: { lineItems: [], withLoan: false, personalSharePct: 33, businessSharePct: 67, annualTotalPersonal: 0, annualTotalBusiness: 0 },
    loansDebt: { lineItems: [], annualTotal: 0 },
  },
};

describe('updateSubCalculator — insuranceIndustry', () => {
  const CALC_DATA = { lineItems: [], annualTotal: 8000 };

  it('calls updateDoc (not setDoc)', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, WORKSHEET_DOC);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('patches subCalculators.insuranceIndustry', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch['subCalculators.insuranceIndustry']).toEqual(CALC_DATA);
  });

  it('patches expenseGroups.businessExpenses with merged subCalcRef', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect('expenseGroups.businessExpenses' in patch).toBe(true);
    const biz = patch['expenseGroups.businessExpenses'];
    expect(biz.subCalculatorRefs.some((r) => r.key === 'insuranceIndustry' && r.annualTotal === 8000)).toBe(true);
  });

  it('does NOT patch livingExpenses', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect('expenseGroups.livingExpenses' in patch).toBe(false);
  });

  it('returns rollup and updatedGroups', async () => {
    const result = await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, WORKSHEET_DOC);
    expect(result).toHaveProperty('rollup');
    expect(result).toHaveProperty('updatedGroups');
    expect(result.updatedGroups).toHaveProperty('businessExpenses');
  });
});

describe('updateSubCalculator — carExpenses', () => {
  const CALC_DATA = { lineItems: [], withLoan: false, personalSharePct: 33, businessSharePct: 67, annualTotalPersonal: 3300, annualTotalBusiness: 6700 };

  it('patches expenseGroups.livingExpenses with personal share', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'carExpenses', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect('expenseGroups.livingExpenses' in patch).toBe(true);
    const living = patch['expenseGroups.livingExpenses'];
    expect(living.subCalculatorRefs.some((r) => r.key === 'carExpenses' && r.annualTotal === 3300)).toBe(true);
  });

  it('patches expenseGroups.businessExpenses with business share', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'carExpenses', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    const biz = patch['expenseGroups.businessExpenses'];
    expect(biz.subCalculatorRefs.some((r) => r.key === 'carExpenses' && r.annualTotal === 6700)).toBe(true);
  });
});

describe('updateSubCalculator — loansDebt', () => {
  const CALC_DATA = { lineItems: [], annualTotal: 24000 };

  it('patches subCalculators.loansDebt', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch['subCalculators.loansDebt']).toEqual(CALC_DATA);
  });

  it('does NOT patch any expenseGroups', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, WORKSHEET_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    const groupKeys = Object.keys(patch).filter((k) => k.startsWith('expenseGroups.'));
    expect(groupKeys).toHaveLength(0);
  });

  it('returns empty updatedGroups', async () => {
    const result = await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, WORKSHEET_DOC);
    expect(Object.keys(result.updatedGroups)).toHaveLength(0);
  });

  it('throws for invalid year', async () => {
    await expect(
      updateSubCalculator(TENANT_ID, UID, 'bad', 'loansDebt', CALC_DATA, WORKSHEET_DOC),
    ).rejects.toThrow();
  });
});

// ── updateCommissionTargets ───────────────────────────────────────────────────

const COMMISSION_WORKSHEET = {
  year: YEAR,
  totalAnnualPreTax: 200000,
  estimatedRenewalIncome: { life: 10000, ah: 0, property: 0, motor: 0, total: 10000 },
};
const COMMISSION_TARGETS = { life: 80000, ah: 20000, property: 15000, motor: 5000 };

describe('updateCommissionTargets', () => {
  it('calls updateDoc (not setDoc)', async () => {
    await updateCommissionTargets(TENANT_ID, UID, YEAR, COMMISSION_TARGETS, COMMISSION_WORKSHEET);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('computes firstYearCommissionsRequired = totalAnnualPreTax - renewalTotal', async () => {
    await updateCommissionTargets(TENANT_ID, UID, YEAR, COMMISSION_TARGETS, COMMISSION_WORKSHEET);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.firstYearCommissionsRequired).toBe(190000); // 200000 - 10000
  });

  it('patches firstYearCommissionsTargets with all four product lines + total', async () => {
    await updateCommissionTargets(TENANT_ID, UID, YEAR, COMMISSION_TARGETS, COMMISSION_WORKSHEET);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.firstYearCommissionsTargets).toEqual({
      life: 80000, ah: 20000, property: 15000, motor: 5000,
      total: 120000,
    });
  });

  it('total = sum of the four product lines', async () => {
    const targets = { life: 50000, ah: 10000, property: 20000, motor: 10000 };
    await updateCommissionTargets(TENANT_ID, UID, YEAR, targets, COMMISSION_WORKSHEET);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.firstYearCommissionsTargets.total).toBe(90000);
  });

  it('stamps updatedAt serverTimestamp and updatedBy uid', async () => {
    await updateCommissionTargets(TENANT_ID, UID, YEAR, COMMISSION_TARGETS, COMMISSION_WORKSHEET);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
    expect(patch.updatedBy).toBe(UID);
  });

  it('returns firstYearCommissionsRequired and firstYearCommissionsTargets', async () => {
    const result = await updateCommissionTargets(TENANT_ID, UID, YEAR, COMMISSION_TARGETS, COMMISSION_WORKSHEET);
    expect(result).toHaveProperty('firstYearCommissionsRequired');
    expect(result).toHaveProperty('firstYearCommissionsTargets');
  });

  it('throws for invalid year', async () => {
    await expect(
      updateCommissionTargets(TENANT_ID, UID, 'bad', COMMISSION_TARGETS, COMMISSION_WORKSHEET),
    ).rejects.toThrow();
  });
});
