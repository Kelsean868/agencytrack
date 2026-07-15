// @vitest-environment jsdom
//
// §1 silent-swallow fix — useMyProduction's primary read (getAgentSubmissions)
// used to self-catch to [], so a real failure looked identical to "no
// production yet." Asserts:
//   1. A getAgentSubmissions rejection sets loadError true (loading false).
//   2. Secondary arms (goals/history/settlements/minimums/ruleset) rejecting
//      alone does NOT set loadError — semantic degradation preserved.
//   3. reload() (the hook's retry) re-invokes getAgentSubmissions and clears
//      loadError on a subsequent success.

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/submissionService', () => ({
  getAgentSubmissions: vi.fn(),
}));

vi.mock('../../services/goalsService', () => ({
  getGoals:            vi.fn().mockResolvedValue(null),
  getCompanyMinimums:  vi.fn().mockResolvedValue(null),
  getGoalHierarchy:    vi.fn().mockResolvedValue(null),
  getSalesManagerUid:  vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/awardsRulesetService', () => ({
  getMergedAwardsRuleset: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../config/awardsRuleset/2026', () => ({
  DEFAULT_RULESET_2026: {},
}));

vi.mock('../../services/persistencyService', () => ({
  getAgentHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/settlementService', () => ({
  getSettlements: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/policiesService', () => ({
  getOwnPolicies: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/extractFields', () => ({
  extractFields:                vi.fn().mockReturnValue({ applicationsSold: '0', ffiConducted: '0', ciConducted: '0', totalTelAttempts: '0' }),
  extractTotalProductionCredit: vi.fn(() => 0),
}));

vi.mock('../../utils/dateHelpers', () => ({
  getMostRecentSunday: vi.fn().mockReturnValue('2026-06-22'),
}));

import { getAgentSubmissions } from '../../services/submissionService';
import { getGoals } from '../../services/goalsService';
import { useMyProduction } from '../useMyProduction';

describe('useMyProduction — §1 loadError (primary-arm failure surfacing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGoals.mockResolvedValue(null);
  });

  it('getAgentSubmissions rejection sets loadError (and loading false)', async () => {
    getAgentSubmissions.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useMyProduction('tenant-1', 'uid-1', { unitId: null })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadError).toBe(true);
  });

  it('a secondary-arm-only rejection (getGoals) does NOT set loadError', async () => {
    getAgentSubmissions.mockResolvedValue([]);
    getGoals.mockRejectedValue(new Error('goals read down'));

    const { result } = renderHook(() =>
      useMyProduction('tenant-1', 'uid-1', { unitId: null })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadError).toBe(false);
  });

  it('reload() re-invokes getAgentSubmissions and clears loadError on success', async () => {
    getAgentSubmissions.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() =>
      useMyProduction('tenant-1', 'uid-1', { unitId: null })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
    expect(getAgentSubmissions).toHaveBeenCalledTimes(1);

    getAgentSubmissions.mockResolvedValueOnce([]);
    result.current.reload();

    await waitFor(() => expect(getAgentSubmissions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loadError).toBe(false));
  });
});
