// @vitest-environment jsdom
//
// Slice 2.1a — production scope split in useBranchOverview.
// Phase 3 — UM mandatory filing (cutoff-conditional compliance).
// Asserts:
//   1. UM personal submission is included in teamYTDAPI (production scope).
//   2. inScopeAgentCount stays agents-only always (used for goal fallback, never gains UMs).
//   3. kpiData.compliance is agents-only for pre-cutoff weeks (historical preserved).
//   4. kpiData.compliance includes UMs for weeks >= UM_MANDATORY_FILING_CUTOFF.
//   5. BM sees all branch UMs in teamYTDAPI, agents-only compliance denom.

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
import { getBranchGoals, getCompanyMinimums } from '../../services/goalsService';
import { useBranchOverview } from '../useBranchOverview';

const WEEK      = '2026-06-08'; // pre-cutoff (< 2026-06-14)
const WEEK_POST = '2026-06-14'; // cutoff boundary — UMs enter compliance scope (>= inclusive)

function mkSub(agentId, api) {
  return { agentId, weekStarting: WEEK, _api: api };
}

function mkSubW(agentId, api, week) {
  return { agentId, weekStarting: week, _api: api };
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

    it('pre-cutoff week: kpiData.compliance uses agents-only numerator and denominator (historical preserved)', async () => {
      // WEEK = '2026-06-08' < cutoff '2026-06-14'
      // UM submitted + a1 submitted; a2 did NOT submit
      getAllYTDSubmissions.mockResolvedValue([
        mkSub(UM_ID, 500),
        mkSub('a1',  200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 1 agent filed (a1) out of 2 agents (a1 + a2) → 50% — UM excluded despite filing
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

    it('pre-cutoff week: uses agents-only count for compliance denominator (historical preserved)', async () => {
      // WEEK = '2026-06-08' < cutoff — Only um1 + a1 submitted; a2 did not
      getAllYTDSubmissions.mockResolvedValue([
        mkSub('um1', 400),
        mkSub('a1',  200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('branch_manager', {}, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.inScopeAgentCount).toBe(2); // a1 + a2 — agents only
      expect(result.current.kpiData.compliance).toEqual([50]); // 1/2 agents filed; UM excluded
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

  // ── Phase 3 — UM mandatory filing (cutoff-conditional) ──────────────────────
  describe('Phase 3 — UM mandatory filing (cutoff-conditional compliance)', () => {
    const UM_ID = 'um-1';
    const unitId = UM_ID;
    const userProfile = { unitId };

    // Minimal fixture: UM + 2 agents in one unit (no cross-unit noise).
    const users = [
      { id: UM_ID, role: 'unit_manager', unitId },
      { id: 'a1',  role: 'agent',        unitId },
      { id: 'a2',  role: 'agent',        unitId },
    ];

    beforeEach(() => { getTenantUsers.mockResolvedValue(users); });

    it('pre-cutoff week: UM excluded from compliance numerator and denominator (historical preserved)', async () => {
      // UM filed for WEEK (pre-cutoff) — should NOT be counted
      getAllYTDSubmissions.mockResolvedValue([
        mkSub(UM_ID, 500), // weekStarting: WEEK = '2026-06-08' < cutoff
        mkSub('a1',  200),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 1 agent filed (a1) out of 2 agents (a1 + a2) → 50%; UM excluded despite filing
      expect(result.current.kpiData.compliance).toEqual([50]);
      expect(result.current.inScopeAgentCount).toBe(2);
    });

    it('post-cutoff boundary (2026-06-14, >= inclusive): non-filing UM in denominator lowers %', async () => {
      // UM did NOT file; a1 filed → 1 out of 3 (a1 + a2 + UM) → 33%
      getAllYTDSubmissions.mockResolvedValue([
        mkSubW('a1', 200, WEEK_POST),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.kpiData.compliance).toEqual([33]);
      // inScopeAgentCount stays agents-only — used for teamAnnualGoal fallback, never gains UMs
      expect(result.current.inScopeAgentCount).toBe(2);
    });

    it('post-cutoff: filing UM counts toward numerator (increases %)', async () => {
      // UM filed + a1 filed; a2 did not → 2 out of 3 (a1 + a2 + UM) → 67%
      getAllYTDSubmissions.mockResolvedValue([
        mkSubW(UM_ID, 500, WEEK_POST),
        mkSubW('a1',  200, WEEK_POST),
      ]);

      const { result } = renderHook(() =>
        useBranchOverview('unit_manager', userProfile, 'tenant-1')
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.kpiData.compliance).toEqual([67]);
      expect(result.current.inScopeAgentCount).toBe(2); // agents-only unchanged
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 states contract — reload() is what powers ManagerOverviewTab's error-card
// Retry button. It must actually re-invoke the same fetch path, not just
// reset local state.
// ─────────────────────────────────────────────────────────────────────────────
describe('useBranchOverview — reload()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantUsers.mockResolvedValue([{ id: 'a1', role: 'agent', unitId: null }]);
    getAllYTDSubmissions.mockResolvedValue([]);
  });

  it('re-invokes all four parallel reads', async () => {
    const { result } = renderHook(() =>
      useBranchOverview('branch_manager', { unitId: null }, 'tenant-1')
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAllYTDSubmissions).toHaveBeenCalledTimes(1);
    expect(getTenantUsers).toHaveBeenCalledTimes(1);

    result.current.reload();

    await waitFor(() => expect(getAllYTDSubmissions).toHaveBeenCalledTimes(2));
    expect(getTenantUsers).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 silent-swallow fix — primary-read failures must reach `error`; the
// goalRead/getCompanyMinimums config arms stay self-catching (degrade, not fail).
// ─────────────────────────────────────────────────────────────────────────────
describe('useBranchOverview — §1 error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAllYTDSubmissions rejection sets error (and loading false)', async () => {
    getTenantUsers.mockResolvedValue([]);
    getAllYTDSubmissions.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useBranchOverview('branch_manager', {}, 'tenant-1')
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load team overview.');
  });

  it('getTenantUsers rejection sets error (and loading false)', async () => {
    getAllYTDSubmissions.mockResolvedValue([]);
    getTenantUsers.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useBranchOverview('branch_manager', {}, 'tenant-1')
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load team overview.');
  });

  it('a goalRead/getCompanyMinimums-only rejection does NOT set error (semantic degradation preserved)', async () => {
    getAllYTDSubmissions.mockResolvedValue([]);
    getTenantUsers.mockResolvedValue([]);
    getBranchGoals.mockRejectedValue(new Error('goal read down'));
    getCompanyMinimums.mockRejectedValue(new Error('minimums read down'));

    const { result } = renderHook(() =>
      useBranchOverview('branch_manager', {}, 'tenant-1')
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
  });
});
