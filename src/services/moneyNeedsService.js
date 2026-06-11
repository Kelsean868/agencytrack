import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { computePAYE, grossFromNet, DEFAULT_PAYE_CONFIG } from '../utils/payeEngine';

export const PAYE_BRACKETS_VERSION = 'default-2026';

export const FREQUENCY_MULTIPLIERS = { A: 1, S: 2, Q: 4, M: 12 };

export const PLAYGROUND_INCOME_GOAL_KEY = 'agencytrack-playground-income-goal';

export function annualizeAmount(amount, frequency) {
  return (parseFloat(amount) || 0) * (FREQUENCY_MULTIPLIERS[frequency] ?? 12);
}

export function computeGroupTotal(group) {
  const lineTotal = (group.lineItems ?? []).reduce(
    (sum, item) => sum + (parseFloat(item.annualizedAmount) || 0), 0,
  );
  const subCalcTotal = (group.subCalculatorRefs ?? []).reduce(
    (sum, ref) => sum + (parseFloat(ref.annualTotal) || 0), 0,
  );
  return lineTotal + subCalcTotal;
}

export function computeWorksheetRollup(expenseGroups) {
  const totalAnnualAfterTax = Object.values(expenseGroups).reduce(
    (sum, g) => sum + (parseFloat(g.groupAnnualTotal) || 0), 0,
  );
  const totalAnnualPreTax = grossFromNet(totalAnnualAfterTax, DEFAULT_PAYE_CONFIG);
  const computedPAYE = computePAYE(totalAnnualPreTax, DEFAULT_PAYE_CONFIG);
  return { totalAnnualAfterTax, totalAnnualPreTax, computedPAYE };
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

export function mergeSubCalcRef(group, key, annualTotal) {
  const existing = (group.subCalculatorRefs ?? []).filter((r) => r.key !== key);
  const refs = annualTotal > 0 ? [...existing, { key, annualTotal }] : existing;
  const lineTotal = (group.lineItems ?? []).reduce(
    (sum, item) => sum + (parseFloat(item.annualizedAmount) || 0), 0,
  );
  const subCalcTotal = refs.reduce((sum, r) => sum + (parseFloat(r.annualTotal) || 0), 0);
  return { ...group, subCalculatorRefs: refs, groupAnnualTotal: lineTotal + subCalcTotal };
}

export async function updateSubCalculator(tenantId, uid, year, calcKey, calcData, worksheetDoc) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const currentGroups = { ...(worksheetDoc.expenseGroups ?? {}) };
  const updatedGroups = {};
  const patch = { [`subCalculators.${calcKey}`]: calcData };

  if (calcKey === 'insuranceIndustry') {
    const updated = mergeSubCalcRef(currentGroups.businessExpenses ?? {}, 'insuranceIndustry', calcData.annualTotal ?? 0);
    updatedGroups.businessExpenses = updated;
    patch['expenseGroups.businessExpenses'] = updated;
  } else if (calcKey === 'carExpenses') {
    const personal = mergeSubCalcRef(currentGroups.livingExpenses ?? {}, 'carExpenses', calcData.annualTotalPersonal ?? 0);
    const business = mergeSubCalcRef(currentGroups.businessExpenses ?? {}, 'carExpenses', calcData.annualTotalBusiness ?? 0);
    updatedGroups.livingExpenses = personal;
    updatedGroups.businessExpenses = business;
    patch['expenseGroups.livingExpenses'] = personal;
    patch['expenseGroups.businessExpenses'] = business;
  }
  // LoansDebt: no group roll-in

  const mergedGroups = { ...currentGroups, ...updatedGroups };
  const rollup = computeWorksheetRollup(mergedGroups);

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

function seedItem(id, label, frequency) {
  return { id, label, amount: 0, frequency, annualizedAmount: 0, isCustom: false };
}

const DEFAULT_MONEY_NEEDS_CATEGORIES = {
  expenseGroups: {
    fixedExpenses: [
      seedItem('seed-fe-0', 'Rent or mortgage payments', 'A'),
      seedItem('seed-fe-1', 'Utilities – gas, heat, light, telephone, water', 'M'),
      seedItem('seed-fe-2', 'Disability income insurance', 'M'),
      seedItem('seed-fe-3', 'Homeowners insurance', 'M'),
      seedItem('seed-fe-4', 'Car insurance', 'A'),
      seedItem('seed-fe-5', 'Property taxes', 'A'),
      seedItem('seed-fe-6', 'Other', 'M'),
    ],
    livingExpenses: [
      seedItem('seed-le-0', 'Food', 'M'),
      seedItem('seed-le-1', 'Clothing', 'M'),
      seedItem('seed-le-2', 'Laundry, tailoring', 'M'),
      seedItem('seed-le-3', 'Entertainment', 'M'),
      seedItem('seed-le-4', 'Car expenses, nonbusiness', 'M'),
      seedItem('seed-le-5', 'Medical – doctor, dentist, drugs', 'M'),
      seedItem('seed-le-6', 'Household', 'M'),
      seedItem('seed-le-7', 'Other', 'M'),
    ],
    businessExpenses: [
      seedItem('seed-be-0', 'Sales promotion, advertising, direct mail, tuition', 'M'),
      seedItem('seed-be-1', 'Trade association dues, services, events', 'M'),
      seedItem('seed-be-2', 'Telephone, computer, stationery, postage, supplies', 'M'),
      seedItem('seed-be-3', 'Secretarial and banking services', 'M'),
      seedItem('seed-be-4', 'Business travel, car expense', 'M'),
      seedItem('seed-be-5', 'Business entertainment', 'M'),
      seedItem('seed-be-6', 'Other', 'M'),
    ],
    savingsAccumulation: [
      seedItem('seed-sa-0', 'Life insurance', 'M'),
      seedItem('seed-sa-1', 'Savings account', 'M'),
      seedItem('seed-sa-2', 'Debt reduction (other than mortgage)', 'M'),
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
      seedItem('seed-ce-7', 'Vehicle Loan', 'M'),
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

const EXPENSE_GROUP_SCAFFOLD = (items = []) => ({
  lineItems: [...items],
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
      lineItems: [...DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.insuranceIndustry],
      annualTotal: 0,
    },
    carExpenses: {
      lineItems: [...DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.carExpenses],
      withLoan: false,
      personalSharePct: 33,
      businessSharePct: 67,
      annualTotalPersonal: 0,
      annualTotalBusiness: 0,
    },
    loansDebt: {
      lineItems: [...DEFAULT_MONEY_NEEDS_CATEGORIES.subCalculators.loansDebt],
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

export async function createMoneyNeeds(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  const existing = await getDoc(docRef);
  if (existing.exists()) return { id: existing.id, ...existing.data() };

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
  return { id: snap.id, ...snap.data() };
}

export async function updateVisibility(tenantId, uid, year, visibility) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) throw new Error('Invalid year');
  if (visibility !== 'private' && visibility !== 'shared') throw new Error('Invalid visibility');
  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'moneyNeeds', String(parsedYear));
  await updateDoc(docRef, { visibility, updatedAt: serverTimestamp(), updatedBy: uid });
  return { visibility };
}
