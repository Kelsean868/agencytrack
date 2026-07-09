// @vitest-environment jsdom
//
// useAppSettings — Settings v2 view-defaults map (Fable Tier 2 · 2.4).
// Covers: mirror-first paint, Firestore reconcile (Firestore wins), and the
// write payload shape (merge, ONLY the touched key) + mirror update.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getUserPrefs = vi.fn();
const setAppSetting = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => getUserPrefs(...a),
  setAppSetting: (...a) => setAppSetting(...a),
}));

import useAppSettings, { settingsMirrorKey, readSettingsMirror } from '../useAppSettings';

const MK = settingsMirrorKey('u1');

beforeEach(() => {
  localStorage.clear();
  getUserPrefs.mockReset();
  setAppSetting.mockReset().mockResolvedValue(undefined);
});

describe('useAppSettings — paint + reconcile', () => {
  it('paints an empty map when no mirror and no doc', () => {
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    expect(result.current.settings).toEqual({});
  });

  it('paints synchronously from the per-user mirror', () => {
    localStorage.setItem(MK, JSON.stringify({ masterSheetPreset: 'Production' }));
    getUserPrefs.mockResolvedValue(null);
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    expect(result.current.settings.masterSheetPreset).toBe('Production');
  });

  it('reconciles from Firestore (Firestore wins on success)', async () => {
    localStorage.setItem(MK, JSON.stringify({ masterSheetPreset: 'All' }));
    getUserPrefs.mockResolvedValue({ settings: { masterSheetPreset: 'Compliance', defaultPeriod: 'week' } });
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    await waitFor(() => expect(result.current.settings.masterSheetPreset).toBe('Compliance'));
    expect(result.current.settings.defaultPeriod).toBe('week');
    // mirror refreshed to the reconciled map
    expect(readSettingsMirror('u1')).toEqual({ masterSheetPreset: 'Compliance', defaultPeriod: 'week' });
  });

  it('keeps the mirror paint when reconcile fails (offline / rules)', async () => {
    localStorage.setItem(MK, JSON.stringify({ defaultPeriod: 'year' }));
    getUserPrefs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    await Promise.resolve();
    expect(result.current.settings.defaultPeriod).toBe('year');
  });
});

describe('useAppSettings — setSetting write shape', () => {
  it('writes ONLY the touched key (merge) and updates local state + mirror', async () => {
    getUserPrefs.mockResolvedValue({ settings: { masterSheetPreset: 'Production' } });
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    await waitFor(() => expect(result.current.settings.masterSheetPreset).toBe('Production'));

    act(() => result.current.setSetting('defaultPeriod', 'month'));

    // Service called with exactly (tenantId, uid, key, value) — the writer
    // merge-writes settings.{key}, so only 'defaultPeriod' is sent.
    expect(setAppSetting).toHaveBeenCalledWith('t1', 'u1', 'defaultPeriod', 'month');
    // Local state keeps the pre-existing key and adds the new one.
    expect(result.current.settings).toEqual({ masterSheetPreset: 'Production', defaultPeriod: 'month' });
    expect(readSettingsMirror('u1')).toEqual({ masterSheetPreset: 'Production', defaultPeriod: 'month' });
  });

  it('does not throw when the write rejects (non-blocking)', async () => {
    getUserPrefs.mockResolvedValue(null);
    setAppSetting.mockRejectedValue(new Error('rules'));
    const { result } = renderHook(() => useAppSettings({ tenantId: 't1', uid: 'u1' }));
    act(() => result.current.setSetting('defaultPeriod', 'week'));
    expect(result.current.settings.defaultPeriod).toBe('week');
  });
});
