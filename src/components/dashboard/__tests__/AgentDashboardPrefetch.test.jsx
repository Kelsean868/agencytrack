// @vitest-environment jsdom
//
// POC (feat/gp-prefetch) — AgentDashboard warms Game Plan's 3 year-docs on
// dashboard idle so the gated Game Plan entrance lands on populated content even
// on field networks. Asserts: the idle prefetch fires once with the exact args
// GamePlanScreen reads with (tenantId, uid, current year), and a throwing prefetch
// cannot break the dashboard render.
//
// The mock scaffold mirrors AgentDashboardNav.test.jsx (AgentDashboard imports all
// of these). The one addition is the gamePlanPrefetch mock + a synchronous
// requestIdleCallback so the idle callback runs deterministically in the test.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent1' },
    userProfile: { name: 'Test Agent', email: 'agent@test.com' },
    role:        'agent',
    tenantId:    'test-tenant',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  getDraft:            vi.fn().mockResolvedValue(null),
  getAgentSubmissions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/goalsService', () => ({
  getGoals:           vi.fn().mockResolvedValue(null),
  getCompanyMinimums: vi.fn().mockResolvedValue(null),
  getGoalHierarchy:   vi.fn().mockResolvedValue(null),
  getSalesManagerUid: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/awardsRulesetService', () => ({
  getAwardsRuleset: vi.fn().mockResolvedValue(null),
  getMergedAwardsRuleset: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../config/awardsRuleset/2026', () => ({ DEFAULT_RULESET_2026: {} }));
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
vi.mock('../../../services/exportService',  () => ({ generateAgentPDF: vi.fn() }));
vi.mock('../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: vi.fn().mockResolvedValue([]),
  getCampaignSubmissions:     vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: vi.fn().mockResolvedValue(null),
  getDailyEntriesForWeek: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/weeklyPlanService', () => ({
  getWeeklyPlan: vi.fn().mockResolvedValue(null),
  commitWeeklyPlan: vi.fn().mockResolvedValue(undefined),
  deleteWeeklyPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../services/authService',  () => ({ signOut: vi.fn() }));
vi.mock('../../../utils/formatters', () => ({
  getRoleLabel:      () => 'Agent',
  formatCurrency:    (v) => `$${v}`,
  formatDateDisplay: () => '2026-05-25',
}));
vi.mock('../../../utils/dateHelpers', () => ({
  getMostRecentSunday: () => '2026-05-25',
  weekNumber: () => 22,
}));
vi.mock('../../../utils/extractFields', () => ({
  extractFields:                () => ({ applicationsSold: 0 }),
  extractTotalProductionCredit: () => 0,
}));
vi.mock('../../../utils/buildActivityEvents', () => ({ buildActivityEvents: () => [] }));

vi.mock('../../shell/Shell', () => ({
  default: ({ children }) => React.createElement('div', { 'data-testid': 'shell-mock' }, children),
}));

vi.mock('../../wizard/WizardForm',                   () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel',              () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground',          () => ({ default: () => null }));
vi.mock('../../profile/CareerPortal',                () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',               () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                 () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',             () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer',        () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',              () => ({ default: () => null }));
vi.mock('../../agent/ProspectInfoPanel',             () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',             () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: () => null }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../agent/PersistencyTab',                () => ({ default: () => null }));
vi.mock('../../daily/DailyFAB',                      () => ({ default: () => null }));
vi.mock('../../onboarding/WelcomeScreen',            () => ({ default: () => null }));
vi.mock('../../gamification/BadgeGrid', () => ({
  default: () => null,
  computeEarnedBadges: () => [],
}));
vi.mock('../HomeV2', () => ({ default: () => null }));
vi.mock('../../leaderboard/ProductionLeaderboardSurface', () => ({ default: () => null }));
vi.mock('../GamePlanV2', () => ({ default: () => null }));

// The subject under test — mocked so we can assert the idle invocation + args.
const prefetchMock = vi.fn(() => vi.fn());
vi.mock('../../../services/gamePlanPrefetch', () => ({
  prefetchGamePlanYearDocs: (...args) => prefetchMock(...args),
}));

import AgentDashboard from '../AgentDashboard';

beforeEach(() => {
  vi.clearAllMocks();
  prefetchMock.mockImplementation(() => vi.fn());
  // Run the idle callback synchronously so the prefetch fires within the test.
  window.requestIdleCallback = (cb) => { cb({ didTimeout: false, timeRemaining: () => 50 }); return 1; };
  window.cancelIdleCallback = vi.fn();
});
afterEach(() => {
  delete window.requestIdleCallback;
  delete window.cancelIdleCallback;
});

describe('AgentDashboard — Game Plan idle prefetch (feat/gp-prefetch)', () => {
  it('prefetches the 3 Game Plan year-docs on dashboard idle with (tenantId, uid, thisYear)', () => {
    render(<AgentDashboard />);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
    const [tenantId, uid, year] = prefetchMock.mock.calls[0];
    expect(tenantId).toBe('test-tenant');
    expect(uid).toBe('agent1');
    expect(year).toBe(new Date().getFullYear()); // same year GamePlanScreen reads
  });

  it('a throwing prefetch does not break the dashboard render', () => {
    prefetchMock.mockImplementation(() => { throw new Error('prefetch boom'); });
    expect(() => render(<AgentDashboard />)).not.toThrow();
  });
});
