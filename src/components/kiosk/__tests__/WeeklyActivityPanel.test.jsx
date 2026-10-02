import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeeklyActivityPanel from '../panels/WeeklyActivityPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

// One aggregate entry (leaderboards/{branchId}) carrying `activity` (L-1b, A1-D4).
const entry = (agentId, name, activity) => ({
  agentId, name, unitId: 'u1', unitName: 'Unit One', periodApi: 0, apps: 0, points: 0,
  rank: 99, rankWithinUnit: 99, previousRank: null, previousRanks: null,
  ...(activity ? { activity } : {}),
});
const act = (names, calls, ffi, ci) => ({ names, calls, ffi, ci });

const AGG = {
  week: [
    entry('a1', 'Alice', act(4, 10, 1, 0)), // prospecting 14, conversions 1
    entry('a2', 'Bob', act(2, 3, 3, 2)),    // prospecting 5,  conversions 5
    entry('a3', 'Carol', act(0, 0, 0, 0)),  // nothing
  ],
};

const columnEl = (title) => screen.getByRole('heading', { name: title }).closest('div.flex.flex-col.h-full');
// Agent names in rank order for one column, read from the rendered rows.
const column = (title) => Array.from(columnEl(title).querySelectorAll('p.font-semibold')).map((p) => p.textContent);

