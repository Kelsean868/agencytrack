// @vitest-environment jsdom
//
// Mobile nav v2 reorder — ManagerDashboard bottom-nav + More-drawer composition.
//
// Asserts, per manager flavor:
//   • Producing managers (unit_manager / branch_manager): Profile is NOT in the
//     bottom nav; it is injected into the More drawer (the producingManager nav
//     config has no profile row, so without the inject it would strand). The ＋
//     FAB is the center slot of the 5-slot nav (4 items + auto-appended "More").
//   • Non-producing managers (sales_manager): Profile is NOT in the bottom nav;
//     it folds into the More drawer automatically from NAV_ITEMS. No FAB.
//
// Reuses the ManagerDashboardMyProduction mock scaffold; the Shell mock here
// captures the nav props rather than rendering navigable buttons.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock:         vi.fn(),
  useMyProductionMock: vi.fn(),
  captured: { navItems: null, bottomNavItems: null, drawerNavItems: null },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuthMock,
}));

vi.mock('../../../hooks/useMyProduction', () => ({
  useMyProduction: hoisted.useMyProductionMock,
}));

// ── Inert service mocks ───────────────────────────────────────────────────────
vi.mock('../../../services/authService',      () => ({ signOut: vi.fn() }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: vi.fn(), dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService',   () => ({
  getWeeklySubmissions: vi.fn().mockResolvedValue([]),
  getTenantUsers:       vi.fn().mockResolvedValue([]),
  getAllYTDSubmissions:  vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/persistencyService', () => ({
  getPersistencyMapForYear: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../services/exportService',    () => ({ exportBranchCSV: vi.fn() }));
vi.mock('../../../utils/formatters',          () => ({ getRoleLabel: () => 'Manager' }));
vi.mock('../../../utils/dateHelpers',         () => ({ getMostRecentSunday: () => '2026-06-22' }));

// ── Sentinel + inert component mocks ─────────────────────────────────────────
vi.mock('../../daily/DailyCaptureV2', () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',       () => ({ default: () => null }));
vi.mock('../GamePlanV2',              () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',       () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',      () => ({ default: () => null }));
vi.mock('../../agent/CommissionAnchorStrip', () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',  () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel',      () => ({ default: () => null }));
vi.mock('../../goals/DerivedIncomePanel',    () => ({ default: () => null }));
vi.mock('../../goals/AwardsReachPanel',      () => ({ default: () => null }));
vi.mock('../../goals/MdrtTracker',           () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',     () => ({ default: () => null }));
vi.mock('../../wizard/WizardForm',                   () => ({ default: () => null }));
vi.mock('../../manager/MasterSheet',                 () => ({ default: () => null }));
vi.mock('../../manager/CompliancePanel',             () => ({ default: () => null }));
vi.mock('../../manager/PersistencyTab',              () => ({ default: () => null }));
vi.mock('../../manager/GoalsPanel',                  () => ({ default: () => null }));
vi.mock('../../manager/SettlementPanel',             () => ({ default: () => null }));
vi.mock('../../manager/MeetingMode',                 () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignPanel',             () => ({ default: () => null }));
vi.mock('../../manager/UserManagementPanel',         () => ({ default: () => null }));
vi.mock('../../awards/ManagerAwardsPanel',           () => ({ default: () => null }));
vi.mock('../ManagerOverviewTab',                      () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',               () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../kiosk/KioskModeTab',                  () => ({ default: () => null }));
vi.mock('../../manager/AgentOfMonthTab',             () => ({ default: () => null }));
vi.mock('../../manager/ManagerWarTab',               () => ({ default: () => null }));
vi.mock('../../manager/TeamWarsTab',                 () => ({ default: () => null }));
vi.mock('../../manager/MonthlyRecruitingTab',        () => ({ default: () => null }));
vi.mock('../../manager/PolicyReconciliationPanel',   () => ({ default: () => null }));
vi.mock('../../planner/manager/TeamPlannerPanel',    () => ({ default: () => null }));
vi.mock('../../leaderboard/ProductionLeaderboardSurface', () => ({ default: () => null }));
vi.mock('../../leaderboard/SmLeaderboardView',       () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',            () => ({ default: () => null }));

// ── Shell — captures the nav props for assertion, renders children ────────────
vi.mock('../../shell/Shell', () => ({
  default: ({ children, navItems, bottomNavItems, drawerNavItems }) => {
    hoisted.captured.navItems       = navItems;
    hoisted.captured.bottomNavItems = bottomNavItems;
    hoisted.captured.drawerNavItems = drawerNavItems;
    return React.createElement('div', { 'data-testid': 'shell-mock' }, children);
  },
}));

import ManagerDashboard from '../ManagerDashboard';

const EMPTY_MY_PROD = {
  allSubmissions: [], goals: null, companyMinimums: null,
  persistency: [], settlements: [], awardsRuleset: {},
  loading: false, hierarchy: null, hierarchyLoading: false, hierarchyError: null,
  policies: null, policiesLoading: false, policiesError: false,
  loadPolicies: vi.fn(), reload: vi.fn(), currentWeek: '2026-06-22',
  ytdTotals: { api: 0, apps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 },
  ytdPersistency: null,
};

function mountWithRole(role) {
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: `${role}-uid` },
    userProfile: { name: 'Test User', branchId: 'south' },
    tenantId:    'tatillife_south',
    role,
  });
  hoisted.useMyProductionMock.mockReturnValue(EMPTY_MY_PROD);
  return render(<ManagerDashboard />);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.captured.navItems       = null;
  hoisted.captured.bottomNavItems = null;
  hoisted.captured.drawerNavItems = null;
});

// ─────────────────────────────────────────────────────────────────────────────
// Producing managers (unit_manager + branch_manager) — inject + centered FAB.
// ─────────────────────────────────────────────────────────────────────────────

describe.each(['unit_manager', 'branch_manager'])('ManagerDashboard mobile nav v2 — %s (producing)', (role) => {
  it('Profile is NOT in the bottom nav', () => {
    mountWithRole(role);
    expect(hoisted.captured.bottomNavItems.find((i) => i.id === 'profile')).toBeUndefined();
    expect(hoisted.captured.bottomNavItems.find((i) => i.tabId === 'profile')).toBeUndefined();
  });

  it('Profile IS injected into the More drawer, exactly once (not stranded)', () => {
    mountWithRole(role);
    const profiles = hoisted.captured.drawerNavItems.filter((i) => i.id === 'profile');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].tabId).toBe('profile');
  });

  it('the ＋ FAB is the center slot of the 5-slot nav (4 items + auto-appended More)', () => {
    mountWithRole(role);
    expect(hoisted.captured.bottomNavItems).toHaveLength(4);
    const fabIndex = hoisted.captured.bottomNavItems.findIndex((i) => i.fab === true);
    expect(fabIndex).toBe(2);
    expect(hoisted.captured.bottomNavItems[fabIndex].action).toBe('quick-add');
  });

  it('bottom-nav order is Dashboard · Team · Create(＋) · Reports', () => {
    mountWithRole(role);
    expect(hoisted.captured.bottomNavItems.map((i) => i.id)).toEqual([
      'overview', 'team', 'create', 'mastersheet',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-producing manager (sales_manager) — pure fold, no FAB.
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard mobile nav v2 — sales_manager (non-producing)', () => {
  it('Profile is NOT in the bottom nav', () => {
    mountWithRole('sales_manager');
    expect(hoisted.captured.bottomNavItems.find((i) => i.id === 'profile')).toBeUndefined();
  });

  it('Profile folds into the More drawer from NAV_ITEMS, exactly once', () => {
    mountWithRole('sales_manager');
    const profiles = hoisted.captured.drawerNavItems.filter((i) => i.id === 'profile');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].tabId).toBe('profile');
  });

  it('has no ＋ FAB and a 4-tab bottom nav', () => {
    mountWithRole('sales_manager');
    expect(hoisted.captured.bottomNavItems.find((i) => i.fab === true)).toBeUndefined();
    expect(hoisted.captured.bottomNavItems.map((i) => i.id)).toEqual([
      'overview', 'team', 'mastersheet', 'campaigns',
    ]);
  });

  // ── D3: Team Planner nav item wired for sales_manager ────────────────────────
  it('D3: sees the Team Planner sidebar item (id/tabId=planner), not disabled', () => {
    mountWithRole('sales_manager');
    const planner = hoisted.captured.navItems.find((i) => i.id === 'planner');
    expect(planner).toBeDefined();
    expect(planner.tabId).toBe('planner');
    expect(planner.label).toBe('Team Planner');
    expect(planner.disabled).not.toBe(true);
  });

  it('D3: Team Planner is NOT in the bottom nav (BOTTOM_NAV untouched)', () => {
    mountWithRole('sales_manager');
    expect(hoisted.captured.bottomNavItems.find((i) => i.id === 'planner')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D3: plain producing managers keep their existing planner wiring (via navConfig)
// and the sales_manager-gated NAV_ITEMS row must NOT double-inject for them.
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerDashboard — D3 Team Planner gating', () => {
  it.each(['unit_manager', 'branch_manager'])(
    '%s has exactly one planner nav item (from navConfig, no NAV_ITEMS duplicate)',
    (role) => {
      mountWithRole(role);
      const planners = hoisted.captured.navItems.filter((i) => i.id === 'planner');
      expect(planners).toHaveLength(1);
    },
  );
});
