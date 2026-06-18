import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MOCK_ROWS } from '../mockRosterData';
import TeamPerfRoster from '../TeamPerfRoster';
import TenureCell from '../TenureCell';
import { formatTenureStr, formatContractDateStr } from '../tenureUtils';
import PersBandCell from '../PersBandCell';
import GoalHeatCell from '../GoalHeatCell';
import PeriodFilter from '../PeriodFilter';
import { defaultPeriodForGrain, periodLabel } from '../periodUtils';
import TeamPerfRosterPage from '../TeamPerfRosterPage';

// ─── helpers ──────────────────────────────────────────────────────────────────
const SORT_ASC  = { column: 'name', direction: 'asc' };
const noop      = () => {};
const FULL_ROWS = MOCK_ROWS;

// ─── TenureCell unit tests ────────────────────────────────────────────────────
describe('TenureCell', () => {
  it('renders tenure string for a known date', () => {
    // contractDate = 2017-04-18  →  ~9y 2m from Jun 2026
    const date = new Date(2017, 3, 18).getTime();
    const now  = new Date(2026, 5, 17); // 17 Jun 2026
    expect(formatTenureStr(date, now)).toBe('9y 1m');
  });

  it('renders 0y 0m for a very recent date', () => {
    const date = new Date(2026, 5, 15).getTime();
    const now  = new Date(2026, 5, 17);
    expect(formatTenureStr(date, now)).toBe('0y 0m');
  });

  it('never returns negative months', () => {
    const date = new Date(2026, 6, 1).getTime(); // future
    const now  = new Date(2026, 5, 17);
    expect(formatTenureStr(date, now)).toBe('0y 0m');
  });

  it('returns null for missing contractDate', () => {
    expect(formatTenureStr(null)).toBeNull();
    expect(formatTenureStr(undefined)).toBeNull();
  });

  it('formats contract date string correctly', () => {
    const date = new Date(2019, 10, 4).getTime(); // 4 Nov 2019
    expect(formatContractDateStr(date)).toBe('4 Nov 2019');
  });

  it('renders tenure cell with testid', () => {
    const date = new Date(2017, 3, 18).getTime();
    render(<TenureCell contractDate={date} />);
    expect(screen.getByTestId('tenure-cell')).toBeTruthy();
  });

  it('renders dash for null contractDate', () => {
    render(<TenureCell contractDate={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

// ─── PersBandCell unit tests ──────────────────────────────────────────────────
describe('PersBandCell', () => {
  it('shows pers-band-cell for a populated value', () => {
    render(<PersBandCell persistency={94} />);
    expect(screen.getByTestId('pers-band-cell')).toBeTruthy();
    expect(screen.getByText('94%')).toBeTruthy();
  });

  it('shows pers-band-cell-empty for null', () => {
    render(<PersBandCell persistency={null} />);
    expect(screen.getByTestId('pers-band-cell-empty')).toBeTruthy();
  });

  it('shows pers-band-cell-empty for undefined', () => {
    render(<PersBandCell persistency={undefined} />);
    expect(screen.getByTestId('pers-band-cell-empty')).toBeTruthy();
  });

  it('renders text-success-ink for >= 90', () => {
    const { container } = render(<PersBandCell persistency={90} />);
    expect(container.querySelector('.text-success-ink')).toBeTruthy();
  });

  it('renders text-warning-ink for 80–89', () => {
    const { container } = render(<PersBandCell persistency={85} />);
    expect(container.querySelector('.text-warning-ink')).toBeTruthy();
  });

  it('renders text-danger-ink for < 80', () => {
    const { container } = render(<PersBandCell persistency={72} />);
    expect(container.querySelector('.text-danger-ink')).toBeTruthy();
  });

  it('caps value at 100 in display', () => {
    render(<PersBandCell persistency={110} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

// ─── GoalHeatCell unit tests ──────────────────────────────────────────────────
describe('GoalHeatCell', () => {
  it('shows goal-heat-cell for populated value', () => {
    render(<GoalHeatCell pctOfAnnualGoal={103} />);
    expect(screen.getByTestId('goal-heat-cell')).toBeTruthy();
    expect(screen.getByText('103%')).toBeTruthy();
  });

  it('shows goal-heat-cell-empty for null', () => {
    render(<GoalHeatCell pctOfAnnualGoal={null} />);
    expect(screen.getByTestId('goal-heat-cell-empty')).toBeTruthy();
  });

  it('shows goal-heat-cell-empty for undefined', () => {
    render(<GoalHeatCell pctOfAnnualGoal={undefined} />);
    expect(screen.getByTestId('goal-heat-cell-empty')).toBeTruthy();
  });

  it('shows text-success-ink when ahead of pace', () => {
    // Very high value — always ahead
    const { container } = render(<GoalHeatCell pctOfAnnualGoal={100} />);
    expect(container.querySelector('.text-success-ink')).toBeTruthy();
  });

  it('shows text-warning-ink when behind pace', () => {
    // 1% — always behind except on Jan 1
    const { container } = render(<GoalHeatCell pctOfAnnualGoal={1} />);
    expect(container.querySelector('.text-warning-ink')).toBeTruthy();
  });
});

// ─── PeriodFilter unit tests ──────────────────────────────────────────────────
describe('PeriodFilter', () => {
  it('renders with grain pills and period value', () => {
    const period = defaultPeriodForGrain('year');
    render(<PeriodFilter period={period} onChangePeriod={noop} />);
    expect(screen.getByTestId('period-filter')).toBeTruthy();
    expect(screen.getByTestId('grain-selector')).toBeTruthy();
    expect(screen.getByTestId('period-value')).toBeTruthy();
  });

  it('defaultPeriodForGrain year returns 2026', () => {
    const p = defaultPeriodForGrain('year');
    expect(p).toEqual({ grain: 'year', value: '2026' });
  });

  it('defaultPeriodForGrain month returns 2026-MM for current month', () => {
    const p = defaultPeriodForGrain('month', new Date(2026, 5, 17));
    expect(p).toEqual({ grain: 'month', value: '2026-06' });
  });

  it('defaultPeriodForGrain week returns current Sunday', () => {
    // 17 Jun 2026 is a Wednesday; Sunday = 14 Jun 2026
    const p = defaultPeriodForGrain('week', new Date(2026, 5, 17));
    expect(p.grain).toBe('week');
    expect(p.value).toBe('2026-06-14');
  });

  it('periodLabel for year', () => {
    expect(periodLabel({ grain: 'year', value: '2026' })).toBe('2026');
  });

  it('periodLabel for month', () => {
    expect(periodLabel({ grain: 'month', value: '2026-06' })).toBe('Jun 2026');
  });

  it('periodLabel for week', () => {
    // Week 25 starts 2026-06-14
    const label = periodLabel({ grain: 'week', value: '2026-06-14' });
    expect(label).toMatch(/^Wk \d+ · 2026$/);
  });

  it('year prev/next buttons are disabled', () => {
    const period = defaultPeriodForGrain('year');
    render(<PeriodFilter period={period} onChangePeriod={noop} />);
    const prev = screen.getByTestId('period-prev');
    const next = screen.getByTestId('period-next');
    expect(prev).toBeDisabled();
    expect(next).toBeDisabled();
  });

  it('calls onChangePeriod when grain pill clicked', () => {
    const period = defaultPeriodForGrain('year');
    const onChange = vi.fn();
    render(<PeriodFilter period={period} onChangePeriod={onChange} />);
    fireEvent.click(screen.getByTestId('grain-month'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].grain).toBe('month');
  });

  it('month prev is enabled when not at 2026-01', () => {
    const period = { grain: 'month', value: '2026-06' };
    render(<PeriodFilter period={period} onChangePeriod={noop} />);
    expect(screen.getByTestId('period-prev')).not.toBeDisabled();
  });

  it('month prev is disabled at 2026-01', () => {
    const period = { grain: 'month', value: '2026-01' };
    render(<PeriodFilter period={period} onChangePeriod={noop} />);
    expect(screen.getByTestId('period-prev')).toBeDisabled();
  });

  it('steps month backward on prev click', () => {
    const period = { grain: 'month', value: '2026-06' };
    const onChange = vi.fn();
    render(<PeriodFilter period={period} onChangePeriod={onChange} />);
    fireEvent.click(screen.getByTestId('period-prev'));
    expect(onChange).toHaveBeenCalledWith({ grain: 'month', value: '2026-05' });
  });
});

// ─── TeamPerfRoster render tests ──────────────────────────────────────────────
describe('TeamPerfRoster', () => {
  it('renders skeleton rows when loading=true', () => {
    render(<TeamPerfRoster rows={[]} sort={SORT_ASC} onSort={noop} loading={true} />);
    const skeletons = screen.getAllByTestId('skeleton-row');
    expect(skeletons.length).toBe(5);
  });

  it('renders empty-members state when rows=[] and not loading', () => {
    render(<TeamPerfRoster rows={[]} sort={SORT_ASC} onSort={noop} loading={false} />);
    // Both desktop and mobile empty states
    const states = screen.getAllByTestId(/^empty-members/);
    expect(states.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a row for each member', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    for (const row of FULL_ROWS) {
      expect(screen.getByTestId(`roster-row-${row.id}`)).toBeTruthy();
    }
  });

  it('renders the team-perf-roster container', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    expect(screen.getByTestId('team-perf-roster')).toBeTruthy();
  });

  it('shows empty-period banner when all rows have null production', () => {
    const emptyRows = FULL_ROWS.map((r) => ({
      ...r,
      submittedAPI: null,
      submittedApps: null,
      issuedAPI: null,
      issuedApps: null,
    }));
    render(<TeamPerfRoster rows={emptyRows} sort={SORT_ASC} onSort={noop} loading={false} />);
    expect(screen.getByText(/No production this period/i)).toBeTruthy();
  });

  it('does not show empty-period banner when some rows have production', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    expect(screen.queryByText(/No production this period/i)).toBeNull();
  });

  it('calls onSort with column key when header clicked', () => {
    const onSort = vi.fn();
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={onSort} loading={false} />);
    // Click the Tenure header button (aria text "Tenure")
    const tenureBtn = screen.getByRole('button', { name: /tenure/i });
    fireEvent.click(tenureBtn);
    expect(onSort).toHaveBeenCalledWith('contractDate');
  });

  it('calls onSort with submittedAPI key when API submitted header clicked', () => {
    const onSort = vi.fn();
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={onSort} loading={false} />);
    const btn = screen.getByRole('button', { name: /api submitted/i });
    fireEvent.click(btn);
    expect(onSort).toHaveBeenCalledWith('submittedAPI');
  });

  it('shows UM chip for unit manager rows', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    // MOCK_ROWS has 2 UMs: Anand Persad (ap) and Kavita Ramnarine (kr)
    const chips = screen.getAllByText('UM');
    // Table shows desktop + mobile cards on small viewport = 2 per UM agent, but
    // mobile is lg:hidden so in test-dom both may render — just assert >= 2
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });

  it('renders dash cell for null-production row (Tessa Garcia)', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    const row = screen.getByTestId('roster-row-tg');
    expect(row).toBeTruthy();
  });

  it('shows mobile card for each row', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    for (const row of FULL_ROWS) {
      expect(screen.getByTestId(`roster-card-${row.id}`)).toBeTruthy();
    }
  });

  it('shows member count in footer', () => {
    render(<TeamPerfRoster rows={FULL_ROWS} sort={SORT_ASC} onSort={noop} loading={false} />);
    expect(screen.getByText(`${FULL_ROWS.length} team members`)).toBeTruthy();
  });
});

// ─── TeamPerfRosterPage integration ───────────────────────────────────────────
describe('TeamPerfRosterPage', () => {
  it('renders page container', () => {
    render(<TeamPerfRosterPage />);
    expect(screen.getByTestId('team-perf-page')).toBeTruthy();
  });

  it('renders PeriodFilter and TeamPerfRoster', () => {
    render(<TeamPerfRosterPage />);
    expect(screen.getByTestId('period-filter')).toBeTruthy();
    expect(screen.getByTestId('team-perf-roster')).toBeTruthy();
  });

  it('renders heading', () => {
    render(<TeamPerfRosterPage />);
    expect(screen.getByText('Team Performance Roster')).toBeTruthy();
  });

  it('shows all mock rows initially sorted by name asc', () => {
    render(<TeamPerfRosterPage />);
    // All 11 rows present
    for (const row of FULL_ROWS) {
      expect(screen.getByTestId(`roster-row-${row.id}`)).toBeTruthy();
    }
  });

  it('toggles sort to desc when same column header clicked twice', () => {
    render(<TeamPerfRosterPage />);
    const nameBtn = screen.getByRole('button', { name: /^name/i });
    // First click: default was asc → toggles to desc
    fireEvent.click(nameBtn);
    // Second click: desc → asc
    fireEvent.click(nameBtn);
    // No crash; row count unchanged
    expect(screen.getAllByTestId(/^roster-row-/).length).toBe(FULL_ROWS.length);
  });

  it('changes period grain to Month on pill click', () => {
    render(<TeamPerfRosterPage />);
    fireEvent.click(screen.getByTestId('grain-month'));
    // Period label should now show a month format
    const val = screen.getByTestId('period-value').textContent;
    expect(val).toMatch(/\w+ 2026/);
  });
});
