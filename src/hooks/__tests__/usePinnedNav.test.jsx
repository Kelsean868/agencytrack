// @vitest-environment jsdom
//
// usePinnedNav — ★ Pinned-zone state (Nav redesign PR-2).
// Covers: seed paint, localStorage-first paint, Firestore reconcile (Firestore
// wins), read-failure graceful degrade, pin/unpin mutation + persistence, and
// the descriptor resolver (skips ids absent from the current role's config).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getUserPrefs = vi.fn();
const setPinnedNav = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => getUserPrefs(...a),
  setPinnedNav: (...a) => setPinnedNav(...a),
}));

import usePinnedNav, { pinnedMirrorKey } from '../usePinnedNav';

// All hook calls in this file use uid 'u' → per-user mirror key.
const MK = pinnedMirrorKey('u');

// Agent nav items (subset) — descriptor source for the resolver.
const AGENT_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', tabId: 'dashboard' },
  { id: 'wizard', label: 'Weekly Report', action: 'submit' },
  { id: 'policy-ledger', label: 'Policy Ledger', tabId: 'policy-ledger' },
  { id: 'goals', label: 'Goals', tabId: 'goals' },
  { id: 'planner', label: 'Planner', tabId: 'planner', disabled: true },
  // NOTE: 'daily-log' intentionally absent (simulates weekly-mode agent).
];

beforeEach(() => {
  localStorage.clear();
  getUserPrefs.mockReset();
  setPinnedNav.mockReset().mockResolvedValue(undefined);
});

describe('usePinnedNav — initial paint', () => {
  it('paints the per-role seed when no mirror exists', () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    // Seed = daily-log, wizard, policy-ledger, goals, planner
    expect(result.current.pinnedIds).toEqual(['daily-log', 'wizard', 'policy-ledger', 'goals', 'planner']);
  });

  it('paints from the localStorage mirror when present (over seeds)', () => {
    localStorage.setItem(MK, JSON.stringify(['goals']));
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    expect(result.current.pinnedIds).toEqual(['goals']);
  });
});

describe('usePinnedNav — Firestore reconcile', () => {
  it('Firestore wins on a successful read with pinnedNav', async () => {
    localStorage.setItem(MK, JSON.stringify(['goals']));
    getUserPrefs.mockResolvedValue({ pinnedNav: ['planner', 'wizard'] });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await waitFor(() => expect(result.current.pinnedIds).toEqual(['planner', 'wizard']));
    // mirror refreshed to the Firestore value
    expect(JSON.parse(localStorage.getItem(MK))).toEqual(['planner', 'wizard']);
  });

  it('keeps the seed/mirror paint when the read fails (graceful)', async () => {
    getUserPrefs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    // give the rejected promise a tick
    await act(async () => { await Promise.resolve(); });
    expect(result.current.pinnedIds).toEqual(['daily-log', 'wizard', 'policy-ledger', 'goals', 'planner']);
  });

  it('a doc without pinnedNav does not override the seed paint', async () => {
    getUserPrefs.mockResolvedValue({ menuLayout: 'pinned' });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.pinnedIds).toEqual(['daily-log', 'wizard', 'policy-ledger', 'goals', 'planner']);
  });
});

describe('usePinnedNav — pin / unpin', () => {
  it('pin appends a new id and persists', async () => {
    getUserPrefs.mockResolvedValue({ pinnedNav: ['goals'] });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await waitFor(() => expect(result.current.pinnedIds).toEqual(['goals']));
    act(() => result.current.pin('wizard'));
    expect(result.current.pinnedIds).toEqual(['goals', 'wizard']);
    expect(setPinnedNav).toHaveBeenCalledWith('t', 'u', ['goals', 'wizard']);
    expect(JSON.parse(localStorage.getItem(MK))).toEqual(['goals', 'wizard']);
  });

  it('pin is idempotent (no duplicate, no extra write)', async () => {
    getUserPrefs.mockResolvedValue({ pinnedNav: ['goals'] });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await waitFor(() => expect(result.current.pinnedIds).toEqual(['goals']));
    act(() => result.current.pin('goals'));
    expect(result.current.pinnedIds).toEqual(['goals']);
  });

  it('unpin removes an id and persists', async () => {
    getUserPrefs.mockResolvedValue({ pinnedNav: ['goals', 'wizard'] });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await waitFor(() => expect(result.current.pinnedIds).toEqual(['goals', 'wizard']));
    act(() => result.current.unpin('goals'));
    expect(result.current.pinnedIds).toEqual(['wizard']);
    expect(setPinnedNav).toHaveBeenLastCalledWith('t', 'u', ['wizard']);
  });

  it('isPinned reflects state', async () => {
    // Reconcile to a single-id list so we can assert a NON-pinned id too (the
    // agent seed contains both goals + wizard, so wait for the Firestore value).
    getUserPrefs.mockResolvedValue({ pinnedNav: ['goals'] });
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    await waitFor(() => expect(result.current.pinnedIds).toEqual(['goals']));
    expect(result.current.isPinned('goals')).toBe(true);
    expect(result.current.isPinned('wizard')).toBe(false);
  });
});

describe('usePinnedNav — descriptor resolver', () => {
  it('resolves pinned ids to descriptors in pinned order, skipping ids absent from the role config', async () => {
    // daily-log is in the seed but NOT in AGENT_NAV_ITEMS (weekly-mode agent) → skipped.
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => usePinnedNav({ tenantId: 't', uid: 'u', configKey: 'agent', navItems: AGENT_NAV_ITEMS }));
    const resolvedIds = result.current.pinnedItems.map((i) => i.id);
    expect(resolvedIds).toEqual(['wizard', 'policy-ledger', 'goals', 'planner']); // no daily-log
    expect(result.current.pinnedItems.every((i) => i.label)).toBe(true);
  });
});
