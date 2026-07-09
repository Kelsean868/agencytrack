// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlanCommitCard from '../PlanCommitCard';

describe('PlanCommitCard', () => {
  it('renders the three completion-derived checklist items with their done state', () => {
    render(
      <PlanCommitCard
        moneyNeedsFilled
        yearPlanFilled
        monthlyPlanFilled={false}
        onOpenReviewCommit={vi.fn()}
      />,
    );
    expect(screen.getByTestId('commit-check-moneyNeeds').getAttribute('data-done')).toBe('true');
    expect(screen.getByTestId('commit-check-yearPlan').getAttribute('data-done')).toBe('true');
    expect(screen.getByTestId('commit-check-monthly').getAttribute('data-done')).toBe('false');
  });

  it('CTA opens the existing commit modal (single write path)', () => {
    const onOpenReviewCommit = vi.fn();
    render(
      <PlanCommitCard
        moneyNeedsFilled
        yearPlanFilled
        monthlyPlanFilled
        onOpenReviewCommit={onOpenReviewCommit}
      />,
    );
    fireEvent.click(screen.getByTestId('plan-commit-cta'));
    expect(onOpenReviewCommit).toHaveBeenCalledTimes(1);
  });

  it('shows the not-ready hint until every step is done', () => {
    render(<PlanCommitCard moneyNeedsFilled onOpenReviewCommit={vi.fn()} />);
    expect(screen.getByText(/Finish the steps above/i)).toBeTruthy();
  });

  it('renders a committed state when committed', () => {
    render(
      <PlanCommitCard
        moneyNeedsFilled
        yearPlanFilled
        monthlyPlanFilled
        committed
        committedAnnualAPI={600000}
        onOpenReviewCommit={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plan-commit-card-committed')).toBeTruthy();
    const api = screen.getByTestId('plan-commit-card-api');
    expect(within(api).getByText(/600,000/)).toBeTruthy();
  });
});