describe('WeeklyActivityPanel (FR Leaderboard A1-D5)', () => {
  it('renders the two columns with their titles and subtitles, not a Points column', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(screen.getByText('Weekly Activity')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prospecting' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conversions' })).toBeInTheDocument();
    expect(screen.getByText('(Names + Calls)')).toBeInTheDocument();
    expect(screen.getByText('(FFIs + CIs)')).toBeInTheDocument();
    expect(screen.queryByText('Points')).toBeNull();
  });

  it('ranks Prospecting by names + calls and Conversions by FFIs + CIs, independently', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    expect(column('Prospecting')).toEqual(['Alice', 'Bob']);
    expect(column('Conversions')).toEqual(['Bob', 'Alice']);
  });

  it('shows each total and the per-row breakdown labels', () => {
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} />);
    const prosp = within(columnEl('Prospecting'));
    expect(prosp.getByText('14')).toBeInTheDocument();
    expect(prosp.getByText('4 names, 10 calls')).toBeInTheDocument();
    expect(prosp.getByText('2 names, 3 calls')).toBeInTheDocument();
    const conv = within(columnEl('Conversions'));
    expect(conv.getByText('3 FFIs, 2 CIs')).toBeInTheDocument();
    expect(conv.getByText('1 FFIs, 0 CIs')).toBeInTheDocument();
  });

  it('breaks a total tie by agent name ascending', () => {
    const agg = {
      week: [
        entry('t1', 'Zoe', act(5, 5, 2, 2)),
        entry('t2', 'Yan', act(5, 5, 2, 2)),
        entry('t3', 'Abe', act(5, 5, 2, 2)),
        entry('t4', 'Max', act(9, 9, 0, 0)),
      ],
    };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(column('Prospecting')).toEqual(['Max', 'Abe', 'Yan', 'Zoe']);
    expect(column('Conversions')).toEqual(['Abe', 'Yan', 'Zoe']);
  });

  it('assigns ranks 1..n per column', () => {
    // Ranks 1-3 render as icons; rank 4+ as "#n". Five agents show "#4" and "#5".
    const week = Array.from({ length: 5 }, (_, i) => entry(`r${i}`, `Agent${i}`, act(10 - i, 0, 0, 0)));
    render(<WeeklyActivityPanel leaderboardAggregate={{ week }} />);
    const prosp = within(columnEl('Prospecting'));
    expect(prosp.getByText('#4')).toBeInTheDocument();
    expect(prosp.getByText('#5')).toBeInTheDocument();
    expect(within(columnEl('Conversions')).queryByText('#1')).toBeNull();
  });

  it('omits an agent with a zero total from that column only', () => {
    // Alice: prospecting only. Dan: conversions only.
    const agg = { week: [entry('a1', 'Alice', act(3, 4, 0, 0)), entry('d1', 'Dan', act(0, 0, 2, 1))] };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(column('Prospecting')).toEqual(['Alice']);
    expect(column('Conversions')).toEqual(['Dan']);
  });

  it('shows at most 8 rows per column', () => {
    const week = Array.from({ length: 12 }, (_, i) =>
      entry(`a${i}`, `Agent${String(i).padStart(2, '0')}`, act(100 - i, 0, 50 - i, 0)));
    render(<WeeklyActivityPanel leaderboardAggregate={{ week }} />);
    expect(column('Prospecting')).toHaveLength(8);
    expect(column('Conversions')).toHaveLength(8);
    expect(column('Prospecting')[0]).toBe('Agent00');
  });

  it('reads the week array only', () => {
    const agg = {
      week: [entry('a1', 'WeekAgent', act(1, 1, 1, 1))],
      mtd: [entry('a2', 'MonthAgent', act(99, 99, 99, 99))],
    };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(column('Prospecting')).toEqual(['WeekAgent']);
  });

  it('takes the agent name from the entry, not the roster', () => {
    const users = [{ id: 'a1', name: 'Roster Name', photoURL: 'https://example.test/a1.jpg' }];
    render(<WeeklyActivityPanel leaderboardAggregate={AGG} allUsers={users} />);
    expect(column('Prospecting')).toContain('Alice');
    expect(column('Prospecting')).not.toContain('Roster Name');
  });

  it('falls back to the roster name, then "Agent", when the entry has no name', () => {
    const agg = { week: [entry('a1', '', act(1, 0, 0, 0)), entry('a2', '', act(2, 0, 0, 0))] };
    render(<WeeklyActivityPanel leaderboardAggregate={agg} allUsers={[{ id: 'a1', name: 'Roster Ann' }]} />);
    expect(column('Prospecting')).toEqual(['Agent', 'Roster Ann']);
  });

  describe('empty state: never fake zeros as rows', () => {
    const expectBothEmpty = () => {
      expect(screen.getByText('No prospecting recorded this week')).toBeInTheDocument();
      expect(screen.getByText('No conversions recorded this week')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Prospecting' })).toBeInTheDocument();
      expect(document.querySelectorAll('p.font-semibold')).toHaveLength(0);
    };

    it('when the aggregate doc is missing (null)', () => {
      render(<WeeklyActivityPanel leaderboardAggregate={null} />);
      expectBothEmpty();
    });

    it('when the aggregate has no week array', () => {
      render(<WeeklyActivityPanel leaderboardAggregate={{ mtd: [entry('a1', 'Alice', act(5, 5, 5, 5))] }} />);
      expectBothEmpty();
    });

    it('when entries lack `activity` (aggregate written before L-1b), even with points', () => {
      const week = [
        { ...entry('a1', 'Alice'), points: 300, apps: 2, periodApi: 5000 },
        { ...entry('a2', 'Bob'), points: 120 },
      ];
      render(<WeeklyActivityPanel leaderboardAggregate={{ week }} />);
      expectBothEmpty();
    });

    it('when every count is zero', () => {
      render(<WeeklyActivityPanel leaderboardAggregate={{ week: [entry('a1', 'Alice', act(0, 0, 0, 0))] }} />);
      expectBothEmpty();
    });
  });

  it('skips an entry without `activity` but still shows the others', () => {
    const week = [entry('a1', 'Alice'), entry('a2', 'Bob', act(1, 2, 0, 0))];
    render(<WeeklyActivityPanel leaderboardAggregate={{ week }} />);
    expect(column('Prospecting')).toEqual(['Bob']);
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

  it('does not change the stored aggregate', () => {
    const agg = { week: AGG.week.map((e) => ({ ...e, activity: { ...e.activity } })) };
    const before = JSON.stringify(agg);
    render(<WeeklyActivityPanel leaderboardAggregate={agg} />);
    expect(JSON.stringify(agg)).toBe(before);
  });
});
