import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CelebrationsPanel from '../panels/CelebrationsPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

// Fixed clock: week of 2026-01-04 .. 2026-01-10.
const NOW = new Date(2026, 0, 7);

describe('CelebrationsPanel (3.6)', () => {
  it('renders anniversary cards for in-week contract dates', () => {
    const users = [
      { id: 'a1', name: 'Alice', contractStartDate: '2021-01-06' },
      { id: 'a2', name: 'Bob', contractStartDate: '2019-01-08' },
    ];
    render(<CelebrationsPanel allUsers={users} now={NOW} />);
    const cards = screen.getAllByTestId('celebration-card');
    expect(cards).toHaveLength(2);
    // Avatar is mocked to render the name too, so the name appears twice per
    // card — assert via the aggregated card text instead of a unique matcher.
    const allText = cards.map((c) => c.textContent).join(' ');
    expect(allText).toContain('Alice');
    expect(allText).toContain('5 years');
    expect(allText).toContain('7 years');
  });

  it('shows the empty state when no anniversaries land this week', () => {
    render(<CelebrationsPanel allUsers={[{ id: 'x', name: 'X', contractStartDate: '2020-08-01' }]} now={NOW} />);
    expect(screen.getByText(/no celebrations this week/i)).toBeInTheDocument();
    expect(screen.queryByTestId('celebration-card')).not.toBeInTheDocument();
  });

  it('singularizes a 1-year anniversary', () => {
    render(<CelebrationsPanel allUsers={[{ id: 'a', name: 'Ann', contractStartDate: '2025-01-05' }]} now={NOW} />);
    expect(screen.getByText('1 year')).toBeInTheDocument();
  });
});
