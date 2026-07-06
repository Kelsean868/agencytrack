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
