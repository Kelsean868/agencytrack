import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Hoisted mocks — must be declared before any import that uses these modules.
const hoisted = vi.hoisted(() => ({
  useAuth:                vi.fn(),
  getAllYTDSubmissions:   vi.fn(),
  getTenantUsers:        vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../services/managerService', () => ({
  getAllYTDSubmissions: hoisted.getAllYTDSubmissions,
  getTenantUsers:      hoisted.getTenantUsers,
}));

import useProductionRanking from '../useProductionRanking';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkSub(agentId, weekStarting, api, apps = 1) {
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness:  { api, apps },
    pppIncreases: { apiIncrease: 0, apps: 0 },
    lumpsums:     { apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
  };
}

function mkAgent(id, name, unitId = null) {
  return { id, name, role: 'agent', unitId, provisioning: false };
}

// Current WAR week: Sun 2026-05-10 is within any future `week` window while we
// are in May 2026.  Use a date that will always fall in the current WK window
// (tests are not time-sensitive for this hook — they rely on the selector tests
// for period correctness and just verify the hook wires data correctly).
const CURRENT_SUNDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // most-recent Sunday (local time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
})();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useProductionRanking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ tenantId: 'tenant1' });
    hoisted.getAllYTDSubmissions.mockResolvedValue([]);
    hoisted.getTenantUsers.mockResolvedValue([]);
  });

  it('starts with loading=true and empty ranked array', () => {
    hoisted.getAllYTDSubmissions.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useProductionRanking({ period: 'week' }));
    expect(result.current.loading).toBe(true);
    expect(result.current.ranked).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('resolves to loading=false with data after fetch completes', async () => {
    hoisted.getTenantUsers.mockResolvedValue([mkAgent('a1', 'Test Agent')]);
    hoisted.getAllYTDSubmissions.mockResolvedValue([mkSub('a1', CURRENT_SUNDAY, 5000)]);

    const { result } = renderHook(() => useProductionRanking({ period: 'week' }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.ranked).toHaveLength(1);
    expect(result.current.ranked[0].agentId).toBe('a1');
    expect(result.current.totalCount).toBe(1);
  });

  it('returns correct ranked shape — agentId, name, initials, rank, periodApi, apps, rankWithinUnit', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      mkAgent('a1', 'Carla Joseph'),
      mkAgent('a2', 'Devin Lewis'),
    ]);
    hoisted.getAllYTDSubmissions.mockResolvedValue([
      mkSub('a1', CURRENT_SUNDAY, 20000, 3),
      mkSub('a2', CURRENT_SUNDAY, 10000, 2),
    ]);

    const { result } = renderHook(() => useProductionRanking({ period: 'week' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const [first, second] = result.current.ranked;
    expect(first.agentId).toBe('a1');
    expect(first.name).toBe('Carla Joseph');
    expect(first.initials).toBe('CJ');
    expect(first.rank).toBe(1);
    expect(first.periodApi).toBe(20000);
    expect(first.apps).toBe(3);
    expect(first.rankWithinUnit).toBeDefined();

    expect(second.agentId).toBe('a2');
    expect(second.rank).toBe(2);
  });

  it('totalCount equals ranked.length', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      mkAgent('a1', 'Alpha'), mkAgent('a2', 'Beta'), mkAgent('a3', 'Gamma'),
    ]);
    hoisted.getAllYTDSubmissions.mockResolvedValue([
      mkSub('a1', CURRENT_SUNDAY, 1000),
      mkSub('a2', CURRENT_SUNDAY, 2000),
      mkSub('a3', CURRENT_SUNDAY, 3000),
    ]);

    const { result } = renderHook(() => useProductionRanking({ period: 'week' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalCount).toBe(3);
    expect(result.current.ranked).toHaveLength(3);
  });

  it('returns empty ranked array (not a crash) when both fetches return empty', async () => {
    hoisted.getAllYTDSubmissions.mockResolvedValue([]);
    hoisted.getTenantUsers.mockResolvedValue([]);

    const { result } = renderHook(() => useProductionRanking({ period: 'ytd' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ranked).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('swallows fetch errors and sets error message, ranked remains empty', async () => {
    hoisted.getAllYTDSubmissions.mockRejectedValue(new Error('Network failure'));
    hoisted.getTenantUsers.mockResolvedValue([]);

    const { result } = renderHook(() => useProductionRanking({ period: 'week' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network failure');
    expect(result.current.ranked).toEqual([]);
  });

  it('re-fetches when tenantId changes', async () => {
    hoisted.useAuth.mockReturnValue({ tenantId: 'tenant1' });
    hoisted.getAllYTDSubmissions.mockResolvedValue([]);
    hoisted.getTenantUsers.mockResolvedValue([mkAgent('a1', 'Tenant1 Agent')]);

    const { result, rerender } = renderHook(() => useProductionRanking({ period: 'week' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstCallCount = hoisted.getAllYTDSubmissions.mock.calls.length;

    // Simulate tenantId changing
    hoisted.useAuth.mockReturnValue({ tenantId: 'tenant2' });
    hoisted.getTenantUsers.mockResolvedValue([mkAgent('b1', 'Tenant2 Agent')]);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(hoisted.getAllYTDSubmissions.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('scope param is accepted without error (branch is P1 default)', async () => {
    const { result } = renderHook(() =>
      useProductionRanking({ scope: 'branch', period: 'week' })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ranked).toEqual([]);
  });

  it('does nothing if tenantId is null', () => {
    hoisted.useAuth.mockReturnValue({ tenantId: null });
    renderHook(() => useProductionRanking({ period: 'week' }));
    expect(hoisted.getAllYTDSubmissions).not.toHaveBeenCalled();
    expect(hoisted.getTenantUsers).not.toHaveBeenCalled();
  });
});
