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
  it('Year Plan and Monthly Plan both show honest empty live rungs, no Coming badges', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={0}
        yearPlanFilled={false}
      />
    );
    // Both live rungs show "Set in your plan" when neither plan is filled
    expect(screen.getAllByText('Set in your plan')).toHaveLength(2);
    expect(screen.getByText('Planned annual API')).toBeInTheDocument();
    // No ComingRung badges — both Step 2 and Step 3 are live rungs
    expect(screen.queryByText('Coming')).not.toBeInTheDocument();
  });
});

describe('PlanCascade — flag ON, year plan saved, no monthly plan', () => {
  it('Year Plan shows total, Monthly rung shows honest empty, no Coming badges', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={120000}
        yearPlanFilled={true}
      />
    );
    // Year plan total is rendered (TTD currency)
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    // Monthly live rung shows honest empty
    expect(screen.getByText('Set in your plan')).toBeInTheDocument();
    // No ComingRung badges — both Step 2 and Step 3 are live rungs
    expect(screen.queryByText('Coming')).not.toBeInTheDocument();
  });
});

// ── StepRail — Step 3 live status (Slice 3) ────────────────────────────────

describe('StepRail — Step 3 done when monthlyPlanFilled', () => {
  it('shows Done kicker for Step 3 when year and monthly plans both filled', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        onOpenYearPlan={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={true}
      />
    );
    // Steps 1, 2, and 3 all Done
    expect(screen.getAllByText('Done')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /monthly plan/i })).toBeInTheDocument();
  });
});

describe('StepRail — Step 3 current when year filled, monthly not', () => {
  it('shows Start kicker for Step 3 when year plan done and monthly not started', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        onOpenYearPlan={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={false}
      />
    );
    // Step 3 is first-incomplete — shows Start (current variant)
    const startButtons = screen.getAllByText('Start');
    expect(startButtons).toHaveLength(1);
    expect(screen.getByText('Split into months')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monthly plan/i })).toBeInTheDocument();
  });
});

// ── PlanCascade — Monthly plan filled (Slice 3) ─────────────────────────────

describe('PlanCascade — flag ON, monthly plan filled', () => {
  it('Monthly rung shows total and YTD ahead badge', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={120000}
        yearPlanFilled={true}
        monthlyPlanFilled={true}
        monthlyPlanTotal={120000}
        monthlyYtdDelta={5000}
      />
    );
    // Monthly total rendered
    const matches = screen.getAllByText(/120,000/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // YTD badge shown with ahead indicator
    expect(screen.getByTestId('monthly-ytd-badge')).toBeInTheDocument();
    expect(screen.getByTestId('monthly-ytd-badge').textContent).toMatch(/ahead/);
    // No ComingRung
    expect(screen.queryByText('Coming')).not.toBeInTheDocument();
  });

  it('Monthly rung shows on pace badge when ytdDelta is 0', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={120000}
        yearPlanFilled={true}
        monthlyPlanFilled={true}
        monthlyPlanTotal={120000}
        monthlyYtdDelta={0}
      />
    );
    expect(screen.getByTestId('monthly-ytd-badge').textContent).toBe('on pace');
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

describe('PlanAnchorStrip — completeness when Monthly Plan also filled', () => {
  it('shows 75% with 3 of 4 steps built', () => {
    render(
      <PlanAnchorStrip
        year={2026}
        commissionNeed={50000}
        afterTaxNeed={80000}
        renewalsCover={10000}
        grossNeed={90000}
        apiCommitment={null}
        planBuiltPct={75}
        stepsBuilt={3}
        totalSteps={4}
        moneyNeedsFilled={true}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('3 of 4 steps')).toBeInTheDocument();
  });
});
