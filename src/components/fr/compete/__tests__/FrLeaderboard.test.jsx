// @vitest-environment jsdom
//
// R2-11 — the FR Leaderboard reads the same state source as the Nexus surface
// (useProductionLeaderboard): on the API board, identical podium / ranks 4–8 /
// around-me in both scopes; the read-time derivations (rank per period, to
// pass, share, champions) are pinned; the error branch calls reload.
// FR Leaderboard L-2 — three boards (Activity · API · Apps): opens on Activity,
// not persisted; each board ranks, formats and words its own metric (D10–D12).

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
import { boardByPeriod, LEADERBOARD_BOARDS } from '../../../../lib/fr/leaderboardBoards';

// Points run in the REVERSE order of API (rank × 10), so the Activity board
// ranks differently from the API board. `previousRanks` is week-only, as L-1 writes it.
function mkEntry(rank, agentId, unitId, periodApi, rankWithinUnit, previousRank = null, previousRanks = null) {
  return {
    agentId, name: `Agent ${agentId}`, unitId, unitName: unitId === 'um-1' ? "Lee's Unit" : "Tony's Unit",
    periodApi, apps: rank, points: rank * 10, rank, rankWithinUnit, previousRank, previousRanks,
  };
}
const prev = (r) => ({ activity: r, api: r, apps: r });
// 12 agents so the viewer (rank 11 on API) sits below ranks 4–8 → around-me cluster.
const YTD = [
  mkEntry(1, 'a1', 'um-1', 900, 1), mkEntry(2, 'a2', 'um-2', 800, 1), mkEntry(3, 'a3', 'um-1', 700, 2),
  mkEntry(4, 'a4', 'um-2', 600, 2), mkEntry(5, 'a5', 'um-1', 500, 3), mkEntry(6, 'a6', 'um-2', 400, 3),
  mkEntry(7, 'a7', 'um-1', 300, 4), mkEntry(8, 'a8', 'um-2', 250, 4), mkEntry(9, 'a9', 'um-1', 200, 5),
  mkEntry(10, 'a10', 'um-2', 150, 5), mkEntry(11, 'me', 'um-1', 120, 6, 12), mkEntry(12, 'a12', 'um-1', 100, 7),
];
const WEEK = [
  mkEntry(1, 'a2', 'um-2', 90, 1, 1, prev(1)),
  mkEntry(2, 'me', 'um-1', 60, 1, 3, prev(3)),
  mkEntry(3, 'a1', 'um-1', 10, 2, 2, prev(2)),
];
const MTD = [mkEntry(1, 'me', 'um-1', 300, 1), mkEntry(2, 'a1', 'um-1', 200, 2)];
const BY_PERIOD = { week: WEEK, mtd: MTD, qtd: [], ytd: YTD };
const ZERO = { agentId: 'me', name: 'Agent me', unitId: 'um-1', periodApi: 0, apps: 0, points: 0, rank: 1, rankWithinUnit: 1 };

function stubWidth(matches) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function auth(role = 'agent', uid = 'me') {
  hoisted.useAuthMock.mockReturnValue({
    user: { uid }, userProfile: { name: 'Me Agent', branchName: 'South' }, tenantId: 'tatillife_south', role,
  });
}
function leaderboard(byPeriod = BY_PERIOD, docExtra = {}) {
  hoisted.useLeaderboardMock.mockReturnValue({
    loading: false, error: null, byPeriod, doc: { ytd: byPeriod.ytd, computedAt: '2026-09-30T09:05:00Z', ...docExtra }, reload,
  });
}
const reload = vi.fn();
const pickBoard = (id) => fireEvent.click(screen.getByTestId(`fr-leaderboard-board-${id}`));

