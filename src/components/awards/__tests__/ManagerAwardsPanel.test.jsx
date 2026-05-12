// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../services/settlementService', () => ({
  getSettlementsForUnit: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../utils/awardsEngine', () => ({
  computeManagerAwards: vi.fn(),
}));

// Mock GoalDonut to avoid pulling in a sibling component that uses JSX without
// importing React (incompatible with this test file's classic JSX transform).
// Same precedent as TeamMedalsPanel.test.jsx mocking BadgeGrid.
vi.mock('../../dashboard/GoalDonut', () => ({
  default: ({ percent }) => <svg data-testid="goal-donut" data-percent={percent} />,
}));

import ManagerAwardsPanel from '../ManagerAwardsPanel';
import { computeManagerAwards } from '../../../utils/awardsEngine';

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

const CONTENTION_AWARD = {
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

const LOCKED_AWARD = {
  id: 'persistency_gold',
  name: 'Agency Persistency — Gold',
  category: 'annual',
  eligible: false,
  inContention: false,
  criteria: [{ label: 'Avg Persistency', target: 95, current: 60, met: false, unit: '%' }],
  prize: 'Persistency Gold Trophy',
  dataSource: 'estimated',
  progressPercent: 50,
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

describe('ManagerAwardsPanel — medal state mapping', () => {
  it('renders medal-1 with .glow for a qualified award', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    const { container } = await renderPanel();
    const medal = container.querySelector('.badge-medal');
    expect(medal).not.toBeNull();
    expect(medal.classList.contains('medal-1')).toBe(true);
    expect(medal.classList.contains('glow')).toBe(true);
  });

  it('renders medal-6 (no glow) for an in-contention award', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [CONTENTION_AWARD] });
    const { container } = await renderPanel();
    const medal = container.querySelector('.badge-medal');
    expect(medal.classList.contains('medal-6')).toBe(true);
    expect(medal.classList.contains('glow')).toBe(false);
  });

  it('renders medal-locked for a not-yet-eligible award', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [LOCKED_AWARD] });
    const { container } = await renderPanel();
    const medal = container.querySelector('.badge-medal');
    expect(medal.classList.contains('medal-locked')).toBe(true);
    expect(medal.classList.contains('glow')).toBe(false);
  });

  it('renders the matching status label for each state', async () => {
    setAwards({
      bonus: BONUS_WITH_NEXT_TIER,
      list: [QUALIFIED_AWARD, CONTENTION_AWARD, LOCKED_AWARD],
    });
    await renderPanel();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('In Contention')).toBeInTheDocument();
    expect(screen.getByText('Not Eligible')).toBeInTheDocument();
  });
});

describe('ManagerAwardsPanel — tab switching', () => {
  it('switches award grid when Activity tab is clicked', async () => {
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
});

describe('ManagerAwardsPanel — Monthly Bonus hero', () => {
  it('renders bonus amount headline and next-tier caption when nextTier is present', async () => {
    setAwards({ bonus: BONUS_WITH_NEXT_TIER, list: [QUALIFIED_AWARD] });
    const { container } = await renderPanel();

    expect(container.querySelector('.role-hero')).not.toBeNull();
    expect(screen.getByText('Monthly Production Bonus')).toBeInTheDocument();
    expect(screen.getByText(/4,200/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 1% unlocked/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 1.5% at/)).toBeInTheDocument();
  });

  it('renders "Top tier achieved" caption when nextTier is null', async () => {
    setAwards({ bonus: BONUS_TOP_TIER, list: [QUALIFIED_AWARD] });
    await renderPanel();
    expect(screen.getByText('Top tier achieved')).toBeInTheDocument();
  });

  it('fills the bar at 100% when nextTier is null', async () => {
    setAwards({ bonus: BONUS_TOP_TIER, list: [QUALIFIED_AWARD] });
    const { container } = await renderPanel();
    const fill = container.querySelector('.bar-fill');
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('100%');
  });
});

describe('ManagerAwardsPanel — empty state', () => {
  it('renders "No agents" empty state when agentIds is empty', () => {
    render(
      <ManagerAwardsPanel
        agentIds={[]}
        currentDate={new Date('2026-05-11')}
        role={DEFAULT_ROLE}
        tenantId="tatil"
      />,
    );
    expect(screen.getByText(/No agents in your unit yet/i)).toBeInTheDocument();
  });
});
