import React, { useId } from 'react';
import {
  PLAYGROUND_PERIODS,
  describeIncomeGoalConversion,
} from '../../../../utils/playgroundPeriods';

/**
 * IncomeGoalField — the Commission Playground's income goal with its period
 * (FR round 2, R2-3). Presentational only: the parent owns the typed amount and
 * the period, and turns them into the annual `incomeGoal` with
 * toAnnualIncomeGoal(). No Firebase import, so the FR harness can render it.
 *
 * The conversion line states in words what the playground will use, e.g.
 * "TTD 50,000 a month × 10 selling months = TTD 500,000 a year".
 */
export default function IncomeGoalField({ amount, period, onAmountChange, onPeriodChange }) {
  const uid = useId();
  const amountId = `${uid}-amount`;
  const periodId = `${uid}-period`;
  const conversionId = `${uid}-conversion`;
  return (
    <div className="flex flex-col gap-1" data-testid="income-goal-field">
      <label htmlFor={amountId} className="text-xs text-ink-muted">Income Goal (TTD)</label>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 min-w-0 items-center min-h-11 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
          <span className="text-xs text-ink-muted pl-2 pr-1 shrink-0">TTD</span>
          <input
            id={amountId}
            type="number"
            min={0}
            step={period === 'annual' ? 5000 : 100}
            value={amount}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            className="flex-1 min-w-0 h-full min-h-11 px-2 text-sm text-ink focus:outline-none bg-transparent"
            aria-describedby={conversionId}
          />
        </div>
        <label htmlFor={periodId} className="sr-only">Goal period</label>
        <select
          id={periodId}
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="shrink-0 min-h-11 rounded-lg border border-border bg-card px-2 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="income-goal-period"
        >
          {PLAYGROUND_PERIODS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>
      <p
        id={conversionId}
        className="text-xs text-ink-muted tabular-nums"
        data-testid="income-goal-conversion"
      >
        {describeIncomeGoalConversion(amount, period)}
      </p>
    </div>
  );
}
