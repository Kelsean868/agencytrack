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
  ledgerProps:    null,
  awardsProps:    null,
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
  default: ({ children, navItems, bottomNavItems, drawerNavItems, activeTab, setActiveTab, sidebar, showPinnedZone }) => {
    captured.sidebar        = sidebar;
    captured.setActiveTab   = setActiveTab;
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
vi.mock('../../profile/CareerPortal',                () => ({
  default: (props) => {
    captured.careerProps = props;
    return null;
  },
}));
vi.mock('../../profile/ProfileScreen',               () => ({ default: () => null }));
vi.mock('../../ui/ReportRangeModal',                 () => ({ default: () => null }));
vi.mock('../../awards/AgentAwardsPanel',             () => ({ default: (props) => { captured.awardsProps = props; return null; } }));
vi.mock('../../submissions/SubmissionViewer',        () => ({ default: () => null }));
vi.mock('../../submissions/HistoryTab',              () => ({ default: () => null }));
vi.mock('../../agent/ProspectInfoPanel',             () => ({ default: () => null }));
vi.mock('../../agent/PolicyLedgerPanel',             () => ({
  default: (props) => {
    captured.ledgerProps = props;
    return React.createElement('div', { 'data-testid': 'policy-ledger-mock' });
  },
}));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: () => React.createElement('div', { 'data-testid': 'money-needs-mock' }) }));
vi.mock('../../agent/PolicyLedgerPanel',             () => ({ default: () => React.createElement('div', { 'data-testid': 'policy-ledger-mock' }) }));
vi.mock('../../agent/MoneyNeedsPanel',               () => ({ default: ({ look }) => React.createElement('div', { 'data-testid': 'money-needs-mock', 'data-look': look }) }));
vi.mock('../../productionReport/ProductionReportTab', () => ({ default: () => React.createElement('div', { 'data-testid': 'production-report-mock' }) }));
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
// FR-4: Focus, Pipeline, and the headers above the Numbers routes and the Ledger.
vi.mock('../../fr/work/FrFocus', () => ({
  default: ({ mode }) => React.createElement('div', { 'data-testid': 'fr-focus-mock', 'data-mode': mode }),
}));
vi.mock('../../fr/work/FrPipeline', () => ({ default: () => React.createElement('div', { 'data-testid': 'fr-pipeline-mock' }) }));
vi.mock('../../fr/work/FrWorkHeaders', () => ({
  FrNumbersHeader: () => React.createElement('div', { 'data-testid': 'fr-numbers-header-mock' }),
  FrLedgerHeader: ({ onOpenWinback }) => React.createElement('button', { 'data-testid': 'fr-ledger-header-mock', onClick: onOpenWinback }),
}));
// FR-5: Campaign, Trophy room, and the headers above the Leaderboard and Profile.
vi.mock('../../fr/compete/FrCampaign', () => ({
  default: ({ onOpenAwards, onOpenPolicy }) => React.createElement(React.Fragment, null,
    React.createElement('button', { 'data-testid': 'fr-campaign-mock', onClick: onOpenAwards }),
    // R2-4 — a campaign row's "Change status".
    React.createElement('button', { 'data-testid': 'fr-campaign-change-status-mock', onClick: () => onOpenPolicy?.('p9') })),
}));
vi.mock('../../fr/compete/FrTrophyRoom', () => ({
  default: (props) => {
    captured.trophyProps = props;
    return React.createElement('div', { 'data-testid': 'fr-trophies-mock' });
  },
}));
vi.mock('../../fr/compete/FrCompeteHeaders', () => ({
  FrArenaHeader: () => React.createElement('div', { 'data-testid': 'fr-arena-header-mock' }),
  FrMeHeader: ({ onOpenTrophies }) => React.createElement('button', { 'data-testid': 'fr-me-header-mock', onClick: onOpenTrophies }),
}));
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
  captured.ledgerProps = null;
  captured.awardsProps = null;
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
    // R2-9: Money needs gets the FR layout at the dashboard boundary.
    if (tab === 'money-needs') expect(screen.getByTestId(calcId)).toHaveAttribute('data-look', 'fr');
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

