// @vitest-environment jsdom
//
// useMenuLayout — sidebar menu-layout preference (Nav redesign PR-4).
// Covers: default paint, localStorage-first paint, Firestore reconcile, the
// agent→pinned clamp (defense-in-depth — even a forced workspace value), manager
// honoring, invalid-value guard, and setMenuLayout mirror + persistence.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getUserPrefs = vi.fn();
const setMenuLayout = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => getUserPrefs(...a),
  setMenuLayout: (...a) => setMenuLayout(...a),
}));

import useMenuLayout, { menuLayoutMirrorKey } from '../useMenuLayout';

const MK = menuLayoutMirrorKey('u');

beforeEach(() => {
  localStorage.clear();
  getUserPrefs.mockReset();
  setMenuLayout.mockReset().mockResolvedValue(undefined);
});

describe('useMenuLayout — initial paint', () => {
  it('defaults to pinned when no mirror and no doc', () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    expect(result.current.menuLayout).toBe('pinned');
  });

  it('paints from the localStorage mirror for a manager', () => {
    localStorage.setItem(MK, 'workspace');
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    expect(result.current.menuLayout).toBe('workspace');
  });

  it('ignores an invalid mirror value (falls back to pinned)', () => {
    localStorage.setItem(MK, 'garbage');
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'unit_manager', tenantId: 't', uid: 'u' }));
    expect(result.current.menuLayout).toBe('pinned');
  });
});

describe('useMenuLayout — agent clamp (defense-in-depth)', () => {
  it('clamps agent to pinned even with a forced workspace mirror', () => {
    localStorage.setItem(MK, 'workspace');
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'agent', tenantId: 't', uid: 'u' }));
    expect(result.current.menuLayout).toBe('pinned');
  });

  it('clamps agent to pinned even when the Firestore doc says both', async () => {
    getUserPrefs.mockResolvedValue({ menuLayout: 'both' });
    const { result } = renderHook(() => useMenuLayout({ role: 'agent', tenantId: 't', uid: 'u' }));
    await waitFor(() => expect(getUserPrefs).toHaveBeenCalled());
    expect(result.current.menuLayout).toBe('pinned');
  });
});

describe('useMenuLayout — Firestore reconcile (manager)', () => {
  it('Firestore menuLayout wins over the default paint', async () => {
    getUserPrefs.mockResolvedValue({ menuLayout: 'both' });
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    await waitFor(() => expect(result.current.menuLayout).toBe('both'));
    expect(localStorage.getItem(MK)).toBe('both');
  });

  it('a doc with no menuLayout (only pinnedNav) leaves the default untouched', async () => {
    getUserPrefs.mockResolvedValue({ pinnedNav: ['mp-report'] });
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    await waitFor(() => expect(getUserPrefs).toHaveBeenCalled());
    expect(result.current.menuLayout).toBe('pinned');
  });

  it('a failed read keeps the mirror paint (never throws)', async () => {
    localStorage.setItem(MK, 'workspace');
    getUserPrefs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMenuLayout({ role: 'unit_manager', tenantId: 't', uid: 'u' }));
    await waitFor(() => expect(getUserPrefs).toHaveBeenCalled());
    expect(result.current.menuLayout).toBe('workspace');
  });
});

describe('useMenuLayout — setMenuLayout', () => {
  it('updates state, mirror, and persists to Firestore', async () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    act(() => result.current.setMenuLayout('both'));
    expect(result.current.menuLayout).toBe('both');
    expect(localStorage.getItem(MK)).toBe('both');
    expect(setMenuLayout).toHaveBeenCalledWith('t', 'u', 'both');
  });

  it('ignores an invalid value', () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useMenuLayout({ role: 'branch_manager', tenantId: 't', uid: 'u' }));
    act(() => result.current.setMenuLayout('nonsense'));
    expect(result.current.menuLayout).toBe('pinned');
    expect(setMenuLayout).not.toHaveBeenCalled();
  });
});
