// @vitest-environment jsdom
/**
 * R2-5 / ruling R-c: under the FR look (onOpenTrophies given) Career shows the
 * "Your badges and trophies" card instead of the badge grid; under Nexus (no
 * prop) the grid stays, because the Trophy room exists only under FR.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getGoals: vi.fn(),
  setGoals: vi.fn(),
  getCompanyMinimums: vi.fn(),
  aggregatePersistency: vi.fn(),
  entry: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/goalsService', () => ({
  getGoals: hoisted.getGoals,
  setGoals: hoisted.setGoals,
  getCompanyMinimums: hoisted.getCompanyMinimums,
}));
vi.mock('../../../lib/persistency/calculations', () => ({ aggregatePersistency: hoisted.aggregatePersistency }));
vi.mock('../../gamification/BadgeGrid', () => ({ default: () => <div data-testid="badge-grid" /> }));
vi.mock('../../goals/CommissionPlayground', () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel', () => ({ default: () => null }));
vi.mock('../../fr/compete/useMyLeaderboardEntry', () => ({ default: (...a) => hoisted.entry(...a) }));

import CareerPortal from '../CareerPortal';

describe('CareerPortal — badge grid merged into the Trophy room (R2-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ user: { uid: 'u1' }, userProfile: { unitId: 'unit1', role: 'agent' }, role: 'agent', tenantId: 't1' });
    hoisted.getGoals.mockResolvedValue([]);
    hoisted.getCompanyMinimums.mockResolvedValue({});
    hoisted.aggregatePersistency.mockReturnValue(0);
    hoisted.entry.mockReturnValue({ loading: false, error: false, retry: vi.fn(), entry: { badges: ['first_submission', 'streak_4', 'big_week'], points: 2100, weeklyStreak: 6 } });
  });

  it('FR look: no BadgeGrid; the card shows the engine count and navigates to the Trophy room', () => {
    const onOpenTrophies = vi.fn();
    render(<CareerPortal submissions={[]} onOpenTrophies={onOpenTrophies} />);
    expect(screen.queryByTestId('badge-grid')).toBeNull();
    expect(hoisted.entry).toHaveBeenCalledWith('t1', 'u1');
    expect(screen.getByRole('heading', { name: 'Your badges and trophies' })).toBeInTheDocument();
    expect(screen.getByTestId('career-trophy-count')).toHaveTextContent('6 of 14 earned');
    fireEvent.click(screen.getByRole('button', { name: /Open the Trophy room/ }));
    expect(onOpenTrophies).toHaveBeenCalledTimes(1);
  });

  it('Nexus look (no Trophy room): the badge grid stays, no card and no engine read', () => {
    render(<CareerPortal submissions={[]} />);
    expect(screen.getByTestId('badge-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('career-trophies-card')).toBeNull();
    expect(hoisted.entry).not.toHaveBeenCalled();
  });
});