describe('AgentDashboard — FR-4 Work', () => {
  it('with the opt-in: Focus and Pipeline are routes of their own', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('focus'));
    expect(await screen.findByTestId('fr-focus-mock')).toHaveAttribute('data-mode', 'calls');
    act(() => captured.sidebar.props.onNavigate('pipeline'));
    expect(await screen.findByTestId('fr-pipeline-mock')).toBeInTheDocument();
  });

  it('with the opt-in: the FR headers sit above the unchanged Production report and Policy Ledger', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('production-report'));
    expect(await screen.findByTestId('production-report-mock')).toBeInTheDocument();
    expect(screen.getByTestId('fr-numbers-header-mock')).toBeInTheDocument();
    act(() => captured.sidebar.props.onNavigate('policy-ledger'));
    expect(await screen.findByTestId('policy-ledger-mock')).toBeInTheDocument();
    expect(screen.getByTestId('fr-ledger-header-mock')).toBeInTheDocument();
  });

  it('the Ledger win-back lens opens Focus in Win-back mode', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('policy-ledger'));
    act(() => screen.getByTestId('fr-ledger-header-mock').click());
    expect(await screen.findByTestId('fr-focus-mock')).toHaveAttribute('data-mode', 'winback');
  });

  it('without the opt-in: no FR-4 surface, and the Numbers and Ledger screens render exactly as before', async () => {
    render(<AgentDashboard />);
    expect(NEXUS_TABS).not.toContain('focus');
    expect(NEXUS_TABS).not.toContain('pipeline');
    // Visit each wrapped tab through the Nexus shell, so a broken `fr` gate would show its header.
    act(() => captured.setActiveTab('production-report'));
    expect(await screen.findByTestId('production-report-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-numbers-header-mock')).toBeNull();
    act(() => captured.setActiveTab('policy-ledger'));
    expect(await screen.findByTestId('policy-ledger-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-ledger-header-mock')).toBeNull();
  });

  it.each([['focus', 'dashboard'], ['pipeline', 'policy-ledger']])(
    'switching the opt-in off on %s falls back to %s',
    async (route, fallback) => {
      localStorage.setItem('agencytrack-look', 'fr');
      render(<AgentDashboard />);
      act(() => captured.sidebar.props.onNavigate(route));
      act(() => setLookOptIn(false));
      await screen.findByTestId('shell-mock');
      expect(captured.activeTab).toBe(fallback);
    },
  );
});

