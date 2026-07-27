// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlannerWeekNav from '../PlannerWeekNav.jsx';

function renderNav(props = {}) {
  const onPrev = vi.fn();
  const onNext = vi.fn();
  const onToday = vi.fn();
  render(
    <PlannerWeekNav
      rangeLabel="Jul 19 – 25"
      isCurrentWeek
      onPrev={onPrev}
      onNext={onNext}
      onToday={onToday}
      {...props}
    />,
  );
  return { onPrev, onNext, onToday };
}

describe('PlannerWeekNav — week navigation control', () => {
  it('renders the range label and both direction controls', () => {
    renderNav();
    expect(screen.getByTestId('planner-week-nav')).toBeInTheDocument();
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 19 – 25');
    expect(screen.getByTestId('planner-week-prev')).toBeInTheDocument();
    expect(screen.getByTestId('planner-week-next')).toBeInTheDocument();
  });

  it('prev/next fire their callbacks (navigation is unlimited in both directions)', () => {
    const { onPrev, onNext } = renderNav();
    fireEvent.click(screen.getByTestId('planner-week-prev'));
    fireEvent.click(screen.getByTestId('planner-week-next'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('hides the Today snap-back while already on the current week', () => {
    renderNav({ isCurrentWeek: true });
    expect(screen.queryByTestId('planner-week-today')).toBeNull();
  });

  it('offers Today once navigated away, and it fires onToday', () => {
    const { onToday } = renderNav({ isCurrentWeek: false });
    const btn = screen.getByTestId('planner-week-today');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('direction controls carry accessible names and 44px touch targets', () => {
    renderNav({ isCurrentWeek: false });
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
    // 44px is a class contract in jsdom (no layout engine) — assert the tokens.
    ['planner-week-prev', 'planner-week-next', 'planner-week-today'].forEach((id) => {
      expect(screen.getByTestId(id).className).toMatch(/min-h-\[44px\]/);
    });
  });

  it('announces the viewed range politely for screen readers', () => {
    renderNav();
    expect(screen.getByTestId('planner-week-label')).toHaveAttribute('aria-live', 'polite');
  });
});
