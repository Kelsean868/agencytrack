/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useState } from 'react';
import IncomeGoalField from '../../../goals/CommissionPlayground/components/IncomeGoalField';

/**
 * R2-3 harness scene: the Commission Playground's income goal with its period
 * select and the conversion line. The playground itself is a Nexus-look
 * component that imports Firebase services, so only the presentational field
 * is rendered here — one live field plus one row per period so every
 * conversion sentence is on the page. SAMPLE figures only.
 */
function Field({ initialAmount, initialPeriod }) {
  const [amount, setAmount] = useState(initialAmount);
  const [period, setPeriod] = useState(initialPeriod);
  return (
    <IncomeGoalField amount={amount} period={period} onAmountChange={setAmount} onPeriodChange={setPeriod} />
  );
}

const ROWS = [
  { amount: 300000, period: 'annual' },
  { amount: 150000, period: 'semi' },
  { amount: 75000, period: 'quarterly' },
  { amount: 50000, period: 'monthly' },
  { amount: 1000, period: 'weekly' },
  { amount: 200, period: 'daily' },
];

function IncomeGoalPeriodScene() {
  return (
    <ScenePage className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">R2-3 · Commission playground · SAMPLE</p>
      <section className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Income Assumptions</p>
        <div className="sm:max-w-md">
          <Field initialAmount={50000} initialPeriod="monthly" />
        </div>
      </section>
      <section className="card flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Every period</p>
        {ROWS.map((r) => (
          <div key={r.period} className="sm:max-w-md">
            <Field initialAmount={r.amount} initialPeriod={r.period} />
          </div>
        ))}
      </section>
    </ScenePage>
  );
}

export const PLAYGROUND_SCENES = [
  { id: 'income-goal-period', title: 'Money · Commission playground income goal period', slice: 'R2-3', viewport: 'desktop,tablet,phone', render: IncomeGoalPeriodScene },
];
