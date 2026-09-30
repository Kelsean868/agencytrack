import { formatCurrency } from '../../../utils/formatters';
import { FIRST_PAYMENT_RATIO } from '../../goals/CommissionPlayground/utils/commissionMath';
import { buildStackedData } from '../../goals/CommissionPlayground/utils/cashFlowStacking';
import { ladderFigures, formatLadderFigure } from '../../goals/CommissionPlayground/utils/decompositionStages';
import { PLAYGROUND_PERIODS } from '../../../utils/playgroundPeriods';

/**
 * commissionModel — pure formatters for the FR Commission playground (R2-7,
 * canvas D3M-Commission / M3-Commission). Every figure comes from a function
 * the Nexus playground already uses (ladderFigures / formatLadderFigure,
 * modeBreakdown rows, FIRST_PAYMENT_RATIO, buildStackedData, buildInsights);
 * this file only shapes them for the FR view. No new money math.
 */

export const MODE_LABELS = Object.freeze({
  annual: 'Annual',
  semiAnnual: 'Semi-Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
});

function modeLabel(mode) {
  const label = MODE_LABELS[mode];
  if (!label) throw new Error(`commissionModel: unknown payment mode "${mode}"`);
  return label;
}

/**
 * The view cadence for `freqKey`. A saved scenario may carry a key that is not
 * (or no longer) a playground period; the Nexus ladder shows such a key as
 * Annual (`PERIODS.find(...) ?? PERIODS[0]`), so the FR table does the same
 * instead of throwing — and says so in development (v3 rule 11).
 */
export function cadenceFor(freqKey) {
  const found = PLAYGROUND_PERIODS.find((p) => p.key === freqKey);
  if (!found && import.meta.env?.DEV) console.warn(`commissionModel: unknown view cadence "${freqKey}" — showing Annual`);
  return found ?? PLAYGROUND_PERIODS[0];
}

/**
 * The decomposition table: one row per ladder stage, the annual figure and
 * the figure for the chosen view cadence (null when the cadence is Annual).
 */
export function goalTableRows({ computed, inputs, preTaxAlreadyApplied, freqKey }) {
  const period = cadenceFor(freqKey);
  return ladderFigures({ computed, inputs, preTaxAlreadyApplied }).map((figure) => ({
    key: figure.key,
    label: figure.label,
    kind: figure.kind,
    year: formatLadderFigure(figure, 1),
    period: period.divisor === 1 ? null : formatLadderFigure(figure, period.divisor),
  }));
}

/** The Modal Targeting headline, rounded exactly as the Nexus tab rounds it. */
export function requiredApiText(totalApi) {
  return totalApi > 0 ? formatCurrency(Math.round(totalApi / 100) * 100) : '—';
}

/** Breakdown rows, formatted exactly as CommissionBreakdownTable formats them. */
export function breakdownRows(breakdown) {
  return breakdown.map((row) => ({
    key: row.mode,
    mode: modeLabel(row.mode),
    mix: `${Math.round(row.weight * 100)}%`,
    api: formatCurrency(Math.round(row.modeApi / 10) * 10),
    commission: formatCurrency(Math.round(row.commission)),
  }));
}

/** First-payment share of each mode (the Tatil modal ratios), as bars. */
export function firstPaymentBars() {
  return Object.entries(FIRST_PAYMENT_RATIO).map(([mode, ratio]) => ({
    key: mode,
    label: modeLabel(mode),
    value: Math.round(ratio * 1000) / 10,
    highlight: true, // four bars: every one carries its value label
  }));
}

/**
 * The 12-month cash flow from buildStackedData (the same rows the Nexus
 * chart plots): one bar per month (the four modes together) and the table.
 */
export function cashFlowModel({ totalApi, modeMix, commissionRate }) {
  const rows = buildStackedData(totalApi, modeMix, commissionRate).map((r) => ({
    key: r.name,
    month: r.name,
    annual: r.annual,
    semiAnnual: r.semiAnnual,
    quarterly: r.quarterly,
    monthly: r.monthly,
    total: r.annual + r.semiAnnual + r.quarterly + r.monthly,
    cumulative: r.cumulative,
  }));
  return {
    // Month 1 is "this month" — it carries a value label (Columns also labels the last bar).
    bars: rows.map((r, i) => ({ key: r.key, label: r.month, value: r.total, highlight: i === 0 })),
    rows,
    yearTotal: rows.length ? rows[rows.length - 1].cumulative : 0,
  };
}

export const CASH_TABLE_COLUMNS = Object.freeze([
  { key: 'month', label: 'Month', align: 'left' },
  { key: 'annual', label: 'Annual', format: (v) => formatCurrency(v) },
  { key: 'semiAnnual', label: 'Semi', format: (v) => formatCurrency(v) },
  { key: 'quarterly', label: 'Quarterly', format: (v) => formatCurrency(v) },
  { key: 'monthly', label: 'Monthly', format: (v) => formatCurrency(v) },
  { key: 'total', label: 'Total', format: (v) => formatCurrency(v) },
  { key: 'cumulative', label: 'Cumulative', format: (v) => formatCurrency(v) },
]);
