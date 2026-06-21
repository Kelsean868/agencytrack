// @vitest-environment jsdom
//
// Track J P5 + P5b — ManagerDashboard's role-conditional Leaderboard tab swap.
//
// Asserts:
//   1. unit_manager → ProductionLeaderboardSurface (P5a scope control is on
//      this surface; this test pins the swap, not the control itself which
//      is covered by UnitScope.test.jsx).
//   2. branch_manager → ProductionLeaderboardSurface (same).
//   3. sales_manager → SmLeaderboardView (P5b — all-branches picker; SM no
//      longer mounts the points board).
//   4. tenant_admin → SHOULD NOT REACH ManagerDashboard's leaderboard arm
//      (TA routes to TenantAdminDashboard via App.jsx); kept here as a
//      defensive fallback only for documentation.
//   5. platform_admin → gamification/Leaderboard (regression — PA still
//      falls through the default arm; keeps the points-board import
//      consumed so it is NOT orphaned by P5b).
//
// Mocks the three leaderboard render targets with sentinel divs so the
// assertions pin which one ManagerDashboard chose to mount; mocks every
// other heavy sub-component as inert so we don't drag the whole dashboard
// into the test.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuthMock,
}));

// ── Service mocks (all inert — none of this matters for the leaderboard tab)
vi.mock('../../../services/authService', () => ({ signOut: vi.fn() }));
vi.mock('../../../services/managerService', () => ({
  getWeeklySubmissions: vi.fn().mockResolvedValue([]),
  getTenantUsers:       vi.fn().mockResolvedValue([]),
  getAllYTDSubmissions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/persistencyService', () => ({
  getPersistencyMapForYear: vi.fn().mockResolvedValue({}),
  getAgentHistory:          vi.fn().mockResolvedValue([]), // PM-2: useMyProduction calls this for UM/BM
}));
vi.mock('../../../services/exportService', () => ({ exportBranchCSV: vi.fn() }));
vi.mock('../../../utils/formatters', () => ({ getRoleLabel: () => 'Manager' }));
vi.mock('../../../utils/dateHelpers', () => ({ getMostRecentSunday: () => '2026-05-31' }));

// ── Mount-sentinel mocks for the TWO leaderboard render targets ──────────────
//
// These are what the test ACTUALLY asserts. The sentinel divs let us read
// which one ManagerDashboard chose to mount via testid. We use
// React.createElement (NOT JSX) inside vi.mock factories because the
// factories are hoisted above the `import React` statement.
vi.mock('../../gamification/Leaderboard', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'manager-leaderboard-points-board-mount' }),
  };
});
vi.mock('../../leaderboard/ProductionLeaderboardSurface', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'manager-leaderboard-production-surface-mount' }),
  };
});
vi.mock('../../leaderboard/SmLeaderboardView', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'manager-leaderboard-sm-view-mount' }),
  };
});

// ── PM-2: useMyProduction fires for UM/BM — stub it out so this test doesn't
//    need to satisfy all the service deps the hook pulls in. ─────────────────
vi.mock('../../../hooks/useMyProduction', () => ({
  useMyProduction: () => ({
    allSubmissions: [], goals: null, companyMinimums: null,
    persistency: [], settlements: [], awardsRuleset: {},
    loading: false, hierarchy: null, hierarchyLoading: false, hierarchyError: null,
    policies: null, policiesLoading: false, policiesError: false,
    loadPolicies: () => {}, reload: () => {}, currentWeek: '2026-05-31',
    ytdTotals: { api: 0, apps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 },
    ytdPersistency: null,
  }),
}));

