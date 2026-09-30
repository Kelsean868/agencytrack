/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useEffect, useMemo, useState } from 'react';
import FrCommissionView from '../../money/FrCommissionView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { decomposeFromIncome, DEFAULT_DECOMPOSITION_INPUTS } from '../../../../utils/goalDecomposition';
import { toAnnualIncomeGoal } from '../../../../utils/playgroundPeriods';
import { reverseCalc, modeBreakdown } from '../../../goals/CommissionPlayground/utils/commissionMath';
import { buildInsights } from '../../../goals/CommissionPlayground/utils/insights';

/**
 * R2-7 harness scenes: the FR Commission playground (canvas D3M-Commission /
 * M3-Commission). The View is pure; the real app feeds it from
 * useGoalDecomposition / useModalTargeting, which read Firebase, so here the
 * same pure math (decomposeFromIncome, reverseCalc, modeBreakdown,
 * buildInsights) runs on SAMPLE inputs held in local state. Saves are no-ops.
 *
 * The target scene has an A/B data switch (a larger target and a mixed payment
 * split) so its bars glide. The goal scene has none: its canvas table has no
 * motion to probe.
 */

function useLayout() {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  return !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
}

const GOAL_B = { taxRate: 20, renewalIncome: 15000, settlementRate: 80, commissionRate: 40, avgPolicyAPI: 9000, persistencyRate: 85, ciToSaleRatio: 3, dialsToCIRatio: 4, prospectRatio: 1.5 };
const SCENARIOS = [
  { id: 'sc-1', label: 'Christmas push', savedAt: '2026-09-01T00:00:00.000Z', freqKey: 'weekly', inputs: {} },
  { id: 'sc-2', label: 'MDRT year', savedAt: '2026-09-02T00:00:00.000Z', freqKey: 'annual', inputs: {} },
];

function Frame({ children }) {
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-3 p-4 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">R2-7 · Commission playground · SAMPLE</p>
      {children}
    </main>
  );
}

function CommissionScene({ variant, initialTab = 'goal' }) {
  const layout = useLayout();
  const [tab, setTab] = useState(initialTab);
  const b = variant === 'B';
  const [incomeAmount, setIncomeAmount] = useState(b ? 25000 : 300000);
  const [incomePeriod, setIncomePeriod] = useState(b ? 'monthly' : 'annual');
  const [ratios, setRatios] = useState(b ? { ...DEFAULT_DECOMPOSITION_INPUTS, ...GOAL_B } : { ...DEFAULT_DECOMPOSITION_INPUTS });
  const [freqKey, setFreqKey] = useState(b ? 'monthly' : 'annual');
  const [target, setTarget] = useState(b ? 8000 : 5000);
  const [rate, setRate] = useState(b ? 40 : 35);
  const [modeMix, setModeMix] = useState(b ? { annual: 0.4, semiAnnual: 0, quarterly: 0.2, monthly: 0.4 } : { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 });
  const noop = () => {};
  // The harness "Change data" button flips `variant`; follow it so the
  // figures and bars change in place (and glide).
  useEffect(() => {
    setIncomeAmount(b ? 25000 : 300000);
    setIncomePeriod(b ? 'monthly' : 'annual');
    setRatios(b ? { ...DEFAULT_DECOMPOSITION_INPUTS, ...GOAL_B } : { ...DEFAULT_DECOMPOSITION_INPUTS });
    setFreqKey(b ? 'monthly' : 'annual');
    setTarget(b ? 8000 : 5000);
    setRate(b ? 40 : 35);
    setModeMix(b ? { annual: 0.4, semiAnnual: 0, quarterly: 0.2, monthly: 0.4 } : { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 });
  }, [b]);

  const inputs = useMemo(() => ({ ...ratios, incomeGoal: toAnnualIncomeGoal(incomeAmount, incomePeriod) }), [ratios, incomeAmount, incomePeriod]);
  const computed = useMemo(() => decomposeFromIncome({ ...inputs, preTaxAlreadyApplied: false }), [inputs]);
  const totalApi = reverseCalc({ targetCommission: target, modeMix, commissionRate: rate });

  const goal = {
    inputs, computed, freqKey, setFreqKey, preTaxAlreadyApplied: false,
    incomeAmount, incomePeriod,
    handleIncomeAmountChange: setIncomeAmount, handleIncomePeriodChange: setIncomePeriod,
    setField: (key) => (value) => setRatios((prev) => ({ ...prev, [key]: value })),
    hasHistory: b, fromHistory: () => b, historyWeeks: 12,
    scenarios: SCENARIOS, scenarioSaving: false, activeScenarioId: b ? 'sc-1' : null,
    handleScenarioApply: noop, handleScenarioSave: noop, handleScenarioDelete: noop,
    currentGoal: 250000, showConfirm: false, setShowConfirm: noop, saving: false,
    savedGoals: false, savedAssumptions: false, error: '',
    handleRequestConfirm: noop, handleConfirmWrite: noop, handleSaveAssumptions: noop,
  };
  const modal = {
    targetCommission: target, setTargetCommission: setTarget, commissionRate: rate, setCommissionRate: setRate,
    modeMix, setModeMix, totalApi,
    breakdown: modeBreakdown({ totalApi, modeMix, commissionRate: rate }),
    insights: totalApi > 0 ? buildInsights({ totalApi, modeMix, commissionRate: rate, targetCommission: target }) : [],
  };
  return (
    <Frame>
      <FrCommissionView layout={layout} tab={tab} onTabChange={setTab} goal={goal} modal={modal} />
    </Frame>
  );
}

function TargetScene({ variant }) {
  return <CommissionScene variant={variant} initialTab="modal" />;
}

export const COMMISSION_SCENES = [
  { id: 'money-commission-goal', title: 'Money · Commission (goal decomposition)', slice: 'R2-7', viewport: 'desktop,tablet,phone', pager: true, render: CommissionScene },
  { id: 'money-commission-target', title: "Money · Commission (this month's target)", slice: 'R2-7', viewport: 'desktop,tablet,phone', hasVariants: true, pager: true, render: TargetScene },
];
