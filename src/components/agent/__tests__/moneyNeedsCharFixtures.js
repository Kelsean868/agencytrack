// Shared fixtures for the Money needs characterization suite (R2-9 commit 1).
// A realistic, internally consistent worksheet: every stored group total and
// rollup figure is what the services would have written for these lines, so
// the pinned outputs are the ones an agent actually sees today.

export const YEAR = new Date().getFullYear();
export const TENANT = 'test-tenant';
export const UID = 'agent1';

const line = (id, label, amount, frequency, extra = {}) => ({
  id,
  label,
  amount,
  frequency,
  annualizedAmount: amount * ({ A: 1, S: 2, Q: 4, M: 12 }[frequency]),
  ...extra,
});

const calc = (id, label, calcKey, amount, isOverridden = false) =>
  line(id, label, amount, 'A', { calcKey, isOverridden });

export function makeWorksheet(overrides = {}) {
  return {
    year: YEAR,
    visibility: 'private',
    payeBracketsVersionId: 'default-2026',
    // 64,200 + 31,198 + 11,902 + 5,400 + 2,400
    totalAnnualAfterTax: 115100,
    // grossFromNet(115,100): 90,000 + 25,100 / 0.75
    totalAnnualPreTax: 123466.66666666667,
    computedPAYE: 8366.666666666672,
    estimatedRenewalIncome: { total: 10000 },
    firstYearCommissionsTargets: { life: 60000, ah: 20000, property: 0, motor: 0 },
    expenseGroups: {
      fixedExpenses: {
        lineItems: [
          line('seed-fe-0', 'Rent or mortgage payments', 54000, 'A'),
          line('seed-fe-1', 'Utilities – gas, heat, light, telephone, water', 850, 'M'),
        ],
        subCalculatorRefs: [],
        groupAnnualTotal: 64200,
      },
      livingExpenses: {
        lineItems: [
          line('seed-le-0', 'Food', 2400, 'M'),
          calc('seed-le-4', 'Car expenses, nonbusiness', 'carExpenses.personal', 2398),
        ],
        subCalculatorRefs: [],
        groupAnnualTotal: 31198,
      },
      businessExpenses: {
        lineItems: [
          line('seed-be-0', 'Sales promotion, advertising, direct mail, tuition', 300, 'M'),
          calc('seed-be-4', 'Business car expenses', 'carExpenses.business', 4802),
          calc('seed-be-7', 'Professional/industry expenses', 'insuranceIndustry', 3500),
        ],
        subCalculatorRefs: [],
        groupAnnualTotal: 11902,
      },
      savingsAccumulation: {
        lineItems: [
          line('seed-sa-0', 'Life insurance', 350, 'M'),
          calc('seed-sa-2', 'Debt reduction (non-mortgage)', 'loansDebt', 1200, true),
        ],
        subCalculatorRefs: [],
        groupAnnualTotal: 5400,
      },
      miscellaneous: {
        lineItems: [
          line('seed-mi-0', 'Donations – religious, charitable, etc.', 200, 'M'),
          line('seed-mi-2', 'Club dues', 0, 'M'),
        ],
        subCalculatorRefs: [],
        groupAnnualTotal: 2400,
      },
    },
    subCalculators: {
      insuranceIndustry: {
        lineItems: [
          line('seed-ii-0', 'Life License Renewal', 500, 'A'),
          line('seed-ii-4', 'CPD classes', 3000, 'A'),
        ],
        annualTotal: 3500,
      },
      carExpenses: {
        lineItems: [line('seed-ce-0', 'Gas/Petrol/Electric', 600, 'M')],
        withLoan: false,
        personalSharePct: 33.3,
        businessSharePct: 66.7,
        annualTotalPersonal: 2398,
        annualTotalBusiness: 4802,
      },
      loansDebt: {
        lineItems: [line('seed-ld-1', 'Car Loan', 150, 'M')],
        annualTotal: 1800,
      },
    },
    ...overrides,
  };
}

// The rollup the service would return after a group save (values not asserted
// by the panel beyond being merged in; kept stable so figures stay pinned).
export const ROLLUP = {
  totalAnnualAfterTax: 115100,
  totalAnnualPreTax: 123466.66666666667,
  computedPAYE: 8366.666666666672,
};
