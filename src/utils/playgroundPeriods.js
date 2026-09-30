/**
 * playgroundPeriods — the Commission Playground's period table (FR round 2, R2-3).
 *
 * ONE table serves two jobs, so they can never drift apart:
 *   1. the ladder's "View cadence" chips, which DIVIDE the annual figures for
 *      display (unchanged since Tier 3b), and
 *   2. the income-goal period select, which MULTIPLIES what the agent typed back
 *      up to the annual `incomeGoal` every reader already expects.
 *
 * The divisors are existing app policy, not new math: a 10-selling-month year
 * (monthly), WEEKLY_DIVISOR = 43 selling weeks and DAILY_DIVISOR = 258 selling
 * days (both derived in utils/goalDecomposition.js). The conversion happens at
 * the input edge only — the decomposition utilities never see a period.
 *
 * `goalsService.setGoals` uses PLAYGROUND_PERIOD_KEYS as the allowlist for the
 * persisted `playgroundIncomeGoalPeriod` string.
 */
import { WEEKLY_DIVISOR, DAILY_DIVISOR } from './goalDecomposition';
import { formatCurrency } from './formatters';

export const PLAYGROUND_PERIODS = Object.freeze([
  Object.freeze({ key: 'annual',    label: 'Annual',  display: 'Annual',  divisor: 1,              per: 'a year',      units: null }),
  Object.freeze({ key: 'semi',      label: 'Semi',    display: 'Semi',    divisor: 2,              per: 'a half-year', units: 'halves' }),
  Object.freeze({ key: 'quarterly', label: 'Quarter', display: 'Quarter', divisor: 4,              per: 'a quarter',   units: 'quarters' }),
  Object.freeze({ key: 'monthly',   label: 'Month',   display: 'Month',   divisor: 10,             per: 'a month',     units: 'selling months' }),
  Object.freeze({ key: 'weekly',    label: 'Week',    display: 'Week',    divisor: WEEKLY_DIVISOR, per: 'a week',      units: 'selling weeks' }),
  // §4.7 daily-cadence chip. DAILY_DIVISOR = 43 selling weeks × 6 selling days
  // = 258 (derivation + Rule 17 note live on the constant in goalDecomposition).
  Object.freeze({ key: 'daily',     label: 'Day',     display: 'Day',     divisor: DAILY_DIVISOR,  per: 'a day',       units: 'selling days' }),
]);

export const PLAYGROUND_PERIOD_KEYS = Object.freeze(PLAYGROUND_PERIODS.map((p) => p.key));

/** Default income-goal period. Saved assumptions / scenarios with no period load as this. */
export const DEFAULT_INCOME_GOAL_PERIOD = 'annual';

/**
 * Look up one period. An unknown key THROWS rather than falling back to
 * Annual — a silent fallback here would turn a monthly goal back into a
 * yearly one, which is the exact defect R2-3 fixes.
 */
export function playgroundPeriod(key) {
  const found = PLAYGROUND_PERIODS.find((p) => p.key === key);
  if (!found) throw new Error(`Unknown playground period: ${String(key)}`);
  return found;
}

/** What the agent typed, in `periodKey` units → the annual income goal. */
export function toAnnualIncomeGoal(amount, periodKey) {
  const n = parseFloat(amount);
  return (Number.isFinite(n) ? n : 0) * playgroundPeriod(periodKey).divisor;
}

/**
 * The conversion in words, shown under the income-goal field, e.g.
 * "TTD 50,000 a month × 10 selling months = TTD 500,000 a year".
 */
export function describeIncomeGoalConversion(amount, periodKey) {
  const period = playgroundPeriod(periodKey);
  const n = parseFloat(amount);
  const entered = Number.isFinite(n) ? n : 0;
  const annual = toAnnualIncomeGoal(entered, periodKey);
  if (period.divisor === 1) return `${formatCurrency(annual)} a year`;
  return `${formatCurrency(entered)} ${period.per} × ${period.divisor} ${period.units} = ${formatCurrency(annual)} a year`;
}
