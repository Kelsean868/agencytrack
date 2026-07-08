// @vitest-environment jsdom
//
// Track J P5a — unit-scope surface integration tests.
//
// Covers:
//   1. Role gating — agent shows NO control; UM shows segmented; BM shows
//      segmented + unit-picker.
//   2. Scope filter applied to the surface — selecting My Unit re-scopes
//      the podium + tail + around-me + subtitle.
//   3. Persistence round-trip — set scope as UM, unmount, remount → scope
//      restored from localStorage (keyed by UID).
//   4. localStorage is per-UID — UM persistence does NOT bleed to another UID.
//
// The exhaustive filter/re-rank/rescale math lives in scopeFilter.test.js.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

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
// §2 count-up — PodiumCard's API figure now animates via useCountUp on
// mount. Mocked to the identity function so this file's assertions observe
// the final rendered state synchronously.
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

import ProductionLeaderboardSurface from '../ProductionLeaderboardSurface';

// ── Fixture: a 6-agent branch with two units; UM 'um-1' manages unit 'um-1' ──

function mkEntry({ rank, rankWithinUnit, agentId, unitId, periodApi, name }) {
  return {
    agentId,
    name: name ?? `Agent ${agentId}`,
    unitId,
    unitName: unitId === 'um-1' ? "Lee's Unit" : "Tony's Unit",
    periodApi,
    apps: 1,
    rank,
    rankWithinUnit,
    previousRank: null,
  };
}

const BRANCH = [
  mkEntry({ rank: 1, rankWithinUnit: 1, agentId: 'a1', unitId: 'um-1', periodApi: 500 }),
  mkEntry({ rank: 2, rankWithinUnit: 1, agentId: 'a4', unitId: 'um-2', periodApi: 400 }),
  mkEntry({ rank: 3, rankWithinUnit: 2, agentId: 'a2', unitId: 'um-1', periodApi: 300 }),
  mkEntry({ rank: 4, rankWithinUnit: 2, agentId: 'a5', unitId: 'um-2', periodApi: 200 }),
  mkEntry({ rank: 5, rankWithinUnit: 3, agentId: 'a3', unitId: 'um-1', periodApi: 100 }),
  mkEntry({ rank: 6, rankWithinUnit: 4, agentId: 'a6', unitId: 'um-1', periodApi: 50 }),
];

function authMock({ role, uid }) {
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid },
    userProfile: { name: 'Test User', branchName: 'South' },
    tenantId:    'tatillife_south',
    role,
  });
}

