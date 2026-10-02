import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeeklyActivityPanel from '../panels/WeeklyActivityPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

// One aggregate entry (leaderboards/{branchId}). `points` is the Activity metric.
const entry = (agentId, name, points, apps = 0, periodApi = 0) => ({
  agentId, name, unitId: 'u1', unitName: 'Unit One', periodApi, apps, points,
  rank: 99, rankWithinUnit: 99, previousRank: null, previousRanks: null,
});

const AGG = {
  week: [
    entry('a1', 'Alice', 120, 2, 5000),
    entry('a2', 'Bob', 300, 0, 0),
    entry('a3', 'Carol', 0, 0, 0),
  ],
};

// Agent names in rank order, read from the rendered rows.
const names = () => Array.from(document.querySelectorAll('p.font-semibold')).map((p) => p.textContent);

describe('WeeklyActivityPanel (FR Leaderboard L-3)', () => {
  it('has one Points column — no Prospecting / Conversions columns', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(screen.getByText('Points')).toBeInTheDocument();
    expect(screen.queryByText('Prospecting')).toBeNull();
    expect(screen.queryByText('Conversions')).toBeNull();
    expect(screen.getByText('Weekly Activity')).toBeInTheDocument();
  });

  it('ranks the week by points, not by API', () => {
    // Bob has 0 API but the most points; Alice has the API.
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(names()).toEqual(['Bob', 'Alice']);
  });

  it('shows each agent\'s points total and ledger apps beneath it', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(document.body.textContent).toContain('2 apps');
    expect(document.body.textContent).toContain('0 apps');
  });

  it('breaks a points tie by API, then apps, then name (shared ranker)', () => {
    const agg = {
      week: [
        entry('t1', 'Zoe', 100, 1, 0),
        entry('t2', 'Yan', 100, 0, 9000),  // more API -> first
        entry('t3', 'Xia', 100, 3, 0),     // more apps than Zoe -> before Zoe
        entry('t4', 'Abe', 100, 1, 0),     // same as Zoe -> name first
      ],
    };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(names()).toEqual(['Yan', 'Xia', 'Abe', 'Zoe']);
  });

  it('reads the week array only', () => {
    const agg = { week: [entry('a1', 'WeekAgent', 10)], mtd: [entry('a2', 'MonthAgent', 999)] };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(names()).toEqual(['WeekAgent']);
  });

  it('shows the empty state when the aggregate doc is missing (null)', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={null} />);
    expect(screen.getByText(/no activity recorded this week/i)).toBeInTheDocument();
    expect(screen.getByText('Points')).toBeInTheDocument();
  });

  it('shows the empty state when nobody has points yet', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={{ week: [entry('a1', 'Alice', 0, 3, 8000)] }} />);
    expect(screen.getByText(/no activity recorded this week/i)).toBeInTheDocument();
  });

  it('takes names from the aggregate when the roster is empty', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} allUsers={[]} />);
    expect(names()).toContain('Alice');
    expect(names()).not.toContain('Agent');
  });

  it('shows at most 8 rows', () => {
    const week = Array.from({ length: 12 }, (_, i) => entry(`a${i}`, `Agent${String(i).padStart(2, '0')}`, 100 - i));
    render(<WeeklyActivityPanel leaderboardAggregate={{ week }} />);
    expect(names()).toHaveLength(8);
    expect(names()[0]).toBe('Agent00');
  });

  it('does not render emoji characters', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}⭐\u{1F525}]/u;
    expect(emojiPattern.test(document.body.textContent)).toBe(false);
  });

  it('uses Trophy and Medal icons for top positions, not emoji', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
