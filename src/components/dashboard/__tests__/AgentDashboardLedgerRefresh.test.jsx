// @vitest-environment jsdom
//
// hero-ledger H1 — the home hero re-derives from the ledger when the agent
// comes back to Home after the Policy Ledger wrote a policy, with no reload.
// The ledger panel is stubbed to a button that fires `onPoliciesChanged`, and
// getOwnPolicies returns a different book on each call, so the only way the
// hero can show the second figure is a real refetch on the way back.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ getOwnPolicies: vi.fn() }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent1' },
    userProfile: { name: 'Test Agent', email: 'agent@test.com' },
    role:        'agent',
    tenantId:    'test-tenant',
  }),
}));

vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies: (...args) => hoisted.getOwnPolicies(...args),
}));

vi.mock('../../../services/submissionService', () => ({
  getDraft:            vi.fn().mockResolvedValue(null),
  // One submission so the dashboard renders the home view, not the empty state.
  getAgentSubmissions: vi.fn().mockResolvedValue([{ id: 's1', status: 'submitted', weekStarting: '2026-06-01' }]),
}));
vi.mock('../../../services/goalsService', () => ({
  getGoals:           vi.fn().mockResolvedValue(null),
  getCompanyMinimums: vi.fn().mockResolvedValue(null),
  getGoalHierarchy:   vi.fn().mockResolvedValue(null),
  getSalesManagerUid: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/awardsRulesetService', () => ({
  getAwardsRuleset:       vi.fn().mockResolvedValue(null),
  getMergedAwardsRuleset: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../config/awardsRuleset/2026', () => ({ DEFAULT_RULESET_2026: {} }));
vi.mock('../../../utils/tenureFloors', () => ({
  resolveWeeklyAPIFloor:    vi.fn().mockReturnValue(0),
  FLAT_WEEKLY_API_FALLBACK: 0,
}));
vi.mock('../../../services/persistencyService', () => ({ getAgentHistory: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/settlementService', () => ({ getSettlements: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/exportService', () => ({ generateAgentPDF: vi.fn() }));
vi.mock('../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: vi.fn().mockResolvedValue([]),
  getCampaignSubmissions:     vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry:          vi.fn().mockResolvedValue(null),
  getDailyEntriesForWeek: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/weeklyPlanService', () => ({
  getWeeklyPlan:    vi.fn().mockResolvedValue(null),
  commitWeeklyPlan: vi.fn().mockResolvedValue(undefined),
  deleteWeeklyPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../services/authService', () => ({ signOut: vi.fn() }));
vi.mock('../../../utils/dateHelpers', () => ({
  getMostRecentSunday: () => '2026-06-01',
  weekNumber: () => 23,
}));
vi.mock('../../../utils/buildActivityEvents', () => ({ buildActivityEvents: () => [] }));

vi.mock('../../shell/Shell', () => ({
  default: ({ children, setActiveTab }) => (
    <div data-testid="shell">
      <button type="button" data-testid="go-dashboard" onClick={() => setActiveTab('dashboard')} />
      <button type="button" data-testid="go-ledger"    onClick={() => setActiveTab('policy-ledger')} />
      {children}
    </div>
  ),
}));

// The home view, reduced to the one figure under test.
vi.mock('../HomeV2', () => ({
  default: ({ ledgerProduction }) => (
    <div data-testid="hero-settled">{ledgerProduction ? String(ledgerProduction.settled.api) : 'pending'}</div>
  ),
}));

// The ledger, reduced to "a write happened".
vi.mock('../../agent/PolicyLedgerPanel', () => ({
  default: ({ onPoliciesChanged }) => (
    <button type="button" data-testid="ledger-write" onClick={() => onPoliciesChanged?.()}>write</button>
  ),
}));

vi.mock('../../wizard/WizardForm',                   () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',           () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignCard',               () => ({ default: () => null }));
vi.mock('../../profile/CareerPortal',                 () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',                () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                  () => ({ default: () => null }));
vi.mock('../../gamification/Leaderboard',             () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',              () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer',         () => ({ default: () => null }));
vi.mock('../../gamification/BadgeGrid',               () => ({ default: () => null, computeEarnedBadges: () => [] }));
vi.mock('../../onboarding/WelcomeScreen',             () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../agent/PersistencyTab',                 () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',                       () => ({ default: () => null }));

import AgentDashboard from '../AgentDashboard';

const YEAR = new Date().getFullYear();
const settled = (id, api, status = 'settled') => ({
  id, status, newBusinessType: 'nb_ordinary', productLine: 'life',
  dateIssued: `${YEAR}-02-01`, proposedAPI: api,
});

beforeEach(() => {
  hoisted.getOwnPolicies.mockReset();
});

describe('AgentDashboard — home hero refreshes after a ledger write (H1)', () => {
  it('re-derives on return to Home after a policy is added, then after it changes', async () => {
    hoisted.getOwnPolicies
      .mockResolvedValueOnce([settled('a', 1000)])
      .mockResolvedValueOnce([settled('a', 1000), settled('b', 500)])
      .mockResolvedValueOnce([settled('a', 1000), settled('b', 500, 'lapsed')]);

    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByTestId('hero-settled')).toHaveTextContent('1000'));

    // Add a policy in the ledger, come back: the hero refetches and moves.
    fireEvent.click(screen.getByTestId('go-ledger'));
    fireEvent.click(await screen.findByTestId('ledger-write'));
    fireEvent.click(screen.getByTestId('go-dashboard'));
    await waitFor(() => expect(screen.getByTestId('hero-settled')).toHaveTextContent('1500'));

    // Change it (lapse it), come back: the hero returns to the original figure.
    fireEvent.click(screen.getByTestId('go-ledger'));
    fireEvent.click(await screen.findByTestId('ledger-write'));
    fireEvent.click(screen.getByTestId('go-dashboard'));
    await waitFor(() => expect(screen.getByTestId('hero-settled')).toHaveTextContent('1000'));

    expect(hoisted.getOwnPolicies).toHaveBeenCalledTimes(3);
  });

  it('does not refetch on return to Home when the ledger wrote nothing', async () => {
    hoisted.getOwnPolicies.mockResolvedValue([settled('a', 1000)]);
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByTestId('hero-settled')).toHaveTextContent('1000'));

    fireEvent.click(screen.getByTestId('go-ledger'));
    await screen.findByTestId('ledger-write');
    fireEvent.click(screen.getByTestId('go-dashboard'));
    await waitFor(() => expect(screen.getByTestId('hero-settled')).toHaveTextContent('1000'));
    expect(hoisted.getOwnPolicies).toHaveBeenCalledTimes(1);
  });
});
