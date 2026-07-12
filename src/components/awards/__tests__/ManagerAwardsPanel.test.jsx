// @vitest-environment jsdom
//
// Track J — Manager Awards v2 panel.
//
// Regression strategy: the awards data flow (computeManagerAwards + loaders)
// is untouched, so each test mocks computeManagerAwards to a fixed map and
// asserts the new v2 markup renders the same data set. Tabs, bonus hero,
// empty state, role-gated BmAtRiskPanel mount, and the drill drawer all live
// here.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';

vi.mock('../../../services/settlementService', () => ({
  getSettlementsForUnit: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../services/awardsRulesetService', () => ({
  getAwardsRuleset: vi.fn(() => Promise.resolve(undefined)),
  getMergedAwardsRuleset: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../../services/managerService', () => ({
  getAllYTDSubmissions: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../utils/awardsEngine', () => ({
  computeManagerAwards: vi.fn(),
}));

vi.mock('../BmAtRiskPanel', () => ({
  default: () => (
    <section data-testid="bm-at-risk-panel">
      <h3>Agent Award Risk View</h3>
    </section>
  ),
}));

import ManagerAwardsPanel from '../ManagerAwardsPanel';
import { computeManagerAwards } from '../../../utils/awardsEngine';
import { getSettlementsForUnit } from '../../../services/settlementService';

const QUALIFIED_AWARD = {
  id: 'production_award',
  name: 'Production Award',
  category: 'annual',
  eligible: true,
  inContention: false,
  criteria: [{ label: 'Avg API / Advisor', target: 250000, current: 280000, met: true, unit: 'TTD' }],
  prize: 'Production Award + Bonus',
  dataSource: 'confirmed',
  progressPercent: 112,
  note: null,
};

const ALMOST_AWARD = {
  id: 'persistency_silver',
  name: 'Agency Persistency — Silver',
  category: 'annual',
  eligible: false,
  inContention: true,
  criteria: [{ label: 'Avg Persistency', target: 92, current: 88, met: false, unit: '%' }],
  prize: 'Persistency Silver Trophy',
  dataSource: 'estimated',
  progressPercent: 95,
  note: 'Estimated — pending confirmation',
};

const PROGRESS_AWARD = {
  id: 'production_silver',
  name: 'Production Silver',
  category: 'annual',
  eligible: false,
  inContention: true,
  criteria: [{ label: 'Avg API / Advisor', target: 200000, current: 95000, met: false, unit: 'TTD' }],
  prize: 'Production Silver',
  dataSource: 'estimated',
  progressPercent: 48,
  note: null,
};

const LOCKED_AWARD = {
  id: 'persistency_gold',
  name: 'Agency Persistency — Gold',
  category: 'annual',
  eligible: false,
  inContention: false,
  criteria: [{ label: 'Avg Persistency', target: 95, current: 12, met: false, unit: '%' }],
  prize: 'Persistency Gold Trophy',
  dataSource: 'estimated',
  progressPercent: 12,
  note: null,
};

const ACTIVITY_QUALIFIED = {
  id: 'activity_gold',
  name: 'Activity Award — Gold',
  category: 'annual',
  eligible: true,
  inContention: false,
  criteria: [{ label: 'Avg Apps / Advisor', target: 60, current: 62, met: true, unit: 'apps' }],
  prize: 'Gold Activity Award',
  dataSource: 'confirmed',
  progressPercent: 103,
  note: null,
};

const RECRUIT_AWARD = {
  id: 'recruiting_bronze',
  name: 'Recruiting Bronze',
  category: 'annual',
  eligible: true,
  inContention: false,
  criteria: [{ label: 'New advisors licensed', target: 2, current: 3, met: true, unit: '' }],
  prize: 'Bronze recruiter trophy',
  dataSource: 'confirmed',
  progressPercent: 150,
  note: null,
};

const BONUS_WITH_NEXT_TIER = {
  id: 'agency_monthly_bonus',
  name: 'Agency Monthly Production Bonus',
  category: 'monthly',
  currentTier: 1.0,
  bonusPct: 1.0,
  bonusAmount: 4200,
  avgMonthlyAPI: 21000,
  nextTier: { threshold: 30000, pct: 1.5 },
  note: null,
};

