import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepRail from '../StepRail';
import PlanCascade from '../PlanCascade';
import PlanAnchorStrip from '../PlanAnchorStrip';

// ── StepRail — Slice 3 ──────────────────────────────────────────────────────

describe('StepRail — flag OFF (no onOpenYearPlan)', () => {
  it('Step 2 shows Next/non-interactive state unchanged', () => {
    render(
      <StepRail
        moneyNeedsFilled={false}
        onOpenMoneyNeeds={() => {}}
        onOpenYearPlan={undefined}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('Next')).toBeInTheDocument();
    // 3 "Coming soon" subs: Step 2 (flag off) + Step 3 + Step 4
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
    // Step 2 card is aria-disabled (no onClick handler)
    expect(screen.getByText('Year Plan').closest('[aria-disabled="true"]')).toBeTruthy();
  });
});

describe('StepRail — flag ON, no plan', () => {
  it('Step 2 shows Start/current state and is clickable', () => {
    const onOpenYearPlan = vi.fn();
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        onOpenYearPlan={onOpenYearPlan}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Allocate API by line')).toBeInTheDocument();
    // Step 2 is a clickable button
    expect(screen.getByRole('button', { name: /year plan/i })).toBeInTheDocument();
  });
});

describe('StepRail — flag ON, saved plan', () => {
  it('Step 2 shows Done/settled state and remains clickable', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        onOpenYearPlan={() => {}}
        yearPlanFilled={true}
      />
    );
    // Both Step 1 and Step 2 show "Done" kicker
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.getByText('API allocated by line')).toBeInTheDocument();
    // Step 2 is still a button (clickable → opens modal)
    expect(screen.getByRole('button', { name: /year plan/i })).toBeInTheDocument();
  });
});

// ── PlanCascade — Slice 3 ───────────────────────────────────────────────────

describe('PlanCascade — flag OFF', () => {
  it('Year Plan and Monthly Plan both show Coming badge', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={false}
        yearPlanTotalAPI={0}
        yearPlanFilled={false}
      />
    );
    // Two ComingRungs rendered — Year Plan + Monthly Plan
    expect(screen.getAllByText('Coming')).toHaveLength(2);
  });
});

describe('PlanCascade — flag ON, no plan', () => {
  it('Year Plan live rung shows honest empty, Monthly Plan still Coming', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={0}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('Set in your plan')).toBeInTheDocument();
    expect(screen.getByText('Planned annual API')).toBeInTheDocument();
    // Only Monthly Plan ComingRung remains
    expect(screen.getAllByText('Coming')).toHaveLength(1);
  });
});

describe('PlanCascade — flag ON, saved plan', () => {
  it('Year Plan live rung shows plan total API, Monthly Plan still Coming', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={120000}
        yearPlanFilled={true}
      />
    );
    // Formatted plan total is rendered (TTD currency)
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    // Only Monthly Plan ComingRung
    expect(screen.getAllByText('Coming')).toHaveLength(1);
    // "Set in your plan" is NOT shown
    expect(screen.queryByText('Set in your plan')).not.toBeInTheDocument();
  });
});

// ── PlanAnchorStrip — completeness ──────────────────────────────────────────

describe('PlanAnchorStrip — completeness when Year Plan filled', () => {
  it('shows 50% with 2 of 4 steps built', () => {
    render(
      <PlanAnchorStrip
        year={2026}
        commissionNeed={50000}
        afterTaxNeed={80000}
        renewalsCover={10000}
        grossNeed={90000}
        apiCommitment={null}
        planBuiltPct={50}
        stepsBuilt={2}
        totalSteps={4}
        moneyNeedsFilled={true}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 steps')).toBeInTheDocument();
  });

  it('API Commitment chip stays on goals value — not the plan total', () => {
    render(
      <PlanAnchorStrip
        year={2026}
        commissionNeed={50000}
        afterTaxNeed={80000}
        renewalsCover={10000}
        grossNeed={90000}
        apiCommitment={null}
        planBuiltPct={50}
        stepsBuilt={2}
        totalSteps={4}
        moneyNeedsFilled={true}
      />
    );
    // Goals API unset → chip shows "—" and "Set in your plan" hint
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Set in your plan')).toBeInTheDocument();
  });
});
