// @vitest-environment jsdom
//
// Producing-manager fast path — daily-review → Confirm routing.
//
// Asserts the ManagerDashboard wiring added for the fast-path extension:
//   1. Fast payload (aggregatedFromDaily/daysWorked ≥ 1) routes the dedicated
//      showMpWizard host to initialScreen='confirm' / initialStep=10.
//   2. Empty/full payload routes to initialScreen=null / initialStep=1 (full).
//   3. mp-report direct nav still mounts a BARE WizardForm (no initialScreen) —
//      regression guard on the untouched full-path entry.
//   4. SM / PA mount without crashing (the host is only reachable via the
//      role-gated FAB, never for these roles — defensive).
//
// The real resolvePath (WizardForm.helpers) drives the routing — only the
// WizardForm *component* is mocked, so this exercises the actual path logic.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

// ── Fast-path-relevant mocks ─────────────────────────────────────────────────
// DailyCaptureV2 surfaces onReviewSubmit via two buttons: one with a FAST
// payload (daily entries present), one with an EMPTY payload (full path).
vi.mock('../../daily/DailyCaptureV2', async () => {
  const R = await import('react');
  return {
    default: ({ onReviewSubmit }) =>
      R.createElement(
        'div',
        { 'data-testid': 'mp-daily-capture-v2' },
        R.createElement(
          'button',
          {
            'data-testid': 'daily-review-fast',
            onClick: () => onReviewSubmit('2026-06-14', { aggregatedFromDaily: true, daysWorked: 3 }),
          },
          'review-fast',
        ),
        R.createElement(
          'button',
          {
            'data-testid': 'daily-review-full',
            onClick: () => onReviewSubmit('2026-06-14', { aggregatedFromDaily: false, daysWorked: 0 }),
          },
          'review-full',
        ),
      ),
  };
});

// DailyFAB surfaces its onClick so the test can open the daily modal.
vi.mock('../../daily/DailyFAB', async () => {
  const R = await import('react');
  return { default: ({ onClick }) => R.createElement('button', { 'data-testid': 'mp-daily-fab', onClick }) };
});

// WizardForm exposes the routing props it received via data-* attributes.
vi.mock('../../wizard/WizardForm', async () => {
  const R = await import('react');
  return {
    default: ({ initialWeek, initialStep, initialScreen }) =>
      R.createElement('div', {
        'data-testid': 'wizard-form',
        'data-initial-week': String(initialWeek),
        'data-initial-step': String(initialStep),
        'data-initial-screen': String(initialScreen),
      }),
  };
});

// ── Inert mocks for every other dashboard sub-component ──────────────────────
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
vi.mock('../GamePlanV2',                              () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',              () => ({ default: () => null }));
vi.mock('../../agent/CommissionAnchorStrip',         () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',          () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel',              () => ({ default: () => null }));
vi.mock('../../goals/DerivedIncomePanel',            () => ({ default: () => null }));
vi.mock('../../goals/AwardsReachPanel',              () => ({ default: () => null }));
vi.mock('../../goals/MdrtTracker',                   () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',             () => ({ default: () => null }));
vi.mock('../../manager/roster/TeamPerfRosterPage',   () => ({ default: () => null }));

// ── Shell — renders navItems as clickable buttons, then children ──────────────
vi.mock('../../shell/Shell', async () => {
  const R = await import('react');
  return {
    default: ({ children, navItems = [], setActiveTab }) =>
      R.createElement(
        'div',
        { 'data-testid': 'shell-mock' },
        navItems.map((item) =>
          R.createElement(
            'button',
            { key: item.id, type: 'button', 'data-testid': `nav-${item.id}`, onClick: () => setActiveTab(item.tabId) },
            item.label,
          ),
        ),
        children,
      ),
  };
});

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

function mountWithRole(role, profileOverrides = {}) {
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: `${role}-uid` },
    userProfile: { name: 'Test User', branchId: 'south', ...profileOverrides },
    tenantId:    'tatillife_south',
    role,
  });
  hoisted.useMyProductionMock.mockReturnValue(EMPTY_MY_PROD);
  return render(<ManagerDashboard />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Navigate to an mp-* tab, open the daily modal via the FAB, and click the
// given review button. Leaves the dashboard on the showMpWizard host render.
function openDailyReview(reviewTestId) {
  fireEvent.click(screen.getByTestId('nav-mp-goals'));   // mp-* tab → FAB visible
  fireEvent.click(screen.getByTestId('mp-daily-fab'));   // → showMpDailyModal
  fireEvent.click(screen.getByTestId(reviewTestId));     // → onReviewSubmit(payload)
}

describe('ManagerDashboard — producing-manager fast path', () => {
  it('fast payload routes the wizard host to Confirm at step 10', () => {
    mountWithRole('unit_manager'); // loggingMode unset → hybrid
    openDailyReview('daily-review-fast');

    const wizard = screen.getByTestId('wizard-form');
    expect(wizard).toHaveAttribute('data-initial-screen', 'confirm');
    expect(wizard).toHaveAttribute('data-initial-step', '10');
    expect(wizard).toHaveAttribute('data-initial-week', '2026-06-14');
  });

  it('empty payload routes the wizard host to the full path (step 1, no Confirm)', () => {
    mountWithRole('unit_manager');
    openDailyReview('daily-review-full');

    const wizard = screen.getByTestId('wizard-form');
    expect(wizard).toHaveAttribute('data-initial-screen', 'null');
    expect(wizard).toHaveAttribute('data-initial-step', '1');
  });

  it('fast path works for branch_manager too (no role gate on resolvePath)', () => {
    mountWithRole('branch_manager', { loggingMode: 'hybrid' });
    openDailyReview('daily-review-fast');

    const wizard = screen.getByTestId('wizard-form');
    expect(wizard).toHaveAttribute('data-initial-screen', 'confirm');
    expect(wizard).toHaveAttribute('data-initial-step', '10');
  });

  it('mp-report direct nav still mounts a bare WizardForm (no Confirm) — regression', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-report'));

    const wizard = screen.getByTestId('wizard-form');
    // Bare mount threads no routing props → undefined, NOT 'confirm'.
    expect(wizard).toHaveAttribute('data-initial-screen', 'undefined');
    expect(wizard).not.toHaveAttribute('data-initial-screen', 'confirm');
  });

  it('mounts without crashing for sales_manager (fast-path host unreachable)', () => {
    expect(() => mountWithRole('sales_manager')).not.toThrow();
    // SM has no mp-* nav items → no FAB → fast-path host never reached.
    expect(screen.queryByTestId('nav-mp-goals')).not.toBeInTheDocument();
  });

  it('mounts without crashing for platform_admin (fast-path host unreachable)', () => {
    expect(() => mountWithRole('platform_admin')).not.toThrow();
    expect(screen.queryByTestId('nav-mp-goals')).not.toBeInTheDocument();
  });
});
