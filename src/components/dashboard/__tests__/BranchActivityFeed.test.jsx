// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BranchActivityFeed from '../BranchActivityFeed.jsx';

vi.mock('../ActivityFeed', () => ({
  default: ({ heading, subHeading, events }) => (
    <div data-testid="activity-feed" data-heading={heading} data-sub={subHeading}>
      {events?.map((e) => <div key={e.id} data-testid="event">{e.title}</div>)}
    </div>
  ),
}));

const EVENTS = [
  { id: 'e1', title: 'Alice submitted her report', sub: '$5,000 API', pill: { label: 'Submitted', variant: 'success' }, timestamp: '2026-05-10T10:00:00Z', type: 'submission', iconVariant: 'success' },
  { id: 'e2', title: 'Bob submitted his report',   sub: '$3,200 API', pill: { label: 'Submitted', variant: 'success' }, timestamp: '2026-05-09T14:00:00Z', type: 'submission', iconVariant: 'success' },
];

describe('BranchActivityFeed — loading', () => {
  it('renders skeleton when loading=true', () => {
    const { container } = render(<BranchActivityFeed events={[]} loading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
    expect(screen.queryByTestId('activity-feed')).toBeNull();
  });
});

describe('BranchActivityFeed — with events', () => {
  it('renders ActivityFeed with heading "Team Activity"', () => {
    render(<BranchActivityFeed events={EVENTS} loading={false} />);
    const feed = screen.getByTestId('activity-feed');
    expect(feed.dataset.heading).toBe('Team Activity');
  });

  it('renders ActivityFeed with subHeading "Last 14 days"', () => {
    render(<BranchActivityFeed events={EVENTS} loading={false} />);
    const feed = screen.getByTestId('activity-feed');
    expect(feed.dataset.sub).toBe('Last 14 days');
  });

  it('passes all events to ActivityFeed', () => {
    render(<BranchActivityFeed events={EVENTS} loading={false} />);
    expect(screen.getAllByTestId('event')).toHaveLength(2);
  });
});

describe('BranchActivityFeed — empty', () => {
  it('renders ActivityFeed with empty array', () => {
    render(<BranchActivityFeed events={[]} loading={false} />);
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    expect(screen.queryAllByTestId('event')).toHaveLength(0);
  });
});
