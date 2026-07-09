// @vitest-environment jsdom
//
// §1 states contract — the error card previously stopped at a message with
// no way to recover (audit: ProductionLeaderboardSurface ~433-446). Retry
// now re-invokes useLeaderboard's real fetch via the hook's `reload()`.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock:            vi.fn(),
  useLeaderboardMock:     vi.fn(),
  useWeeklyChampionsMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuthMock,
}));
vi.mock('../../../hooks/useLeaderboard', () => ({
  default: hoisted.useLeaderboardMock,
}));
vi.mock('../../../hooks/useWeeklyChampions', () => ({
  default: hoisted.useWeeklyChampionsMock,
}));
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

import ProductionLeaderboardSurface from '../ProductionLeaderboardSurface';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: 'me' },
    userProfile: { name: 'Test Viewer', branchId: 'south' },
    tenantId:    'tatillife_south',
  });
  hoisted.useWeeklyChampionsMock.mockReturnValue({
    champions: null, loading: false, error: null,
  });
});

describe('ProductionLeaderboardSurface — §1 states contract (error / retry)', () => {
  it('renders a persistent inline error card with a Retry button (never a toast)', () => {
    const reload = vi.fn();
    hoisted.useLeaderboardMock.mockReturnValue({
      loading: false,
      error: { code: 'unavailable', message: 'boom' },
      byPeriod: { week: [], mtd: [], qtd: [], ytd: [] },
      doc: null,
      reload,
    });

    render(<ProductionLeaderboardSurface />);

    const card = screen.getByTestId('production-leaderboard-error');
    expect(card).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry calls the hook\'s reload() — the same fetch path, not a fresh ad-hoc call', () => {
    const reload = vi.fn();
    hoisted.useLeaderboardMock.mockReturnValue({
      loading: false,
      error: { code: 'unavailable', message: 'boom' },
      byPeriod: { week: [], mtd: [], qtd: [], ytd: [] },
      doc: null,
      reload,
    });

    render(<ProductionLeaderboardSurface />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
