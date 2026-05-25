import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { computePAYE, grossFromNet, DEFAULT_PAYE_CONFIG } from '../utils/payeEngine';

export const PAYE_BRACKETS_VERSION = 'default-2026';

export const FREQUENCY_MULTIPLIERS = { A: 1, S: 2, Q: 4, M: 12 };

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
