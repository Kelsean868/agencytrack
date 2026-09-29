import { describe, it, expect } from 'vitest';
import {
  PLAYGROUND_PERIODS,
  PLAYGROUND_PERIOD_KEYS,
  DEFAULT_INCOME_GOAL_PERIOD,
  playgroundPeriod,
  toAnnualIncomeGoal,
  describeIncomeGoalConversion,
} from '../playgroundPeriods';
import { WEEKLY_DIVISOR, DAILY_DIVISOR } from '../goalDecomposition';

// FR round 2 R2-3 — the Commission Playground period table and the input-edge
// conversion (typed amount in a period → the annual income goal).
describe('playgroundPeriods', () => {
  it('keeps the existing divisors: 1 / 2 / 4 / 10 selling months / 43 weeks / 258 days', () => {
    expect(PLAYGROUND_PERIODS.map((p) => [p.key, p.divisor])).toEqual([
      ['annual', 1], ['semi', 2], ['quarterly', 4], ['monthly', 10],
      ['weekly', WEEKLY_DIVISOR], ['daily', DAILY_DIVISOR],
    ]);
    expect(WEEKLY_DIVISOR).toBe(43);
    expect(DAILY_DIVISOR).toBe(258);
    expect(PLAYGROUND_PERIOD_KEYS).toEqual(['annual', 'semi', 'quarterly', 'monthly', 'weekly', 'daily']);
    expect(DEFAULT_INCOME_GOAL_PERIOD).toBe('annual');
  });

  it.each([
    [50000, 'monthly', 500000],
    [1000, 'weekly', 43000],
    [200, 'daily', 51600],
    [75000, 'quarterly', 300000],
    [150000, 'semi', 300000],
    [300000, 'annual', 300000],
  ])('%d %s → %d a year, and dividing back gives the typed amount', (amount, key, annual) => {
    expect(toAnnualIncomeGoal(amount, key)).toBe(annual);
    expect(annual / playgroundPeriod(key).divisor).toBe(amount);
  });

  it('an unknown period throws — never a silent fallback to Annual', () => {
    expect(() => playgroundPeriod('fortnightly')).toThrow(/unknown playground period/i);
    expect(() => toAnnualIncomeGoal(1000, undefined)).toThrow();
  });

  it('non-numeric amounts count as 0', () => {
    expect(toAnnualIncomeGoal('', 'monthly')).toBe(0);
    expect(toAnnualIncomeGoal(undefined, 'weekly')).toBe(0);
  });

  it('states the conversion in words', () => {
    expect(describeIncomeGoalConversion(50000, 'monthly'))
      .toBe('TTD 50,000 a month × 10 selling months = TTD 500,000 a year');
    expect(describeIncomeGoalConversion(75000, 'quarterly'))
      .toBe('TTD 75,000 a quarter × 4 quarters = TTD 300,000 a year');
    expect(describeIncomeGoalConversion(150000, 'semi'))
      .toBe('TTD 150,000 a half-year × 2 halves = TTD 300,000 a year');
    expect(describeIncomeGoalConversion(300000, 'annual')).toBe('TTD 300,000 a year');
  });
});
