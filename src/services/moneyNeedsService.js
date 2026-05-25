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

const EXPENSE_GROUP_SCAFFOLD = () => ({ lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 });

const BLANK_SCAFFOLD = (tenantId, uid, year) => ({
  year,
  productLines: [],

  expenseGroups: {
    fixedExpenses:       EXPENSE_GROUP_SCAFFOLD(),
    livingExpenses:      EXPENSE_GROUP_SCAFFOLD(),
    businessExpenses:    EXPENSE_GROUP_SCAFFOLD(),
    savingsAccumulation: EXPENSE_GROUP_SCAFFOLD(),
    miscellaneous:       EXPENSE_GROUP_SCAFFOLD(),
  },

  subCalculators: {
    insuranceIndustry: { lineItems: [], annualTotal: 0 },
    carExpenses: {
      lineItems: [], withLoan: false,
      personalSharePct: 33, businessSharePct: 67,
      annualTotalPersonal: 0, annualTotalBusiness: 0,
    },
    loansDebt: { lineItems: [], annualTotal: 0 },
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
