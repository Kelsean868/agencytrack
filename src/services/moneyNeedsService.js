import { db } from '../firebase';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';

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
