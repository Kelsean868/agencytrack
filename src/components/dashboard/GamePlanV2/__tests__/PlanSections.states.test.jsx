import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlanAnchorStrip from '../PlanAnchorStrip';
import PlanCascade from '../PlanCascade';
import StepRail from '../StepRail';

// Persist-shells: each section's testid'd shell must render in loading / error /
// empty / ready WITHOUT a mount swap, so the section never pops in after the fade.
describe('Game Plan persisted-shell states', () => {
  describe('PlanAnchorStrip', () => {
    it('loading: shell (testid) persists + skeleton in place', () => {
      const { getByTestId } = render(
        <PlanAnchorStrip year={2026} loading planBuiltPct={0} stepsBuilt={0} totalSteps={3} />,
      );
      const shell = getByTestId('game-plan-anchor');
      expect(shell.tagName).toBe('SECTION');
      expect(shell.querySelector('[aria-busy="true"]')).toBeTruthy();
    });

    it('error: shell persists + in-place retry (no strand)', () => {
      const { getByTestId } = render(<PlanAnchorStrip year={2026} error onRetry={() => {}} />);
      expect(getByTestId('game-plan-anchor')).toBeTruthy();
      expect(getByTestId('game-plan-anchor-retry')).toBeTruthy();
    });

    it('empty (no money needs): shell + honest "build your plan" copy', () => {
      const { getByTestId, getByText } = render(
        <PlanAnchorStrip year={2026} moneyNeedsFilled={false} commissionNeed={0} planBuiltPct={0} stepsBuilt={0} totalSteps={3} />,
      );
      expect(getByTestId('game-plan-anchor')).toBeTruthy();
      expect(getByText(/Build your 2026 plan/i)).toBeTruthy();
    });
  });

  describe('PlanCascade', () => {
    it('loading: shell persists + aria-busy', () => {
      const { getByTestId } = render(<PlanCascade loading commissionNeed={0} />);
      expect(getByTestId('game-plan-cascade').getAttribute('aria-busy')).toBe('true');
    });

    it('error: shell persists + in-place message (no strand)', () => {
      const { getByTestId, getByText } = render(<PlanCascade error commissionNeed={0} />);
      expect(getByTestId('game-plan-cascade')).toBeTruthy();
      expect(getByText(/retry above/i)).toBeTruthy();
    });
  });

  describe('StepRail', () => {
    it('loading: rail shell persists + aria-busy', () => {
      const { getByTestId } = render(<StepRail loading />);
      expect(getByTestId('game-plan-rail').getAttribute('aria-busy')).toBe('true');
    });
  });
});

// Text-identical trees: the STRUCTURAL nodes (shell testid + static labels/titles)
// must be present in BOTH loading and ready — only the value text differs. Locks the
// invariant so a future edit can't silently reintroduce a loading→ready mount swap.
describe('Game Plan text-identical trees (loading structure == ready structure)', () => {
  const STRUCTURAL = {
    anchor: ['Draft', 'After-Tax Need', 'Renewals Cover', 'Commission Need', 'API Commitment', 'Plan Built'],
    cascade: ['The plan so far', 'Step 1 · Money Needs', 'Commission you must earn this year'],
    rail: ['Money Needs', 'Monthly Plan', 'Review & Commit'],
  };

  it('PlanAnchorStrip: same structural nodes present in loading and ready', () => {
    const base = { year: 2026, planBuiltPct: 100, stepsBuilt: 3, totalSteps: 3 };
    const loading = render(<PlanAnchorStrip {...base} loading />);
    STRUCTURAL.anchor.forEach((t) => expect(loading.queryAllByText(t).length).toBeGreaterThan(0));
    expect(loading.getByTestId('game-plan-anchor')).toBeTruthy();
    loading.unmount();
    const ready = render(
      <PlanAnchorStrip {...base} moneyNeedsFilled commissionNeed={53333} afterTaxNeed={100000} renewalsCover={50000} grossNeed={103333} apiCommitment={100000} />,
    );
    STRUCTURAL.anchor.forEach((t) => expect(ready.queryAllByText(t).length).toBeGreaterThan(0));
    expect(ready.getByTestId('game-plan-anchor')).toBeTruthy();
  });

  it('PlanCascade: same structural nodes present in loading and ready', () => {
    const loading = render(<PlanCascade loading yearPlanEnabled commissionNeed={0} />);
    STRUCTURAL.cascade.forEach((t) => expect(loading.queryAllByText(t).length).toBeGreaterThan(0));
    loading.unmount();
    const ready = render(<PlanCascade yearPlanEnabled moneyNeedsFilled commissionNeed={53333} />);
    STRUCTURAL.cascade.forEach((t) => expect(ready.queryAllByText(t).length).toBeGreaterThan(0));
  });

  it('StepRail: same step titles present in loading and ready', () => {
    const loading = render(<StepRail loading />);
    STRUCTURAL.rail.forEach((t) => expect(loading.queryAllByText(t).length).toBeGreaterThan(0));
    loading.unmount();
    const ready = render(<StepRail moneyNeedsFilled />);
    STRUCTURAL.rail.forEach((t) => expect(ready.queryAllByText(t).length).toBeGreaterThan(0));
  });
});
