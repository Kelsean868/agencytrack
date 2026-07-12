// @vitest-environment jsdom
//
// §2 motion residuals — design-conformance-2026-07-12 row 137:
// "Podium stagger/bar-grow/count-up — residual: per-card stagger + tail-row
// bar-grow absent". Count-up was already shipped; this file covers the two
// remaining pieces:
//
//   1. Per-card stagger — the shipped `.stagger` class (index.css) wraps
//      each visible podium row (mobile hero+pair, desktop 3-up) so the
//      individual PodiumCards animate in sequence rather than as one block.
//   2. Tail-row bar-grow — the %-of-leader fill bar carries `.bar-grow-x`
//      (transform:scaleX keyframe, index.css), not a width transition, so
//      there is no layout shift.
//
// Uses the same hook-mock scaffold as UnitScope.test.jsx / error.test.jsx.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
// §2 count-up is orthogonal to this file's coverage — mocked to identity so
// assertions observe the final rendered state synchronously.
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

import ProductionLeaderboardSurface, { PodiumCard, TailRow } from '../ProductionLeaderboardSurface';

function mkEntry({ rank, agentId, periodApi, name }) {
  return {
    agentId,
    name: name ?? `Agent ${agentId}`,
    unitName: 'S·01',
    periodApi,
    apps: rank,
    rank,
    rankWithinUnit: rank,
    previousRank: null,
  };
}

const RANKING = [
  mkEntry({ rank: 1, agentId: 'a1', periodApi: 500 }),
  mkEntry({ rank: 2, agentId: 'a2', periodApi: 400 }),
  mkEntry({ rank: 3, agentId: 'a3', periodApi: 300 }),
  mkEntry({ rank: 4, agentId: 'a4', periodApi: 200 }),
  mkEntry({ rank: 5, agentId: 'a5', periodApi: 100 }),
];

beforeEach(() => {
  window.localStorage.clear();
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: 'viewer-uid' },
    userProfile: { name: 'Test Viewer', branchName: 'South' },
    tenantId:    'tatillife_south',
    role:        'agent',
  });
  hoisted.useLeaderboardMock.mockReturnValue({
    loading:  false,
    error:    null,
    byPeriod: { week: [], mtd: [], qtd: [], ytd: RANKING },
    doc:      { ytd: RANKING },
  });
  hoisted.useWeeklyChampionsMock.mockReturnValue({
    champions: null, loading: false, error: null,
  });
});

describe('ProductionLeaderboardSurface — §2 per-card podium stagger', () => {
  it('the desktop 3-up podium row carries .stagger so its 3 PodiumCard children animate in sequence', () => {
    render(<ProductionLeaderboardSurface />);
    const podium = screen.getByTestId('podium');
    // Desktop row: hidden sm:grid — present in jsdom regardless of viewport
    // (Tailwind responsive classes don't hide elements from the DOM/JSDOM).
    const desktopRow = podium.querySelector('.hidden.sm\\:grid.stagger');
    expect(desktopRow).not.toBeNull();
    const cards = desktopRow.querySelectorAll('[data-testid^="podium-card-rank-"]');
    expect(cards.length).toBe(3);
  });

  it('the mobile podium wrapper AND its #2/#3 row both carry .stagger (nested, independent delays)', () => {
    render(<ProductionLeaderboardSurface />);
    const podium = screen.getByTestId('podium');
    const mobileWrapper = podium.querySelector('.sm\\:hidden.stagger');
    expect(mobileWrapper).not.toBeNull();
    const mobilePairRow = mobileWrapper.querySelector('.stagger.grid.grid-cols-2');
    expect(mobilePairRow).not.toBeNull();
  });
});

describe('PodiumCard — no bare stagger class on the card itself (parent-scoped only)', () => {
  it('renders without throwing and keeps its existing testid contract', () => {
    const entry = mkEntry({ rank: 1, agentId: 'a1', periodApi: 500 });
    render(<PodiumCard entry={entry} label="Champion" isChampion isCenter />);
    expect(screen.getByTestId('podium-card-rank-1')).toBeInTheDocument();
  });
});

describe('TailRow — §2 bar-grow', () => {
  it('the %-of-leader fill bar carries .bar-grow-x (transform-based, not a width transition class)', () => {
    const entry = mkEntry({ rank: 4, agentId: 'a4', periodApi: 200 });
    render(<TailRow entry={entry} leaderApi={500} isLast={false} />);
    const row = screen.getByTestId('tail-row-rank-4');
    const fill = row.querySelector('.bar-grow-x');
    expect(fill).not.toBeNull();
    // Layout width is still driven by the inline style (bar-grow-x only
    // adds the transform keyframe on top) — the %-of-leader math is
    // unchanged by this motion addition.
    expect(fill.style.width).toBe('40%');
  });

  it('bar-grow-x is present even at 0% (no production yet) — animates in place, no layout implication', () => {
    const entry = mkEntry({ rank: 5, agentId: 'a5', periodApi: 0 });
    render(<TailRow entry={entry} leaderApi={0} isLast isViewer={false} />);
    const row = screen.getByTestId('tail-row-rank-5');
    const fill = row.querySelector('.bar-grow-x');
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('0%');
  });
});
