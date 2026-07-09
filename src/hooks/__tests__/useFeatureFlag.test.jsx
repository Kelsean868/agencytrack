// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ useAuth: vi.fn(), getFeatureFlags: vi.fn() }));

vi.mock('../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../services/featureFlagsService', () => ({
  getFeatureFlags: hoisted.getFeatureFlags,
  isFlagOn: (flags, key) => flags?.[key] === true,
}));

import { useFeatureFlag, __resetFeatureFlagCache } from '../useFeatureFlag';

beforeEach(() => {
  vi.clearAllMocks();
  __resetFeatureFlagCache();
  hoisted.useAuth.mockReturnValue({ tenantId: 't1' });
});

describe('useFeatureFlag', () => {
  it('defaults to false, then resolves ON when the flag is set', async () => {
    hoisted.getFeatureFlags.mockResolvedValue({ persistencyV2: true });
    const { result } = renderHook(() => useFeatureFlag('persistencyV2'));
    expect(result.current).toBe(false); // pre-resolution
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays OFF for an absent key', async () => {
    hoisted.getFeatureFlags.mockResolvedValue({ persistencyV2: true });
    const { result } = renderHook(() => useFeatureFlag('awardsProvenance'));
    await waitFor(() => expect(hoisted.getFeatureFlags).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('loads once per tenant (shared cache across hook instances)', async () => {
    hoisted.getFeatureFlags.mockResolvedValue({ persistencyV2: true, awardsProvenance: true });
    const a = renderHook(() => useFeatureFlag('persistencyV2'));
    const b = renderHook(() => useFeatureFlag('awardsProvenance'));
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(hoisted.getFeatureFlags).toHaveBeenCalledTimes(1);
  });

  it('is OFF (and does not read) when there is no tenant', async () => {
    hoisted.useAuth.mockReturnValue({ tenantId: null });
    const { result } = renderHook(() => useFeatureFlag('persistencyV2'));
    expect(result.current).toBe(false);
    expect(hoisted.getFeatureFlags).not.toHaveBeenCalled();
  });

  it('stays OFF when the flag read rejects', async () => {
    hoisted.getFeatureFlags.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useFeatureFlag('persistencyV2'));
    await waitFor(() => expect(hoisted.getFeatureFlags).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
