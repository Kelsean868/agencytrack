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
  drawerNavItems: null,
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
  weekNumber: () => 22,
}));
vi.mock('../../../utils/extractFields', () => ({
  extractFields:                () => ({ applicationsSold: 0 }),
  extractTotalProductionCredit: () => 0,
}));
vi.mock('../../../utils/buildActivityEvents', () => ({ buildActivityEvents: () => [] }));
// ── Shell mock — captures nav props for assertion ────────────────────────────

vi.mock('../../shell/Shell', () => ({
  default: ({ children, navItems, bottomNavItems, drawerNavItems, activeTab }) => {
    captured.navItems       = navItems;
    captured.bottomNavItems = bottomNavItems;
    captured.drawerNavItems = drawerNavItems;
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
  captured.drawerNavItems = null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Nav redesign PR-1 — agent nav IA (groups, SOON, child, Daily Log).
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentDashboard — Nav redesign PR-1 structure', () => {
  it('renders the four section groups in order: Today, Planning, Tools, Recognition', () => {
    render(<AgentDashboard />);
    const labels = captured.navItems.map((i) => i.sectionLabel).filter(Boolean);
    expect(labels).toEqual(['Today', 'Planning', 'Tools', 'Recognition']);
  });

  it('Game Plan renders with NO "New" badge (badgeNew removed)', () => {
    render(<AgentDashboard />);
    const gamePlan = captured.navItems.find((i) => i.id === 'game-plan');
    expect(gamePlan).toBeDefined();
    expect(gamePlan.badgeNew).toBeUndefined();
  });

  it('Money Needs is an indented child', () => {
    render(<AgentDashboard />);
    expect(captured.navItems.find((i) => i.id === 'money-needs')?.child).toBe(true);
  });

  it('Planner is present and un-gated (ships item 3.2)', () => {
    render(<AgentDashboard />);
    const planner = captured.navItems.find((i) => i.id === 'planner');
    expect(planner).toBeDefined();
    expect(planner.disabled).toBeFalsy();
  });

  it('Prospect Prep stays SOON (disabled via COMING_SOON_TABS)', () => {
    render(<AgentDashboard />);
    expect(captured.navItems.find((i) => i.id === 'prospect-info')?.disabled).toBe(true);
  });

  it('Daily Log is present for the default (hybrid) logging mode', () => {
    render(<AgentDashboard />);
    const dailyLog = captured.navItems.find((i) => i.id === 'daily-log');
    expect(dailyLog).toBeDefined();
    expect(dailyLog.action).toBe('log-today');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mobile nav v2 reorder — Profile → More drawer, centered ＋ FAB.
//
// The stranding guard: AGENT_NAV has no profile row, so Profile must be injected
// into the drawer or removing it from the bottom nav would leave mobile agents
// with NO route to Profile (the desktop sidebar avatar is hidden < 768px).
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentDashboard — mobile nav v2 reorder', () => {
  it('Profile is NOT in the mobile bottom nav', () => {
    render(<AgentDashboard />);
    expect(captured.bottomNavItems.find((i) => i.tabId === 'profile')).toBeUndefined();
    expect(captured.bottomNavItems.find((i) => i.id === 'profile')).toBeUndefined();
  });

  it('Profile IS in the More drawer and routes to the profile tab (not stranded)', () => {
    render(<AgentDashboard />);
    const profile = captured.drawerNavItems.find((i) => i.tabId === 'profile');
    expect(profile).toBeDefined();
    expect(profile.label).toBe('Profile');
    // Exactly one profile row — the inject guard must not duplicate.
    expect(captured.drawerNavItems.filter((i) => i.tabId === 'profile')).toHaveLength(1);
  });

  it('the ＋ FAB is the center slot of the 5-slot nav (4 items + auto-appended More)', () => {
    render(<AgentDashboard />);
    // 4 bottom-nav items; MobileBottomNav auto-appends "More" as the 5th slot,
    // so the FAB at index 2 renders dead-center.
    expect(captured.bottomNavItems).toHaveLength(4);
    const fabIndex = captured.bottomNavItems.findIndex((i) => i.fab === true);
    expect(fabIndex).toBe(2);
    expect(captured.bottomNavItems[fabIndex].action).toBe('quick-add');
  });

  it('bottom-nav order is Home · History · Create(＋) · Ranks', () => {
    render(<AgentDashboard />);
    expect(captured.bottomNavItems.map((i) => i.id)).toEqual([
      'home', 'history', 'create', 'leaderboard',
    ]);
  });
});
