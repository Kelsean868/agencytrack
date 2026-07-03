// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  useAuth:           vi.fn(),
  getMonthlyPlan:    vi.fn(),
  createMonthlyPlan: vi.fn(),
  saveMonthlyPlan:   vi.fn(),
  getTodayTT:        vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../services/monthlyPlanService', () => ({
  getMonthlyPlan:    (...args) => hoisted.getMonthlyPlan(...args),
  createMonthlyPlan: (...args) => hoisted.createMonthlyPlan(...args),
  saveMonthlyPlan:   (...args) => hoisted.saveMonthlyPlan(...args),
}));

vi.mock('../../../utils/dateInputs', () => ({
  getTodayTT:       () => hoisted.getTodayTT(),
  // parseDateOnlyTT used by monthlyPlanMath — keep functional
  parseDateOnlyTT: (s) => {
    const d = new Date(s + 'T12:00:00Z');
    if (isNaN(d.getTime())) throw new Error(`parseDateOnlyTT: invalid "${s}"`);
    return d;
  },
}));

import MonthlyPlanModal from '../MonthlyPlanModal';
import MonthChart from '../MonthChart';
import StepRail from '../../dashboard/GamePlanV2/StepRail';

// ── Helpers ───────────────────────────────────────────────────────────────────

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});

const ANCHOR_API = 120000;
const YEAR = 2026;
// currentMonthIndex = 5 (June) throughout — getTodayTT mocked to '2026-06-01'
const EVEN_TARGETS = Array(12).fill(10000);

const EXISTING_PLAN = {
  id: '2026',
  year: YEAR,
  targets: [...EVEN_TARGETS],
  split: 'even',
  status: 'draft',
  anchorAPI: ANCHOR_API,
};

function renderModal(props = {}) {
  return render(
    <MonthlyPlanModal
      onClose={vi.fn()}
      yearPlanAPI={ANCHOR_API}
      submissions={[]}
      year={YEAR}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({ tenantId: 'tenant-1', user: { uid: 'agent-1' } });
  hoisted.getTodayTT.mockReturnValue('2026-06-01'); // June = index 5
  hoisted.getMonthlyPlan.mockResolvedValue(null);
  hoisted.createMonthlyPlan.mockResolvedValue({ ...EXISTING_PLAN });
  hoisted.saveMonthlyPlan.mockResolvedValue(undefined);
});

// ── Modal states ──────────────────────────────────────────────────────────────

describe('MonthlyPlanModal — no-yearPlan state', () => {
  it('shows Set up Year Plan first when yearPlanAPI is 0', async () => {
    render(
      <MonthlyPlanModal onClose={vi.fn()} yearPlanAPI={0} submissions={[]} year={YEAR} />,
    );
    await flush();
    expect(screen.getByTestId('no-yearplan-state')).toBeTruthy();
    expect(screen.getByText(/Nothing to split yet/i)).toBeTruthy();
  });

  // Fork B1 honesty copy — the header disclosure renders in every phase.
  it('header carries the manager-visibility disclosure line', async () => {
    render(
      <MonthlyPlanModal onClose={vi.fn()} yearPlanAPI={0} submissions={[]} year={YEAR} />,
    );
    await flush();
    expect(screen.getByText(/Visible to your managers\./i)).toBeTruthy();
  });

  it('does not call getMonthlyPlan when yearPlanAPI is 0', async () => {
    render(
      <MonthlyPlanModal onClose={vi.fn()} yearPlanAPI={0} submissions={[]} year={YEAR} />,
    );
    await flush();
    expect(hoisted.getMonthlyPlan).not.toHaveBeenCalled();
  });
});

describe('MonthlyPlanModal — no existing plan → creates even split', () => {
  it('calls createMonthlyPlan with the anchor when no plan exists', async () => {
    renderModal();
    await flush();
    expect(hoisted.createMonthlyPlan).toHaveBeenCalledWith(
      'tenant-1', 'agent-1', YEAR, ANCHOR_API,
    );
  });

  it('renders 12 month target sections after plan is created', async () => {
    renderModal();
    await flush();
    // editable months are spinbuttons (current + future = indices 5–11 = 7)
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBe(7);
  });

  it('Save is enabled when plan loads balanced', async () => {
    renderModal();
    await flush();
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(false);
  });
});

