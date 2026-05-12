// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Trophy, ClipboardList, Zap } from 'lucide-react';
import WeeklyChampionsBanner, { ChampionCard } from '../WeeklyChampionsBanner';

const CHAMPIONS_FULL = {
  topAPI:      { agentId: 'a1', agentName: 'Kelsean Marchan', value: 42500 },
  topApps:     { agentId: 'a2', agentName: 'Jordan Pierre',   value: 8 },
  topActivity: { agentId: 'a3', agentName: 'Avery Lopez',     value: 27 },
  weekStarting: '2026-05-03',
};

const CHAMPIONS_EMPTY = {
  topAPI: null,
  topApps: null,
  topActivity: null,
  weekStarting: '2026-05-03',
};

const CHAMPIONS_PARTIAL = {
  topAPI:      { agentId: 'a1', agentName: 'Kelsean Marchan', value: 42500 },
  topApps:     null,
  topActivity: { agentId: 'a3', agentName: 'Avery Lopez', value: 27 },
  weekStarting: '2026-05-03',
};

describe('WeeklyChampionsBanner — loading', () => {
  it('renders skeleton with three pulse blocks when loading=true', () => {
    const { container } = render(<WeeklyChampionsBanner champions={null} loading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Last Week's Champions/)).toBeNull();
  });

  it('skeleton uses rounded-full (circle) placeholders matching medal shape', () => {
    const { container } = render(<WeeklyChampionsBanner champions={null} loading />);
    const circles = container.querySelectorAll('.rounded-full.animate-pulse');
    expect(circles.length).toBe(3);
  });
});

describe('WeeklyChampionsBanner — null champions', () => {
  it('renders nothing when champions prop is null and not loading', () => {
    const { container } = render(<WeeklyChampionsBanner champions={null} loading={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('WeeklyChampionsBanner — with data', () => {
  it('renders header and week label', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    expect(screen.getByText(/Last Week's Champions/)).toBeInTheDocument();
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('renders three champion cards', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    expect(container.querySelectorAll('[data-testid="champion-card"]').length).toBe(3);
  });

  it('renders each category label', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    expect(screen.getByText('Top API')).toBeInTheDocument();
    expect(screen.getByText('Top Apps')).toBeInTheDocument();
    expect(screen.getByText('Top Activity')).toBeInTheDocument();
  });

  it('renders each champion name', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    expect(screen.getByText('Kelsean Marchan')).toBeInTheDocument();
    expect(screen.getByText('Jordan Pierre')).toBeInTheDocument();
    expect(screen.getByText('Avery Lopez')).toBeInTheDocument();
  });

  it('renders Top API value as TTD currency', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    // Currency formatter prefixes "TT$" — verify the integer is present
    expect(screen.getByText(/42,500/)).toBeInTheDocument();
  });

  it('renders Top Apps and Top Activity values as plain integers', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
  });

  it('uses mobile-stacking grid (grid-cols-1 sm:grid-cols-3)', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    const grid = container.querySelector('.grid-cols-1.sm\\:grid-cols-3');
    expect(grid).not.toBeNull();
  });
});

describe('WeeklyChampionsBanner — medal class mapping', () => {
  it('applies medal-1 glow to Top API card', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    const cards = container.querySelectorAll('[data-testid="champion-card"]');
    const apiMedal = cards[0].querySelector('.badge-medal');
    expect(apiMedal.classList.contains('medal-1')).toBe(true);
    expect(apiMedal.classList.contains('glow')).toBe(true);
  });

  it('applies medal-2 glow to Top Apps card', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    const cards = container.querySelectorAll('[data-testid="champion-card"]');
    const appsMedal = cards[1].querySelector('.badge-medal');
    expect(appsMedal.classList.contains('medal-2')).toBe(true);
    expect(appsMedal.classList.contains('glow')).toBe(true);
  });

  it('applies medal-3 glow to Top Activity card', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_FULL} loading={false} />);
    const cards = container.querySelectorAll('[data-testid="champion-card"]');
    const activityMedal = cards[2].querySelector('.badge-medal');
    expect(activityMedal.classList.contains('medal-3')).toBe(true);
    expect(activityMedal.classList.contains('glow')).toBe(true);
  });
});

describe('WeeklyChampionsBanner — empty per-category state', () => {
  it('renders medal-locked (no glow) when a category has no champion', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_PARTIAL} loading={false} />);
    const cards = container.querySelectorAll('[data-testid="champion-card"]');
    const appsMedal = cards[1].querySelector('.badge-medal');
    expect(appsMedal.classList.contains('medal-locked')).toBe(true);
    expect(appsMedal.classList.contains('glow')).toBe(false);
  });

  it('shows "No data yet" caption for empty categories', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_PARTIAL} loading={false} />);
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });

  it('shows "No submissions recorded last week" when all categories are empty', () => {
    render(<WeeklyChampionsBanner champions={CHAMPIONS_EMPTY} loading={false} />);
    expect(screen.getByText(/No submissions recorded last week/)).toBeInTheDocument();
    expect(screen.queryByText(/Week of/)).toBeNull();
  });

  it('renders three medal-locked coins when all categories are empty', () => {
    const { container } = render(<WeeklyChampionsBanner champions={CHAMPIONS_EMPTY} loading={false} />);
    const lockedMedals = container.querySelectorAll('.badge-medal.medal-locked');
    expect(lockedMedals.length).toBe(3);
  });
});

describe('ChampionCard — direct render', () => {
  const formatNumber = (v) => String(v);

  it('renders agent name and value when champion present', () => {
    render(
      <ChampionCard
        Icon={Trophy}
        label="Top API"
        champion={{ agentId: 'a1', agentName: 'Sam Lee', value: 15 }}
        medalClass="medal-1"
        format={formatNumber}
      />
    );
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Top API')).toBeInTheDocument();
  });

  it('renders "No data yet" and locked medal when champion is null', () => {
    const { container } = render(
      <ChampionCard
        Icon={ClipboardList}
        label="Top Apps"
        champion={null}
        medalClass="medal-2"
        format={formatNumber}
      />
    );
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
    const medal = container.querySelector('.badge-medal');
    expect(medal.classList.contains('medal-locked')).toBe(true);
    expect(medal.classList.contains('medal-2')).toBe(false);
  });

  it('marks the medal coin aria-hidden so the surrounding text drives screen readers', () => {
    const { container } = render(
      <ChampionCard
        Icon={Zap}
        label="Top Activity"
        champion={{ agentId: 'a3', agentName: 'Jamie', value: 9 }}
        medalClass="medal-3"
        format={formatNumber}
      />
    );
    const medal = container.querySelector('.badge-medal');
    expect(medal.getAttribute('aria-hidden')).toBe('true');
  });
});
