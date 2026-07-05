// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
  getMergedAwardsRuleset: vi.fn().mockResolvedValue(null),
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
  getDailyEntry:          vi.fn().mockResolvedValue(null),
  getDailyEntriesForWeek: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/weeklyPlanService', () => ({
  getWeeklyPlan:     vi.fn().mockResolvedValue(null),
  commitWeeklyPlan:  vi.fn().mockResolvedValue(undefined),
  deleteWeeklyPlan:  vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/authService', () => ({
  signOut: vi.fn(),
}));

vi.mock('../../../utils/formatters', () => ({
  getRoleLabel:      () => 'Agent',
  formatCurrency:    (v) => `$${v}`,
  formatDateDisplay: () => '2026-06-07',
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getMostRecentSunday: () => '2026-06-01',
  weekNumber: () => 23,
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields:                () => ({ applicationsSold: 0 }),
  extractTotalProductionCredit: () => 0,
}));

vi.mock('../../../utils/buildActivityEvents', () => ({
  buildActivityEvents: () => [],
}));

// ── Component mocks ───────────────────────────────────────────────────────────

vi.mock('../../shell/Shell', () => ({
  default: ({ children, setActiveTab }) => (
    <div data-testid="shell">
      <button type="button" data-testid="go-prospect-info"  onClick={() => setActiveTab('prospect-info')} />
      <button type="button" data-testid="go-goals"          onClick={() => setActiveTab('goals')} />
      <button type="button" data-testid="go-money-needs"    onClick={() => setActiveTab('money-needs')} />
      {children}
    </div>
  ),
}));

vi.mock('../../wizard/WizardForm',                   () => ({ default: () => null }));
vi.mock('../../daily/DailyEntryModal',                () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',           () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignCard',               () => ({ default: () => null }));
vi.mock('../../profile/CareerPortal',                 () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',                () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                  () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',             () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',              () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer',         () => ({ default: () => null }));
vi.mock('../GoalCarousel',                             () => ({ default: () => null }));
vi.mock('../KPICard',                                  () => ({ default: () => null }));
vi.mock('../ActivityFeed',                             () => ({ default: () => null }));
vi.mock('../../gamification/BadgeGrid',               () => ({ default: () => null, computeEarnedBadges: () => [] }));
vi.mock('../../onboarding/WelcomeScreen',             () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../agent/PersistencyTab',                 () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',                       () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',              () => ({ default: () => React.createElement('div', { 'data-testid': 'policy-ledger-panel' }) }));
vi.mock('../../agent/MoneyNeedsPanel',                () => ({ default: () => React.createElement('div', { 'data-testid': 'money-needs-panel' }) }));
vi.mock('../../goals/GapAnalysisPanel',               () => ({ default: () => React.createElement('div', { 'data-testid': 'gap-analysis-panel' }) }));
vi.mock('../../goals/AwardsReachPanel',               () => ({ default: () => null }));

import AgentDashboard from '../AgentDashboard';
import { getAgentSubmissions } from '../../../services/submissionService';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentDashboard — coming-soon tab gating (pilot readiness)', () => {
  it('prospect-info tab renders ComingSoonPanel, not the real panel', async () => {
    render(<AgentDashboard />);
    fireEvent.click(screen.getByTestId('go-prospect-info'));
    await waitFor(() => expect(screen.getByText('Coming soon')).toBeInTheDocument());
    expect(screen.queryByTestId('prospect-info-panel')).not.toBeInTheDocument();
  });

  it('goals tab renders GapAnalysisPanel (un-gated)', async () => {
    render(<AgentDashboard />);
    fireEvent.click(screen.getByTestId('go-goals'));
    await waitFor(() => expect(screen.getByTestId('gap-analysis-panel')).toBeInTheDocument());
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('money-needs tab renders MoneyNeedsPanel (un-gated)', async () => {
    render(<AgentDashboard />);
    fireEvent.click(screen.getByTestId('go-money-needs'));
    await waitFor(() => expect(screen.getByTestId('money-needs-panel')).toBeInTheDocument());
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });
});

describe('AgentDashboard — dashboard empty-state loading guard (#715)', () => {
  it('shows the loading skeleton (NOT the empty state) while data is loading', () => {
    // Never-resolving fetch → `loading` stays true. allSubmissions is [] during
    // load, but the guard must show the skeleton, not flash NewAgentEmptyState.
    getAgentSubmissions.mockReturnValueOnce(new Promise(() => {}));
    render(<AgentDashboard />);
    expect(screen.getByTestId('agent-dashboard-loading')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /your account's ready/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Submit your first report/i)).not.toBeInTheDocument();
    // The populated view is the same non-loading else-branch, so it cannot flash either.
  });

  it('renders the empty state once loaded with zero submissions (skeleton gone)', async () => {
    render(<AgentDashboard />); // default mock resolves to []
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /your account's ready/i })).toBeInTheDocument());
    expect(screen.queryByTestId('agent-dashboard-loading')).not.toBeInTheDocument();
  });
});
