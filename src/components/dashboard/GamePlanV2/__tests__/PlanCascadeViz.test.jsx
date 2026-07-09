// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanCascade from '../PlanCascade';

const baseProps = {
  commissionNeed: 100000,
  moneyNeedsFilled: true,
  yearPlanEnabled: true,
  yearPlanTotalAPI: 100000,
  yearPlanFilled: true,
  lineKeys: ['life', 'ah', 'general'],
  yearPlanLines: {
    life:    { targetAPI: 60000, enabled: true },
    ah:      { targetAPI: 20000, enabled: true },
    general: { targetAPI: 20000, enabled: true },
  },
};

describe('PlanCascade — hub viz', () => {
  it('renders the AllocationBar with one segment per funded line', () => {
    render(<PlanCascade {...baseProps} monthlyPlanFilled={false} />);
    expect(screen.getByTestId('cascade-allocation-bar')).toBeTruthy();
    expect(screen.getByTestId('cascade-alloc-seg-life')).toBeTruthy();
    expect(screen.getByTestId('cascade-alloc-seg-ah')).toBeTruthy();
    expect(screen.getByTestId('cascade-alloc-seg-general')).toBeTruthy();
    // legend % for life = 60%
    expect(screen.getByTestId('cascade-alloc-legend-life').textContent).toMatch(/60%/);
  });

  it('renders the 12-bar MiniMonthStrip when the monthly plan is filled', () => {
    render(
      <PlanCascade
        {...baseProps}
        monthlyPlanFilled
        monthlyPlanTotal={120000}
        monthlyTargets={Array(12).fill(10000)}
        monthlyActuals={Array(12).fill(4000)}
        currentMonthIndex={5}
      />,
    );
    const strip = screen.getByTestId('cascade-mini-months');
    expect(strip.querySelectorAll('[data-testid^="cascade-month-"]')).toHaveLength(12);
  });

  it('omits the AllocationBar when the year plan is not filled', () => {
    render(<PlanCascade {...baseProps} yearPlanFilled={false} monthlyPlanFilled={false} />);
    expect(screen.queryByTestId('cascade-allocation-bar')).toBeNull();
  });
});