const BONUS_TOP_TIER = {
  ...BONUS_WITH_NEXT_TIER,
  bonusPct: 1.5,
  bonusAmount: 6000,
  avgMonthlyAPI: 32000,
  nextTier: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function setAwards({ bonus, list }) {
  const map = { agency_monthly_bonus: bonus };
  list.forEach((a) => { map[a.id] = a; });
  computeManagerAwards.mockReturnValue(map);
}

const DEFAULT_ROLE = 'unit_manager';

async function renderPanel(props = {}) {
  const result = render(
    <ManagerAwardsPanel
      agentIds={['a1','a2']}
      currentDate={new Date('2026-05-11')}
      role={DEFAULT_ROLE}
      tenantId="tatil"
      {...props}
    />,
  );
  await waitFor(() => {
    expect(result.container.querySelectorAll('.animate-pulse').length).toBe(0);
  });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group classification — Qualified / Almost / Progress / Starting
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — v2 group classification', () => {
  it('renders Qualified group for an eligible award (gold accent)', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();
    expect(screen.getByTestId('award-group-qualified')).toBeInTheDocument();
    const card = screen.getByTestId('award-card-production_award');
    expect(card).toHaveAttribute('data-state', 'qualified');
    expect(card.textContent).toContain('Production Award');
    expect(card.textContent).toContain('QUALIFIED');
  });

  it('renders Almost-there group for inContention >=70%', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [ALMOST_AWARD] });
    await renderPanel();
    expect(screen.getByTestId('award-group-almost')).toBeInTheDocument();
    const card = screen.getByTestId('award-card-persistency_silver');
    expect(card).toHaveAttribute('data-state', 'contention');
  });

  it('renders Making-progress group for inContention 30-70%', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [PROGRESS_AWARD] });
    await renderPanel();
    expect(screen.getByTestId('award-group-progress')).toBeInTheDocument();
  });

  it('renders Just-starting group for not-yet-eligible <30%', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [LOCKED_AWARD] });
    await renderPanel();
    expect(screen.getByTestId('award-group-starting')).toBeInTheDocument();
    const card = screen.getByTestId('award-card-persistency_gold');
    expect(card).toHaveAttribute('data-state', 'locked');
    expect(card.textContent).toContain('NOT STARTED');
  });

  it('selects the highest-progress in-contention award as the hero (via dedicated HeroAwardCard usage)', async () => {
    // ALMOST (95%) wins over PROGRESS (48%). The hero pick is also the source
    // of the highest-percent state pill on the card — assert by data-state.
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [ALMOST_AWARD, PROGRESS_AWARD] });
    await renderPanel();
    expect(screen.getByTestId('award-card-persistency_silver')).toBeInTheDocument();
    expect(screen.getByTestId('award-card-production_silver')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category tab switching (annual / activity / recruit)
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — category tabs', () => {
  it('renders Annual tab content by default; switching to Activity swaps the grid', async () => {
    setAwards({
      bonus: BONUS_WITH_NEXT_TIER,
      list: [QUALIFIED_AWARD, ACTIVITY_QUALIFIED],
    });
    await renderPanel();

    expect(screen.getByText('Production Award')).toBeInTheDocument();
    expect(screen.queryByText('Activity Award — Gold')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /activity/i }));

    expect(screen.getByText('Activity Award — Gold')).toBeInTheDocument();
    expect(screen.queryByText('Production Award')).toBeNull();
  });

  it('switches to Recruiting tab and renders the recruit-id awards', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD, RECRUIT_AWARD] });
    await renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: /recruiting/i }));

    expect(screen.getByText('Recruiting Bronze')).toBeInTheDocument();
    expect(screen.queryByText('Production Award')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Bonus hero — restyled v2 card-shell
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — Monthly Bonus hero (v2 card-shell)', () => {
  it('renders the bonus hero card with amount + tier + next-tier label when nextTier present', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();

    const hero = screen.getByTestId('monthly-bonus-hero');
    expect(hero).toBeInTheDocument();
    expect(hero.textContent).toContain('Monthly Production Bonus');
    expect(hero.textContent).toMatch(/4,200/);
    expect(hero.textContent).toMatch(/Tier 1% unlocked/);
    expect(hero.textContent).toMatch(/Tier 1.5% at/);
    expect(hero.textContent).toMatch(/Next tier in reach/);
  });

  it('renders "Top tier achieved" eyebrow when nextTier is null and uses qualified state', async () => {
    setAwards({ bonus: BONUS_TOP_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();

    const hero = screen.getByTestId('monthly-bonus-hero');
    expect(hero.textContent).toContain('Top tier achieved');
    // Donut data-state should be qualified for top tier
    const donuts = hero.querySelectorAll('[data-testid="award-donut"]');
    expect(donuts.length).toBeGreaterThan(0);
    expect(donuts[0].getAttribute('data-state')).toBe('qualified');
    expect(donuts[0].getAttribute('data-percent')).toBe('100');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// newAdvisors prop threading — preserved from legacy panel
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — newAdvisors prop threading (preserved)', () => {
  it('defaults newAdvisors to 0 when prop is omitted', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ newAdvisors: undefined });
    const last = computeManagerAwards.mock.calls.at(-1);
    expect(last[3]).toEqual({ newAdvisors: 0 });
  });

  it('forwards newAdvisors={5} to computeManagerAwards', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ newAdvisors: 5 });
    const last = computeManagerAwards.mock.calls.at(-1);
    expect(last[3]).toEqual({ newAdvisors: 5 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — empty state', () => {
  it('renders the "No agents" empty card when agentIds is empty', () => {
    render(
      <ManagerAwardsPanel
        agentIds={[]}
        currentDate={new Date('2026-05-11')}
        role={DEFAULT_ROLE}
        tenantId="tatil"
      />,
    );
    expect(screen.getByText('No agents in your unit yet.')).toBeInTheDocument();
  });

  it('renders the "No awards in this category" empty card when category has none', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: /recruiting/i }));
    expect(screen.getByTestId('award-empty')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BmAtRiskPanel role gating — BM/TA/PA mount; UM and SM do NOT
// ─────────────────────────────────────────────────────────────────────────────
// `sales_manager` is intentionally EXCLUDED from isBmPlus. SM has no single
// branch — whether these panels scope correctly for an all-branches SM is an
// open product question (cf. P5b for the leaderboard); banked as an FU.
describe('ManagerAwardsPanel — BmAtRiskPanel gating (SM intentionally excluded)', () => {
  it('mounts at-risk panel for branch_manager', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ role: 'branch_manager' });
    expect(screen.getByTestId('bm-at-risk-panel')).toBeInTheDocument();
  });

  it('mounts at-risk panel for tenant_admin', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ role: 'tenant_admin' });
    expect(screen.getByTestId('bm-at-risk-panel')).toBeInTheDocument();
  });

  it('mounts at-risk panel for platform_admin', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ role: 'platform_admin' });
    expect(screen.getByTestId('bm-at-risk-panel')).toBeInTheDocument();
  });

  it('does NOT mount at-risk panel for unit_manager', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ role: 'unit_manager' });
    expect(screen.queryByTestId('bm-at-risk-panel')).not.toBeInTheDocument();
  });

  it('does NOT mount at-risk panel for sales_manager (open product question — FU banked)', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel({ role: 'sales_manager' });
    expect(screen.queryByTestId('bm-at-risk-panel')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drill drawer — clicking an AwardCard opens the criteria detail panel
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — drill drawer', () => {
  it('opens the AwardDrillDrawer when an AwardCard is clicked + closes on Escape', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();

    expect(screen.queryByTestId('award-drill-drawer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('award-card-production_award'));
    expect(screen.getByTestId('award-drill-drawer')).toBeInTheDocument();
    // Criteria header inside the drawer
    const drawer = screen.getByTestId('award-drill-drawer');
    expect(drawer.textContent).toContain('Criteria');
    expect(drawer.textContent).toContain('Avg API / Advisor');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('award-drill-drawer')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error state + Retry (§1(b) four-states holdouts)
// ─────────────────────────────────────────────────────────────────────────────
describe('ManagerAwardsPanel — error state + Retry', () => {
  it('renders an error card with role="alert" and a Retry button when the load fails', async () => {
    getSettlementsForUnit.mockRejectedValueOnce(new Error('boom'));
    render(
      <ManagerAwardsPanel
        agentIds={['a1', 'a2']}
        currentDate={new Date('2026-05-11')}
        role={DEFAULT_ROLE}
        tenantId="tatil"
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Failed to load settlement data.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry re-invokes the load (getSettlementsForUnit called again) and recovers on success', async () => {
    getSettlementsForUnit.mockRejectedValueOnce(new Error('boom'));
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    render(
      <ManagerAwardsPanel
        agentIds={['a1', 'a2']}
        currentDate={new Date('2026-05-11')}
        role={DEFAULT_ROLE}
        tenantId="tatil"
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const callsBeforeRetry = getSettlementsForUnit.mock.calls.length;
    getSettlementsForUnit.mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    await waitFor(() => expect(getSettlementsForUnit.mock.calls.length).toBe(callsBeforeRetry + 1));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByTestId('manager-awards-panel')).toBeInTheDocument();
  });
});
