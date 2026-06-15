// @vitest-environment jsdom
//
// Slice 2.1a — production scope split in useBranchOverview.
// Asserts:
//   1. UM personal submission is included in teamYTDAPI (production scope).
//   2. UM is NOT counted in inScopeAgentCount (compliance denominator stays agents-only).
//   3. kpiData.compliance uses agents-only numerator and denominator.
//   4. BM sees all branch UMs in teamYTDAPI, agents-only compliance denom.

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/managerService', () => ({
  getAllYTDSubmissions: vi.fn(),
  getTenantUsers:       vi.fn(),
}));

vi.mock('../../services/goalsService', () => ({
  getBranchGoals:     vi.fn().mockResolvedValue(null),
  getUnitGoals:       vi.fn().mockResolvedValue(null),
  getCompanyMinimums: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../utils/extractFields', () => ({
  extractFields:                vi.fn().mockReturnValue({ applicationsSold: '0', ffiConducted: '0' }),
  extractTotalProductionCredit: vi.fn((s) => s._api ?? 0),
}));

vi.mock('../../utils/buildManagerActivityEvents', () => ({
  buildManagerActivityEvents: vi.fn().mockReturnValue([]),
}));

vi.mock('../../components/gamification/BadgeGrid', () => ({
  computeEarnedBadges: vi.fn().mockReturnValue([]),
  BADGE_KEY_ORDER:     [],
}));

import { getAllYTDSubmissions, getTenantUsers } from '../../services/managerService';
import { useBranchOverview } from '../useBranchOverview';

const WEEK = '2026-06-08';

function mkSub(agentId, api) {
  return { agentId, weekStarting: WEEK, _api: api };
}

describe('useBranchOverview — production scope split (Slice 2.1a)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── unit_manager ──────────────────────────────────────────────────────────
  describe('unit_manager role', () => {
    const UM_ID = 'um-1';
    const unitId = UM_ID;
    const userProfile = { unitId };

    // Five users: UM + 2 agents in unit + another UM + agent in a different unit
    const users = [
      { id: UM_ID,      role: 'unit_manager', unitId },
      { id: 'a1',       role: 'agent',        unitId },
      { id: 'a2',       role: 'agent',        unitId },
      { id: 'other-um', role: 'unit_manager', unitId: 'other-unit' },
      { id: 'other-a',  role: 'agent',        unitId: 'other-unit' },
    ];

    beforeEach(() => { getTenantUsers.mockResolvedValue(users); });

    it('includes UM personal submission in teamYTDAPI', async () => {
      getAllYTDSubmissions.mockResolvedValue([
        mkSub(UM_ID,    500),
        mkSub('a1',     200),
        mkSub('other-a', 100), // out-of-unit — excluded
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.teamYTDAPI).toBe(700); // UM 500 + a1 200
    });

    it('excludes UM from inScopeAgentCount (compliance denominator)', async () => {
      getAllYTDSubmissions.mockResolvedValue([mkSub(UM_ID, 500), mkSub('a1', 200)]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.inScopeAgentCount).toBe(2); // a1 + a2 only
    });

    it('kpiData.compliance uses agents-only numerator and denominator', async () => {
      // UM submitted + a1 submitted; a2 did NOT submit
      getAllYTDSubmissions.mockResolvedValue([
        mkSub(UM_ID, 500),
        mkSub('a1',  200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 1 agent submitted (a1) out of 2 agents (a1 + a2) → 50%
      expect(result.current.kpiData.compliance).toEqual([50]);
    });
  });

  // ── branch_manager ────────────────────────────────────────────────────────
  describe('branch_manager role', () => {
    const users = [
      { id: 'bm1', role: 'branch_manager' },
      { id: 'um1', role: 'unit_manager',  unitId: 'um1' },
      { id: 'um2', role: 'unit_manager',  unitId: 'um2' },
      { id: 'a1',  role: 'agent',         unitId: 'um1' },
      { id: 'a2',  role: 'agent',         unitId: 'um2' },
    ];

    beforeEach(() => { getTenantUsers.mockResolvedValue(users); });

    it('includes all branch UMs in teamYTDAPI', async () => {
      getAllYTDSubmissions.mockResolvedValue([
        mkSub('um1', 400),
        mkSub('um2', 300),
        mkSub('a1',  200),
        mkSub('a2',  100),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('branch_manager', {}, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.teamYTDAPI).toBe(1000); // um1+um2+a1+a2
    });

    it('uses agents-only count for compliance denominator', async () => {
      // Only um1 + a1 submitted; a2 did not
      getAllYTDSubmissions.mockResolvedValue([
        mkSub('um1', 400),
        mkSub('a1',  200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('branch_manager', {}, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.inScopeAgentCount).toBe(2); // a1 + a2
      expect(result.current.kpiData.compliance).toEqual([50]); // 1/2 agents submitted
    });
  });

  // ── branch_manager (Slice 2.1b) ───────────────────────────────────────────
  // Validates that a BM's own personal submission (with sentinel unitId) is
  // included in teamYTDAPI via productionScopeIds, while BM stays excluded
  // from the compliance denominator (agents-only).
  describe('branch_manager role — Slice 2.1b (BM personal production roll-up)', () => {
    const BM_ID = 'bm1';
    const users = [
      { id: BM_ID, role: 'branch_manager' },
      { id: 'um1', role: 'unit_manager',  unitId: 'um1' },
      { id: 'a1',  role: 'agent',         unitId: 'um1' },
      { id: 'a2',  role: 'agent',         unitId: 'um1' },
    ];

    beforeEach(() => { getTenantUsers.mockResolvedValue(users); });

    it('BM personal submission is included in teamYTDAPI', async () => {
      getAllYTDSubmissions.mockResolvedValue([
        mkSub(BM_ID, 600),
        mkSub('um1',  400),
        mkSub('a1',   200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('branch_manager', {}, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.teamYTDAPI).toBe(1200); // BM 600 + um1 400 + a1 200
    });

    it('BM is NOT counted in inScopeAgentCount (compliance denominator stays agents-only)', async () => {
      getAllYTDSubmissions.mockResolvedValue([mkSub(BM_ID, 600)]);

      const { result } = renderHook(() =>
        useBranchOverview('branch_manager', {}, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.inScopeAgentCount).toBe(2); // a1 + a2 only — BM excluded
    });
  });
});
