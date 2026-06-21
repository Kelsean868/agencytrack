// @vitest-environment jsdom
//
// PM-2 — ManagerDashboard "My Production" section.
//
// Asserts:
//   1. UM + BM see all 7 My Production nav items (mp-report → mp-policies).
//   2. SM / PA do NOT see My Production items (role-gate is filtering).
//   3. Standalone "policy-ledger" nav item is gone (absorbed as mp-policies).
//   4. Each mp-* tab mounts the correct sentinel component.
//   5. DailyFAB visible on mp-* tabs for default loggingMode (unset → 'hybrid').
//   6. DailyFAB hidden on non-mp tabs and when loggingMode = 'wizard'.
//
// Shell mock receives navItems and renders one button per item so tests can
// navigate without going through real sidebar DOM.

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

// ── PM-2 sentinel mocks ───────────────────────────────────────────────────────
vi.mock('../../daily/DailyCaptureV2', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-daily-capture-v2' }) };
});
vi.mock('../../daily/DailyFAB', async () => {
  const R = await import('react');
  return { default: ({ onClick }) => R.createElement('button', { 'data-testid': 'mp-daily-fab', onClick }) };
});
vi.mock('../GamePlanV2', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-game-plan-screen' }) };
});
vi.mock('../../agent/MoneyNeedsPanel', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-money-needs-panel' }) };
});
vi.mock('../../submissions/HistoryTab', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-history-tab' }) };
});
vi.mock('../../agent/CommissionAnchorStrip', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-commission-anchor-strip' }) };
});
vi.mock('../../goals/CommissionPlayground', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-commission-playground' }) };
});
vi.mock('../../goals/GapAnalysisPanel', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-gap-analysis-panel' }) };
});
vi.mock('../../goals/DerivedIncomePanel', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-derived-income-panel' }) };
});
vi.mock('../../goals/AwardsReachPanel', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-awards-reach-panel' }) };
});
vi.mock('../../goals/MdrtTracker', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-mdrt-tracker' }) };
});

// PolicyLedgerPanel — used by the mp-policies tab (previously standalone policy-ledger).
vi.mock('../../agent/PolicyLedgerPanel', async () => {
  const R = await import('react');
  return { default: () => R.createElement('div', { 'data-testid': 'mp-policy-ledger-panel' }) };
});

// ── Inert mocks for every other dashboard sub-component ──────────────────────
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

// ── Default useMyProduction return value (no-op data) ────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Nav visibility — UM and BM only
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — My Production nav section visibility', () => {
  it('unit_manager sees all 7 My Production nav items', () => {
    mountWithRole('unit_manager');
    expect(screen.getByTestId('nav-mp-report')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-goals')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-game-plan')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-money-needs')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-commission')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-policies')).toBeInTheDocument();
  });

  it('branch_manager sees all 7 My Production nav items', () => {
    mountWithRole('branch_manager');
    expect(screen.getByTestId('nav-mp-report')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-goals')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-game-plan')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-money-needs')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-commission')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mp-policies')).toBeInTheDocument();
  });

  it('sales_manager does NOT see any My Production nav items', () => {
    mountWithRole('sales_manager');
    expect(screen.queryByTestId('nav-mp-report')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-mp-goals')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-mp-policies')).not.toBeInTheDocument();
  });

  it('platform_admin does NOT see any My Production nav items', () => {
    mountWithRole('platform_admin');
    expect(screen.queryByTestId('nav-mp-report')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-mp-policies')).not.toBeInTheDocument();
  });

  it('standalone policy-ledger nav item is removed (now mp-policies)', () => {
    // Regression: the old standalone "Policy Ledger" entry must not appear.
    // Policies are now reachable only via My Production (mp-policies).
    mountWithRole('unit_manager');
    expect(screen.queryByTestId('nav-policy-ledger')).not.toBeInTheDocument();
  });

  it('standalone policy-ledger nav item was never shown to SM either (not a regression)', () => {
    mountWithRole('sales_manager');
    expect(screen.queryByTestId('nav-policy-ledger')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab renders — correct sentinel mounts per mp-* tab
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — My Production tab renders (UM)', () => {
  it('mp-report click triggers WizardForm early return (no crash)', () => {
    // WizardForm is mocked to null — the early return renders nothing.
    // Key assertion: no throw, and the dashboard does not crash.
    mountWithRole('unit_manager');
    expect(() => fireEvent.click(screen.getByTestId('nav-mp-report'))).not.toThrow();
  });

  it('mp-goals mounts GapAnalysisPanel, AwardsReachPanel, MdrtTracker', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-goals'));
    expect(screen.getByTestId('mp-gap-analysis-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mp-derived-income-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mp-awards-reach-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mp-mdrt-tracker')).toBeInTheDocument();
  });

  it('mp-game-plan mounts GamePlanScreen', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-game-plan'));
    expect(screen.getByTestId('mp-game-plan-screen')).toBeInTheDocument();
  });

  it('mp-money-needs mounts MoneyNeedsPanel', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-money-needs'));
    expect(screen.getByTestId('mp-money-needs-panel')).toBeInTheDocument();
  });

  it('mp-history mounts HistoryTab', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-history'));
    expect(screen.getByTestId('mp-history-tab')).toBeInTheDocument();
  });

  it('mp-commission mounts CommissionAnchorStrip and CommissionPlayground', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-commission'));
    expect(screen.getByTestId('mp-commission-anchor-strip')).toBeInTheDocument();
    expect(screen.getByTestId('mp-commission-playground')).toBeInTheDocument();
  });

  it('mp-policies mounts PolicyLedgerPanel', () => {
    mountWithRole('unit_manager');
    fireEvent.click(screen.getByTestId('nav-mp-policies'));
    expect(screen.getByTestId('mp-policy-ledger-panel')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DailyFAB gating — mp-* tabs only, loggingMode-aware
// ─────────────────────────────────────────────────────────────────────────────

describe('ManagerDashboard — DailyFAB on My Production tabs', () => {
  it('DailyFAB visible on mp-goals tab (loggingMode unset → default hybrid)', () => {
    mountWithRole('unit_manager'); // no loggingMode → undefined → 'hybrid'
    fireEvent.click(screen.getByTestId('nav-mp-goals'));
    expect(screen.getByTestId('mp-daily-fab')).toBeInTheDocument();
  });

  it('DailyFAB visible on mp-history tab (hybrid)', () => {
    mountWithRole('branch_manager', { loggingMode: 'hybrid' });
    fireEvent.click(screen.getByTestId('nav-mp-history'));
    expect(screen.getByTestId('mp-daily-fab')).toBeInTheDocument();
  });

  it('DailyFAB visible on mp-commission tab (daily logging mode)', () => {
    mountWithRole('unit_manager', { loggingMode: 'daily' });
    fireEvent.click(screen.getByTestId('nav-mp-commission'));
    expect(screen.getByTestId('mp-daily-fab')).toBeInTheDocument();
  });

  it('DailyFAB absent on non-mp tabs (overview is the default)', () => {
    mountWithRole('unit_manager');
    // Default active tab is 'overview' — DailyFAB must not appear.
    expect(screen.queryByTestId('mp-daily-fab')).not.toBeInTheDocument();
  });

  it('DailyFAB absent when loggingMode = "wizard" even on an mp-* tab', () => {
    mountWithRole('unit_manager', { loggingMode: 'wizard' });
    fireEvent.click(screen.getByTestId('nav-mp-goals'));
    expect(screen.queryByTestId('mp-daily-fab')).not.toBeInTheDocument();
  });
});
