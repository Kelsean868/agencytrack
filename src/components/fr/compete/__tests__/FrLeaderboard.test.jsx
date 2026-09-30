// @vitest-environment jsdom
//
// R2-11 — the FR Leaderboard reads the same state source as the Nexus surface
// (useProductionLeaderboard): identical podium / ranks 4–8 / around-me in both
// scopes; the new read-time derivations (rank per period, to pass, share,
// champions) are pinned; the error branch calls reload.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useLeaderboardMock: vi.fn(),
  useWeeklyChampionsMock: vi.fn(),
}));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: hoisted.useAuthMock }));
vi.mock('../../../../hooks/useLeaderboard', () => ({ default: hoisted.useLeaderboardMock }));
vi.mock('../../../../hooks/useWeeklyChampions', () => ({ default: hoisted.useWeeklyChampionsMock }));
vi.mock('../../../../hooks/useCountUp', () => ({ useCountUp: (v) => v }));

import ProductionLeaderboardSurface from '../../../leaderboard/ProductionLeaderboardSurface';
import FrLeaderboard from '../FrLeaderboard';
import { arenaStanding } from '../../../../lib/fr/competeModel';
import { shareOfScope, championsModel, toPass } from '../../../../lib/fr/leaderboardModel';

function mkEntry(rank, agentId, unitId, periodApi, rankWithinUnit, previousRank = null) {
  return {
    agentId, name: `Agent ${agentId}`, unitId, unitName: unitId === 'um-1' ? "Lee's Unit" : "Tony's Unit",
    periodApi, apps: rank, rank, rankWithinUnit, previousRank,
  };
}
// 12 agents so the viewer (rank 11) sits below ranks 4–8 → around-me cluster.
const YTD = [
  mkEntry(1, 'a1', 'um-1', 900, 1), mkEntry(2, 'a2', 'um-2', 800, 1), mkEntry(3, 'a3', 'um-1', 700, 2),
  mkEntry(4, 'a4', 'um-2', 600, 2), mkEntry(5, 'a5', 'um-1', 500, 3), mkEntry(6, 'a6', 'um-2', 400, 3),
  mkEntry(7, 'a7', 'um-1', 300, 4), mkEntry(8, 'a8', 'um-2', 250, 4), mkEntry(9, 'a9', 'um-1', 200, 5),
  mkEntry(10, 'a10', 'um-2', 150, 5), mkEntry(11, 'me', 'um-1', 120, 6, 12), mkEntry(12, 'a12', 'um-1', 100, 7),
];
const WEEK = [mkEntry(1, 'a2', 'um-2', 90, 1), mkEntry(2, 'me', 'um-1', 60, 1), mkEntry(3, 'a1', 'um-1', 10, 2)];
const MTD = [mkEntry(1, 'me', 'um-1', 300, 1), mkEntry(2, 'a1', 'um-1', 200, 2)];
const BY_PERIOD = { week: WEEK, mtd: MTD, qtd: [], ytd: YTD };

function stubWidth(matches) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function auth(role = 'agent', uid = 'me') {
  hoisted.useAuthMock.mockReturnValue({
    user: { uid }, userProfile: { name: 'Me Agent', branchName: 'South' }, tenantId: 'tatillife_south', role,
  });
}
const reload = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  reload.mockClear();
  stubWidth(true);
  auth();
  hoisted.useLeaderboardMock.mockReturnValue({
    loading: false, error: null, byPeriod: BY_PERIOD, doc: { ytd: YTD, computedAt: '2026-09-30T09:05:00Z' }, reload,
  });
  hoisted.useWeeklyChampionsMock.mockReturnValue({
    champions: {
      weekStarting: '2026-09-20',
      topAPI: { agentId: 'a1', agentName: 'Agent a1', value: 45250.4 },
      topApps: { agentId: 'a2', agentName: 'Agent a2', value: 3 },
      topActivity: null,
    },
    loading: false, error: null,
  });
});
afterEach(cleanup);

function nexusBoard() {
  const podium = [1, 2, 3].map((r) => screen.getAllByTestId(`podium-card-rank-${r}`)[0].textContent);
  const tail = [4, 5, 6, 7, 8].filter((r) => screen.queryAllByTestId(`tail-row-rank-${r}`).length > 0).map(String);
  const cluster = [...screen.getByTestId('around-me-desktop').querySelectorAll('[data-testid^="around-me-row-rank-"]')]
    .map((el) => el.getAttribute('data-testid').replace('around-me-row-rank-', ''));
  const gap = screen.queryByTestId('around-me-gap-divider')?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  return { podium, tail, cluster, gap };
}
function frBoard() {
  const podium = [1, 2, 3].map((r) => screen.getByTestId(`fr-podium-rank-${r}`).textContent);
  const rows = screen.getByTestId('fr-leaderboard-rows');
  const ranks = within(rows).queryAllByTestId(/^fr-leaderboard-row-/).map((el) => el.getAttribute('data-testid').replace('fr-leaderboard-row-', ''));
  const gap = within(rows).queryByTestId('fr-leaderboard-gap')?.textContent ?? null;
  return { podium, ranks, gap };
}
const agentNames = (texts) => texts.map((t) => (t.match(/Agent a\d+|You/) ?? [null])[0]);

