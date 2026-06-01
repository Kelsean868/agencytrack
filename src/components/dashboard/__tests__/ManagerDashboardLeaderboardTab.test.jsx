// @vitest-environment jsdom
//
// Track J P5 — ManagerDashboard's role-conditional Leaderboard tab swap.
//
// Asserts:
//   1. unit_manager → ProductionLeaderboardSurface (P5a scope control is on
//      this surface; this test pins the swap, not the control itself which
//      is covered by UnitScope.test.jsx).
//   2. branch_manager → ProductionLeaderboardSurface (same).
//   3. sales_manager → gamification/Leaderboard (REGRESSION — must NOT
//      break; SM uses points board until P5b ships the all-branches picker).
//   4. tenant_admin → gamification/Leaderboard (regression — same default
//      arm as SM; only UM/BM are gated to the production surface).
//   5. platform_admin → gamification/Leaderboard (regression — same).
//
// Mocks the two leaderboard components with sentinel divs so the assertions
// pin which one ManagerDashboard chose to mount; mocks every other heavy
// sub-component as inert so we don't drag the whole dashboard into the test.

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
// Regression — SM/TA/PA still mount the points board
// (this is the load-bearing safety net; SM must NOT break — P5b is the
//  proper SM experience, not in this PR)
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — Leaderboard tab regression (SM/TA/PA keep points board)', () => {
  it('sales_manager → mounts gamification/Leaderboard (REGRESSION GUARD — SM unchanged until P5b)', () => {
    mountWithRole('sales_manager');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-production-surface-mount')).not.toBeInTheDocument();
  });

  it('tenant_admin → mounts gamification/Leaderboard (regression — default arm)', () => {
    mountWithRole('tenant_admin');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-production-surface-mount')).not.toBeInTheDocument();
  });

  it('platform_admin → mounts gamification/Leaderboard (regression — default arm)', () => {
    mountWithRole('platform_admin');
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-leaderboard-production-surface-mount')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Points-board NOT orphaned — its import is still consumed
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — gamification/Leaderboard is not orphaned (import stays consumed)', () => {
  it('the points-board mount path resolves at module load (no Cannot-find-module on SM render)', () => {
    // If `gamification/Leaderboard` had been removed or the import deleted,
    // the SM render path would either throw at module-load OR fail to
    // resolve the testid below (because the mock provides one). The fact
    // that SM mounts the sentinel proves the import is intact AND its
    // render branch is reachable.
    cleanup();
    expect(() => mountWithRole('sales_manager')).not.toThrow();
    fireEvent.click(screen.getByTestId('go-leaderboard'));
    expect(screen.getByTestId('manager-leaderboard-points-board-mount')).toBeInTheDocument();
  });
});