beforeEach(() => {
  // Clean localStorage between tests so persistence assertions are
  // deterministic.
  window.localStorage.clear();
  hoisted.useLeaderboardMock.mockReturnValue({
    loading:  false,
    error:    null,
    byPeriod: { week: [], mtd: [], qtd: [], ytd: BRANCH },
    doc:      { ytd: BRANCH },
  });
  hoisted.useWeeklyChampionsMock.mockReturnValue({
    champions: null, loading: false, error: null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role gating
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductionLeaderboardSurface — scope control role gating', () => {
  it('agent → NO scope control (the control element is absent)', () => {
    authMock({ role: 'agent', uid: 'a1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.queryByTestId('leaderboard-scope-control')).not.toBeInTheDocument();
    // Subtitle still renders, showing branch + period + count
    const subtitle = screen.getByTestId('leaderboard-scope-subtitle');
    expect(subtitle.getAttribute('data-scope')).toBe('branch');
    expect(subtitle.getAttribute('data-count')).toBe('6');
  });

  it('unit_manager → 2-segment My Unit / My Branch (no picker)', () => {
    authMock({ role: 'unit_manager', uid: 'um-1' });
    render(<ProductionLeaderboardSurface />);
    const ctl = screen.getByTestId('leaderboard-scope-control');
    expect(ctl.getAttribute('data-role')).toBe('unit_manager');
    expect(screen.getByTestId('leaderboard-scope-myunit')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-scope-mybranch')).toBeInTheDocument();
    // UM gets NO unit-picker
    expect(screen.queryByTestId('leaderboard-scope-unit-picker')).not.toBeInTheDocument();
  });

  it('branch_manager → My Branch segment + unit-picker with derived options', () => {
    authMock({ role: 'branch_manager', uid: 'bm-1' });
    render(<ProductionLeaderboardSurface />);
    const ctl = screen.getByTestId('leaderboard-scope-control');
    expect(ctl.getAttribute('data-role')).toBe('branch_manager');
    expect(screen.getByTestId('leaderboard-scope-mybranch')).toBeInTheDocument();
    const picker = screen.getByTestId('leaderboard-scope-unit-picker');
    const options = within(picker).getAllByRole('option');
    // 1 placeholder + 2 distinct units (um-1, um-2)
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['', 'um-1', 'um-2']);
  });

  it('sales_manager → NO control (P5b parked)', () => {
    authMock({ role: 'sales_manager', uid: 'sm-1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.queryByTestId('leaderboard-scope-control')).not.toBeInTheDocument();
  });

  it('tenant_admin / platform_admin → NO control', () => {
    authMock({ role: 'tenant_admin', uid: 'ta-1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.queryByTestId('leaderboard-scope-control')).not.toBeInTheDocument();

    cleanup();

    authMock({ role: 'platform_admin', uid: 'pa-1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.queryByTestId('leaderboard-scope-control')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scope filter applied to the surface
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductionLeaderboardSurface — scope filter re-scopes the surface', () => {
  it('UM defaults to My Branch (subtitle shows branch + 6 agents)', () => {
    authMock({ role: 'unit_manager', uid: 'um-1' });
    render(<ProductionLeaderboardSurface />);
    const subtitle = screen.getByTestId('leaderboard-scope-subtitle');
    expect(subtitle.getAttribute('data-scope')).toBe('branch');
    expect(subtitle.getAttribute('data-count')).toBe('6');
    expect(subtitle.textContent).toMatch(/South · YTD · 6 agents/);
  });

  it('UM clicks My Unit → subtitle re-scopes to unit (4 agents) + podium re-ranks 1/2/3 in unit', () => {
    authMock({ role: 'unit_manager', uid: 'um-1' });
    render(<ProductionLeaderboardSurface />);
    fireEvent.click(screen.getByTestId('leaderboard-scope-myunit'));

    const subtitle = screen.getByTestId('leaderboard-scope-subtitle');
    expect(subtitle.getAttribute('data-scope')).toBe('unit');
    expect(subtitle.getAttribute('data-count')).toBe('4');
    expect(subtitle.textContent).toMatch(/South · Lee's Unit · YTD · 4 agents/);

    // Podium now shows um-1 agents only, ranked 1/2/3 IN UNIT.
    // BRANCH order for um-1: a1 (500), a2 (300), a3 (100), a6 (50)
    // Podium top 3 = a1, a2, a3 — each carries `rank` remapped to rankWithinUnit.
    // The surface renders both mobile and desktop variants — assert count > 0.
    expect(screen.getAllByTestId('podium-card-rank-1').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('podium-card-rank-2').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('podium-card-rank-3').length).toBeGreaterThan(0);
    // No tail rank > 4 from this unit (only 4 agents → 1 tail row at rank 4)
    expect(screen.getAllByTestId('tail-row-rank-4').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('tail-row-rank-5')).toHaveLength(0);
    expect(screen.queryAllByTestId('tail-row-rank-6')).toHaveLength(0);
  });

  it('UM My Unit → My Branch (round-trip) restores the full branch view', () => {
    authMock({ role: 'unit_manager', uid: 'um-1' });
    render(<ProductionLeaderboardSurface />);
    fireEvent.click(screen.getByTestId('leaderboard-scope-myunit'));
    fireEvent.click(screen.getByTestId('leaderboard-scope-mybranch'));

    const subtitle = screen.getByTestId('leaderboard-scope-subtitle');
    expect(subtitle.getAttribute('data-scope')).toBe('branch');
    expect(subtitle.getAttribute('data-count')).toBe('6');
    // All 6 branch entries again — tail goes up to rank 6 (mobile + desktop renders).
    expect(screen.getAllByTestId('tail-row-rank-6').length).toBeGreaterThan(0);
  });

  it('BM picks a unit via the picker → surface re-scopes to that unit', () => {
    authMock({ role: 'branch_manager', uid: 'bm-1' });
    render(<ProductionLeaderboardSurface />);
    const picker = screen.getByTestId('leaderboard-scope-unit-picker');
    fireEvent.change(picker, { target: { value: 'um-2' } });

    const subtitle = screen.getByTestId('leaderboard-scope-subtitle');
    expect(subtitle.getAttribute('data-scope')).toBe('unit');
    expect(subtitle.getAttribute('data-count')).toBe('2');
    expect(subtitle.textContent).toMatch(/Tony's Unit · YTD · 2 agents/);
    // um-2 has 2 agents (a4, a5) → podium has rank 1 + 2 only (across mobile + desktop variants).
    expect(screen.getAllByTestId('podium-card-rank-1').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('podium-card-rank-2').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('podium-card-rank-3')).toHaveLength(0);
  });

  it('BM picks then resets to "— Pick a unit —" → returns to My Branch', () => {
    authMock({ role: 'branch_manager', uid: 'bm-1' });
    render(<ProductionLeaderboardSurface />);
    const picker = screen.getByTestId('leaderboard-scope-unit-picker');
    fireEvent.change(picker, { target: { value: 'um-1' } });
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('unit');
    fireEvent.change(picker, { target: { value: '' } });
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('branch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistence (localStorage keyed by UID — mirror of dark-mode pattern)
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductionLeaderboardSurface — persistence (localStorage per UID)', () => {
  it('UM selects My Unit → unmount → remount restores My Unit (same UID)', () => {
    authMock({ role: 'unit_manager', uid: 'um-1' });
    const { unmount } = render(<ProductionLeaderboardSurface />);
    fireEvent.click(screen.getByTestId('leaderboard-scope-myunit'));
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('unit');

    // Verify the storage write
    const stored = JSON.parse(
      window.localStorage.getItem('agencytrack-leaderboard-scope-um-1') ?? '{}'
    );
    expect(stored.scope).toBe('unit');
    expect(stored.targetUnitId).toBe('um-1');

    unmount();
    render(<ProductionLeaderboardSurface />);
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('unit');
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-count')).toBe('4');
  });

  it('persistence is per-UID — UM-1\'s My Unit does NOT bleed to UM-2', () => {
    // Seed UM-1's preference
    window.localStorage.setItem(
      'agencytrack-leaderboard-scope-um-1',
      JSON.stringify({ scope: 'unit', targetUnitId: 'um-1' })
    );
    // Render as a DIFFERENT UM (um-2)
    authMock({ role: 'unit_manager', uid: 'um-2' });
    render(<ProductionLeaderboardSurface />);
    // um-2 sees the default (branch), NOT um-1's persisted 'unit'
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('branch');
  });

  it('agent NEVER persists scope (role-forced to branch even if localStorage has stale unit data)', () => {
    // Seed an agent UID with a stale 'unit' preference (e.g. role-changed)
    window.localStorage.setItem(
      'agencytrack-leaderboard-scope-a1',
      JSON.stringify({ scope: 'unit', targetUnitId: 'um-1' })
    );
    authMock({ role: 'agent', uid: 'a1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('branch');
    expect(screen.queryByTestId('leaderboard-scope-control')).not.toBeInTheDocument();
  });

  it('stale persisted unitId no longer in availableUnitIds → falls back to branch', () => {
    // Seed a UM with a unitId that doesn't exist in the current branch
    window.localStorage.setItem(
      'agencytrack-leaderboard-scope-um-1',
      JSON.stringify({ scope: 'unit', targetUnitId: 'um-vanished' })
    );
    authMock({ role: 'unit_manager', uid: 'um-1' });
    render(<ProductionLeaderboardSurface />);
    expect(screen.getByTestId('leaderboard-scope-subtitle').getAttribute('data-scope')).toBe('branch');
  });
});
