import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import StepRail from '../components/dashboard/GamePlanV2/StepRail';
import PlanCascade from '../components/dashboard/GamePlanV2/PlanCascade';
import PlanAnchorStrip from '../components/dashboard/GamePlanV2/PlanAnchorStrip';

// ── StepRail ──────────────────────────────────────────────────────────────────

describe('StepRail — Step 4 committed wiring', () => {
  const baseProps = {
    moneyNeedsFilled: true,
    onOpenMoneyNeeds: vi.fn(),
    onOpenYearPlan: vi.fn(),
    yearPlanFilled: true,
    onOpenMonthlyPlan: vi.fn(),
    monthlyPlanFilled: true,
  };

  it('flag OFF (no onOpenReviewCommit) → Step 4 shows Coming', () => {
    render(<StepRail {...baseProps} />);
    // Step 4 card — coming variant: aria-disabled, "Coming" kicker
    const rail = screen.getByTestId('game-plan-rail');
    expect(rail).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('flag ON + not committed → Step 4 shows Review (current)', () => {
    render(
      <StepRail
        {...baseProps}
        onOpenReviewCommit={vi.fn()}
        committed={false}
      />
    );
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Review & commit your plan')).toBeTruthy();
  });

  it('flag ON + committed → Step 4 shows Done / Plan committed', () => {
    render(
      <StepRail
        {...baseProps}
        onOpenReviewCommit={vi.fn()}
        committed={true}
      />
    );
    // "Done" kicker appears twice (Step 2 yearPlanFilled + Step 4 committed)
    const donePills = screen.getAllByText('Done');
    expect(donePills.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Plan committed')).toBeTruthy();
  });
});

// ── PlanCascade ───────────────────────────────────────────────────────────────

describe('PlanCascade — Commit rung', () => {
  const baseProps = {
    commissionNeed: 120000,
    moneyNeedsFilled: true,
    yearPlanTotalAPI: 504000,
    yearPlanFilled: true,
    monthlyPlanFilled: true,
    monthlyPlanTotal: 504000,
    monthlyYtdDelta: 0,
  };

  it('flag OFF → Step 4 shows ComingRung (Coming pill)', () => {
    render(<PlanCascade {...baseProps} yearPlanEnabled={false} />);
    // Three Coming rungs: Year Plan, Monthly Plan, Commit (all gated off)
    const comingPills = screen.getAllByText(/coming/i);
    // At least one "Coming" pill for the Commit rung
    expect(comingPills.length).toBeGreaterThanOrEqual(1);
    // No committed rung
    expect(screen.queryByTestId('commit-rung-committed')).toBeNull();
  });

  it('flag ON + not committed → ready rung (Next pill, no green)', () => {
    render(
      <PlanCascade
        {...baseProps}
        yearPlanEnabled={true}
        committed={false}
        committedAt={null}
      />
    );
    expect(screen.getByTestId('commit-rung-ready')).toBeTruthy();
    expect(screen.queryByTestId('commit-rung-committed')).toBeNull();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.getByText('Commit to your plan')).toBeTruthy();
  });

  it('flag ON + committed → green rung with Committed pill', () => {
    const sealDate = new Date('2026-06-13T14:00:00Z');
    render(
      <PlanCascade
        {...baseProps}
        yearPlanEnabled={true}
        committed={true}
        committedAt={sealDate}
      />
    );
    expect(screen.getByTestId('commit-rung-committed')).toBeTruthy();
    expect(screen.queryByTestId('commit-rung-ready')).toBeNull();
    // "Committed" appears in both the seal description and the pill — use getAllByText
    expect(screen.getAllByText('Committed').length).toBeGreaterThanOrEqual(1);
    // Dated seal text includes the date + " TT" suffix
    expect(screen.getByText(/Committed · .+ TT/)).toBeTruthy();
  });

  it('flag ON + committed with null committedAt → shows "Committed" without date', () => {
    render(
      <PlanCascade
        {...baseProps}
        yearPlanEnabled={true}
        committed={true}
        committedAt={null}
      />
    );
    expect(screen.getByTestId('commit-rung-committed')).toBeTruthy();
    // Graceful: no date — pill still says Committed
    expect(screen.getAllByText('Committed').length).toBeGreaterThanOrEqual(1);
    // No dated seal (no " TT" in the seal description)
    expect(screen.queryByText(/Committed · .+ TT/)).toBeNull();
  });
});

// ── PlanAnchorStrip — completeness reaches 100% ───────────────────────────────

describe('PlanAnchorStrip — completeness 100% when committed', () => {
  const baseProps = {
    year: 2026,
    commissionNeed: 120000,
    afterTaxNeed: 180000,
    renewalsCover: 60000,
    grossNeed: 240000,
    apiCommitment: 504000,
    moneyNeedsFilled: true,
  };

  it('4 of 4 steps = 100% when all four steps built', () => {
    render(
      <PlanAnchorStrip
        {...baseProps}
        stepsBuilt={4}
        totalSteps={4}
        planBuiltPct={100}
      />
    );
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('4 of 4 steps')).toBeTruthy();
  });

  it('3 of 4 steps = 75% when not yet committed', () => {
    render(
      <PlanAnchorStrip
        {...baseProps}
        stepsBuilt={3}
        totalSteps={4}
        planBuiltPct={75}
      />
    );
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('3 of 4 steps')).toBeTruthy();
  });
});
