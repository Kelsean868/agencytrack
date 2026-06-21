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
  updateExpenseGroup, updateSubCalculator,
  updateCommissionTargets, refreshPAYECalculation, updateVisibility,
  applyCalcToGroup, calcFedValue, normalizeWorksheet,
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

  it('scaffolds all 5 expense groups with seeded lineItems', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    await createMoneyNeeds(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    const groups = payload.expenseGroups;
    expect(Object.keys(groups)).toEqual([
      'fixedExpenses', 'livingExpenses', 'businessExpenses',
      'savingsAccumulation', 'miscellaneous',
    ]);
    expect(groups.fixedExpenses.lineItems).toHaveLength(6);
    expect(groups.livingExpenses.lineItems).toHaveLength(8);
    expect(groups.businessExpenses.lineItems).toHaveLength(8);
    expect(groups.savingsAccumulation.lineItems).toHaveLength(6);
    expect(groups.miscellaneous.lineItems).toHaveLength(6);
    for (const g of Object.values(groups)) {
      expect(g.groupAnnualTotal).toBe(0);
      expect(g.subCalculatorRefs).toEqual([]);
    }
  });

  it('scaffolds all 3 sub-calculators with seeded lineItems', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    await createMoneyNeeds(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    const sc = payload.subCalculators;
    expect(Object.keys(sc)).toEqual(['insuranceIndustry', 'carExpenses', 'loansDebt']);
    expect(sc.insuranceIndustry.annualTotal).toBe(0);
    expect(sc.insuranceIndustry.lineItems).toHaveLength(11);
    expect(sc.carExpenses.personalSharePct).toBe(33);
    expect(sc.carExpenses.lineItems).toHaveLength(7); // Vehicle Loan removed → loan lives in Loans & Debt
    expect(sc.loansDebt.annualTotal).toBe(0);
    expect(sc.loansDebt.lineItems).toHaveLength(6);
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

// ── createMoneyNeeds — seeded taxonomy ───────────────────────────────────────

describe('createMoneyNeeds — seeded taxonomy', () => {
  beforeEach(() => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));
  });

  async function getPayload() {
    await createMoneyNeeds(TENANT_ID, UID, YEAR);
    return hoisted.mockSetDoc.mock.calls[0][1];
  }

  it('seeds the correct item count per expense group (6-8-8-6-6)', async () => {
    const { expenseGroups: g } = await getPayload();
    expect(g.fixedExpenses.lineItems).toHaveLength(6);
    expect(g.livingExpenses.lineItems).toHaveLength(8);
    expect(g.businessExpenses.lineItems).toHaveLength(8);
    expect(g.savingsAccumulation.lineItems).toHaveLength(6);
    expect(g.miscellaneous.lineItems).toHaveLength(6);
  });

  it('seeds the correct item count per sub-calculator (11-7-6)', async () => {
    const { subCalculators: sc } = await getPayload();
    expect(sc.insuranceIndustry.lineItems).toHaveLength(11);
    expect(sc.carExpenses.lineItems).toHaveLength(7);
    expect(sc.loansDebt.lineItems).toHaveLength(6);
  });

  it('seeds the four calc-fed lines with calcKey + isOverridden:false', async () => {
    const { expenseGroups: g } = await getPayload();
    const find = (group, id) => group.lineItems.find((i) => i.id === id);
    const carPersonal = find(g.livingExpenses, 'seed-le-4');
    const carBusiness = find(g.businessExpenses, 'seed-be-4');
    const insurance   = find(g.businessExpenses, 'seed-be-7');
    const debt        = find(g.savingsAccumulation, 'seed-sa-2');
    expect(carPersonal.calcKey).toBe('carExpenses.personal');
    expect(carBusiness.calcKey).toBe('carExpenses.business');
    expect(insurance.calcKey).toBe('insuranceIndustry');
    expect(debt.calcKey).toBe('loansDebt');
    for (const line of [carPersonal, carBusiness, insurance, debt]) {
      expect(line.isOverridden).toBe(false);
    }
  });

  it('drops the retired named lines (Car insurance, Trade association dues)', async () => {
    const { expenseGroups: g } = await getPayload();
    const labels = (group) => group.lineItems.map((i) => i.label);
    expect(labels(g.fixedExpenses).some((l) => /car insurance/i.test(l))).toBe(false);
    expect(labels(g.businessExpenses).some((l) => /trade association/i.test(l))).toBe(false);
    expect(g.savingsAccumulation.lineItems.find((i) => i.id === 'seed-sa-2').label)
      .toBe('Debt reduction (non-mortgage)');
    expect(g.businessExpenses.lineItems.find((i) => i.id === 'seed-be-4').label)
      .toBe('Business car expenses');
  });

  it('every seeded item has isCustom: false, amount: 0, annualizedAmount: 0', async () => {
    const payload = await getPayload();
    const allItems = [
      ...Object.values(payload.expenseGroups).flatMap((g) => g.lineItems),
      ...Object.values(payload.subCalculators).flatMap((sc) => sc.lineItems),
    ];
    expect(allItems.length).toBeGreaterThan(0);
    for (const item of allItems) {
      expect(item.isCustom).toBe(false);
      expect(item.amount).toBe(0);
      expect(item.annualizedAmount).toBe(0);
    }
  });

  it('every seeded item frequency is a valid FREQUENCY_MULTIPLIERS key', async () => {
    const payload = await getPayload();
    const validFreqs = Object.keys(FREQUENCY_MULTIPLIERS);
    const allItems = [
      ...Object.values(payload.expenseGroups).flatMap((g) => g.lineItems),
      ...Object.values(payload.subCalculators).flatMap((sc) => sc.lineItems),
    ];
    for (const item of allItems) {
      expect(validFreqs).toContain(item.frequency);
    }
  });

  it('every seeded item has a non-empty id and label', async () => {
    const payload = await getPayload();
    const allItems = [
      ...Object.values(payload.expenseGroups).flatMap((g) => g.lineItems),
      ...Object.values(payload.subCalculators).flatMap((sc) => sc.lineItems),
    ];
    for (const item of allItems) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('seeded ids are unique across all groups and sub-calculators', async () => {
    const payload = await getPayload();
    const allIds = [
      ...Object.values(payload.expenseGroups).flatMap((g) => g.lineItems.map((i) => i.id)),
      ...Object.values(payload.subCalculators).flatMap((sc) => sc.lineItems.map((i) => i.id)),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('existing doc path does not call setDoc (idempotency gate)', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));
    await createMoneyNeeds(TENANT_ID, UID, YEAR);
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
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

  it('count-once: IGNORES retired subCalculatorRefs (no double-add)', () => {
    const group = {
      lineItems: [{ annualizedAmount: 5000 }],
      subCalculatorRefs: [{ annualTotal: 3000 }],
    };
    // The 3000 ref is no longer added on top — calc values live in their line.
    expect(computeGroupTotal(group)).toBe(5000);
  });

  it('returns 0 for empty lineItems', () => {
    expect(computeGroupTotal({ lineItems: [] })).toBe(0);
  });

  it('handles missing lineItems gracefully', () => {
    expect(computeGroupTotal({})).toBe(0);
    expect(computeGroupTotal({ lineItems: null })).toBe(0);
  });
});

// ── applyCalcToGroup ──────────────────────────────────────────────────────────

describe('applyCalcToGroup', () => {
  const group = {
    lineItems: [
      { id: 'seed-le-4', label: 'Car expenses, nonbusiness', amount: 0, frequency: 'A', annualizedAmount: 0, calcKey: 'carExpenses.personal', isOverridden: false },
      { id: 'seed-le-0', label: 'Food', amount: 100, frequency: 'M', annualizedAmount: 1200, isCustom: false },
    ],
  };

  it('prefills a non-overridden calc-fed line and recomputes the group total', () => {
    const result = applyCalcToGroup(group, 'seed-le-4', 3300);
    const fed = result.lineItems.find((i) => i.id === 'seed-le-4');
    expect(fed.amount).toBe(3300);
    expect(fed.annualizedAmount).toBe(3300);
    expect(fed.frequency).toBe('A');
    expect(result.groupAnnualTotal).toBe(3300 + 1200); // counted ONCE
  });

  it('does NOT overwrite an overridden line', () => {
    const overridden = {
      lineItems: [{ id: 'seed-le-4', amount: 500, frequency: 'M', annualizedAmount: 6000, calcKey: 'carExpenses.personal', isOverridden: true }],
    };
    const result = applyCalcToGroup(overridden, 'seed-le-4', 3300);
    expect(result.lineItems[0].amount).toBe(500);
    expect(result.lineItems[0].annualizedAmount).toBe(6000);
  });

  it('leaves non-matching lines untouched', () => {
    const result = applyCalcToGroup(group, 'seed-le-4', 3300);
    const food = result.lineItems.find((i) => i.id === 'seed-le-0');
    expect(food.amount).toBe(100);
  });
});

// ── calcFedValue ──────────────────────────────────────────────────────────────

describe('calcFedValue', () => {
  const sc = {
    carExpenses: { annualTotalPersonal: 3300, annualTotalBusiness: 6700 },
    insuranceIndustry: { annualTotal: 8000 },
    loansDebt: { annualTotal: 24000 },
  };
  it('routes carExpenses.personal → annualTotalPersonal', () => {
    expect(calcFedValue('carExpenses.personal', sc)).toBe(3300);
  });
  it('routes carExpenses.business → annualTotalBusiness', () => {
    expect(calcFedValue('carExpenses.business', sc)).toBe(6700);
  });
  it('routes insuranceIndustry → annualTotal', () => {
    expect(calcFedValue('insuranceIndustry', sc)).toBe(8000);
  });
  it('routes loansDebt → annualTotal', () => {
    expect(calcFedValue('loansDebt', sc)).toBe(24000);
  });
  it('returns 0 for an unknown calcKey or absent sub-calc', () => {
    expect(calcFedValue('unknown', sc)).toBe(0);
    expect(calcFedValue('loansDebt', {})).toBe(0);
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

// ── updateSubCalculator (count-once prefill) ──────────────────────────────────

// A normalized worksheet: every calc-fed line is present (id + calcKey) so a
// calc value can prefill it. Mirrors what getMoneyNeeds returns post-normalize.
const calcFed = (id, calcKey) => ({ id, label: id, amount: 0, frequency: 'A', annualizedAmount: 0, calcKey, isOverridden: false });
const manual  = (id, annualizedAmount = 0) => ({ id, label: id, amount: annualizedAmount, frequency: 'A', annualizedAmount, isCustom: false });

const NORMALIZED_DOC = {
  year: YEAR,
  expenseGroups: {
    fixedExpenses:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
    livingExpenses:      { lineItems: [calcFed('seed-le-4', 'carExpenses.personal'), manual('seed-le-0', 12000)], subCalculatorRefs: [], groupAnnualTotal: 12000 },
    businessExpenses:    { lineItems: [calcFed('seed-be-4', 'carExpenses.business'), calcFed('seed-be-7', 'insuranceIndustry')], subCalculatorRefs: [], groupAnnualTotal: 0 },
    savingsAccumulation: { lineItems: [calcFed('seed-sa-2', 'loansDebt')], subCalculatorRefs: [], groupAnnualTotal: 0 },
    miscellaneous:       { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  },
  subCalculators: {
    insuranceIndustry: { lineItems: [], annualTotal: 0 },
    carExpenses: { lineItems: [], withLoan: false, personalSharePct: 33, businessSharePct: 67, annualTotalPersonal: 0, annualTotalBusiness: 0 },
    loansDebt: { lineItems: [], annualTotal: 0 },
  },
};

describe('updateSubCalculator — insuranceIndustry (prefills the named line)', () => {
  const CALC_DATA = { lineItems: [], annualTotal: 8000 };

  it('calls updateDoc (not setDoc)', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, NORMALIZED_DOC);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('patches subCalculators.insuranceIndustry', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, NORMALIZED_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch['subCalculators.insuranceIndustry']).toEqual(CALC_DATA);
  });

  it('prefills the Professional/industry line (seed-be-7) — NO subCalculatorRefs add-on', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, NORMALIZED_DOC);
    const biz = hoisted.mockUpdateDoc.mock.calls[0][1]['expenseGroups.businessExpenses'];
    const fed = biz.lineItems.find((i) => i.id === 'seed-be-7');
    expect(fed.amount).toBe(8000);
    expect(fed.annualizedAmount).toBe(8000);
    expect(biz.subCalculatorRefs).toEqual([]);
    expect(biz.groupAnnualTotal).toBe(8000); // counted once
  });

  it('does NOT patch livingExpenses', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, NORMALIZED_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect('expenseGroups.livingExpenses' in patch).toBe(false);
  });

  it('returns rollup and updatedGroups', async () => {
    const result = await updateSubCalculator(TENANT_ID, UID, YEAR, 'insuranceIndustry', CALC_DATA, NORMALIZED_DOC);
    expect(result).toHaveProperty('rollup');
    expect(result.updatedGroups).toHaveProperty('businessExpenses');
  });
});

describe('updateSubCalculator — carExpenses (prefills both shares)', () => {
  const CALC_DATA = { lineItems: [], withLoan: false, personalSharePct: 33, businessSharePct: 67, annualTotalPersonal: 3300, annualTotalBusiness: 6700 };

  it('prefills the personal share into Living (seed-le-4), counted once', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'carExpenses', CALC_DATA, NORMALIZED_DOC);
    const living = hoisted.mockUpdateDoc.mock.calls[0][1]['expenseGroups.livingExpenses'];
    const fed = living.lineItems.find((i) => i.id === 'seed-le-4');
    expect(fed.amount).toBe(3300);
    expect(living.subCalculatorRefs).toEqual([]);
    // 3300 (car personal) + 12000 (existing Food) — the car value counted ONCE.
    expect(living.groupAnnualTotal).toBe(15300);
  });

  it('prefills the business share into Business (seed-be-4)', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'carExpenses', CALC_DATA, NORMALIZED_DOC);
    const biz = hoisted.mockUpdateDoc.mock.calls[0][1]['expenseGroups.businessExpenses'];
    const fed = biz.lineItems.find((i) => i.id === 'seed-be-4');
    expect(fed.amount).toBe(6700);
  });
});