describe('MonthlyPlanModal — existing plan → loads it', () => {
  beforeEach(() => {
    hoisted.getMonthlyPlan.mockResolvedValue({ ...EXISTING_PLAN });
  });

  it('does not call createMonthlyPlan when plan already exists', async () => {
    renderModal();
    await flush();
    expect(hoisted.createMonthlyPlan).not.toHaveBeenCalled();
  });

  it('shows the allocating phase with month grid', async () => {
    renderModal();
    await flush();
    expect(screen.getAllByRole('spinbutton').length).toBe(7);
  });
});

// ── Edit behavior ─────────────────────────────────────────────────────────────

describe('MonthlyPlanModal — edit behavior', () => {
  beforeEach(() => {
    hoisted.getMonthlyPlan.mockResolvedValue({ ...EXISTING_PLAN });
  });

  it('past months (index < 5) are locked — fewer than 12 spinbuttons', async () => {
    renderModal();
    await flush();
    const inputs = screen.getAllByRole('spinbutton');
    // only current (June=5) + future (6-11) = 7 editable
    expect(inputs.length).toBe(7);
    expect(inputs.length).toBeLessThan(12);
  });

  it('editing a future month unbalances the delta and disables Save', async () => {
    renderModal();
    await flush();
    // inputs[6] = month 11 (December), a future month
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '20000' } });
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(true);
    const pill = screen.getByTestId('balance-pill');
    expect(pill.textContent).not.toContain('✓');
  });

  it('fill-empty-months fills cleared months and re-enables Save', async () => {
    renderModal();
    await flush();
    const inputs = screen.getAllByRole('spinbutton');
    // Clear December (the last editable/future month) to 0 → under-allocated.
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(true);
    // Fill empty months spreads the remainder into the cleared month → balanced.
    fireEvent.click(screen.getByTestId('auto-distribute-btn'));
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(false);
    expect(screen.getByTestId('balance-pill').textContent).toContain('✓');
  });

  it('reset-to-even re-balances and re-enables Save', async () => {
    renderModal();
    await flush();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5000' } }); // June: 10000 → 5000
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /reset to even/i }));
    expect(screen.getByRole('button', { name: /save draft/i }).disabled).toBe(false);
    expect(screen.getByTestId('balance-pill').textContent).toContain('✓');
  });

  it('fill-empty-months button is disabled when already balanced', async () => {
    renderModal();
    await flush();
    expect(screen.getByTestId('auto-distribute-btn').disabled).toBe(true);
  });

  it('fill-empty-months button is disabled when over-allocated', async () => {
    renderModal();
    await flush();
    const inputs = screen.getAllByRole('spinbutton');
    // Push a future month above the annual anchor → over-allocated (no-op for fill).
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '999999' } });
    expect(screen.getByTestId('auto-distribute-btn').disabled).toBe(true);
  });
});

// ── Stale anchor ──────────────────────────────────────────────────────────────

describe('MonthlyPlanModal — stale anchor', () => {
  it('shows the stale-anchor banner when plan.anchorAPI differs from yearPlanAPI', async () => {
    hoisted.getMonthlyPlan.mockResolvedValue({
      ...EXISTING_PLAN,
      anchorAPI: 100000, // stale — yearPlanAPI is 120000
    });
    renderModal({ yearPlanAPI: 120000 });
    await flush();
    expect(screen.getByTestId('stale-anchor-banner')).toBeTruthy();
  });

  it('clicking Reset on stale banner re-seeds even split and hides the banner', async () => {
    hoisted.getMonthlyPlan.mockResolvedValue({
      ...EXISTING_PLAN,
      anchorAPI: 100000,
    });
    renderModal({ yearPlanAPI: 120000 });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.queryByTestId('stale-anchor-banner')).toBeNull();
  });
});

// ── Chart ─────────────────────────────────────────────────────────────────────

