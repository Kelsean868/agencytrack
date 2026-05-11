// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamMedalsPanel from '../TeamMedalsPanel.jsx';

// Mock BadgeGrid to avoid Icon component resolution issues in jsdom
vi.mock('../../gamification/BadgeGrid', () => ({
  BADGES: {
    streak3: {
      Icon: ({ size }) => <svg data-testid="badge-icon" width={size} height={size} />,
      label: '3-Week Streak',
      gradient: 'medal-1',
      tier: 1,
    },
    topProducer: {
      Icon: ({ size }) => <svg data-testid="badge-icon" width={size} height={size} />,
      label: 'Top Producer',
      gradient: 'medal-3',
      tier: 3,
    },
  },
}));

const BADGE_COUNTS = [
  { key: 'streak3',     count: 4 },
  { key: 'topProducer', count: 2 },
];

describe('TeamMedalsPanel — loading', () => {
  it('renders skeleton grid when loading=true', () => {
    const { container } = render(<TeamMedalsPanel badgeCounts={[]} loading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
    expect(screen.queryByText('Team Badges')).toBeNull();
  });
});

describe('TeamMedalsPanel — with data', () => {
  it('renders "Team Badges" heading', () => {
    render(<TeamMedalsPanel badgeCounts={BADGE_COUNTS} loading={false} />);
    expect(screen.getByText('Team Badges')).toBeInTheDocument();
  });

  it('renders a badge item for each count entry', () => {
    render(<TeamMedalsPanel badgeCounts={BADGE_COUNTS} loading={false} />);
    expect(screen.getByText('3-Week Streak')).toBeInTheDocument();
    expect(screen.getByText('Top Producer')).toBeInTheDocument();
  });

  it('renders "× N advisors" sub-label', () => {
    render(<TeamMedalsPanel badgeCounts={BADGE_COUNTS} loading={false} />);
    expect(screen.getByText('× 4 advisors')).toBeInTheDocument();
    expect(screen.getByText('× 2 advisors')).toBeInTheDocument();
  });

  it('renders singular "advisor" when count=1', () => {
    render(<TeamMedalsPanel badgeCounts={[{ key: 'streak3', count: 1 }]} loading={false} />);
    expect(screen.getByText('× 1 advisor')).toBeInTheDocument();
  });

  it('sets correct aria-label on badge items', () => {
    render(<TeamMedalsPanel badgeCounts={BADGE_COUNTS} loading={false} />);
    expect(screen.getByLabelText(/3-Week Streak — earned by 4 advisors/)).toBeInTheDocument();
  });

  it('skips badge entries with unknown keys', () => {
    const counts = [{ key: 'nonexistent_badge_xyz', count: 5 }, ...BADGE_COUNTS];
    render(<TeamMedalsPanel badgeCounts={counts} loading={false} />);
    // Still renders known badges
    expect(screen.getByText('3-Week Streak')).toBeInTheDocument();
    // No crash
  });
});

describe('TeamMedalsPanel — empty', () => {
  it('renders empty state message when badgeCounts is empty', () => {
    render(<TeamMedalsPanel badgeCounts={[]} loading={false} />);
    expect(screen.getByText(/no team badges yet/i)).toBeInTheDocument();
  });
});
