/**
 * Career "Your badges and trophies" card (R2-5, ruling R-c): the engine's own
 * count (useMyLeaderboardEntry + trophyRoom), and the way into the Trophy room.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ entry: vi.fn() }));
vi.mock('../useMyLeaderboardEntry', () => ({ default: (...a) => hoisted.entry(...a) }));

import CareerTrophiesCard from '../CareerTrophiesCard';
import CareerTrophiesCardView from '../CareerTrophiesCardView';
import { trophyRoom } from '../../../../lib/fr/competeModel';

describe('CareerTrophiesCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the engine count (badges + levels) from the leaderboard doc and opens the Trophy room', () => {
    // 3 engine badges + 3 levels at 2,100 pts (Rookie, Associate, Pro) = 6 of 9 + 5 = 14.
    hoisted.entry.mockReturnValue({ loading: false, error: false, retry: vi.fn(), entry: { badges: ['first_submission', 'streak_4', 'big_week'], points: 2100, weeklyStreak: 6 } });
    const onOpen = vi.fn();
    render(<CareerTrophiesCard tenantId="t1" uid="u1" onOpen={onOpen} />);
    expect(hoisted.entry).toHaveBeenCalledWith('t1', 'u1');
    expect(screen.getByRole('heading', { name: 'Your badges and trophies' })).toBeInTheDocument();
    expect(screen.getByTestId('career-trophy-count')).toHaveTextContent('6 of 14 earned');
    fireEvent.click(screen.getByRole('button', { name: /Open the Trophy room/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the count follows the engine doc, not client-side badge maths', () => {
    hoisted.entry.mockReturnValue({ loading: false, error: false, retry: vi.fn(), entry: { badges: ['first_submission'], points: 0, weeklyStreak: 1 } });
    render(<CareerTrophiesCard tenantId="t1" uid="u1" onOpen={() => {}} />);
    // 1 badge + the starting level (Rookie, 0 points).
    expect(screen.getByTestId('career-trophy-count')).toHaveTextContent('2 of 14 earned');
  });

  it('no engine doc yet: everything locked but the starting level, not an error', () => {
    hoisted.entry.mockReturnValue({ loading: false, error: false, retry: vi.fn(), entry: null });
    render(<CareerTrophiesCard tenantId="t1" uid="u1" onOpen={() => {}} />);
    expect(screen.getByTestId('career-trophy-count')).toHaveTextContent('1 of 14 earned');
  });

  it('loading shows a skeleton and no figure; error shows Retry and keeps the button', () => {
    const retry = vi.fn();
    hoisted.entry.mockReturnValue({ loading: true, error: false, retry, entry: null });
    const { rerender } = render(<CareerTrophiesCard tenantId="t1" uid="u1" onOpen={() => {}} />);
    expect(screen.queryByTestId('career-trophy-count')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    hoisted.entry.mockReturnValue({ loading: false, error: true, retry, entry: null });
    rerender(<CareerTrophiesCard tenantId="t1" uid="u1" onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Open the Trophy room/ })).toBeInTheDocument();
  });

  it('the pure view renders a given model (14 total: 9 badges + 5 levels)', () => {
    render(<CareerTrophiesCardView room={trophyRoom({ badges: [], points: 1500, weeklyStreak: 0 })} onOpen={() => {}} />);
    expect(screen.getByTestId('career-trophy-count')).toHaveTextContent('3 of 14 earned');
  });
});
