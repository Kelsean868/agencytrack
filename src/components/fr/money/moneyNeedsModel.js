import { formatCurrency } from '../../../utils/formatters';
import { DEFAULT_PAYE_CONFIG } from '../../../utils/payeEngine';
import { FREQUENCY_OPTIONS } from '../../agent/moneyNeedsShared';

/**
 * moneyNeedsModel — PURE formatting for the FR Money needs port (R2-9,
 * canvas D3M-MoneyNeeds / M3-MoneyNeeds).
 *
 * It FORMATS values the Money needs panel already computes — it does not
 * compute money. Every figure arrives already derived:
 *   - the build-up from payeBuildUp() (the same function PAYESummary prints),
 *   - group totals / filled counts / row yearly figures from
 *     useExpenseGroupEditor + annualizeAmount (the Nexus accordion's code),
 *   - composition shares from compositionSegments() (the Nexus chips' helper),
 *   - sub-calculator totals from the stored worksheet.subCalculators.
 * The only arithmetic here is presentational: picking the biggest segment and
 * counting filled lines (same predicate the panel uses: amount > 0).
 */

/** The four frequencies as short segmented buttons (M / Q / S / A). */
export const FR_FREQUENCIES = ['M', 'Q', 'S', 'A'].map((value) => {
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === value);
  if (!opt) throw new Error(`moneyNeedsModel: unknown frequency ${value}`);
  return { value, short: value, label: opt.label };
});

/** Short group names for the phone pager chips. */
export const GROUP_SHORT = Object.freeze({
  fixedExpenses: 'Fixed',
  livingExpenses: 'Living',
  businessExpenses: 'Business',
  savingsAccumulation: 'Savings',
  miscellaneous: 'Misc',
});

/** Short name for a group key; throws in development when one is missing. */
export function groupShort(key, label) {
  const short = GROUP_SHORT[key];
  if (!short) {
    if (import.meta.env.DEV) throw new Error(`moneyNeedsModel: no short name for group "${key}"`);
    return label;
  }
  return short;
}

const pct = (rate) => `${Math.round(rate * 100)}%`;

/** "Why?" copy for the PAYE row, written from the live bracket config. */
export function payeWhy(config = DEFAULT_PAYE_CONFIG) {
  const parts = [`Personal allowance ${formatCurrency(config.personalAllowance)}, tax-free.`];
  const brackets = config.chargeableBrackets ?? [];
  const bands = brackets.map((b, i) => {
    if (b.upToChargeable == null) return `${pct(b.rate)} above that`;
    if (i === 0) return `${pct(b.rate)} on the next ${formatCurrency(b.upToChargeable)} of chargeable income`;
    return `${pct(b.rate)} up to ${formatCurrency(b.upToChargeable)} of chargeable income`;
  });
  if (bands.length) parts.push(`${bands.join(', ')}.`);
  return parts.join(' ');
}

/**
 * The inspector ladder ("What you need to earn") from payeBuildUp().
 * @param {{ totalAnnualAfterTax:number, totalAnnualPreTax:number, payeGrossUp:number,
 *           renewals:number, commissionsRequired:number }} b
 */
export function moneyNeedsLadder(b) {
  const empty = !b || (b.totalAnnualAfterTax === 0 && b.totalAnnualPreTax === 0);
  if (empty) return { empty: true, rows: [] };
  const rows = [
    { id: 'afterTax', label: 'Total annual needs · after tax', value: formatCurrency(b.totalAnnualAfterTax) },
    { id: 'paye', label: 'PAYE (grossed up)', value: `+ ${formatCurrency(b.payeGrossUp)}`, why: payeWhy() },
    { id: 'preTax', label: 'Total annual needs · pre-tax (= income you must earn)', value: formatCurrency(b.totalAnnualPreTax) },
  ];
  if (b.renewals > 0) {
    rows.push({ id: 'renewals', label: 'Renewal income', value: `− ${formatCurrency(b.renewals)}` });
  }
  rows.push({
    id: 'commission',
    label: '1st-year commissions required',
    value: formatCurrency(b.commissionsRequired),
    note: b.renewals === 0 ? 'all of it — no renewal income yet' : null,
    hero: true,
  });
  return { empty: false, rows };
}