beforeEach(() => {
  window.localStorage.clear();
  reload.mockClear();
  stubWidth(true);
  auth();
  leaderboard();
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
const agentNames = (texts) => texts.map((t) => (t.match(/Agent a\d+|Agent me|You/) ?? [null])[0]);

describe('FR Leaderboard — the API board matches the Nexus surface', () => {
  it.each([['branch', 'agent', 'me'], ['unit', 'unit_manager', 'um-1']])('same podium, ranks 4–8 and around-me (%s scope)', (scopeName, role, uid) => {
    // A unit manager's unit is keyed by their own uid (scopeFilter convention).
    auth(role, uid);
    render(<ProductionLeaderboardSurface />);
    if (scopeName === 'unit') fireEvent.click(screen.getByRole('tab', { name: 'My Unit' }));
    const nexus = nexusBoard();
    cleanup();
    render(<FrLeaderboard />);
    pickBoard('api');
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
    // The standing is branch-wide (arenaStanding); in unit scope the screen says so.
    if (scopeName === 'unit') {
      expect(screen.getByTestId('fr-leaderboard-branch-note')).toBeInTheDocument();
      expect(screen.getByTestId('fr-leaderboard-you').textContent).toContain('Your branch rank in each period');
      expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain("Your share of the unit's settled API");
    } else {
      expect(screen.queryByTestId('fr-leaderboard-branch-note')).toBeNull();
    }
  });
});

describe('FR Leaderboard — read-time derivations (API board)', () => {
  it('rank per period equals arenaStanding on the board, the selected period highlighted, a missing rank as —', () => {
    render(<FrLeaderboard />);
    pickBoard('api');
    const standing = arenaStanding(boardByPeriod(BY_PERIOD, 'api'), 'me', 'periodApi');
    for (const id of ['week', 'mtd', 'qtd', 'ytd']) {
      const col = screen.getByTestId(`fr-leaderboard-rankcol-${id}`);
      const expected = standing[id].rank == null ? '—' : `#${standing[id].rank}`;
      expect(col.textContent.startsWith(expected), id).toBe(true);
    }
    expect(screen.getByTestId('fr-leaderboard-you-rank').textContent).toBe('#11');
    expect(screen.getByTestId('fr-leaderboard-you-value').textContent).toBe('TTD 120 settled');
    // Movement is week-only (previousRanks): none on the year, "Up 1" on the week.
    expect(screen.queryByTestId('fr-leaderboard-moved')).toBeNull();
    fireEvent.click(screen.getByTestId('fr-leaderboard-period-wk'));
    expect(screen.getByTestId('fr-leaderboard-moved').textContent).toBe('Up 1 since last update');
  });

  it('to pass: the gap and the name of the agent above; "You lead" at #1', () => {
    render(<FrLeaderboard />);
    pickBoard('api');
    const box = screen.getByTestId('fr-leaderboard-topass');
    expect(box.textContent).toContain('TTD 30');
    expect(box.textContent).toContain('to pass Agent a10 (#10)');
    fireEvent.click(screen.getByTestId('fr-leaderboard-period-mtd'));
    expect(screen.getByTestId('fr-leaderboard-topass').textContent).toContain('You lead');
    const week = boardByPeriod(BY_PERIOD, 'api');
    expect(toPass(arenaStanding(week, 'me', 'periodApi'), 'week', week.week)).toMatchObject({ lead: false, gap: 30, aboveName: 'Agent a2', aboveRank: 1 });
  });

  it('share is mine ÷ the DISPLAYED ranking, and hidden when that sum is 0', () => {
    render(<FrLeaderboard />);
    pickBoard('api');
    const total = YTD.reduce((s, e) => s + e.periodApi, 0);
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain(`${Math.round((120 / total) * 100)}%`);
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain('Your share of branch settled API');
    const unit = YTD.filter((e) => e.unitId === 'um-1');
    expect(shareOfScope(unit, 'me', 'unit')).toMatchObject({ mine: 120, total: unit.reduce((s, e) => s + e.periodApi, 0), of: 'of the unit' });
    expect(shareOfScope([{ agentId: 'me', periodApi: 0 }, { agentId: 'x', periodApi: 0 }], 'me', 'branch')).toBeNull();
    expect(shareOfScope(YTD, 'me', 'branch', 'points')).toMatchObject({ mine: 110, total: 780 });
  });

  it('champions: amount, apps, points — and "No winner this week" for a missing category', () => {
    render(<FrLeaderboard />);
    const strip = screen.getByTestId('fr-leaderboard-champions');
    expect(strip.textContent).toContain('Week 39 champions');
    expect(screen.getByTestId('fr-leaderboard-champion-topAPI').textContent).toContain('TTD 45,250');
    expect(screen.getByTestId('fr-leaderboard-champion-topApps').textContent).toContain('3 apps');
    expect(screen.getByTestId('fr-leaderboard-champion-topActivity').textContent).toContain('No winner this week');
    expect(championsModel({ weekStarting: '2026-09-20', topActivity: { agentName: 'Z', value: 1 } }).cards[2].value).toBe('1 point');
    expect(championsModel({ weekStarting: '2026-09-20', topActivity: { agentName: 'Z', value: 1312 } }).cards[2].value).toBe('1,312 points');
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
});

describe('FR Leaderboard — three boards (L-2)', () => {
  const board = () => screen.getByRole('radiogroup', { name: 'Board' });

  it('opens on Activity: the switch is Activity · API · Apps, ranked by points', () => {
    render(<FrLeaderboard />);
    const radios = within(board()).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Activity', 'API', 'Apps']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByTestId('fr-leaderboard')).toHaveAttribute('data-board', 'activity');
    expect(screen.getByTestId('fr-leaderboard-podium').textContent).toContain("Who's putting in the work this year.");
    // Points are the reverse of API: a12 leads, you are #2.
    expect(screen.getByTestId('fr-podium-rank-1').textContent).toContain('Agent a12');
    expect(screen.getByTestId('fr-podium-rank-1').textContent).toContain('120 pts');
    expect(screen.getByTestId('fr-leaderboard-you-rank').textContent).toBe('#2');
    expect(screen.getByTestId('fr-leaderboard-you-value').textContent).toBe('110 pts');
    expect(screen.getByTestId('fr-leaderboard-topass').textContent).toContain('10 pts');
    expect(screen.getByTestId('fr-leaderboard-share').textContent).toContain('Your share of branch points');
  });

  it('each board ranks, words and formats its own metric', () => {
    render(<FrLeaderboard />);
    pickBoard('api');
    expect(screen.getByTestId('fr-leaderboard')).toHaveAttribute('data-board', 'api');
    expect(screen.getByTestId('fr-leaderboard-podium').textContent).toContain("Who's leading on API this year.");
    expect(screen.getByTestId('fr-podium-rank-1').textContent).toContain('Agent a1');
    expect(screen.getByTestId('fr-podium-rank-1').textContent).toContain('TTD 900');
    pickBoard('apps');
    expect(screen.getByTestId('fr-leaderboard-podium').textContent).toContain("Who's writing the most this year.");
    expect(screen.getByTestId('fr-podium-rank-1').textContent).toContain('12 apps');
    const rows = screen.getByTestId('fr-leaderboard-rows');
    expect(rows.textContent).toContain('Applications');
    expect(rows.textContent).toContain('Settled API');
    // The Apps board's second column is the agent's settled API: #4 on apps is a9 (9 apps, TTD 200).
    expect(within(rows).getByTestId('fr-leaderboard-row-4').textContent).toContain('Agent a9');
    expect(within(rows).getByTestId('fr-leaderboard-row-4').textContent).toContain('TTD 200');
  });

  it('board radios move with the arrow keys and wrap around', () => {
    render(<FrLeaderboard />);
    const activity = screen.getByTestId('fr-leaderboard-board-activity');
    fireEvent.keyDown(activity, { key: 'ArrowRight' });
    expect(screen.getByTestId('fr-leaderboard-board-api')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByTestId('fr-leaderboard-board-api'), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByTestId('fr-leaderboard-board-activity'), { key: 'ArrowLeft' });
    expect(screen.getByTestId('fr-leaderboard-board-apps')).toHaveAttribute('aria-checked', 'true');
  });

  it('the board choice is not persisted: every visit opens on Activity', () => {
    const { unmount } = render(<FrLeaderboard />);
    pickBoard('apps');
    unmount();
    render(<FrLeaderboard />);
    expect(screen.getByTestId('fr-leaderboard-board-activity')).toHaveAttribute('aria-checked', 'true');
  });

  it('footers carry the D11 copy; only Activity mentions skipped reports', () => {
    leaderboard(BY_PERIOD, { skippedNoBranch: { count: 2, agentIds: ['x'] } });
    render(<FrLeaderboard />);
    const footer = () => screen.getByTestId('fr-leaderboard-footer').textContent;
    const { activity, api, apps } = LEADERBOARD_BOARDS;
    expect(footer().startsWith(`${activity.footer} Test accounts are left out. Updated `)).toBe(true);
    expect(footer()).toContain('2 submissions skipped (no branch)');
    expect(footer()).not.toContain('Own and family');
    pickBoard('api');
    expect(footer().startsWith(`${api.footer} Own and family policies are left out. Test accounts are left out. Updated `)).toBe(true);
    expect(footer()).not.toContain('skipped');
    pickBoard('apps');
    expect(footer().startsWith(`${apps.footer} Own and family policies are left out. Test accounts are left out. Updated `)).toBe(true);
  });

  it('an all-zero period shows each board’s empty state and no standing', () => {
    leaderboard({ week: [], mtd: [], qtd: [], ytd: [ZERO] });
    render(<FrLeaderboard />);
    const empty = () => screen.getByTestId('fr-leaderboard-empty').textContent;
    expect(empty()).toBe('No activity logged this year yetThe board fills in as agents log their calls and meetings.');
    expect(screen.queryByTestId('fr-leaderboard-you')).toBeNull();
    pickBoard('api');
    expect(empty()).toBe('No settled business this year yetThe board fills in as policies settle in the ledger.');
    pickBoard('apps');
    expect(empty()).toBe('No applications this year yetThe board fills in as applications reach the ledger.');
  });

  it('a board with business is not empty just because another board is', () => {
    leaderboard({ week: [], mtd: [], qtd: [], ytd: [{ ...ZERO, points: 40 }] });
    render(<FrLeaderboard />);
    expect(screen.queryByTestId('fr-leaderboard-empty')).toBeNull();
    pickBoard('api');
    expect(screen.getByTestId('fr-leaderboard-empty')).toBeInTheDocument();
  });
});