describe('FR Leaderboard — one state source with the Nexus surface', () => {
  it.each([['branch', 'agent', 'me'], ['unit', 'unit_manager', 'um-1']])('same podium, ranks 4–8 and around-me (%s scope)', (scopeName, role, uid) => {
    // A unit manager's unit is keyed by their own uid (scopeFilter convention).
    auth(role, uid);
    render(<ProductionLeaderboardSurface />);
    if (scopeName === 'unit') fireEvent.click(screen.getByRole('tab', { name: 'My Unit' }));
    const nexus = nexusBoard();
    cleanup();
    render(<FrLeaderboard />);
    if (scopeName === 'unit') fireEvent.click(screen.getByRole('tab', { name: 'My Unit' }));
    const fr = frBoard();
    expect(agentNames(fr.podium)).toEqual(agentNames(nexus.podium));
    expect(nexus.tail.length).toBeGreaterThan(0);
    expect(fr.ranks.slice(0, nexus.tail.length)).toEqual(nexus.tail);
    expect(fr.ranks.slice(nexus.tail.length)).toEqual(nexus.cluster);
    expect(fr.gap?.replace(/\s+/g, ' ')).toEqual(nexus.gap?.replace('+ ', '+'));
    // Share is over the DISPLAYED ranking: the unit's total in unit scope.
    const displayed = scopeName === 'unit' ? YTD.filter((e) => e.unitId === 'um-1') : YTD;
    const total = displayed.reduce((sum, e) => sum + e.periodApi, 0);
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain(`of TTD ${total.toLocaleString('en-US')}`);
  });
});

describe('FR Leaderboard — read-time derivations', () => {
  it('rank per period equals arenaStanding, the selected period highlighted, a missing rank as —', () => {
    render(<FrLeaderboard />);
    const standing = arenaStanding(BY_PERIOD, 'me');
    for (const id of ['week', 'mtd', 'qtd', 'ytd']) {
      const col = screen.getByTestId(`fr-leaderboard-rankcol-${id}`);
      const expected = standing[id].rank == null ? '—' : `#${standing[id].rank}`;
      expect(col.textContent.startsWith(expected), id).toBe(true);
    }
    expect(screen.getByTestId('fr-leaderboard-you-rank').textContent).toBe('#11');
    expect(screen.getByTestId('fr-leaderboard-moved').textContent).toBe('Up 1 since last update');
  });

  it('to pass: the gap and the name of the agent above; "You lead" at #1', () => {
    render(<FrLeaderboard />);
    const box = screen.getByTestId('fr-leaderboard-topass');
    expect(box.textContent).toContain('TTD 30');
    expect(box.textContent).toContain('to pass Agent a10 (#10)');
    fireEvent.click(screen.getByTestId('fr-leaderboard-period-mtd'));
    expect(screen.getByTestId('fr-leaderboard-topass').textContent).toContain('You lead');
    expect(toPass(arenaStanding(BY_PERIOD, 'me'), 'week', WEEK)).toMatchObject({ lead: false, gap: 30, aboveName: 'Agent a2', aboveRank: 1 });
  });

  it('share is mine ÷ the DISPLAYED ranking, and hidden when that sum is 0', () => {
    render(<FrLeaderboard />);
    const total = YTD.reduce((s, e) => s + e.periodApi, 0);
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain(`${Math.round((120 / total) * 100)}%`);
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain('of the branch');
    const unit = YTD.filter((e) => e.unitId === 'um-1');
    expect(shareOfScope(unit, 'me', 'unit')).toMatchObject({ mine: 120, total: unit.reduce((s, e) => s + e.periodApi, 0), of: 'of the unit' });
    expect(shareOfScope([{ agentId: 'me', periodApi: 0 }, { agentId: 'x', periodApi: 0 }], 'me', 'branch')).toBeNull();
  });

  it('champions: amount, apps, activities — and "No winner this week" for a missing category', () => {
    render(<FrLeaderboard />);
    const strip = screen.getByTestId('fr-leaderboard-champions');
    expect(strip.textContent).toContain('Week 39 champions');
    expect(screen.getByTestId('fr-leaderboard-champion-topAPI').textContent).toContain('TTD 45,250');
    expect(screen.getByTestId('fr-leaderboard-champion-topApps').textContent).toContain('3 apps');
    expect(screen.getByTestId('fr-leaderboard-champion-topActivity').textContent).toContain('No winner this week');
    expect(championsModel({ weekStarting: '2026-09-20', topActivity: { agentName: 'Z', value: 1 } }).cards[2].value).toBe('1 activity');
  });

  it('period radios move with the arrow keys', () => {
    render(<FrLeaderboard />);
    const ytd = screen.getByRole('radio', { name: 'Year' });
    expect(ytd).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(ytd, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Week' }), { key: 'ArrowLeft' });
    expect(ytd).toHaveAttribute('aria-checked', 'true');
  });

  it('the error branch shows the permission copy and Retry calls reload', () => {
    hoisted.useLeaderboardMock.mockReturnValue({ loading: false, error: { code: 'permission-denied' }, byPeriod: BY_PERIOD, doc: null, reload });
    render(<FrLeaderboard />);
    expect(screen.getByTestId('fr-leaderboard-error').textContent).toContain("You don't have access to this branch's rankings.");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an all-zero period shows the empty state and no standing', () => {
    hoisted.useLeaderboardMock.mockReturnValue({ loading: false, error: null, byPeriod: { week: [], mtd: [], qtd: [], ytd: [mkEntry(1, 'me', 'um-1', 0, 1)] }, doc: {}, reload });
    render(<FrLeaderboard />);
    expect(screen.getByTestId('fr-leaderboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-leaderboard-you')).toBeNull();
  });
});
