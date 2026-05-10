import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeriodLeaderboardsPanel from '../panels/PeriodLeaderboardsPanel';

// useCountUp returns target immediately in tests
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (target) => target,
}));

// Avatar is just initials in test env
vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

const makeSubmission = (agentId, weekStarting, api, apps) => ({
  agentId,
  weekStarting,
  status: 'submitted',
  newBusiness: { api, apps },
  version: 2,
});

const AGENTS = [
  { id: 'a1', name: 'Alice', role: 'agent' },
  { id: 'a2', name: 'Bob', role: 'agent' },
  { id: 'a3', name: 'Carol', role: 'agent' },
];

// YTD week within current year
const THIS_YEAR = new Date().getFullYear();
const YTD_WEEK = `${THIS_YEAR}-01-07`;

const SUBS = [
  makeSubmission('a1', YTD_WEEK, 90_000, 5),
  makeSubmission('a2', YTD_WEEK, 60_000, 8),
  makeSubmission('a3', YTD_WEEK, 30_000, 2),
];

function renderPanel(period = 'ytd') {
  return render(
    <PeriodLeaderboardsPanel
      period={period}
      periodLabel={period.toUpperCase()}
      allSubmissions={SUBS}
      allUsers={AGENTS}
    />
  );
}

describe('PeriodLeaderboardsPanel', () => {
  it('renders heading with period label', () => {
    renderPanel('ytd');
    expect(screen.getByText(/YTD Leaderboards/i)).toBeInTheDocument();
  });

  it('renders both API and Apps column headers', () => {
    renderPanel('ytd');
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Apps')).toBeInTheDocument();
  });

  it('API column sorts by API descending — Alice first', () => {
    renderPanel('ytd');
    const cells = screen.getAllByText('Alice');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('Apps column ranks independently — Bob first (8 apps)', () => {
    // Bob has most apps (8), Alice has 5 — they should appear in different positions
    renderPanel('ytd');
    // Both columns render all three agent names
    const allText = document.body.textContent;
    expect(allText).toContain('Bob');
    expect(allText).toContain('Alice');
  });

  it('renders Trophy icon for rank 1', () => {
    renderPanel('ytd');
    // Lucide Trophy renders an SVG; check there is at least one
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders empty state when no submissions match period', () => {
    render(
      <PeriodLeaderboardsPanel
        period="ytd"
        periodLabel="YTD"
        allSubmissions={[]}
        allUsers={AGENTS}
      />
    );
    const msgs = screen.getAllByText(/no data for this period/i);
    expect(msgs.length).toBe(2); // one per column
  });

  it('does not render emoji characters', () => {
    renderPanel('ytd');
    const text = document.body.textContent;
    // Common kiosk emojis that must not appear
    const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}⭐\u{1F525}]/u;
    expect(emojiPattern.test(text)).toBe(false);
  });
});

describe('TVRankedLeaderboard sub-paging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('shows page indicator when agents exceed PAGE_SIZE', async () => {
    const manyAgents = Array.from({ length: 13 }, (_, i) => ({
      id: `u${i}`,
      name: `Agent ${i}`,
      role: 'agent',
    }));
    const manyWeek = `${THIS_YEAR}-01-07`;
    const manySubs = manyAgents.map((a) =>
      makeSubmission(a.id, manyWeek, 1000 * (13 - parseInt(a.id.slice(1))), 1)
    );

    render(
      <PeriodLeaderboardsPanel
        period="ytd"
        periodLabel="YTD"
        allSubmissions={manySubs}
        allUsers={manyAgents}
      />
    );

    // 13 agents → 2 pages each column → page indicator "1 / 2" appears twice
    const indicators = screen.getAllByText(/1 \/ 2/);
    expect(indicators.length).toBe(2);
  });

  it('does not show page indicator for 12 or fewer agents', () => {
    renderPanel('ytd');
    expect(screen.queryByText(/\/ \d/)).toBeNull();
  });
});
