// @vitest-environment jsdom
//
// D1 (VH) — ManagerDashboard warms the producing-manager's OWN Game Plan
// year-docs on dashboard idle (extends #829 from the agent side). Asserts:
//   • Producing managers (unit_manager / branch_manager) fire the idle prefetch
//     exactly once with the args GamePlanScreen reads with (tenantId, uid, year).
//   • Non-producing roles (sales_manager, tenant_admin) NEVER prefetch — the
//     opt-in scoping matches the surface that renders GamePlanScreen for its own uid.
//   • The listeners are torn down on unmount (cleanup contract).
//   • A throwing prefetch cannot break the dashboard render.
//
// Reuses the ManagerDashboardNav mock scaffold (ManagerDashboard imports all of
// these). The additions vs that file are the gamePlanPrefetch mock + a synchronous
// requestIdleCallback so the idle callback runs deterministically in the test.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock:         vi.fn(),
  useMyProductionMock: vi.fn(),
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
vi.mock('../../leaderboard/ProductionLeaderboardSurface', () => ({ default: () => null }));
vi.mock('../../leaderboard/SmLeaderboardView',       () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',            () => ({ default: () => null }));

vi.mock('../../shell/Shell', () => ({
  default: ({ children }) => React.createElement('div', { 'data-testid': 'shell-mock' }, children),
}));

// The subject under test — mocked so we can assert the idle invocation + args.
const teardownMock = vi.fn();
const prefetchMock = vi.fn(() => teardownMock);
vi.mock('../../../services/gamePlanPrefetch', () => ({
  prefetchGamePlanYearDocs: (...args) => prefetchMock(...args),
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
  prefetchMock.mockImplementation(() => teardownMock);
  // Run the idle callback synchronously so the prefetch fires within the test.
  window.requestIdleCallback = (cb) => { cb({ didTimeout: false, timeRemaining: () => 50 }); return 1; };
  window.cancelIdleCallback = vi.fn();
});
afterEach(() => {
  delete window.requestIdleCallback;
  delete window.cancelIdleCallback;
});

describe('ManagerDashboard — Game Plan idle prefetch (D1/VH, extends #829)', () => {
  describe.each(['unit_manager', 'branch_manager'])('producing manager — %s', (role) => {
    it('prefetches the manager\'s own Game Plan year-docs on idle with (tenantId, uid, thisYear)', () => {
      mountWithRole(role);
      expect(prefetchMock).toHaveBeenCalledTimes(1);
      const [tenantId, uid, year] = prefetchMock.mock.calls[0];
      expect(tenantId).toBe('tatillife_south');
      expect(uid).toBe(`${role}-uid`); // the manager's OWN uid, same as GamePlanScreen reads
      expect(year).toBe(new Date().getFullYear());
    });

    it('tears down the listeners on unmount', () => {
      const { unmount } = mountWithRole(role);
      expect(teardownMock).not.toHaveBeenCalled();
      unmount();
      expect(teardownMock).toHaveBeenCalledTimes(1);
    });

    it('a throwing prefetch does not break the dashboard render', () => {
      prefetchMock.mockImplementation(() => { throw new Error('prefetch boom'); });
      expect(() => mountWithRole(role)).not.toThrow();
    });
  });

  describe.each(['sales_manager', 'tenant_admin'])('non-producing role — %s never prefetches', (role) => {
    it('does NOT prefetch (opt-in scoping — no GamePlanScreen for own uid)', () => {
      mountWithRole(role);
      expect(prefetchMock).not.toHaveBeenCalled();
    });
  });
});
