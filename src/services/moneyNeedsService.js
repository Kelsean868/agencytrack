import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { computePAYE, grossFromNet, DEFAULT_PAYE_CONFIG } from '../utils/payeEngine';

export const PAYE_BRACKETS_VERSION = 'default-2026';

export const FREQUENCY_MULTIPLIERS = { A: 1, S: 2, Q: 4, M: 12 };

export const PLAYGROUND_INCOME_GOAL_KEY = 'agencytrack-playground-income-goal';

export const CAR_PERSONAL_PCT = 33;
export const CAR_BUSINESS_PCT = 67;

// ── Feed-map (count-once) ─────────────────────────────────────────────────────
// Each sub-calculator output PREFILLS a single named expense-group line rather
// than being added on top as a separate ref. A line marked with one of these
// `calcKey` values is "calc-fed": its value syncs from the calculator unless the
// agent has explicitly overridden it. FEED_MAP routes a calc value → its line.
// Banked: PR #5 Money-Needs double-count reconciliation.
export const FEED_MAP = {
  'carExpenses.personal': { group: 'livingExpenses',      lineId: 'seed-le-4' },
  'carExpenses.business': { group: 'businessExpenses',    lineId: 'seed-be-4' },
  insuranceIndustry:      { group: 'businessExpenses',    lineId: 'seed-be-7' },
  loansDebt:              { group: 'savingsAccumulation', lineId: 'seed-sa-2' },
};

// Loans & Debt line that represents the car loan — surfaced read-only inside the
// Car Expenses calculator as a cost-of-ownership reference (NOT split, NOT a car
// total). Matched by stable seed id.
export const CAR_LOAN_LOANSDEBT_LINE_ID = 'seed-ld-1';

export function annualizeAmount(amount, frequency) {
  return (parseFloat(amount) || 0) * (FREQUENCY_MULTIPLIERS[frequency] ?? 12);
}

// Count-once: a group total is the sum of its line items only. Calc-fed values
// live IN their named line (prefilled-but-editable), so there is no separate
// sub-calculator add-on. `subCalculatorRefs` is retired and ignored here.
export function computeGroupTotal(group) {
  return (group.lineItems ?? []).reduce(
    (sum, item) => sum + (parseFloat(item.annualizedAmount) || 0), 0,
  );
}

export function computeWorksheetRollup(expenseGroups) {
  const totalAnnualAfterTax = Object.values(expenseGroups).reduce(
    (sum, g) => sum + (parseFloat(g.groupAnnualTotal) || 0), 0,
  );
  const totalAnnualPreTax = grossFromNet(totalAnnualAfterTax, DEFAULT_PAYE_CONFIG);
  const computedPAYE = computePAYE(totalAnnualPreTax, DEFAULT_PAYE_CONFIG);
  return { totalAnnualAfterTax, totalAnnualPreTax, computedPAYE };
}

/**
 * countFilledLineItems — worksheet-level FILLED N/total tally (Game Plan v2 1.8).
 *
 * Pure derivation over the worksheet's expense groups: total = every line item
 * across all groups; filled = items with a positive amount. Mirrors the per-group
 * "N of M filled" count each accordion derives from its own items, aggregated
 * across the whole worksheet. First-run seed (34 named items, all 0) → { filled: 0,
 * total: 34 }; adding a custom item grows the denominator.
 *
 * @param {Record<string, { lineItems?: Array<{ amount?: number|string }> }>|null|undefined} expenseGroups
 * @returns {{ filled: number, total: number }}
 */
export function countFilledLineItems(expenseGroups) {
  if (!expenseGroups) return { filled: 0, total: 0 };
  return Object.values(expenseGroups).reduce(
    (acc, group) => {
      const items = group?.lineItems ?? [];
      acc.total += items.length;
      acc.filled += items.filter((i) => (parseFloat(i?.amount) || 0) > 0).length;
      return acc;
    },
    { filled: 0, total: 0 },
  );
}

