// @vitest-environment jsdom
//
// Regression: focus-return after Meeting Mode closes.
//
// MeetingMode replaces the ENTIRE dashboard while open (ManagerDashboard early-
// returns <MeetingMode/> instead of the Shell), so the Start Meeting trigger
// unmounts. useFocusTrap captured that trigger on open, but by close time it is
// a detached node and its restore silently no-ops — the Tier-0 browser smoke
// caught focus never returning. ManagerDashboard now owns the restore: when
// meetingActive flips false it re-focuses the freshly remounted trigger.
//
// This test drives the real open→close cycle (mocked data + a MeetingMode stub
// that fires onClose) and asserts document.activeElement lands back on the
// Start Meeting button. It fails without the re-focus effect in ManagerDashboard.
//
// Reuses the ManagerDashboardNav mock scaffold; the Shell mock here additionally
// renders `topbarActions` (where the Start Meeting button lives), and the
// MeetingMode mock renders a working close button.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock:         vi.fn(),
  useMyProductionMock: vi.fn(),
  toastShow:           vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuthMock }));
vi.mock('../../../hooks/useMyProduction', () => ({ useMyProduction: hoisted.useMyProductionMock }));

// ── Inert service mocks ───────────────────────────────────────────────────────
vi.mock('../../../services/authService',      () => ({ signOut: vi.fn() }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.toastShow, dismiss: vi.fn() }) }));
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
vi.mock('../../manager/FinancingTab',                () => ({ default: () => null }));
// MeetingMode stub — renders a working close button so the test can drive the
// real open→close cycle through ManagerDashboard's onClose wiring.
vi.mock('../../manager/MeetingMode', () => ({
  default: ({ onClose }) =>
    React.createElement('button', { onClick: onClose, 'data-testid': 'meeting-close-stub' }, 'Exit stub'),
}));
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
vi.mock('../../manager/roster/TeamPerfRosterPage',   () => ({ default: () => null }));
vi.mock('../../leaderboard/ProductionLeaderboardSurface', () => ({ default: () => null }));
vi.mock('../../leaderboard/SmLeaderboardView',       () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',            () => ({ default: () => null }));

// ── Shell — renders children AND topbarActions (the Start Meeting button) ─────
vi.mock('../../shell/Shell', () => ({
  default: ({ children, topbarActions }) =>
    React.createElement('div', { 'data-testid': 'shell-mock' }, topbarActions, children),
}));

import ManagerDashboard from '../ManagerDashboard';
import { getWeeklySubmissions } from '../../../services/managerService';

const EMPTY_MY_PROD = {
  allSubmissions: [], goals: null, companyMinimums: null,
  persistency: [], settlements: [], awardsRuleset: {},
  loading: false, hierarchy: null, hierarchyLoading: false, hierarchyError: null,
  policies: null, policiesLoading: false, policiesError: false,
  loadPolicies: vi.fn(), reload: vi.fn(), currentWeek: '2026-06-22',
  ytdTotals: { api: 0, apps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 },
  ytdPersistency: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuthMock.mockReturnValue({
    user:        { uid: 'bm-uid' },
    userProfile: { name: 'Test Manager', branchId: 'south' },
    tenantId:    'tatillife_south',
    role:        'branch_manager',
  });
  hoisted.useMyProductionMock.mockReturnValue(EMPTY_MY_PROD);
});

describe('ManagerDashboard — focus-return after Meeting Mode closes', () => {
  it('re-focuses the Start Meeting trigger when the meeting closes', async () => {
    render(<ManagerDashboard />);

    const startBtn = screen.getByRole('button', { name: /start meeting/i });
    startBtn.focus();
    expect(document.activeElement).toBe(startBtn);

    // Open — handleStartMeeting awaits data, then flips meetingActive true and
    // the whole dashboard (including this button) unmounts.
    fireEvent.click(startBtn);
    const closeStub = await screen.findByTestId('meeting-close-stub');
    expect(screen.queryByRole('button', { name: /start meeting/i })).toBeNull();

    // Close — onClose flips meetingActive false; the dashboard remounts and the
    // re-focus effect should land focus back on the freshly rendered trigger.
    fireEvent.click(closeStub);

    await waitFor(() => {
      const remounted = screen.getByRole('button', { name: /start meeting/i });
      expect(document.activeElement).toBe(remounted);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 silent-swallow fix — handleStartMeeting surfaces a failure toast (in
// addition to the existing console.error) instead of swallowing silently.
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerDashboard — Start Meeting failure toast', () => {
  it('shows a failure toast when the meeting data load fails', async () => {
    getWeeklySubmissions.mockRejectedValueOnce(new Error('boom'));
    render(<ManagerDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /start meeting/i }));

    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' })
    ));
    // Meeting never opens — the whole dashboard (incl. this button) stays mounted.
    expect(screen.getByRole('button', { name: /start meeting/i })).toBeInTheDocument();
  });
});
