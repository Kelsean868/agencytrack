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
import { act, render, screen } from '@testing-library/react';

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
vi.mock('../../goals/GapAnalysisPanel',              () => ({ default: () => React.createElement('div', { 'data-testid': 'gap-analysis-mock' }) }));
vi.mock('../../goals/CommissionPlayground',          () => ({ default: () => React.createElement('div', { 'data-testid': 'commission-playground-mock' }) }));
// FR-3: the other Goals-tab panels (the FR header tests open Goals).
// FR-3: the remaining Money calculators, so each tab can be checked mounted under its FR header.
vi.mock('../../agent/CommissionAnchorStrip', () => ({ default: () => null }));
vi.mock('../GamePlanV2', () => ({ default: () => React.createElement('div', { 'data-testid': 'game-plan-mock' }) }));
vi.mock('../../financing/FinancingSelfView', () => ({ default: () => React.createElement('div', { 'data-testid': 'financing-self-view-mock' }) }));
vi.mock('../../goals/DerivedIncomePanel', () => ({ default: () => null }));
vi.mock('../../goals/AwardsReachPanel',   () => ({ default: () => null }));
vi.mock('../../goals/MdrtTracker',        () => ({ default: () => null }));
vi.mock('../../profile/CareerPortal',                () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',               () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                 () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',             () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer',        () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',              () => ({ default: () => null }));
vi.mock('../../agent/ProspectInfoPanel',             () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',             () => ({ default: () => null }));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: () => React.createElement('div', { 'data-testid': 'money-needs-mock' }) }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => null }));
vi.mock('../../agent/PersistencyTab',                () => ({ default: () => React.createElement('div', { 'data-testid': 'persistency-tab-mock' }) }));
vi.mock('../../daily/DailyFAB',                      () => ({ default: () => null }));
vi.mock('../../onboarding/WelcomeScreen',            () => ({ default: () => null }));
vi.mock('../../gamification/BadgeGrid', () => ({
  default: () => null,
  computeEarnedBadges: () => [],
}));
vi.mock('../HomeV2', () => ({ default: () => React.createElement('div', { 'data-testid': 'home-v2-mock' }) }));
// FR-2: under the FR look the dashboard tab renders FrToday instead of HomeV2.
vi.mock('../../fr/today/FrToday', () => ({ default: () => React.createElement('div', { 'data-testid': 'fr-today-mock' }) }));
// FR-3: the Money Overview (route `money`) and the FR header above each calculator.
vi.mock('../../fr/money/FrMoney', () => ({ default: () => React.createElement('div', { 'data-testid': 'fr-money-mock' }) }));
vi.mock('../../fr/money/FrMoneyHeader', () => ({
  default: ({ tab }) => React.createElement('div', { 'data-testid': 'fr-money-header-mock', 'data-tab': tab }),
}));

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
import { setLookOptIn } from '../../../lib/fr/look';
import { getAgentSubmissions } from '../../../services/submissionService';

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

describe('AgentDashboard — FR-2 Today', () => {
  const SUBS = [{ id: 's1', status: 'submitted', weekStarting: '2026-05-18' }];

  it('with the opt-in and at least one submission: FrToday renders instead of HomeV2', async () => {
    getAgentSubmissions.mockResolvedValue(SUBS);
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    expect(await screen.findByTestId('fr-today-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('home-v2-mock')).toBeNull();
  });

  it('without the opt-in: HomeV2 renders, FrToday does not', async () => {
    getAgentSubmissions.mockResolvedValue(SUBS);
    render(<AgentDashboard />);
    expect(await screen.findByTestId('home-v2-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-today-mock')).toBeNull();
  });
});

describe('AgentDashboard — FR-3 Money', () => {
  it('with the opt-in: the Money tab-bar item opens the Overview (route `money`)', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    expect(captured.bottomNavItems.find((i) => i.id === 'money')?.tabId).toBe('money');
    act(() => captured.sidebar.props.onNavigate('money'));
    expect(await screen.findByTestId('fr-money-mock')).toBeInTheDocument();
  });

  it('with the opt-in: the FR header sits ABOVE the unchanged Goals calculator', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('goals'));
    const header = await screen.findByTestId('fr-money-header-mock');
    expect(header).toHaveAttribute('data-tab', 'goals');
    const calc = screen.getByTestId('gap-analysis-mock');
    expect(header.compareDocumentPosition(calc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['goals', 'gap-analysis-mock'],
    ['game-plan', 'game-plan-mock'],
    ['money-needs', 'money-needs-mock'],
    ['commission', 'commission-playground-mock'],
    ['persistency', 'persistency-tab-mock'],
    ['financing', 'financing-self-view-mock'],
  ])('with the opt-in: %s keeps its existing calculator mounted under the FR header (FR-D5)', async (tab, calcId) => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate(tab));
    expect(await screen.findByTestId(calcId)).toBeInTheDocument();
    expect(screen.getByTestId('fr-money-header-mock')).toHaveAttribute('data-tab', tab);
  });

  it('without the opt-in: no Nexus route leads to `money`, and no FR Money surface renders', () => {
    render(<AgentDashboard />);
    expect(NEXUS_TABS).not.toContain('money');
    expect(screen.queryByTestId('fr-money-mock')).toBeNull();
    expect(screen.queryByTestId('fr-money-header-mock')).toBeNull();
  });

  it('switching the opt-in off while on the Overview falls back to Goals (no dead route)', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('money'));
    expect(await screen.findByTestId('fr-money-mock')).toBeInTheDocument();
    act(() => setLookOptIn(false));
    expect(await screen.findByTestId('gap-analysis-mock')).toBeInTheDocument();
    expect(captured.activeTab).toBe('goals');
    expect(screen.queryByTestId('fr-money-mock')).toBeNull();
    expect(screen.queryByTestId('fr-money-header-mock')).toBeNull();
  });
});

