import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RankedLeaderboardPanel from '../panels/RankedLeaderboardPanel';

vi.mock('../../../hooks/useCountUp', () => ({ useCountUp: (v) => v }));
vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

// One aggregate entry (leaderboards/{branchId}): ledger API + apps + points.
const entry = (agentId, name, periodApi, apps, extra = {}) => ({
  agentId, name, unitId: 'u1', unitName: 'Unit One', periodApi, apps, points: 0,
  rank: 99, rankWithinUnit: 99, previousRank: null, previousRanks: null, ...extra,
});

const ENTRIES = [
  entry('a1', 'Alice', 100000, 5),
  entry('a2', 'Bob', 80000, 8),
  entry('a3', 'Carol', 60000, 3),
  entry('a4', 'Dave', 40000, 2),
  entry('a5', 'Eve', 20000, 1),
];
const AGG = { week: ENTRIES, mtd: ENTRIES, qtd: ENTRIES, ytd: ENTRIES, sources: { api: 'ledger', apps: 'ledger', points: 'activity' } };

const championText = () => document.querySelector('[data-testid="podium-card-rank-1"]').textContent;

describe('RankedLeaderboardPanel (FR Leaderboard L-3)', () => {
  it('orders the podium runner-up · champion · third with the champion centered', () => {
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={AGG} />);
    const cards = Array.from(document.querySelectorAll('[data-testid^="podium-card-rank-"]'));
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      'podium-card-rank-2', 'podium-card-rank-1', 'podium-card-rank-3',
    ]);
  });

  it('ranks by settled API (periodApi), not by the stored rank', () => {
    // Stored ranks are all 99 and Bob has more apps — only periodApi decides.
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={AGG} />);
    expect(championText()).toContain('Alice');
    expect(championText()).toContain('Champion');
    expect(championText()).toContain('TTD 100.0K');
  });

  it('shows the ledger apps under each podium name', () => {
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={AGG} />);
    expect(championText()).toContain('5 apps');
    expect(document.querySelector('[data-testid="podium-card-rank-2"]').textContent).toContain('8 apps');
  });

  it('breaks an API tie by apps, then points, then name (shared ranker)', () => {
    const tied = [
      entry('t1', 'Zoe', 50000, 2, { points: 10 }),
      entry('t2', 'Yan', 50000, 3, { points: 0 }),   // more apps -> first
      entry('t3', 'Xia', 50000, 2, { points: 90 }),  // same apps, more points -> before Zoe
      entry('t4', 'Abe', 50000, 2, { points: 10 }),  // same apps+points -> name before Zoe
    ];
    render(<RankedLeaderboardPanel period="week" leaderboardAggregate={{ week: tied }} />);
    expect(document.querySelector('[data-testid="podium-card-rank-1"]').textContent).toContain('Yan');
    expect(document.querySelector('[data-testid="podium-card-rank-2"]').textContent).toContain('Xia');
    expect(document.querySelector('[data-testid="podium-card-rank-3"]').textContent).toContain('Abe');
    expect(document.querySelector('[data-testid="tail-row-rank-4"]').textContent).toContain('Zoe');
  });

  it('uses the period array that matches the panel (quarter -> qtd)', () => {
    const agg = {
      week: [entry('a1', 'WeekLeader', 10, 1)],
      mtd: [entry('a1', 'MonthLeader', 10, 1)],
      qtd: [entry('a1', 'QuarterLeader', 10, 1)],
      ytd: [entry('a1', 'YearLeader', 10, 1)],
    };
    render(<RankedLeaderboardPanel period="quarter" leaderboardAggregate={agg} />);
    expect(championText()).toContain('QuarterLeader');
  });

  it('renders ranks 4–5 in the tail', () => {
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={AGG} />);
    expect(document.querySelector('[data-testid="tail-row-rank-4"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tail-row-rank-5"]')).not.toBeNull();
  });

  it('marks the chip for the active period', () => {
    render(<RankedLeaderboardPanel period="mtd" leaderboardAggregate={AGG} />);
    expect(screen.getByTestId('period-chip-MTD').getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('period-chip-YTD').getAttribute('data-active')).toBe('false');
  });

  it('shows the empty state when the aggregate doc is missing (null)', () => {
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={null} />);
    expect(screen.getByText(/no production for this period/i)).toBeInTheDocument();
    expect(document.querySelector('[data-testid^="podium-card-rank-"]')).toBeNull();
  });

  it('shows the empty state when every agent is at zero for the period', () => {
    const zeros = [entry('a1', 'Alice', 0, 0), entry('a2', 'Bob', 0, 0)];
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={{ ytd: zeros }} />);
    expect(screen.getByText(/no production for this period/i)).toBeInTheDocument();
  });

  it('leaves out agents with nothing on the board but keeps one with apps only', () => {
    const rows = [entry('a1', 'Alice', 0, 0), entry('a2', 'Bob', 0, 2), entry('a3', 'Carol', 5000, 1)];
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={{ ytd: rows }} />);
    expect(championText()).toContain('Carol');
    expect(document.querySelector('[data-testid="podium-card-rank-2"]').textContent).toContain('Bob');
    expect(document.body.textContent).not.toContain('Alice');
  });

  it('takes the name from the aggregate when the roster is empty (kiosk cannot list users)', () => {
    render(<RankedLeaderboardPanel period="ytd" leaderboardAggregate={AGG} allUsers={[]} />);
    expect(championText()).toContain('Alice');
    expect(championText()).not.toContain('Agent');
  });

  it('uses the roster only for the photo', () => {
    render(
      <RankedLeaderboardPanel
        period="ytd"
        leaderboardAggregate={AGG}
        allUsers={[{ id: 'a1', name: 'Roster Name', photoURL: 'https://example.test/a1.jpg' }]}
      />,
    );
    // Name still comes from the aggregate; the avatar mock echoes agent.name.
    expect(championText()).toContain('Alice');
  });
});