export async function updateExpenseGroup(tenantId, uid, year, groupKey, updatedGroup, fullExpenseGroups) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const rollup = computeWorksheetRollup(fullExpenseGroups);

  await updateDoc(docRef, {
    [`expenseGroups.${groupKey}`]: updatedGroup,
    totalAnnualAfterTax: rollup.totalAnnualAfterTax,
    totalAnnualPreTax: rollup.totalAnnualPreTax,
    computedPAYE: rollup.computedPAYE,
    payeBracketsVersionId: PAYE_BRACKETS_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  return rollup;
}

// Write an annual calc value into its named calc-fed line, unless the agent has
// overridden that line. Returns the group with a recomputed groupAnnualTotal.
export function applyCalcToGroup(group, lineId, annualValue) {
  const items = (group.lineItems ?? []).map((item) => {
    if (item.id !== lineId || item.isOverridden) return item;
    const v = parseFloat(annualValue) || 0;
    return { ...item, amount: v, frequency: 'A', annualizedAmount: v };
  });
  return { ...group, lineItems: items, groupAnnualTotal: computeGroupTotal({ lineItems: items }) };
}

// Which feed(s) a sub-calculator drives, paired with the annual value to push.
function feedsForCalc(calcKey, calcData) {
  if (calcKey === 'insuranceIndustry') return [['insuranceIndustry', calcData.annualTotal ?? 0]];
  if (calcKey === 'carExpenses') return [
    ['carExpenses.personal', calcData.annualTotalPersonal ?? 0],
    ['carExpenses.business', calcData.annualTotalBusiness ?? 0],
  ];
  if (calcKey === 'loansDebt') return [['loansDebt', calcData.annualTotal ?? 0]];
  return [];
}

export async function updateSubCalculator(tenantId, uid, year, calcKey, calcData, worksheetDoc) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const working = { ...(worksheetDoc.expenseGroups ?? {}) };
  const patch = { [`subCalculators.${calcKey}`]: calcData };

  // Prefill each fed line in turn. Multiple feeds can target the same group
  // (car-business + insurance both → businessExpenses), so compose on `working`.
  const feeds = feedsForCalc(calcKey, calcData);
  const touched = new Set();
  for (const [feedKey, value] of feeds) {
    const target = FEED_MAP[feedKey];
    if (!target) continue;
    working[target.group] = applyCalcToGroup(working[target.group] ?? {}, target.lineId, value);
    touched.add(target.group);
  }

  const updatedGroups = {};
  for (const gKey of touched) {
    updatedGroups[gKey] = working[gKey];
    patch[`expenseGroups.${gKey}`] = working[gKey];
  }

  const rollup = computeWorksheetRollup(working);
  Object.assign(patch, {
    totalAnnualAfterTax: rollup.totalAnnualAfterTax,
    totalAnnualPreTax: rollup.totalAnnualPreTax,
    computedPAYE: rollup.computedPAYE,
    payeBracketsVersionId: PAYE_BRACKETS_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  await updateDoc(docRef, patch);
  return { rollup, updatedGroups };
}

export async function refreshPAYECalculation(tenantId, uid, year, expenseGroups) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const rollup = computeWorksheetRollup(expenseGroups);

  await updateDoc(docRef, {
    totalAnnualAfterTax: rollup.totalAnnualAfterTax,
    totalAnnualPreTax: rollup.totalAnnualPreTax,
    computedPAYE: rollup.computedPAYE,
    payeBracketsVersionId: PAYE_BRACKETS_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  return rollup;
}

export async function updateCommissionTargets(tenantId, uid, year, targets, worksheet) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const life     = parseFloat(targets.life)     || 0;
  const ah       = parseFloat(targets.ah)       || 0;
  const property = parseFloat(targets.property) || 0;
  const motor    = parseFloat(targets.motor)    || 0;
  const total    = life + ah + property + motor;

  const renewalTotal = parseFloat(worksheet.estimatedRenewalIncome?.total) || 0;
  const firstYearCommissionsRequired = (parseFloat(worksheet.totalAnnualPreTax) || 0) - renewalTotal;
  const firstYearCommissionsTargets = { life, ah, property, motor, total };

  await updateDoc(docRef, {
    firstYearCommissionsRequired,
    firstYearCommissionsTargets,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  return { firstYearCommissionsRequired, firstYearCommissionsTargets };
}

// `calcKey` (4th arg) marks a calc-fed line; calc-fed lines also carry
// `isOverridden: false` so the prefill/override state is explicit from seed.
function seedItem(id, label, frequency, calcKey = null) {
  const base = { id, label, amount: 0, frequency, annualizedAmount: 0, isCustom: false };
  return calcKey ? { ...base, calcKey, isOverridden: false } : base;
}

const DEFAULT_MONEY_NEEDS_CATEGORIES = {
  expenseGroups: {
    fixedExpenses: [
      seedItem('seed-fe-0', 'Rent or mortgage payments', 'A'),
      seedItem('seed-fe-1', 'Utilities – gas, heat, light, telephone, water', 'M'),
      seedItem('seed-fe-2', 'Disability income insurance', 'M'),
      seedItem('seed-fe-3', 'Homeowners insurance', 'M'),
      seedItem('seed-fe-5', 'Property taxes', 'A'),
      seedItem('seed-fe-6', 'Other', 'M'),
    ],
    livingExpenses: [
      seedItem('seed-le-0', 'Food', 'M'),
      seedItem('seed-le-1', 'Clothing', 'M'),
      seedItem('seed-le-2', 'Laundry, tailoring', 'M'),
      seedItem('seed-le-3', 'Entertainment', 'M'),
      seedItem('seed-le-4', 'Car expenses, nonbusiness', 'A', 'carExpenses.personal'),
      seedItem('seed-le-5', 'Medical – doctor, dentist, drugs', 'M'),
      seedItem('seed-le-6', 'Household', 'M'),
      seedItem('seed-le-7', 'Other', 'M'),
    ],
    businessExpenses: [
      seedItem('seed-be-0', 'Sales promotion, advertising, direct mail, tuition', 'M'),
      seedItem('seed-be-2', 'Telephone, computer, stationery, postage, supplies', 'M'),
      seedItem('seed-be-3', 'Secretarial and banking services', 'M'),
      seedItem('seed-be-4', 'Business car expenses', 'A', 'carExpenses.business'),
      seedItem('seed-be-5', 'Business entertainment', 'M'),
      seedItem('seed-be-6', 'Other', 'M'),
      seedItem('seed-be-7', 'Professional/industry expenses', 'A', 'insuranceIndustry'),
      seedItem('seed-be-8', 'Other business travel', 'M'),
    ],
    savingsAccumulation: [
      seedItem('seed-sa-0', 'Life insurance', 'M'),
      seedItem('seed-sa-1', 'Savings account', 'M'),
      seedItem('seed-sa-2', 'Debt reduction (non-mortgage)', 'A', 'loansDebt'),
      seedItem('seed-sa-3', 'Investments', 'M'),
      seedItem('seed-sa-4', 'Slush fund', 'M'),
      seedItem('seed-sa-5', 'Other', 'M'),
    ],
    miscellaneous: [
      seedItem('seed-mi-0', 'Donations – religious, charitable, etc.', 'M'),
      seedItem('seed-mi-1', 'Recreation', 'M'),
      seedItem('seed-mi-2', 'Club dues', 'M'),
      seedItem('seed-mi-3', 'Gifts and services', 'M'),
      seedItem('seed-mi-4', 'Vacation', 'M'),
      seedItem('seed-mi-5', 'Other', 'M'),
    ],
  },
  subCalculators: {
    insuranceIndustry: [
      seedItem('seed-ii-0',  'Life License Renewal', 'A'),
      seedItem('seed-ii-1',  'General License Renewal', 'A'),
      seedItem('seed-ii-2',  'TTAIFA fees', 'A'),
      seedItem('seed-ii-3',  'TTII Portal Fee', 'A'),
      seedItem('seed-ii-4',  'CPD classes', 'A'),
      seedItem('seed-ii-5',  'TTAIFA Courses (FSCP/etc)', 'A'),
      seedItem('seed-ii-6',  'TTAIFA Congress', 'A'),
      seedItem('seed-ii-7',  'MDRT membership fee', 'A'),
      seedItem('seed-ii-8',  'MDRT Convention', 'A'),
      seedItem('seed-ii-9',  'Branch Retreats', 'A'),
      seedItem('seed-ii-10', 'Other Industry Events', 'A'),
    ],
    carExpenses: [
      seedItem('seed-ce-0', 'Gas/Petrol/Electric', 'M'),
      seedItem('seed-ce-1', 'Mechanical Servicing', 'Q'),
      seedItem('seed-ce-2', 'Insurance', 'A'),
      seedItem('seed-ce-3', 'Parking fees', 'M'),
      seedItem('seed-ce-4', 'Tickets', 'A'),
      seedItem('seed-ce-5', 'Car wash and maintenance', 'M'),
      seedItem('seed-ce-6', 'Miscellaneous', 'A'),
    ],
    loansDebt: [
      seedItem('seed-ld-0', 'Credit Card', 'M'),
      seedItem('seed-ld-1', 'Car Loan', 'M'),
      seedItem('seed-ld-2', 'Personal Loan', 'M'),
      seedItem('seed-ld-3', 'Sou-sou', 'M'),
      seedItem('seed-ld-4', 'Hire-Purchase', 'M'),
      seedItem('seed-ld-5', 'Other', 'M'),
    ],
  },
};

// Canonical named-line spec per group, derived from the seed. Drives normalization:
// any stored line whose id is NOT here and isCustom:false is a retired line and
// is dropped (Car insurance, Trade association dues, Vehicle Loan-in-car-calc).
const CANONICAL_LINES = Object.fromEntries(
  Object.entries(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups).map(([gKey, items]) => [
    gKey,
    items.map((i) => ({ id: i.id, label: i.label, frequency: i.frequency, calcKey: i.calcKey ?? null })),
  ]),
);

const EXPENSE_GROUP_KEYS = Object.keys(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups);

const EXPENSE_GROUP_SCAFFOLD = (items = []) => ({
  lineItems: items.map((i) => ({ ...i })),
  subCalculatorRefs: [],
  groupAnnualTotal: 0,
});

const BLANK_SCAFFOLD = (tenantId, uid, year) => ({
  year,
  productLines: [],

  expenseGroups: {
    fixedExpenses:       EXPENSE_GROUP_SCAFFOLD(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups.fixedExpenses),
    livingExpenses:      EXPENSE_GROUP_SCAFFOLD(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups.livingExpenses),
    businessExpenses:    EXPENSE_GROUP_SCAFFOLD(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups.businessExpenses),
    savingsAccumulation: EXPENSE_GROUP_SCAFFOLD(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups.savingsAccumulation),
    miscellaneous:       EXPENSE_GROUP_SCAFFOLD(DEFAULT_MONEY_NEEDS_CATEGORIES.expenseGroups.miscellaneous),
  },

  subCalculators: {
    insuranceIndustry: {
      lineItems: DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.insuranceIndustry.map((i) => ({ ...i })),
      annualTotal: 0,
    },
    carExpenses: {
      lineItems: DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.carExpenses.map((i) => ({ ...i })),
      withLoan: false,
      personalSharePct: CAR_PERSONAL_PCT,
      businessSharePct: CAR_BUSINESS_PCT,
      annualTotalPersonal: 0,
      annualTotalBusiness: 0,
    },
    loansDebt: {
      lineItems: DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.loansDebt.map((i) => ({ ...i })),
      annualTotal: 0,
    },
  },

  totalAnnualAfterTax: 0,
  payeBracketsSnapshot: null,
  payeBracketsVersionId: null,
  computedPAYE: 0,
  totalAnnualPreTax: 0,

  estimatedRenewalIncome: { life: 0, ah: 0, property: 0, motor: 0, total: 0 },
  firstYearCommissionsRequired: 0,
  firstYearCommissionsTargets: { life: 0, ah: 0, property: 0, motor: 0, total: 0 },

  visibility: 'private',
  shareWithSm: false,

  tenantId,
  uid,
  createdAt: serverTimestamp(),
  createdBy: uid,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
});

// Annual value a given calc-fed line should sync to, read from the worksheet's
// sub-calculators. Excludes the car loan from the car split (loan lives in
// Loans & Debt) because the car calc's own line inventory no longer contains it.
// Exported for the panel's "reset to calculator value" affordance.
export function calcFedValue(calcKey, subCalculators) {
  const sc = subCalculators ?? {};
  if (calcKey === 'carExpenses.personal') return parseFloat(sc.carExpenses?.annualTotalPersonal) || 0;
  if (calcKey === 'carExpenses.business') return parseFloat(sc.carExpenses?.annualTotalBusiness) || 0;
  if (calcKey === 'insuranceIndustry')    return parseFloat(sc.insuranceIndustry?.annualTotal) || 0;
  if (calcKey === 'loansDebt')            return parseFloat(sc.loansDebt?.annualTotal) || 0;
  return 0;
}

// Default sub-calculator scaffolds — used to back-fill a legacy/sparse worksheet
// that is missing a sub-calculator entirely, so the UI never shows an empty
// checklist instead of the seeded items. (Gemini #714.)
function defaultSubCalc(key) {
  if (key === 'carExpenses') {
    return {
      lineItems: DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.carExpenses.map((i) => ({ ...i })),
      withLoan: false,
      personalSharePct: CAR_PERSONAL_PCT,
      businessSharePct: CAR_BUSINESS_PCT,
      annualTotalPersonal: 0,
      annualTotalBusiness: 0,
    };
  }
  return {
    lineItems: DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators[key].map((i) => ({ ...i })),
    annualTotal: 0,
  };
}

// Recompute the car calc's personal/business split from its line items, having
// dropped any retired Vehicle Loan line. Loan is excluded from the split. A
// legacy doc missing `lineItems` falls back to the seeded car items rather than
// rendering an empty checklist. (Gemini #714.)
function normalizeCarCalc(carCalc) {
  const canonicalIds = new Set(DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.carExpenses.map((i) => i.id));
  const storedItems = carCalc?.lineItems
    ?? DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.carExpenses.map((i) => ({ ...i }));
  const items = storedItems.filter((i) => i.isCustom || canonicalIds.has(i.id));
  const lineAnnual = items.reduce(
    (s, i) => s + (annualizeAmount(parseFloat(i.amount) || 0, i.frequency) || 0), 0,
  );
  const annualTotalPersonal = Math.round((lineAnnual * CAR_PERSONAL_PCT) / 100);
  const annualTotalBusiness = Math.round((lineAnnual * CAR_BUSINESS_PCT) / 100);
  return {
    ...carCalc,
    lineItems: items,
    personalSharePct: CAR_PERSONAL_PCT,
    businessSharePct: CAR_BUSINESS_PCT,
    annualTotalPersonal,
    annualTotalBusiness,
  };
}

/**
 * normalizeWorksheet — bring a loaded worksheet to the count-once schema in memory.
 *
 * Applied on read so every consumer sees corrected, un-double-counted totals
 * without a write. Persists naturally on the agent's next save (every save path
 * recomputes the rollup from the in-memory groups this returns).
 *
 *  1. Reconcile the named-line inventory against CANONICAL_LINES: retired lines
 *     (Car insurance, Trade association dues, in-car Vehicle Loan) drop; renamed
 *     lines pick up the new label; new lines (Professional/industry expenses,
 *     Other business travel) are added; calc-fed lines pick up their `calcKey`.
 *  2. Preserve agent values: a legacy calc-fed line carrying a manual value
 *     becomes an explicit override (no data loss); custom lines are carried over.
 *  3. Drop the retired `subCalculatorRefs` add-on (the double-count source).
 *  4. Sync each non-overridden calc-fed line to its current calculator value
 *     (car split excludes the loan).
 *  5. Recompute every groupAnnualTotal and the worksheet rollup.
 *
 * @param {object|null} worksheet
 * @returns {object|null}
 */
export function normalizeWorksheet(worksheet) {
  if (!worksheet) return worksheet;

  // Scaffold any missing OR empty sub-calculator so legacy/sparse docs never
  // render an empty checklist — a sub-calculator with zero lines is
  // non-functional (no total/split possible), so we fall back to the seeded set.
  // (Gemini #714, extended from missing→empty.)
  const sc = worksheet.subCalculators ?? {};
  const ensureSubCalc = (stored, key) =>
    (stored && Array.isArray(stored.lineItems) && stored.lineItems.length > 0) ? stored : defaultSubCalc(key);
  const subCalculators = {
    insuranceIndustry: ensureSubCalc(sc.insuranceIndustry, 'insuranceIndustry'),
    loansDebt:         ensureSubCalc(sc.loansDebt, 'loansDebt'),
    carExpenses:       normalizeCarCalc(ensureSubCalc(sc.carExpenses, 'carExpenses')),
  };

  const storedGroups = worksheet.expenseGroups ?? {};
  const expenseGroups = {};

  for (const gKey of EXPENSE_GROUP_KEYS) {
    const canonical = CANONICAL_LINES[gKey];
    const stored = storedGroups[gKey]?.lineItems ?? [];
    const byId = new Map(stored.map((i) => [i.id, i]));

    // Canonical named lines, in canonical order, merging any stored values.
    const namedLines = canonical.map((spec) => {
      const prev = byId.get(spec.id);
      const base = {
        id: spec.id,
        label: spec.label,
        frequency: prev?.frequency ?? spec.frequency,
        amount: parseFloat(prev?.amount) || 0,
        annualizedAmount: 0,
        isCustom: false,
      };
      base.annualizedAmount = annualizeAmount(base.amount, base.frequency);

      if (!spec.calcKey) return base;

      // Calc-fed line. Respect an explicit override flag if present; otherwise a
      // legacy stored value (>0) is preserved as an override (no data loss).
      const explicitOverride = typeof prev?.isOverridden === 'boolean' ? prev.isOverridden : null;
      const hasLegacyValue = base.amount > 0;
      const isOverridden = explicitOverride !== null ? explicitOverride : hasLegacyValue;

      if (isOverridden) {
        return { ...base, calcKey: spec.calcKey, isOverridden: true };
      }
      const synced = calcFedValue(spec.calcKey, subCalculators);
      return {
        ...base,
        calcKey: spec.calcKey,
        isOverridden: false,
        amount: synced,
        frequency: 'A',
        annualizedAmount: synced,
      };
    });

    // Carry over agent-added custom lines (never calc-fed).
    const canonicalIds = new Set(canonical.map((c) => c.id));
    const customLines = stored
      .filter((i) => i.isCustom && !canonicalIds.has(i.id))
      .map((i) => {
        const amount = parseFloat(i.amount) || 0;
        return {
          id: i.id,
          label: i.label,
          frequency: i.frequency,
          amount,
          annualizedAmount: annualizeAmount(amount, i.frequency),
          isCustom: true,
        };
      });

    const lineItems = [...namedLines, ...customLines];
    expenseGroups[gKey] = {
      lineItems,
      subCalculatorRefs: [],
      groupAnnualTotal: computeGroupTotal({ lineItems }),
    };
  }

  const rollup = computeWorksheetRollup(expenseGroups);
  const renewalTotal = parseFloat(worksheet.estimatedRenewalIncome?.total) || 0;

  return {
    ...worksheet,
    subCalculators,
    expenseGroups,
    totalAnnualAfterTax: rollup.totalAnnualAfterTax,
    totalAnnualPreTax: rollup.totalAnnualPreTax,
    computedPAYE: rollup.computedPAYE,
    firstYearCommissionsRequired: Math.max(0, rollup.totalAnnualPreTax - renewalTotal),
  };
}

export async function createMoneyNeeds(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const existing = await getDoc(docRef);
  if (existing.exists()) return normalizeWorksheet({ id: existing.id, ...existing.data() });

  const payload = BLANK_SCAFFOLD(tenantId, uid, parsedYear);
  await setDoc(docRef, payload);
  return { id: String(parsedYear), ...payload };
}

export async function getMoneyNeeds(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) return null;

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return normalizeWorksheet({ id: snap.id, ...snap.data() });
}

export async function updateVisibility(tenantId, uid, year, visibility) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');
  if (visibility !== 'private' && visibility !== 'shared') throw new Error('Invalid visibility');
  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  await updateDoc(docRef, { visibility, updatedAt: serverTimestamp(), updatedBy: uid });
  return { visibility };
}
