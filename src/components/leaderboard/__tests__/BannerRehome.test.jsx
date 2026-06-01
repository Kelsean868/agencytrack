// @vitest-environment jsdom
//
// Track J banner re-home — surface-level integration tests.
//
// Verifies:
//   1. ProductionLeaderboardSurface mounts WeeklyChampionsBanner at the top
//      (above the period chips), reusing the existing component unchanged.
//   2. Populated champions doc → three champion cards render with name +
//      formatted value per category (topAPI, topApps, topActivity).
//   3. All-null champions doc → the banner's existing "No data yet" state
//      renders honestly (3 locked-medal cards + "No submissions" subtitle).
//   4. Loading state → the banner's skeleton renders.
//
// The doc-key match (`prevWeekStarting` == CF's `priorWeekStartingString`)
// is covered by `src/lib/leaderboard/__tests__/prevWeekStarting.test.js`
// against the CJS twin's `getPeriodBoundaries`.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Hoisted mock controllers so we can override per-test.
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

// Import AFTER the mocks so the surface picks them up.
import ProductionLeaderboardSurface from '../ProductionLeaderboardSurface';

const POPULATED = {
  weekStarting: '2026-05-24',
  topAPI:      { agentId: 'a1', agentName: 'Alpha Agent', value: 12500 },
  topApps:     { agentId: 'a2', agentName: 'Beta Agent',  value: 7 },
  topActivity: { agentId: 'a3', agentName: 'Gamma Agent', value: 18 },
};

const EMPTY = {
  weekStarting: '2026-05-24',
  topAPI:      null,
  topApps:     null,
  topActivity: null,
};

const NON_EMPTY_RANKING = [
  { agentId: 'a1', name: 'Alpha Agent', rank: 1, periodApi: 12500, apps: 5, rankWithinUnit: 1, unitId: 'u1', unitName: 'S·01' },
  { agentId: 'a2', name: 'Beta Agent',  rank: 2, periodApi: 9000,  apps: 4, rankWithinUnit: 2, unitId: 'u1', unitName: 'S·01' },
  { agentId: 'a3', name: 'Gamma Agent', rank: 3, periodApi: 6000,  apps: 3, rankWithinUnit: 1, unitId: 'u2', unitName: 'S·02' },
];

beforeEach(() => {
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: 'me' },
    userProfile: { name: 'Test Viewer', branchId: 'south' },
    tenantId:    'tatillife_south',
  });
  hoisted.useLeaderboardMock.mockReturnValue({
    loading: false,
    error:   null,
    byPeriod: { week: [], mtd: [], qtd: [], ytd: NON_EMPTY_RANKING },
    doc:      { ytd: NON_EMPTY_RANKING },
  });
});

describe('ProductionLeaderboardSurface — banner re-home', () => {
  it('mounts WeeklyChampionsBanner at the top of the surface', () => {
    hoisted.useWeeklyChampionsMock.mockReturnValue({
      champions: POPULATED, loading: false, error: null,
    });

    render(<ProductionLeaderboardSurface />);

    const surface = screen.getByTestId('production-leaderboard-surface');
    // Three champion cards is the banner's rendered shape when populated.
    const cards = within(surface).getAllByTestId('champion-card');
    expect(cards).toHaveLength(3);

    // The banner sits ABOVE the period chips — assert by DOM order.
    const tablist = surface.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const bannerNode = cards[0].closest('div.rounded-xl');
    expect(bannerNode).not.toBeNull();
    // compareDocumentPosition: bit 2 (DOCUMENT_POSITION_FOLLOWING) set means
    // `bannerNode` precedes `tablist` in the DOM — i.e., the banner is above
    // the period chips.
    expect(bannerNode.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('populated doc → three champion cards render with name + formatted value', () => {
    hoisted.useWeeklyChampionsMock.mockReturnValue({
      champions: POPULATED, loading: false, error: null,
    });

    render(<ProductionLeaderboardSurface />);

    const cards = screen.getAllByTestId('champion-card');
    expect(cards).toHaveLength(3);

    // Top API card — name + currency-formatted value
    const apiCard = cards.find((c) => /Top API/i.test(c.textContent));
    expect(apiCard).toBeDefined();
    expect(apiCard.textContent).toContain('Alpha Agent');
    expect(apiCard.textContent).toMatch(/12,?500/); // formatCurrency output

    // Top Apps card — integer value
    const appsCard = cards.find((c) => /Top Apps/i.test(c.textContent));
    expect(appsCard).toBeDefined();
    expect(appsCard.textContent).toContain('Beta Agent');
    expect(appsCard.textContent).toContain('7');

    // Top Activity card — integer value
    const actCard = cards.find((c) => /Top Activity/i.test(c.textContent));
    expect(actCard).toBeDefined();
    expect(actCard.textContent).toContain('Gamma Agent');
    expect(actCard.textContent).toContain('18');
  });

  it('all-null doc → honest "No data yet" empty state (3 locked-medal cards + empty subtitle)', () => {
    hoisted.useWeeklyChampionsMock.mockReturnValue({
      champions: EMPTY, loading: false, error: null,
    });

    render(<ProductionLeaderboardSurface />);

    const cards = screen.getAllByTestId('champion-card');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.textContent).toContain('No data yet');
    }
    // Banner's empty-week subtitle copy from WeeklyChampionsBanner.jsx
    expect(screen.getByText(/No submissions recorded last week/i)).toBeInTheDocument();
  });

  it('loading state → banner shows skeleton (no champion-card testids yet)', () => {
    hoisted.useWeeklyChampionsMock.mockReturnValue({
      champions: null, loading: true, error: null,
    });

    render(<ProductionLeaderboardSurface />);

    // Banner skeleton path renders 3 placeholder containers but no
    // data-testid="champion-card" until champions resolve.
    expect(screen.queryAllByTestId('champion-card')).toHaveLength(0);
  });

  it('null champions + not loading → banner returns null (no row, surface still mounts)', () => {
    hoisted.useWeeklyChampionsMock.mockReturnValue({
      champions: null, loading: false, error: null,
    });

    render(<ProductionLeaderboardSurface />);

    // Banner's `if (!champions) return null;` guard fires → no cards/skeleton.
    expect(screen.queryAllByTestId('champion-card')).toHaveLength(0);
    // Surface still mounts.
    expect(screen.getByTestId('production-leaderboard-surface')).toBeInTheDocument();
  });
});
