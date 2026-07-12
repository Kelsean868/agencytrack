import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RankedLeaderboardPanel from '../panels/RankedLeaderboardPanel';

vi.mock('../../../hooks/useCountUp', () => ({ useCountUp: (v) => v }));
vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

const YEAR = new Date().getFullYear();
const WK = `${YEAR}-01-07`;
const sub = (agentId, api, apps, agentName) => ({
  agentId, agentName, weekStarting: WK, status: 'submitted', version: 2,
  newBusiness: { api, apps },
});

const USERS = [
  { id: 'a1', name: 'Alice' },
  { id: 'a2', name: 'Bob' },
  { id: 'a3', name: 'Carol' },
  { id: 'a4', name: 'Dave' },
  { id: 'a5', name: 'Eve' },
];
const SUBS = [
  sub('a1', 100000, 5),
  sub('a2', 80000, 8),
  sub('a3', 60000, 3),
  sub('a4', 40000, 2),
  sub('a5', 20000, 1),
];

describe('RankedLeaderboardPanel (3.6)', () => {
  it('orders the podium runner-up · champion · third with the champion centered', () => {
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={SUBS} allUsers={USERS} />);
    const cards = Array.from(document.querySelectorAll('[data-testid^="podium-card-rank-"]'));
    // Visual DOM order is [rank2, rank1, rank3].
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      'podium-card-rank-2', 'podium-card-rank-1', 'podium-card-rank-3',
    ]);
  });

  it('ranks by API — Alice is champion (rank 1)', () => {
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={SUBS} allUsers={USERS} />);
    const champion = document.querySelector('[data-testid="podium-card-rank-1"]');
    expect(champion.textContent).toContain('Alice');
    expect(champion.textContent).toContain('Champion');
  });

  it('renders ranks 4–5 in the tail', () => {
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={SUBS} allUsers={USERS} />);
    expect(document.querySelector('[data-testid="tail-row-rank-4"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tail-row-rank-5"]')).not.toBeNull();
  });

  it('marks the chip for the active period', () => {
    render(<RankedLeaderboardPanel period="mtd" allSubmissions={SUBS} allUsers={USERS} />);
    expect(screen.getByTestId('period-chip-MTD').getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('period-chip-YTD').getAttribute('data-active')).toBe('false');
  });

  it('shows an empty state when there is no production for the period', () => {
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={[]} allUsers={USERS} />);
    expect(screen.getByText(/no production for this period/i)).toBeInTheDocument();
  });

  // SEC-012: when the kiosk cannot list users (allUsers=[]), the podium must
  // still show real names sourced from the submission-carried agentName rather
  // than degrading every agent to "Agent".
  it('resolves names from submission agentName when the roster is empty', () => {
    const namedSubs = [
      sub('a1', 100000, 5, 'Alice'),
      sub('a2', 80000, 8, 'Bob'),
      sub('a3', 60000, 3, 'Carol'),
    ];
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={namedSubs} allUsers={[]} />);
    const champion = document.querySelector('[data-testid="podium-card-rank-1"]');
    expect(champion.textContent).toContain('Alice');
    expect(champion.textContent).not.toContain('Agent');
  });

  it('prefers the roster name over the submission name when both exist', () => {
    // Roster says "Alice", submission carries a stale "Old Alice" — roster wins.
    const namedSubs = [sub('a1', 100000, 5, 'Old Alice')];
    render(<RankedLeaderboardPanel period="ytd" allSubmissions={namedSubs} allUsers={[{ id: 'a1', name: 'Alice' }]} />);
    const champion = document.querySelector('[data-testid="podium-card-rank-1"]');
    expect(champion.textContent).toContain('Alice');
    expect(champion.textContent).not.toContain('Old Alice');
  });
});