describe('AgentDashboard — FR-5 Compete / You', () => {
  it('with the opt-in: Campaign and Trophy room are routes of their own; Campaign links to Awards', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('trophies'));
    expect(await screen.findByTestId('fr-trophies-mock')).toBeInTheDocument();
    // FR-5b: the room gets the Awards tab's inputs from what the dashboard holds (no new read).
    expect(Object.keys(captured.trophyProps)).toEqual(expect.arrayContaining([
      'ledgerPolicies', 'ledgerError', 'onRetryPolicies', 'settlements', 'allSubmissions',
      'userProfile', 'awardsRuleset', 'activeCampaigns', 'now',
    ]));
    act(() => captured.sidebar.props.onNavigate('campaign'));
    act(() => screen.getByTestId('fr-campaign-mock').click());
    await screen.findByTestId('shell-mock');
    expect(captured.activeTab).toBe('awards');
  });

  it('with the opt-in: the FR headers sit above the unchanged Leaderboard and Profile; Me opens the Trophy room', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('production-leaderboard'));
    expect(await screen.findByTestId('production-leaderboard-surface-mock')).toBeInTheDocument();
    expect(screen.getByTestId('fr-arena-header-mock')).toBeInTheDocument();
    act(() => captured.sidebar.props.onNavigate('profile'));
    act(() => screen.getByTestId('fr-me-header-mock').click());
    expect(await screen.findByTestId('fr-trophies-mock')).toBeInTheDocument();
  });

  it('without the opt-in: no FR-5 surface; the Leaderboard and Profile render exactly as before', async () => {
    render(<AgentDashboard />);
    expect(NEXUS_TABS).not.toContain('campaign');
    expect(NEXUS_TABS).not.toContain('trophies');
    // Visit each wrapped tab through the Nexus shell, so a broken `fr` gate would show its header.
    act(() => captured.setActiveTab('production-leaderboard'));
    expect(await screen.findByTestId('production-leaderboard-surface-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-arena-header-mock')).toBeNull();
    act(() => captured.setActiveTab('profile'));
    await screen.findByTestId('shell-mock');
    expect(captured.activeTab).toBe('profile');
    expect(screen.queryByTestId('fr-me-header-mock')).toBeNull();
  });

  it('R2-5: under FR the Career card gets a way into the Trophy room; under Nexus it does not (the grid stays)', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    const { unmount } = render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('career'));
    await screen.findByTestId('shell-mock');
    expect(typeof captured.careerProps.onOpenTrophies).toBe('function');
    act(() => captured.careerProps.onOpenTrophies());
    expect(await screen.findByTestId('fr-trophies-mock')).toBeInTheDocument();
    unmount();
    localStorage.clear();
    captured.careerProps = undefined;
    render(<AgentDashboard />);
    act(() => captured.setActiveTab('career'));
    await screen.findByTestId('shell-mock');
    expect(captured.careerProps).toBeDefined();
    expect(captured.careerProps.onOpenTrophies).toBeUndefined();
  });

  it.each([['campaign', 'awards'], ['trophies', 'career']])(
    'switching the opt-in off on %s falls back to %s',
    async (route, fallback) => {
      localStorage.setItem('agencytrack-look', 'fr');
      render(<AgentDashboard />);
      act(() => captured.sidebar.props.onNavigate(route));
      act(() => setLookOptIn(false));
      await screen.findByTestId('shell-mock');
      expect(captured.activeTab).toBe(fallback);
    },
  );
});

// ── R2-4 — Campaign "Change status" → the Policy ledger with that drawer open ──
describe('AgentDashboard — R2-4 campaign status-change hand-off', () => {
  it('FR Campaign: "Change status" opens the Policy ledger with that policy handed off; consuming clears it', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    render(<AgentDashboard />);
    act(() => captured.sidebar.props.onNavigate('campaign'));
    act(() => screen.getByTestId('fr-campaign-change-status-mock').click());
    expect(await screen.findByTestId('policy-ledger-mock')).toBeInTheDocument();
    expect(captured.activeTab).toBe('policy-ledger');
    expect(captured.ledgerProps.initialPolicyId).toBe('p9');
    act(() => captured.ledgerProps.onInitialPolicyConsumed());
    expect(captured.ledgerProps.initialPolicyId).toBeNull();
  });

  it('Nexus Awards (the Nexus campaign screen) gets the same hand-off, and leaving the ledger clears it', async () => {
    render(<AgentDashboard />);
    act(() => captured.setActiveTab('awards'));
    await vi.waitFor(() => expect(captured.awardsProps?.onOpenPolicy).toBeTypeOf('function'));
    act(() => captured.awardsProps.onOpenPolicy('p9'));
    expect(await screen.findByTestId('policy-ledger-mock')).toBeInTheDocument();
    expect(captured.ledgerProps.initialPolicyId).toBe('p9');
    act(() => captured.setActiveTab('awards'));
    act(() => captured.setActiveTab('policy-ledger'));
    expect(await screen.findByTestId('policy-ledger-mock')).toBeInTheDocument();
    expect(captured.ledgerProps.initialPolicyId).toBeNull();
  });
});
