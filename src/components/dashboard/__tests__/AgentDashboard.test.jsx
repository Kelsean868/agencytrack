// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Hoisted ref containers ────────────────────────────────────────────────────
// vi.hoisted is evaluated before vi.mock factories, so these refs are available
// inside the factory closures below.

const hoisted = vi.hoisted(() => ({
  onCreatePolicyFromPrepRef: { current: null },
  policyLedgerInitialFormRef: { current: undefined },
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent1' },
    userProfile: { name: 'Test Agent', email: 'agent@test.com' },
    role:        'agent',
    tenantId:    'test-tenant',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  getDraft:             vi.fn().mockResolvedValue(null),
  getAgentSubmissions:  vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/goalsService', () => ({
  getGoals:             vi.fn().mockResolvedValue(null),
  getCompanyMinimums:   vi.fn().mockResolvedValue(null),
  getGoalHierarchy:     vi.fn().mockResolvedValue(null),
  getSalesManagerUid:   vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/awardsRulesetService', () => ({
  getAwardsRuleset: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../config/awardsRuleset/2026', () => ({
  DEFAULT_RULESET_2026: {},
}));

vi.mock('../../../utils/tenureFloors', () => ({
  resolveWeeklyAPIFloor:    vi.fn().mockReturnValue(0),
  FLAT_WEEKLY_API_FALLBACK: 0,
}));

vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/settlementService', () => ({
  getSettlements: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/exportService', () => ({
  generateAgentPDF: vi.fn(),
}));

vi.mock('../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: vi.fn().mockResolvedValue([]),
  getCampaignSubmissions:     vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/authService', () => ({
  signOut: vi.fn(),
}));

vi.mock('../../../utils/formatters', () => ({
  getRoleLabel:      () => 'Agent',
  formatCurrency:    (v) => `$${v}`,
  formatDateDisplay: () => '2026-05-25',
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getMostRecentSunday: () => '2026-05-25',
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields:                () => ({ applicationsSold: 0 }),
  extractTotalProductionCredit: () => 0,
}));

vi.mock('../../../utils/buildActivityEvents', () => ({
  buildActivityEvents: () => [],
}));

vi.mock('../../../utils/aggregateAPI', () => ({
  aggregateAPI: () => 0,
}));

// ── Component mocks ───────────────────────────────────────────────────────────

// Shell — renders children and exposes a button to switch to the prospect-info tab
vi.mock('../../shell/Shell', () => ({
  default: ({ children, setActiveTab }) => (
    <div data-testid="shell">
      <button
        type="button"
        data-testid="go-prospect-info"
        onClick={() => setActiveTab('prospect-info')}
      />
      {children}
    </div>
  ),
}));

// ProspectInfoPanel — captures the onCreatePolicyFromPrep callback via the hoisted ref
vi.mock('../../agent/ProspectInfoPanel', () => ({
  default: ({ onCreatePolicyFromPrep }) => {
    hoisted.onCreatePolicyFromPrepRef.current = onCreatePolicyFromPrep;
    return React.createElement('div', { 'data-testid': 'prospect-info-panel' });
  },
}));

// PolicyLedgerPanel — stores the initialForm it receives into the hoisted ref
vi.mock('../../agent/PolicyLedgerPanel', () => ({
  default: ({ initialForm, onPrefillConsumed: _onPrefillConsumed }) => {
    hoisted.policyLedgerInitialFormRef.current = initialForm;
    return React.createElement('div', { 'data-testid': 'policy-ledger-panel' });
  },
}));

// Blank stubs for the remaining sub-components
vi.mock('../../wizard/WizardForm',                  () => ({ default: () => null }));
vi.mock('../../daily/DailyEntryModal',               () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel',              () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',          () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignCard',              () => ({ default: () => null }));
vi.mock('../../profile/CareerPortal',                () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',               () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                 () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',            () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',             () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer',        () => ({ default: () => null }));
vi.mock('../GoalCarousel',                            () => ({ default: () => null }));
vi.mock('../KPICard',                                 () => ({ default: () => null }));
vi.mock('../ActivityFeed',                            () => ({ default: () => null }));
vi.mock('../WeeklyStandardCard',                      () => ({ default: () => null }));
vi.mock('../../gamification/BadgeGrid',              () => ({ default: () => null, computeEarnedBadges: () => [] }));
vi.mock('../../onboarding/WelcomeScreen',            () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../agent/PersistencyTab',                () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',                      () => ({ default: () => null }));

import AgentDashboard from '../AgentDashboard';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.onCreatePolicyFromPrepRef.current   = null;
  hoisted.policyLedgerInitialFormRef.current  = undefined;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentDashboard — handleCreatePolicyFromPrep (F3.1 + socialPlatform prefill)', () => {
  it('prefill carries socialPlatform when prospectingSource is social-media', async () => {
    render(<AgentDashboard />);

    // Navigate to prospect-info tab so ProspectInfoPanel renders and the callback is captured
    fireEvent.click(screen.getByTestId('go-prospect-info'));
    await waitFor(() => expect(hoisted.onCreatePolicyFromPrepRef.current).toBeTruthy());

    // Simulate clicking "Log Policy" on a social-media prep
    await act(async () => {
      hoisted.onCreatePolicyFromPrepRef.current({
        clientName:        'Social Prospect',
        prospectingSource: 'social-media',
        socialPlatform:    'whatsapp',
      });
    });

    // After the callback, activeTab switches to policy-ledger; PolicyLedgerPanel renders
    await waitFor(() => expect(screen.getByTestId('policy-ledger-panel')).toBeInTheDocument());
    expect(hoisted.policyLedgerInitialFormRef.current?.socialPlatform).toBe('whatsapp');
  });

  it('prefill sets socialPlatform to null when prospectingSource is not social-media', async () => {
    render(<AgentDashboard />);

    fireEvent.click(screen.getByTestId('go-prospect-info'));
    await waitFor(() => expect(hoisted.onCreatePolicyFromPrepRef.current).toBeTruthy());

    await act(async () => {
      hoisted.onCreatePolicyFromPrepRef.current({
        clientName:        'Referral Prospect',
        prospectingSource: 'referral',
        socialPlatform:    null,
      });
    });

    await waitFor(() => expect(screen.getByTestId('policy-ledger-panel')).toBeInTheDocument());
    expect(hoisted.policyLedgerInitialFormRef.current?.socialPlatform).toBeNull();
  });
});