describe('MonthChart', () => {
  const targets = Array(12).fill(10000);
  const actuals = Array(12).fill(0);

  it('renders 12 month columns', () => {
    render(
      <MonthChart
        targets={targets}
        actuals={actuals}
        year={2026}
        currentMonthIndex={5}
        todayTT="2026-06-01"
      />,
    );
    for (let i = 0; i < 12; i++) {
      expect(screen.getByTestId(`month-col-${i}`)).toBeTruthy();
    }
  });

  it('renders a pace tick for the current month when target > 0 and pace > 0', () => {
    const t = Array(12).fill(10000);
    render(
      <MonthChart
        targets={t}
        actuals={Array(12).fill(0)}
        year={2026}
        currentMonthIndex={5}
        todayTT="2026-06-15"
      />,
    );
    expect(screen.getByTestId('pace-tick')).toBeTruthy();
  });

  it('renders exactly one pace tick even when multiple months have targets', () => {
    render(
      <MonthChart
        targets={Array(12).fill(10000)}
        actuals={Array(12).fill(0)}
        year={2026}
        currentMonthIndex={5}
        todayTT="2026-06-15"
      />,
    );
    // Only the current month (index 5) gets a pace tick
    expect(screen.getAllByTestId('pace-tick').length).toBe(1);
  });

  it('renders a single NOW line, in the current month column (3.2)', () => {
    render(
      <MonthChart
        targets={targets}
        actuals={actuals}
        year={2026}
        currentMonthIndex={5}
        todayTT="2026-06-15"
      />,
    );
    expect(screen.getAllByTestId('now-line').length).toBe(1);
    // It lives inside June (month-col-5), not elsewhere.
    expect(screen.getByTestId('month-col-5').querySelector('[data-testid="now-line"]')).not.toBeNull();
  });

  it('positions the NOW line by TT day-of-month', () => {
    render(
      <MonthChart
        targets={targets}
        actuals={actuals}
        year={2026}
        currentMonthIndex={5}
        todayTT="2026-06-15"
      />,
    );
    // June has 30 days; (15 − 0.5) / 30 = 0.4833… → ~48.3%
    expect(screen.getByTestId('now-line').style.left).toMatch(/^48\.3/);
  });

  it('omits the NOW line when todayTT is unavailable', () => {
    render(
      <MonthChart
        targets={targets}
        actuals={actuals}
        year={2026}
        currentMonthIndex={5}
        todayTT=""
      />,
    );
    expect(screen.queryByTestId('now-line')).toBeNull();
  });

  it('omits the NOW line when year is invalid (no NaN left position)', () => {
    render(
      <MonthChart
        targets={targets}
        actuals={actuals}
        year={undefined}
        currentMonthIndex={5}
        todayTT="2026-06-15"
      />,
    );
    expect(screen.queryByTestId('now-line')).toBeNull();
  });
});

// ── Honest-empty actuals (3.8) ────────────────────────────────────────────────

describe('MonthlyPlanModal — honest-empty actuals (3.8)', () => {
  it('shows "actuals will fill in" when targets are set but there are no submissions', async () => {
    renderModal({ submissions: [] });
    await flush();
    expect(screen.getByTestId('no-actuals-state')).toBeTruthy();
    expect(screen.getByText(/actuals will fill in/i)).toBeTruthy();
  });

  it('hides the honest-empty state once a submission contributes actuals', async () => {
    const submissions = [{ weekStarting: '2026-06-07', totalProductionCredit: 5000 }];
    renderModal({ submissions });
    await flush();
    expect(screen.queryByTestId('no-actuals-state')).toBeNull();
  });
});

// ── Readouts ──────────────────────────────────────────────────────────────────

describe('MonthlyPlanModal — readouts', () => {
  it('renders to-finish and YTD readout sections after load', async () => {
    hoisted.getMonthlyPlan.mockResolvedValue({ ...EXISTING_PLAN });
    renderModal();
    await flush();
    expect(screen.getByText(/to finish/i)).toBeTruthy();
    expect(screen.getByText(/ytd vs pace/i)).toBeTruthy();
  });
});

// ── Flag gate — Step 3 clickability ──────────────────────────────────────────

describe('StepRail — Monthly Plan flag gate', () => {
  it('Step 3 is a non-interactive div when onOpenMonthlyPlan is not passed', () => {
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={vi.fn()}
        onOpenYearPlan={vi.fn()}
        yearPlanFilled={true}
      />,
    );
    const rail = screen.getByTestId('game-plan-rail');
    const buttons = Array.from(rail.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent.includes('Monthly Plan'))).toBe(false);
  });

  it('Step 3 is a clickable button when onOpenMonthlyPlan is passed', () => {
    const onOpen = vi.fn();
    render(
      <StepRail
        moneyNeedsFilled={true}
        onOpenMoneyNeeds={vi.fn()}
        onOpenYearPlan={vi.fn()}
        yearPlanFilled={true}
        onOpenMonthlyPlan={onOpen}
      />,
    );
    const rail = screen.getByTestId('game-plan-rail');
    const monthlyBtn = Array.from(rail.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Monthly Plan'),
    );
    expect(monthlyBtn).toBeTruthy();
    fireEvent.click(monthlyBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
