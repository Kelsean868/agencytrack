/**
 * playgroundSettings — reads the Commission playground's saved assumptions
 * back out of the goals doc (R2-3b, ruling 3 of 29-09-2026: "load the saved
 * settings when the screen opens").
 *
 * `handleSaveAssumptions` writes these `playground*` keys (goalsService parses
 * the numbers; the period is allow-listed). This is the one place that maps
 * them back onto the playground's input keys. A key that is missing or not a
 * finite number is left out, so the caller's defaults stay for it.
 */
import { PLAYGROUND_PERIOD_KEYS, DEFAULT_INCOME_GOAL_PERIOD, playgroundPeriod } from './playgroundPeriods';

export const PLAYGROUND_SETTING_KEYS = Object.freeze({
  incomeGoal:      'playgroundIncomeGoal',
  taxRate:         'playgroundTaxRate',
  renewalIncome:   'playgroundRenewalIncome',
  settlementRate:  'playgroundSettlementRate',
  commissionRate:  'playgroundCommissionRate',
  avgPolicyAPI:    'playgroundAvgPolicyAPI',
  persistencyRate: 'playgroundPersistencyRate',
  ciToSaleRatio:   'playgroundCiToSaleRatio',
  dialsToCIRatio:  'playgroundDialsToCIRatio',
  prospectRatio:   'playgroundProspectRatio',
});

/**
 * @param {object|null} goals  the agent's goals doc (getGoals), or null
 * @returns {{ inputs: object, period: string, amount: number|null }}
 *   inputs — only the saved keys, as numbers (incomeGoal is ANNUAL);
 *   period — the saved income-goal period, or Annual when none / invalid;
 *   amount — the income goal as typed in that period (annual ÷ divisor), or null.
 */
export function savedPlaygroundSettings(goals) {
  const inputs = {};
  for (const [inputKey, docKey] of Object.entries(PLAYGROUND_SETTING_KEYS)) {
    const v = goals?.[docKey];
    if (typeof v === 'number' && Number.isFinite(v)) inputs[inputKey] = v;
  }
  const rawPeriod = goals?.playgroundIncomeGoalPeriod;
  const period = PLAYGROUND_PERIOD_KEYS.includes(rawPeriod) ? rawPeriod : DEFAULT_INCOME_GOAL_PERIOD;
  const amount = inputs.incomeGoal == null ? null : inputs.incomeGoal / playgroundPeriod(period).divisor;
  return { inputs, period, amount };
}
