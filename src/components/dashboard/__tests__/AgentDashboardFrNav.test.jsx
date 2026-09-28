// @vitest-environment jsdom
//
// FR-1 — AgentDashboard under the FR look (docs/briefs/fr-agent-redesign-program.md).
// Setup copied from AgentDashboardNav.test.jsx; the Shell mock additionally
// captures `sidebar` and `showPinnedZone`.
//
// Asserts: no opt-in ⇒ the Nexus nav is untouched; opt-in ⇒ the FR sidebar,
// and EVERY Nexus agent destination is still reachable on desktop AND phone.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ── Hoisted capture for Shell's navItems / bottomNavItems props ──────────────

const captured = vi.hoisted(() => ({
  sidebar:        undefined,
  showPinnedZone: undefined,
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
  default: ({ children, navItems, bottomNavItems, drawerNavItems, activeTab, sidebar, showPinnedZone }) => {
    captured.sidebar        = sidebar;
    captured.showPinnedZone = showPinnedZone;
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

import { getNavConfig } from '../../shell/navConfig';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-look');
  captured.sidebar = undefined;
  captured.navItems = null;
  captured.bottomNavItems = null;
  captured.drawerNavItems = null;
});

// Every route the Nexus agent nav reaches today (plus Profile + Settings).
const NEXUS_TABS = [
  ...new Set([
    ...getNavConfig('agent', { showDailyCapture: true }).map((i) => i.tabId).filter(Boolean),
    'profile',
    'settings',
  ]),
];

describe('AgentDashboard — FR-1 shell gate', () => {
  it('without the opt-in: Nexus sidebar (no override), Nexus nav items, pinned zone on', () => {
    render(<AgentDashboard />);
    expect(captured.sidebar).toBeUndefined();
    expect(captured.navItems.find((i) => i.id === 'daily-log')).toBeDefined();
    expect(captured.showPinnedZone).toBe(true);
  });

  it('with the opt-in: the FR sidebar replaces it and pins are off', () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    expect(captured.sidebar).toBeTruthy();
    expect(captured.sidebar.props.activeTab).toBe('dashboard');
    expect(captured.showPinnedZone).toBe(false);
  });
});

describe('AgentDashboard — FR-1 keeps every destination', () => {
  it('desktop: every Nexus agent route is in the FR sidebar model (items, hub sections, or footer)', () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    const reachable = new Set(captured.navItems.map((i) => i.tabId));
    // Sidebar footer: avatar → profile, gear → settings.
    reachable.add('profile');
    reachable.add('settings');
    const missing = NEXUS_TABS.filter((t) => !reachable.has(t));
    expect(missing).toEqual([]);
  });

  it('phone: every Nexus agent route is on the tab bar or in the More sheet', () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    const reachable = new Set([
      ...captured.bottomNavItems.flatMap((i) => [i.tabId, ...(i.matchTabs ?? [])]),
      ...captured.drawerNavItems.map((i) => i.tabId),
    ].filter(Boolean));
    // Money sections: the tab bar opens Goals; the hub chips reach the rest.
    const missing = NEXUS_TABS.filter((t) => !reachable.has(t));
    expect(missing).toEqual([]);
  });

  it('the weekly report and daily log stay one tap away (report card + the + tile)', () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    expect(captured.sidebar.props.report).toBeTruthy();
    expect(captured.bottomNavItems.find((i) => i.fab)?.action).toBe('quick-add');
  });
});
