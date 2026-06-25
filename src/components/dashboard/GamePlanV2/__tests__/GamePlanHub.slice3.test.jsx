import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepRail from '../StepRail';
import PlanCascade from '../PlanCascade';
import PlanAnchorStrip from '../PlanAnchorStrip';

// Direction 1.5 (PR-U1): the rail/cascade collapsed from 4 steps to 3 —
// Money Needs + Year Plan merged into one "Money Needs" step (the merged
// allocator writes the yearPlan). Rail: Money Needs → Monthly → Review & Commit.

// ── StepRail — Step 1 (merged Money Needs) ──────────────────────────────────

describe('StepRail — Step 1 not allocated (yearPlanFilled false)', () => {
  it('worksheet started but not allocated → "In progress" current state', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('What you need & how you write it')).toBeInTheDocument();
    // Money Needs is always clickable
    expect(screen.getByRole('button', { name: /money needs/i })).toBeInTheDocument();
    // Monthly + Commit are non-interactive (flag off / not yet reachable)
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('nothing started → "Start" kicker', () => {
    render(
      <StepRail
        moneyNeedsFilled={false}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
  });
});

describe('StepRail — Step 1 allocated (yearPlanFilled true)', () => {
  it('merged Money Needs step shows Done', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
      />
    );
    // Step 1 Done (allocated); Step 2 Monthly becomes the current step
    expect(screen.getByText('Allocated by line')).toBeInTheDocument();
    expect(screen.getByText('Split into months')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /money needs/i })).toBeInTheDocument();
  });
});

// ── StepRail — Step 2 (Monthly Plan) live status ────────────────────────────

describe('StepRail — Step 2 Monthly Plan', () => {
  it('Done when monthly filled (Steps 1 + 2 both Done)', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={true}
      />
    );
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /monthly plan/i })).toBeInTheDocument();
  });

  it('Start when year allocated but monthly not yet', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={false}
      />
    );
    const startButtons = screen.getAllByText('Start');
    expect(startButtons).toHaveLength(1); // Step 2 is the first-incomplete step
    expect(screen.getByText('Split into months')).toBeInTheDocument();
  });
});

// ── StepRail — Step 3 (Review & Commit) ─────────────────────────────────────

describe('StepRail — Step 3 Review & Commit', () => {
  it('flag OFF (no onOpenReviewCommit) → Coming', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={true}
      />
    );
    // Step 3 not reachable without onOpenReviewCommit
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('reachable + committed → Done / Plan committed', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={true}
        onOpenMonthlyPlan={() => {}}
        monthlyPlanFilled={true}
        onOpenReviewCommit={vi.fn()}
        committed={true}
      />
    );
    expect(screen.getByText('Plan committed')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(3); // all three steps
  });
});

// ── PlanCascade — 3-rung (Money Needs merged) ───────────────────────────────

describe('PlanCascade — flag OFF', () => {
  it('Monthly Plan + Review & Commit show Coming (Money Needs rung is live, no planned-API sub-line)', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={false}
        yearPlanTotalAPI={0}
        yearPlanFilled={false}
      />
    );
    // Two ComingRungs — Monthly + Commit (Year Plan rung is gone, merged into Money Needs)
    expect(screen.getAllByText('Coming')).toHaveLength(2);
    // No planned-API sub-line when the loop is gated off
    expect(screen.queryByText('Planned annual API')).not.toBeInTheDocument();
  });
});

describe('PlanCascade — flag ON, not allocated', () => {
  it('Money Needs rung shows "Allocate to set"; Monthly shows honest empty; no Coming', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={0}
        yearPlanFilled={false}
      />
    );
    expect(screen.getByText('Planned annual API')).toBeInTheDocument();
    expect(screen.getByText('Allocate to set')).toBeInTheDocument();
    // Monthly live rung honest-empty
    expect(screen.getByText('Set in your plan')).toBeInTheDocument();
    expect(screen.queryByText('Coming')).not.toBeInTheDocument();
  });
});

describe('PlanCascade — flag ON, allocated, no monthly plan', () => {
  it('Money Needs rung shows the planned API total; Monthly shows honest empty', () => {
    render(
      <PlanCascade
        commissionNeed={50000}
        moneyNeedsFilled={true}
        yearPlanEnabled={true}
        yearPlanTotalAPI={120000}
        yearPlanFilled={true}
      />
    );
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText('Set in your plan')).toBeInTheDocument(); // Monthly only
    expect(screen.queryByText('Coming')).not.toBeInTheDocument();
  });
});

describe('PlanCascade — flag ON, monthly plan filled', () => {
  it('Monthly rung shows per-month total and YTD ahead badge', () => {
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
    // Money Needs rung shows the annual figure; Monthly shows per-month (120000 / 12 = 10,000)
    expect(screen.getAllByText(/120,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
    expect(screen.getByTestId('monthly-ytd-badge')).toBeInTheDocument();
    expect(screen.getByTestId('monthly-ytd-badge').textContent).toMatch(/ahead/);
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

// ── PlanAnchorStrip — completeness (3 steps) ────────────────────────────────

describe('PlanAnchorStrip — completeness', () => {
  it('shows 33% with 1 of 3 steps built (allocated only)', () => {
    render(
      <PlanAnchorStrip
        year={2026}
        commissionNeed={50000}
        afterTaxNeed={80000}
        renewalsCover={10000}
        grossNeed={90000}
        apiCommitment={null}
        planBuiltPct={33}
        stepsBuilt={1}
        totalSteps={3}
        moneyNeedsFilled={true}
      />
    );
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 steps')).toBeInTheDocument();
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
        planBuiltPct={33}
        stepsBuilt={1}
        totalSteps={3}
        moneyNeedsFilled={true}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Set in your plan')).toBeInTheDocument();
  });
});
