// @vitest-environment jsdom
//
// §1 states contract — useLeaderboard.reload() must actually re-invoke the
// same fetch path (getDoc against the same ref), not just reset local state.
// This is what powers ProductionLeaderboardSurface's error-card Retry button.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { getDocMock } = vi.hoisted(() => ({ getDocMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: getDocMock,
}));
vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 'tenant-test', userProfile: { branchId: 'south' } }),
}));

import useLeaderboard from '../useLeaderboard';

describe('useLeaderboard — reload()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-invokes getDoc against the same ref and clears a prior error on success', async () => {
    getDocMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ ytd: [{ agentId: 'a1' }] }) });

    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toEqual({ code: 'unknown', message: 'boom' });
    expect(getDocMock).toHaveBeenCalledTimes(1);

    act(() => { result.current.reload(); });

    await waitFor(() => expect(getDocMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.byPeriod.ytd).toEqual([{ agentId: 'a1' }]);
  });
});