/**
 * "Where the money goes" from compositionSegments() output.
 * @param {{ segments: Array<{key,label,total,pct}>, total:number }} comp
 */
export function moneyNeedsDonut(comp) {
  const segments = comp?.segments ?? [];
  if (!segments.length || !(comp.total > 0)) return null;
  const biggest = segments.reduce((a, s) => (s.pct > a.pct ? s : a), segments[0]);
  return {
    title: `${biggest.label} is your biggest group — ${Math.round(biggest.pct)}% of the year`,
    totalLabel: formatCurrency(comp.total),
    parts: segments.map((s) => ({ key: s.key, label: s.label, value: s.total })),
    table: {
      caption: 'Yearly expenses by group and their share',
      columns: [
        { key: 'group', label: 'Group' },
        { key: 'yearly', label: 'Yearly', align: 'right' },
        { key: 'share', label: 'Share', align: 'right' },
      ],
      rows: segments.map((s) => ({
        key: s.key, group: s.label, yearly: formatCurrency(s.total), share: `${Math.round(s.pct)}%`,
      })),
    },
  };
}

const filledOf = (items) => ({
  filled: (items ?? []).filter((i) => (parseFloat(i?.amount) || 0) > 0).length,
  total: (items ?? []).length,
});

/**
 * The three sub-calculator summary cards, from the stored sub-calculators.
 * @param {object} subCalculators  worksheet.subCalculators
 * @param {{ personalPct:number, businessPct:number }} split  CAR_PERSONAL_PCT / CAR_BUSINESS_PCT
 */
export function moneyNeedsSubCalcs(subCalculators, split) {
  const sc = subCalculators ?? {};
  const ii = sc.insuranceIndustry ?? {};
  const car = sc.carExpenses ?? {};
  const ld = sc.loansDebt ?? {};
  return [
    {
      key: 'insuranceIndustry',
      title: 'Insurance Industry',
      ...filledOf(ii.lineItems),
      value: formatCurrency(ii.annualTotal ?? 0),
      feeds: 'a year · feeds Business Expenses · Professional/industry expenses',
    },
    {
      key: 'carExpenses',
      title: 'Car Expenses',
      ...filledOf(car.lineItems),
      split: [
        { key: 'personal', label: `Personal · ${split.personalPct}%`, value: formatCurrency(car.annualTotalPersonal ?? 0) },
        { key: 'business', label: `Business · ${split.businessPct}%`, value: formatCurrency(car.annualTotalBusiness ?? 0) },
      ],
      feeds: 'a year · splits to Living + Business Expenses',
    },
    {
      key: 'loansDebt',
      title: 'Loans & Debt',
      ...filledOf(ld.lineItems),
      value: formatCurrency(ld.annualTotal ?? 0),
      feeds: 'a year · feeds Savings & Accumulation · Debt reduction',
    },
  ];
}

/**
 * One worksheet row for the view. `annual` is annualizeAmount(amount, frequency)
 * — the value the Nexus row prints — computed by the container.
 */
export function moneyNeedsRow(item, annual) {
  const calcFed = Boolean(item.calcKey);
  return {
    id: item.id,
    label: item.label ?? '',
    amount: item.amount === 0 ? '' : item.amount,
    frequency: item.frequency,
    yearly: formatCurrency(annual),
    calcFed,
    calcId: calcFed ? item.calcKey.split('.')[0] : null,
    overridden: Boolean(item.isOverridden),
    filled: (parseFloat(item.amount) || 0) > 0,
  };
}

/** Group header strings. */
export function moneyNeedsGroupHeader({ filledCount, count, total }) {
  return { filledLabel: `${filledCount} of ${count} filled`, subtotal: formatCurrency(total) };
}
