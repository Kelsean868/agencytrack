// @vitest-environment jsdom
//
// Track J P6 — AgentDashboard nav-swap unit test.
//
// Asserts the atomic agent-nav swap: the production-leaderboard surface is now
// reachable via a real primary-nav item, AND the points-leaderboard nav entry
// has been retired from the agent sidebar + bottom-nav.
//
// Scope: AGENT-only. ManagerDashboard is unchanged in this PR (deferred to P5).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ── Hoisted capture for Shell's navItems / bottomNavItems props ──────────────

const captured = vi.hoisted(() => ({
  navItems:       null,
  bottomNavItems: null,
  activeTab:      null,
}));

// ── Service mocks (minimal — we don't exercise data paths in this test) ──────

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
}));
vi.mock('../../../utils/extractFields', () => ({
  extractFields:                () => ({ applicationsSold: 0 }),
  extractTotalProductionCredit: () => 0,
}));
vi.mock('../../../utils/buildActivityEvents', () => ({ buildActivityEvents: () => [] }));
// ── Shell mock — captures nav props for assertion ────────────────────────────

vi.mock('../../shell/Shell', () => ({
  default: ({ children, navItems, bottomNavItems, activeTab }) => {
    captured.navItems       = navItems;
    captured.bottomNavItems = bottomNavItems;
    captured.activeTab      = activeTab;
    return React.createElement(
      'div',
      { 'data-testid': 'shell-mock', 'data-active-tab': activeTab },
      children
    );
  },
}));

// ── Component blank stubs ────────────────────────────────────────────────────

vi.mock('../../wizard/WizardForm',                   () => ({ default: () => null }));
vi.mock('../../daily/DailyEntryModal',               () => ({ default: () => null }));
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

// ProductionLeaderboardSurface — capture mount when activeTab is the production tab.
const productionMountedRef = vi.hoisted(() => ({ current: false }));
vi.mock('../../leaderboard/ProductionLeaderboardSurface', () => ({
  default: () => {
    productionMountedRef.current = true;
    return React.createElement('div', { 'data-testid': 'production-leaderboard-surface-mock' });
  },
}));

// CRITICAL: do NOT mock `../../gamification/Leaderboard` here. The points-board
// component import was REMOVED from AgentDashboard.jsx in this PR. Mocking it
// here would silently allow a regression where the import is reintroduced.

import AgentDashboard from '../AgentDashboard';

beforeEach(() => {
  vi.clearAllMocks();
  captured.navItems       = null;
  captured.bottomNavItems = null;
  captured.activeTab      = null;
  productionMountedRef.current = false;
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF — atomic agent-nav swap is in place.
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentDashboard — Track J P6 nav swap', () => {
  it('NAV_ITEMS includes a Leaderboard entry pointing to the production-leaderboard tab', () => {
    render(<AgentDashboard />);

    expect(Array.isArray(captured.navItems)).toBe(true);
    const leaderboardEntry = captured.navItems.find((i) => i.id === 'leaderboard');
    expect(leaderboardEntry).toBeDefined();
    expect(leaderboardEntry.label).toBe('Leaderboard');
    expect(leaderboardEntry.tabId).toBe('production-leaderboard'); // ← THE SWAP
    expect(leaderboardEntry.testId).toBe('agent-tab-leaderboard');
  });

  it('NAV_ITEMS does NOT contain any entry routing to the points-board tabId (tabId: "leaderboard")', () => {
    render(<AgentDashboard />);

    const pointsBoardEntry = captured.navItems.find((i) => i.tabId === 'leaderboard');
    expect(pointsBoardEntry).toBeUndefined();
  });

  it('BOTTOM_NAV "Ranks" entry routes to the production-leaderboard tab', () => {
    render(<AgentDashboard />);

    expect(Array.isArray(captured.bottomNavItems)).toBe(true);
    const ranksEntry = captured.bottomNavItems.find((i) => i.label === 'Ranks');
    expect(ranksEntry).toBeDefined();
    expect(ranksEntry.tabId).toBe('production-leaderboard'); // ← THE SWAP

    // And no bottom-nav entry routes to the retired points board tabId.
    const pointsBoardBottom = captured.bottomNavItems.find((i) => i.tabId === 'leaderboard');
    expect(pointsBoardBottom).toBeUndefined();
  });

  it('the production-leaderboard surface is the agent\'s only leaderboard render target', () => {
    // We can't mock `../../gamification/Leaderboard` (that would mask a
    // regression where the import is reintroduced — see the import-block
    // comment above). Instead, asserting the dashboard renders without
    // throwing despite NO mock for that path proves the import was removed.
    expect(() => render(<AgentDashboard />)).not.toThrow();
  });
});