// ── Inert mocks for the rest of the dashboard sub-components ─────────────────
vi.mock('../../wizard/WizardForm',                       () => ({ default: () => null }));
vi.mock('../../manager/MasterSheet',                     () => ({ default: () => null }));
vi.mock('../../manager/CompliancePanel',                 () => ({ default: () => null }));
vi.mock('../../manager/PersistencyTab',                  () => ({ default: () => null }));
vi.mock('../../manager/GoalsPanel',                      () => ({ default: () => null }));
vi.mock('../../manager/SettlementPanel',                 () => ({ default: () => null }));
vi.mock('../../manager/MeetingMode',                     () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignPanel',                 () => ({ default: () => null }));
vi.mock('../../manager/UserManagementPanel',             () => ({ default: () => null }));
vi.mock('../../awards/ManagerAwardsPanel',               () => ({ default: () => null }));
vi.mock('../ManagerOverviewTab',                          () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',                    () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab',     () => ({ default: () => null }));
vi.mock('../../kiosk/KioskModeTab',                       () => ({ default: () => null }));
vi.mock('../../manager/AgentOfMonthTab',                  () => ({ default: () => null }));
vi.mock('../../manager/ManagerWarTab',                    () => ({ default: () => null }));
vi.mock('../../manager/TeamWarsTab',                      () => ({ default: () => null }));
vi.mock('../../manager/MonthlyRecruitingTab',             () => ({ default: () => null }));
vi.mock('../../manager/PolicyReconciliationPanel',        () => ({ default: () => null }));
// PM-2 component imports added to ManagerDashboard — all inert here.
vi.mock('../../daily/DailyCaptureV2',                    () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',                          () => ({ default: () => null }));
vi.mock('../GamePlanV2',                                  () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',                   () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',                   () => ({ default: () => null }));
vi.mock('../../agent/CommissionAnchorStrip',              () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',               () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel',                  () => ({ default: () => null }));
vi.mock('../../goals/DerivedIncomePanel',                 () => ({ default: () => null }));
vi.mock('../../goals/AwardsReachPanel',                  () => ({ default: () => null }));
vi.mock('../../goals/MdrtTracker',                       () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',                 () => ({ default: () => null }));

// Shell — renders children, exposes a setter for activeTab so tests can flip
// directly to the leaderboard tab without going through the sidebar DOM.
vi.mock('../../shell/Shell', async () => {
  const React = await import('react');
  return {
    default: ({ children, setActiveTab }) =>
      React.createElement(
        'div',
        { 'data-testid': 'shell-mock' },
        React.createElement('button', {
          type:        'button',
          'data-testid': 'go-leaderboard',
          onClick:     () => setActiveTab('leaderboard'),
        }),
        children
      ),
  };
});

import ManagerDashboard from '../ManagerDashboard';

function mountWithRole(role, opts = {}) {
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: `${role}-uid` },
    userProfile: { name: 'Test Manager', branchId: 'south', ...opts },
    tenantId:    'tatillife_south',
    role,
  });
  return render(<ManagerDashboard />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// The swap — UM/BM → ProductionLeaderboardSurface
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — Leaderboard tab (Track J P5 swap)', () => {
  it('unit_manager → mounts ProductionLeaderboardSurface (NOT the points board)', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-production-surface-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-points-board-mount')).not.toBeInTheDocument();
  });

  it('branch_manager → mounts ProductionLeaderboardSurface (NOT the points board)', () => {
    mountWithRole('branch_manager');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-production-surface-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-points-board-mount')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5b — SM now mounts SmLeaderboardView (NOT the points board)
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — Leaderboard tab (Track J P5b SM swap)', () => {
  it('sales_manager → mounts SmLeaderboardView (NOT the points board, NOT the production surface)', () => {
    mountWithRole('sales_manager');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-sm-view-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-points-board-mount')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-production-surface-mount')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression — PA still mounts the points board (load-bearing for the
// no-orphan guarantee; the import in ManagerDashboard stays consumed via
// the PA fallback after P5b takes SM out of this arm).
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — Leaderboard tab regression (PA still on points board)', () => {
  it('platform_admin → mounts gamification/Leaderboard (regression — default arm)', () => {
    mountWithRole('platform_admin');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-production-surface-mount')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-sm-view-mount')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Points-board NOT orphaned — its import is still consumed by PA
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — gamification/Leaderboard is not orphaned (PA keeps the import live)', () => {
  it('the points-board mount path resolves at module load (no Cannot-find-module on PA render)', () => {
    // If `gamification/Leaderboard` had been removed or the import deleted,
    // the PA render path would either throw at module-load OR fail to
    // resolve the testid below (because the mock provides one). The fact
    // that PA mounts the sentinel proves the import is intact AND its
    // render branch is reachable — i.e., P5b did NOT orphan the import.
    cleanup();
    expect(() => mountWithRole('platform_admin')).not.toThrow();
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
  });
});
