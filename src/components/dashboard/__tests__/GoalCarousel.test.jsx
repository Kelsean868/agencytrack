// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../GoalDonut', () => ({
  default: ({ percent, period }) => (
    <div data-testid={`donut-${period}`} aria-label={`${percent}% of ${period} goal`} />
  ),
}));

import GoalCarousel from '../GoalCarousel';

const DATA = {
  week:    { period: 'May 19–25', current: 5000, target: 10000, percent: 50, status: '3 days left' },
  month:   { period: 'May 2026',  current: 15000, target: 30000, percent: 50, status: 'On track' },
  quarter: { period: 'Q2 2026',   current: 25000, target: 50000, percent: 50, status: 'On track' },
  ytd:     { period: '2026',      current: 50000, target: 100000, percent: 50, status: 'On track' },
};

describe('GoalCarousel — tab rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all four period tabs', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByRole('tab', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quarter' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'YTD' })).toBeInTheDocument();
  });

  it('has Week selected by default', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const weekTab = screen.getByRole('tab', { name: 'Week' });
    expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the goal-period carousel region', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByRole('region', { name: /goal progress carousel/i })).toBeInTheDocument();
  });

  it('renders a tablist with aria-label', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByRole('tablist', { name: /goal period/i })).toBeInTheDocument();
  });

  it('renders four tabpanels', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    // inactive panels have aria-hidden="true" so must query with hidden:true
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(4);
  });

  it('renders a GoalDonut for each period', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByTestId('donut-week')).toBeInTheDocument();
    expect(screen.getByTestId('donut-month')).toBeInTheDocument();
    expect(screen.getByTestId('donut-quarter')).toBeInTheDocument();
    expect(screen.getByTestId('donut-ytd')).toBeInTheDocument();
  });
});

describe('GoalCarousel — active panel content', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the week period label in the active panel', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByText('May 19–25')).toBeInTheDocument();
  });

  it('renders the week status text', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    expect(screen.getByText('3 days left')).toBeInTheDocument();
  });

  it('shows the non-active panels as aria-hidden', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    const visibleCount = panels.filter(p => p.getAttribute('aria-hidden') === 'false').length;
    expect(visibleCount).toBe(1);
    const hiddenCount = panels.filter(p => p.getAttribute('aria-hidden') === 'true').length;
    expect(hiddenCount).toBe(3);
  });
});

describe('GoalCarousel — tab click switching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('switches to Month when the Month tab is clicked', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows Month period content after clicking Month tab', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(screen.getByText('May 2026')).toBeInTheDocument();
  });

  it('switches to YTD when the YTD tab is clicked', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'YTD' }));
    expect(screen.getByRole('tab', { name: 'YTD' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('GoalCarousel — keyboard navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ArrowRight moves from Week to Month', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const weekTab = screen.getByRole('tab', { name: 'Week' });
    fireEvent.keyDown(weekTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft wraps from Week to YTD', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const weekTab = screen.getByRole('tab', { name: 'Week' });
    fireEvent.keyDown(weekTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'YTD' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowRight wraps from YTD back to Week', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'YTD' }));
    const ytdTab = screen.getByRole('tab', { name: 'YTD' });
    fireEvent.keyDown(ytdTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Home key moves to the first tab (Week)', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Quarter' }));
    const quarterTab = screen.getByRole('tab', { name: 'Quarter' });
    fireEvent.keyDown(quarterTab, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
  });

  it('End key moves to the last tab (YTD)', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const weekTab = screen.getByRole('tab', { name: 'Week' });
    fireEvent.keyDown(weekTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'YTD' })).toHaveAttribute('aria-selected', 'true');
  });

  it('only the active tab has tabIndex=0', () => {
    render(<GoalCarousel data={DATA} autoRotate={false} />);
    const tabs = screen.getAllByRole('tab');
    const focusable = tabs.filter(t => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toHaveTextContent('Week');
  });
});

describe('GoalCarousel — 100%+ percent clamping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not throw when percent exceeds 100', () => {
    const overData = {
      ...DATA,
      week: { ...DATA.week, percent: 130 },
    };
    expect(() => render(<GoalCarousel data={overData} autoRotate={false} />)).not.toThrow();
  });

  it('does not throw when percent is 0', () => {
    const zeroData = {
      ...DATA,
      week: { ...DATA.week, percent: 0 },
    };
    expect(() => render(<GoalCarousel data={zeroData} autoRotate={false} />)).not.toThrow();
  });
});