describe('updateSubCalculator — loansDebt (now prefills Savings)', () => {
  const CALC_DATA = { lineItems: [], annualTotal: 24000 };

  it('patches subCalculators.loansDebt', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, NORMALIZED_DOC);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch['subCalculators.loansDebt']).toEqual(CALC_DATA);
  });

  it('prefills Debt reduction (seed-sa-2) in savingsAccumulation', async () => {
    await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, NORMALIZED_DOC);
    const sav = hoisted.mockUpdateDoc.mock.calls[0][1]['expenseGroups.savingsAccumulation'];
    const fed = sav.lineItems.find((i) => i.id === 'seed-sa-2');
    expect(fed.amount).toBe(24000);
    expect(sav.groupAnnualTotal).toBe(24000);
  });

  it('returns savingsAccumulation in updatedGroups', async () => {
    const result = await updateSubCalculator(TENANT_ID, UID, YEAR, 'loansDebt', CALC_DATA, NORMALIZED_DOC);
    expect(result.updatedGroups).toHaveProperty('savingsAccumulation');
  });

  it('throws for invalid year', async () => {
    await expect(
      updateSubCalculator(TENANT_ID, UID, 'bad', 'loansDebt', CALC_DATA, NORMALIZED_DOC),
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

// ── refreshPAYECalculation ────────────────────────────────────────────────────

const REFRESH_GROUPS = {
  fixedExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 120000 },
  livingExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  businessExpenses: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  savingsAccumulation: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
  miscellaneous: { lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 },
};

describe('refreshPAYECalculation', () => {
  it('calls updateDoc (not setDoc)', async () => {
    await refreshPAYECalculation(TENANT_ID, UID, YEAR, REFRESH_GROUPS);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('patches totalAnnualAfterTax, totalAnnualPreTax, computedPAYE from rollup', async () => {
    await refreshPAYECalculation(TENANT_ID, UID, YEAR, REFRESH_GROUPS);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.totalAnnualAfterTax).toBe(120000);
    expect(patch.totalAnnualPreTax).toBeGreaterThanOrEqual(120000);
    expect(typeof patch.computedPAYE).toBe('number');
  });

  it('stamps payeBracketsVersionId = PAYE_BRACKETS_VERSION', async () => {
    await refreshPAYECalculation(TENANT_ID, UID, YEAR, REFRESH_GROUPS);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.payeBracketsVersionId).toBe(PAYE_BRACKETS_VERSION);
  });

  it('stamps updatedAt serverTimestamp and updatedBy uid', async () => {
    await refreshPAYECalculation(TENANT_ID, UID, YEAR, REFRESH_GROUPS);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
    expect(patch.updatedBy).toBe(UID);
  });

  it('throws for invalid year', async () => {
    await expect(
      refreshPAYECalculation(TENANT_ID, UID, 'bad', REFRESH_GROUPS),
    ).rejects.toThrow();
  });
});

// ── updateVisibility ──────────────────────────────────────────────────────────

describe('updateVisibility', () => {
  it('patches visibility field', async () => {
    await updateVisibility(TENANT_ID, UID, YEAR, 'shared');
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.visibility).toBe('shared');
  });

  it('stamps updatedAt serverTimestamp and updatedBy uid', async () => {
    await updateVisibility(TENANT_ID, UID, YEAR, 'private');
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
    expect(patch.updatedBy).toBe(UID);
  });

  it('throws for invalid year', async () => {
    await expect(updateVisibility(TENANT_ID, UID, 'bad', 'private')).rejects.toThrow();
  });

  it('throws for invalid visibility value', async () => {
    await expect(updateVisibility(TENANT_ID, UID, YEAR, 'default')).rejects.toThrow();
  });
});

// ── normalizeWorksheet — migration / count-once reconciliation ────────────────

describe('normalizeWorksheet', () => {
  it('returns null/undefined untouched', () => {
    expect(normalizeWorksheet(null)).toBeNull();
    expect(normalizeWorksheet(undefined)).toBeUndefined();
  });

  it('expands a sparse legacy doc to the full canonical inventory', () => {
    const result = normalizeWorksheet({ year: YEAR, expenseGroups: {}, subCalculators: {} });
    expect(result.expenseGroups.fixedExpenses.lineItems).toHaveLength(6);
    expect(result.expenseGroups.businessExpenses.lineItems).toHaveLength(8);
    expect(result.expenseGroups.livingExpenses.lineItems.find((i) => i.id === 'seed-le-4').calcKey)
      .toBe('carExpenses.personal');
  });

  it('drops retired lines and the subCalculatorRefs add-on', () => {
    const legacy = {
      year: YEAR,
      expenseGroups: {
        fixedExpenses: {
          lineItems: [{ id: 'seed-fe-4', label: 'Car insurance', amount: 1000, frequency: 'A', annualizedAmount: 1000, isCustom: false }],
          subCalculatorRefs: [],
          groupAnnualTotal: 1000,
        },
      },
      subCalculators: {},
    };
    const result = normalizeWorksheet(legacy);
    expect(result.expenseGroups.fixedExpenses.lineItems.some((i) => i.id === 'seed-fe-4')).toBe(false);
    expect(result.expenseGroups.fixedExpenses.subCalculatorRefs).toEqual([]);
  });

  it('RECONCILES the double-count: a legacy manual value + ref drops to count-once', () => {
    // Agent had a manual "Car expenses, nonbusiness" (6000/yr) AND the old
    // carExpenses ref (3300) double-added → stored 9300. Post-normalize: 6000.
    const legacy = {
      year: YEAR,
      estimatedRenewalIncome: { total: 0 },
      expenseGroups: {
        livingExpenses: {
          lineItems: [{ id: 'seed-le-4', label: 'Car expenses, nonbusiness', amount: 500, frequency: 'M', annualizedAmount: 6000, isCustom: false }],
          subCalculatorRefs: [{ key: 'carExpenses', annualTotal: 3300 }],
          groupAnnualTotal: 9300,
        },
      },
      subCalculators: {
        carExpenses: { lineItems: [], annualTotalPersonal: 3300, annualTotalBusiness: 6700 },
      },
    };
    const result = normalizeWorksheet(legacy);
    const fed = result.expenseGroups.livingExpenses.lineItems.find((i) => i.id === 'seed-le-4');
    expect(fed.isOverridden).toBe(true);          // manual value preserved as override
    expect(fed.amount).toBe(500);                 // exact value retained (no data loss)
    expect(fed.annualizedAmount).toBe(6000);
    expect(result.expenseGroups.livingExpenses.groupAnnualTotal).toBe(6000); // counted ONCE — 3300 phantom gone
  });

  it('prefills a non-overridden calc-fed line from the current calculator value', () => {
    const doc = {
      year: YEAR,
      estimatedRenewalIncome: { total: 0 },
      expenseGroups: {
        savingsAccumulation: {
          lineItems: [{ id: 'seed-sa-2', label: 'Debt reduction (other than mortgage)', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: false }],
          subCalculatorRefs: [],
          groupAnnualTotal: 0,
        },
      },
      // Realistic populated sub-calc (annualTotal derives from lineItems).
      subCalculators: {
        loansDebt: {
          lineItems: [{ id: 'seed-ld-0', label: 'Credit Card', amount: 2000, frequency: 'M', annualizedAmount: 24000, isCustom: false }],
          annualTotal: 24000,
        },
      },
    };
    const result = normalizeWorksheet(doc);
    const fed = result.expenseGroups.savingsAccumulation.lineItems.find((i) => i.id === 'seed-sa-2');
    expect(fed.calcKey).toBe('loansDebt');
    expect(fed.isOverridden).toBe(false);
    expect(fed.amount).toBe(24000);
    expect(fed.label).toBe('Debt reduction (non-mortgage)'); // renamed
  });

  it('excludes the Vehicle Loan from the car split (loan lives in Loans & Debt)', () => {
    const doc = {
      year: YEAR,
      estimatedRenewalIncome: { total: 0 },
      expenseGroups: {},
      subCalculators: {
        carExpenses: {
          lineItems: [
            { id: 'seed-ce-0', label: 'Gas', amount: 1000, frequency: 'M', annualizedAmount: 12000, isCustom: false },
            { id: 'seed-ce-7', label: 'Vehicle Loan', amount: 2000, frequency: 'M', annualizedAmount: 24000, isCustom: false },
          ],
        },
      },
    };
    const result = normalizeWorksheet(doc);
    // Vehicle Loan dropped → split computed on 12000 only: 33% personal, 67% business.
    expect(result.subCalculators.carExpenses.lineItems.some((i) => i.id === 'seed-ce-7')).toBe(false);
    expect(result.subCalculators.carExpenses.annualTotalPersonal).toBe(Math.round(12000 * 33 / 100));
    expect(result.subCalculators.carExpenses.annualTotalBusiness).toBe(Math.round(12000 * 67 / 100));
  });

  it('preserves agent-added custom lines', () => {
    const doc = {
      year: YEAR,
      estimatedRenewalIncome: { total: 0 },
      expenseGroups: {
        miscellaneous: {
          lineItems: [{ id: 'custom-xyz', label: 'My thing', amount: 100, frequency: 'M', annualizedAmount: 1200, isCustom: true }],
          subCalculatorRefs: [],
          groupAnnualTotal: 1200,
        },
      },
      subCalculators: {},
    };
    const result = normalizeWorksheet(doc);
    const custom = result.expenseGroups.miscellaneous.lineItems.find((i) => i.id === 'custom-xyz');
    expect(custom).toBeDefined();
    expect(custom.annualizedAmount).toBe(1200);
  });

  it('scaffolds a MISSING sub-calculator with seeded items (Gemini #714)', () => {
    // Legacy doc with no subCalculators at all → all three seeded, not empty.
    const result = normalizeWorksheet({ year: YEAR, expenseGroups: {}, subCalculators: undefined });
    expect(result.subCalculators.insuranceIndustry.lineItems).toHaveLength(11);
    expect(result.subCalculators.carExpenses.lineItems).toHaveLength(7);
    expect(result.subCalculators.loansDebt.lineItems).toHaveLength(6);
  });

  it('re-seeds an EMPTY sub-calculator (zero lines is non-functional) (Gemini #714)', () => {
    const result = normalizeWorksheet({
      year: YEAR,
      expenseGroups: {},
      subCalculators: {
        insuranceIndustry: { lineItems: [], annualTotal: 0 },
        carExpenses: { lineItems: [] },
        loansDebt: { lineItems: [], annualTotal: 0 },
      },
    });
    expect(result.subCalculators.insuranceIndustry.lineItems).toHaveLength(11);
    expect(result.subCalculators.carExpenses.lineItems).toHaveLength(7);
    expect(result.subCalculators.loansDebt.lineItems).toHaveLength(6);
  });

  it('preserves a POPULATED sub-calculator (no spurious re-seed)', () => {
    const result = normalizeWorksheet({
      year: YEAR,
      expenseGroups: {},
      subCalculators: {
        loansDebt: { lineItems: [{ id: 'custom-ld', label: 'My loan', amount: 100, frequency: 'M', annualizedAmount: 1200, isCustom: true }], annualTotal: 1200 },
      },
    });
    expect(result.subCalculators.loansDebt.lineItems).toHaveLength(1);
    expect(result.subCalculators.loansDebt.lineItems[0].id).toBe('custom-ld');
  });

  it('recomputes rollup totals so downstream reads are corrected in-memory', () => {
    const legacy = {
      year: YEAR,
      estimatedRenewalIncome: { total: 0 },
      totalAnnualAfterTax: 9999999, // stale double-counted value
      expenseGroups: {
        livingExpenses: {
          lineItems: [{ id: 'seed-le-0', label: 'Food', amount: 1000, frequency: 'M', annualizedAmount: 12000, isCustom: false }],
          subCalculatorRefs: [{ key: 'carExpenses', annualTotal: 5000 }],
          groupAnnualTotal: 17000,
        },
      },
      subCalculators: {},
    };
    const result = normalizeWorksheet(legacy);
    expect(result.totalAnnualAfterTax).toBe(12000); // ref dropped, recomputed
  });
});
