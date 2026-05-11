// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabPills from '../TabPills.jsx';

const TABS = [
  { id: 'active',   label: 'Active'   },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ended',    label: 'Ended'    },
];

describe('TabPills — rendering', () => {
  it('renders all tab labels', () => {
    render(<TabPills tabs={TABS} activeId="active" onChange={() => {}} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('container has role="tablist"', () => {
    render(<TabPills tabs={TABS} activeId="active" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('each tab has role="tab"', () => {
    render(<TabPills tabs={TABS} activeId="active" onChange={() => {}} />);
    const buttons = screen.getAllByRole('tab');
    expect(buttons).toHaveLength(3);
  });
});

describe('TabPills — active state', () => {
  it('active tab has aria-selected="true"', () => {
    render(<TabPills tabs={TABS} activeId="upcoming" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute('aria-selected', 'true');
  });

  it('inactive tabs have aria-selected="false"', () => {
    render(<TabPills tabs={TABS} activeId="active" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Ended' })).toHaveAttribute('aria-selected', 'false');
  });

  it('only one tab is active at a time', () => {
    render(<TabPills tabs={TABS} activeId="ended" onChange={() => {}} />);
    const selected = screen.getAllByRole('tab').filter(
      (btn) => btn.getAttribute('aria-selected') === 'true'
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Ended');
  });
});

describe('TabPills — onChange', () => {
  it('fires onChange with tab id when tab clicked', () => {
    const handler = vi.fn();
    render(<TabPills tabs={TABS} activeId="active" onChange={handler} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Upcoming' }));
    expect(handler).toHaveBeenCalledWith('upcoming');
  });

  it('fires onChange when active tab is clicked again', () => {
    const handler = vi.fn();
    render(<TabPills tabs={TABS} activeId="active" onChange={handler} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Active' }));
    expect(handler).toHaveBeenCalledWith('active');
  });
});

describe('TabPills — badge', () => {
  it('shows badge count when badge > 0', () => {
    const tabs = [
      { id: 'active', label: 'Active', badge: 3 },
      { id: 'ended', label: 'Ended', badge: 0 },
    ];
    render(<TabPills tabs={tabs} activeId="active" onChange={() => {}} />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('does not render badge when badge is 0', () => {
    const tabs = [{ id: 'active', label: 'Active', badge: 0 }];
    render(<TabPills tabs={tabs} activeId="active" onChange={() => {}} />);
    expect(screen.queryByText('(0)')).toBeNull();
  });

  it('does not render badge when badge is null', () => {
    const tabs = [{ id: 'active', label: 'Active', badge: null }];
    render(<TabPills tabs={tabs} activeId="active" onChange={() => {}} />);
    expect(screen.queryByText(/\(/)).toBeNull();
  });

  it('does not render badge when badge is undefined', () => {
    const tabs = [{ id: 'active', label: 'Active' }];
    render(<TabPills tabs={tabs} activeId="active" onChange={() => {}} />);
    expect(screen.queryByText(/\(/)).toBeNull();
  });
});

describe('TabPills — className', () => {
  it('appends className to the container', () => {
    const { container } = render(
      <TabPills tabs={TABS} activeId="active" onChange={() => {}} className="overflow-x-auto" />
    );
    expect(container.firstChild).toHaveClass('overflow-x-auto');
  });
});
