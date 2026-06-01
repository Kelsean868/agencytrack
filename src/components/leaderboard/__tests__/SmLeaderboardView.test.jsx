// @vitest-environment jsdom
//
// Track J P5b — SmLeaderboardView (SM all-branches picker).
//
// Asserts:
//   1. Enumerates every ACTIVE branch in the tenant (inactive branches are
//      filtered out; sort is by name ascending).
//   2. Default on first use is the first branch (sorted by name) and that
//      default is persisted so a reload restores it (no re-roll).
//   3. Picking a different branch updates the `<select>` value AND triggers
//      a fresh `useLeaderboard` read against that branch's leaderboards doc
//      (asserted indirectly via the inner surface's branchIdOverride prop —
//      we mock ProductionLeaderboardSurface and assert the prop).
//   4. localStorage round-trip: a new mount with a persisted branch
//      restores that branch on its initial render (no flicker through
//      default + reset).
//   5. The branch-picker `<select>` lists branch.name labels keyed by branch.id.
//
// Mocks branchService.listBranches with deterministic fixtures; mocks
// ProductionLeaderboardSurface as a sentinel that echoes the props it was
// invoked with so we can assert cross-branch re-reads.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  useAuthMock:      vi.fn(),
  listBranchesMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuthMock }));
vi.mock('../../../services/branchService', () => ({
  listBranches: hoisted.listBranchesMock,
}));

// Sentinel surface — echoes its props onto a data attribute we can read.
vi.mock('../ProductionLeaderboardSurface', async () => {
  const React = await import('react');
  return {
    default: (props) =>
      React.createElement('div', {
        'data-testid':            'production-surface-mock',
        'data-branch-override':   props?.branchIdOverride ?? '',
        'data-scope-role':        props?.scopeRoleOverride ?? '',
        'data-branch-name':       props?.overrideBranchName ?? '',
      }),
  };
});

import SmLeaderboardView from '../SmLeaderboardView';

const STORAGE_PREFIX = 'agencytrack-sm-leaderboard-branch-';
const SM_UID         = 'sm-uid-1';
const TENANT_ID      = 'tatillife_south';

// Two active branches (sorted by name: Cyril < South) + one inactive that
// must be filtered out. This proves both the sort and the active-only filter.
const BRANCHES = [
  { id: 'tatil_south',          name: 'South',  isActive: true },
  { id: 'ljbBHP1g7lbZXvHlpcDn', name: 'Cyril',  isActive: true },
  { id: 'retired_branch',       name: 'Aaardo', isActive: false }, // filtered
];

function mountSm() {
  hoisted.useAuthMock.mockReturnValue({
    user:     { uid: SM_UID },
    tenantId: TENANT_ID,
  });
  return render(<SmLeaderboardView />);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  hoisted.listBranchesMock.mockResolvedValue(BRANCHES);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Branch enumeration — every active tenant branch, sorted
// ─────────────────────────────────────────────────────────────────────────────

describe('SmLeaderboardView — branch enumeration', () => {
  it('lists every ACTIVE tenant branch (inactive filtered out), sorted by name', async () => {
    mountSm();
    const picker = await screen.findByTestId('sm-leaderboard-branch-picker');
    const options = Array.from(picker.querySelectorAll('option'));
    expect(options.map((o) => o.value)).toEqual(['ljbBHP1g7lbZXvHlpcDn', 'tatil_south']);
    expect(options.map((o) => o.textContent)).toEqual(['Cyril', 'South']);
  });

  it('queries branchService.listBranches with the active tenantId', async () => {
    mountSm();
    await screen.findByTestId('sm-leaderboard-branch-picker');
    expect(hoisted.listBranchesMock).toHaveBeenCalledWith(TENANT_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Default branch on first use + persistence
// ─────────────────────────────────────────────────────────────────────────────

describe('SmLeaderboardView — default + persistence', () => {
  it('defaults to the first sorted branch on first use AND persists that default', async () => {
    mountSm();
    const picker = await screen.findByTestId('sm-leaderboard-branch-picker');
    expect(picker).toHaveAttribute('data-value', 'ljbBHP1g7lbZXvHlpcDn');
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${SM_UID}`)).toBe('ljbBHP1g7lbZXvHlpcDn');
  });

  it('passes the picked branch as branchIdOverride to the inner surface', async () => {
    mountSm();
    const surface = await screen.findByTestId('production-surface-mock');
    expect(surface).toHaveAttribute('data-branch-override', 'ljbBHP1g7lbZXvHlpcDn');
    expect(surface).toHaveAttribute('data-scope-role',      'branch_manager');
    expect(surface).toHaveAttribute('data-branch-name',     'Cyril');
  });

  it('restores a persisted branch on remount (no flicker through default)', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${SM_UID}`, 'tatil_south');
    mountSm();
    const picker = await screen.findByTestId('sm-leaderboard-branch-picker');
    expect(picker).toHaveAttribute('data-value', 'tatil_south');
    // localStorage value should remain the persisted branch (no overwrite by default).
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${SM_UID}`)).toBe('tatil_south');
  });

  it('falls back to the first sorted branch if the persisted branch is no longer active', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${SM_UID}`, 'retired_branch');
    mountSm();
    const picker = await screen.findByTestId('sm-leaderboard-branch-picker');
    expect(picker).toHaveAttribute('data-value', 'ljbBHP1g7lbZXvHlpcDn'); // Cyril (first sorted)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Picking a different branch re-reads the right leaderboard doc
// ─────────────────────────────────────────────────────────────────────────────

describe('SmLeaderboardView — cross-branch re-read', () => {
  it('picking branch B causes the inner surface to receive branchIdOverride=B', async () => {
    mountSm();
    const picker  = await screen.findByTestId('sm-leaderboard-branch-picker');
    const surface = screen.getByTestId('production-surface-mock');
    expect(surface).toHaveAttribute('data-branch-override', 'ljbBHP1g7lbZXvHlpcDn');

    fireEvent.change(picker, { target: { value: 'tatil_south' } });

    await waitFor(() => {
      expect(screen.getByTestId('production-surface-mock'))
        .toHaveAttribute('data-branch-override', 'tatil_south');
    });
    expect(screen.getByTestId('production-surface-mock'))
      .toHaveAttribute('data-branch-name', 'South');
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${SM_UID}`)).toBe('tatil_south');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Edge cases — load error, empty tenant
// ─────────────────────────────────────────────────────────────────────────────

describe('SmLeaderboardView — edge cases', () => {
  it('surfaces an error card when listBranches rejects', async () => {
    hoisted.listBranchesMock.mockRejectedValueOnce(new Error('boom'));
    mountSm();
    expect(await screen.findByTestId('sm-leaderboard-error')).toBeInTheDocument();
    expect(screen.queryByTestId('production-surface-mock')).not.toBeInTheDocument();
  });

  it('surfaces an empty card when the tenant has no active branches', async () => {
    hoisted.listBranchesMock.mockResolvedValueOnce([
      { id: 'inactive', name: 'Inactive', isActive: false },
    ]);
    mountSm();
    expect(await screen.findByTestId('sm-leaderboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('production-surface-mock')).not.toBeInTheDocument();
  });
});
