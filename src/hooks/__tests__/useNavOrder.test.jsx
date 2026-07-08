// @vitest-environment jsdom
//
// useNavOrder — ★ sidebar drag-reorder persistence (Fable Tier 1 · 1.4).
// Covers: default (empty) order, localStorage-first paint, Firestore reconcile
// (Firestore wins), read-failure graceful degrade, per-config write-through, and
// cross-config mirror preservation on write.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getUserPrefs = vi.fn();
const setNavOrder = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => getUserPrefs(...a),
  setNavOrder: (...a) => setNavOrder(...a),
}));

import useNavOrder, { navOrderMirrorKey } from '../useNavOrder';

const MK = navOrderMirrorKey('u');

beforeEach(() => {
  localStorage.clear();
  getUserPrefs.mockReset();
  setNavOrder.mockReset().mockResolvedValue(undefined);
});

describe('useNavOrder — initial paint', () => {
  it('defaults to an empty order when no mirror and no doc', () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    expect(result.current.orderIds).toEqual([]);
  });

  it('paints from the localStorage mirror for the requested config', () => {
    localStorage.setItem(MK, JSON.stringify({ agent: ['goals', 'wizard'], manager: ['overview'] }));
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    expect(result.current.orderIds).toEqual(['goals', 'wizard']);
  });

  it('returns [] for a config absent from the mirror map', () => {
    localStorage.setItem(MK, JSON.stringify({ agent: ['goals'] }));
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'producingManager' }));
    expect(result.current.orderIds).toEqual([]);
  });
});

describe('useNavOrder — Firestore reconcile', () => {
  it('Firestore wins on a successful read with navOrder', async () => {
    localStorage.setItem(MK, JSON.stringify({ agent: ['goals'] }));
    getUserPrefs.mockResolvedValue({ navOrder: { agent: ['planner', 'wizard'] } });
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    await waitFor(() => expect(result.current.orderIds).toEqual(['planner', 'wizard']));
    // mirror refreshed to the Firestore map
    expect(JSON.parse(localStorage.getItem(MK))).toEqual({ agent: ['planner', 'wizard'] });
  });

  it('keeps the mirror paint when the read fails (graceful)', async () => {
    localStorage.setItem(MK, JSON.stringify({ agent: ['goals'] }));
    getUserPrefs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.orderIds).toEqual(['goals']);
  });

  it('a doc without navOrder does not override the mirror paint', async () => {
    localStorage.setItem(MK, JSON.stringify({ agent: ['goals'] }));
    getUserPrefs.mockResolvedValue({ pinnedNav: ['wizard'] });
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.orderIds).toEqual(['goals']);
  });
});

describe('useNavOrder — reorder (write-through)', () => {
  it('writes the new id array under the config key + mirror', async () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    act(() => result.current.reorder(['wizard', 'goals', 'history']));
    expect(result.current.orderIds).toEqual(['wizard', 'goals', 'history']);
    expect(setNavOrder).toHaveBeenCalledWith('t', 'u', 'agent', ['wizard', 'goals', 'history']);
    expect(JSON.parse(localStorage.getItem(MK))).toEqual({ agent: ['wizard', 'goals', 'history'] });
  });

  it('preserves other configs in the mirror map on write (deep-merge)', async () => {
    localStorage.setItem(MK, JSON.stringify({ manager: ['overview', 'team'] }));
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    act(() => result.current.reorder(['wizard', 'goals']));
    expect(JSON.parse(localStorage.getItem(MK))).toEqual({
      manager: ['overview', 'team'],
      agent: ['wizard', 'goals'],
    });
  });

  it('a failed Firestore write does not throw into render', async () => {
    setNavOrder.mockRejectedValue(new Error('rules'));
    getUserPrefs.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useNavOrder({ tenantId: 't', uid: 'u', configKey: 'agent' }));
    act(() => result.current.reorder(['wizard']));
    // state + mirror still update; the rejected promise is swallowed
    expect(result.current.orderIds).toEqual(['wizard']);
    await act(async () => { await Promise.resolve(); });
    warn.mockRestore();
  });
});
