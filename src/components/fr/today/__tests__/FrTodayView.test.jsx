/**
 * FrTodayView — structure, states and handlers of the pure FR Today view.
 * The view renders ONE layout, picked by `wide`; tests render each explicitly
 * (wide = ≥768 grid, !wide = phone SwipePager).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import FrTodayView from '../FrTodayView';
import { buildTodayModel } from '../../../../lib/fr/todayModel';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../../utils/weeklyActivityFloors';

const PRODUCTION = {
  year: 2026,
  settled: { api: 87146.28, apps: 5, count: 5, fromHeadOffice: 3, selfConfirmed: 2 },
  submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: true, weekApi: 0 },
  pending: { api: 36000, apps: 1, count: 1 },
  weekly: { ytdApi: 0, weekApi: 0 },
  mismatch: { ytd: 0, week: 0 },
};

function makeModel(over = {}) {
  return buildTodayModel({
    production: PRODUCTION,
    floors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS },
    actuals: { source: 'daily', values: { callsMade: null, telContacts: 22, factFindsCompleted: 3 } },
    weekStart: '2026-09-27',
    doNextItems: [{ id: 'confirm', title: 'Confirm settled policies', sub: '2 waiting', tone: 'teal', target: 'ledger-confirm' }],
    persistencyNow: { pct: 86.6, monthKey: '2026-10', kind: 'estimate' },
    settledByMonth: [{ month: '2026-09', api: 87146.28 }],
    todayTT: '2026-10-01',
    hourTT: 9,
    displayName: 'Kyron Marchan',
    ...over,
  });
}

/**
 * Renders ONE layout (`wide` defaults to true = the ≥768 grid). Returns the
 * rendered layout root as `root`, plus `desktop` / `phone` aliases (null when
 * that layout is not the one rendered).
 */
function setup(props = {}) {
  const onAction = vi.fn();
  const onNavigate = vi.fn();
  const onRetry = vi.fn();
  const wide = props.wide ?? true;
  const utils = render(
    <FrTodayView
      model={props.model ?? makeModel()}
      onAction={onAction}
      onNavigate={onNavigate}
      onRetry={onRetry}
      {...props}
      wide={wide}
    />,
  );
  const desktop = screen.queryByTestId('fr-today-desktop');
  const phone = screen.queryByTestId('fr-today-phone');
  return { ...utils, onAction, onNavigate, onRetry, desktop, phone, root: wide ? desktop : phone };
}

describe('FrTodayView — one layout at a time', () => {
  it('wide: the grid only — no pager, no phone branch', () => {
    const { desktop, phone } = setup({ wide: true });
    expect(desktop).toBeInTheDocument();
    expect(phone).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('not wide: the phone swipe pages only, named Today / Week / Money / Campaign', () => {
    const { desktop, phone } = setup({ wide: false });
    expect(desktop).toBeNull();
    expect(within(phone).getByRole('tablist', { name: 'Today pages' })).toBeInTheDocument();
    expect(within(phone).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Today', 'Week', 'Money', 'Campaign']);
  });

  it('greeting is an h2 (the TopBar owns the h1) with the TT date line, in both layouts', () => {
    for (const wide of [true, false]) {
      const { unmount } = setup({ wide });
      expect(screen.getByRole('heading', { level: 2, name: 'Morning, Kyron' })).toBeInTheDocument();
      expect(screen.getByText('Thursday 01-10-2026 · week 40')).toBeInTheDocument();
      unmount();
    }
  });

  it('sections are named as on the canvas, each with an h2', () => {
    const { desktop } = setup();
    for (const name of ['Am I on track', 'Waiting on you', 'Week 40 so far', 'Coach', 'Settled API by month', 'Your 2026 production']) {
      const section = within(desktop).getByRole('region', { name });
      expect(within(section).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    }
  });

  it('every slot mounts exactly once, in either layout', () => {
    const slots = {
      campaign: <p>campaign-slot</p>, points: <p>points-slot</p>, recent: <p>recent-slot</p>,
      delivery: <p>delivery-slot</p>, banner: <p>banner-slot</p>, nudge: <p>nudge-slot</p>,
      reconciliation: <p>recon-slot</p>,
    };
    for (const wide of [true, false]) {
      const { unmount } = setup({ slots, wide });
      for (const t of ['campaign-slot', 'points-slot', 'recent-slot', 'delivery-slot', 'recon-slot', 'banner-slot', 'nudge-slot']) {
        expect(screen.getAllByText(t), `${t} (wide=${wide})`).toHaveLength(1);
      }
      unmount();
    }
  });
});

describe('FrTodayView — data', () => {
  it('tiles show the real figures (final value exposed to screen readers)', () => {
    const { desktop } = setup();
    expect(within(desktop).getByTestId('today-tile-settled-value')).toHaveTextContent('TTD 87,146');
    expect(within(desktop).getByTestId('today-tile-waiting-value')).toHaveTextContent('TTD 36,000');
    expect(within(desktop).getByTestId('today-tile-goal-value')).toHaveTextContent('13%');
    expect(within(desktop).getByTestId('today-tile-persistency-value')).toHaveTextContent('86.6%');
    expect(within(desktop).getByText('Oct 2026 estimate · below the 90% gate')).toBeInTheDocument();
  });

  it('hero: takeaway title, figures, provenance, "Log a policy" → ledger-create', () => {
    const { desktop, onAction } = setup();
    const hero = within(desktop).getByTestId('today-hero');
    expect(within(hero).getByRole('heading', { name: 'TTD 87,146 settled — 13% of MDRT' })).toBeInTheDocument();
    expect(within(hero).getByTestId('today-hero-submitted-api')).toHaveTextContent('TTD 123,146');
    expect(within(hero).getByText('Dated by issue')).toBeInTheDocument();
    expect(within(hero).getByTestId('today-hero-provenance')).toHaveTextContent('3 from head office · 2 self-confirmed');
    expect(within(hero).getByRole('img', { name: /Settled API 2026: TTD 87,146, target MDRT 688,800/ })).toBeInTheDocument();
    fireEvent.click(within(hero).getByRole('button', { name: /Log a policy/ }));
    expect(onAction).toHaveBeenCalledWith('ledger-create');
  });

  it('an unknown week figure shows "—", a known one its value', () => {
    const { desktop } = setup();
    expect(within(desktop).getByTestId('today-meter-callsMade')).toHaveTextContent('—');
    expect(within(desktop).getByTestId('today-meter-callsMade')).toHaveTextContent('not captured yet');
    expect(within(desktop).getByTestId('today-meter-factFindsCompleted')).toHaveTextContent('3');
    expect(within(desktop).getByTestId('today-meter-factFindsCompleted')).toHaveTextContent('Behind');
  });

  it('tile click navigates to its existing route', () => {
    const { desktop, onNavigate } = setup();
    fireEvent.click(within(desktop).getByTestId('today-tile-persistency'));
    expect(onNavigate).toHaveBeenCalledWith('persistency');
    fireEvent.click(within(desktop).getByTestId('today-tile-settled'));
    expect(onNavigate).toHaveBeenCalledWith('policy-ledger');
  });

  it('waiting rows call onAction with their target, submit first', () => {
    const { desktop, onAction } = setup();
    const rows = within(within(desktop).getByTestId('today-waiting')).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Submit your weekly report');
    fireEvent.click(rows[0]);
    fireEvent.click(within(desktop).getByTestId('today-waiting-confirm'));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['submit', 'ledger-confirm']);
  });

  it('coach actions call onAction with the line target', () => {
    const { desktop, onAction } = setup();
    const coach = within(desktop).getByTestId('today-coach');
    fireEvent.click(within(coach).getByRole('button', { name: 'Open game plan' }));
    fireEvent.click(within(coach).getByRole('button', { name: 'See persistency' }));
    fireEvent.click(within(coach).getByRole('button', { name: 'Log today' }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['game-plan', 'persistency', 'daily-log']);
  });

  it('week "Details" opens the standard drawer', () => {
    const { desktop, onAction } = setup();
    fireEvent.click(within(desktop).getByRole('button', { name: 'Details' }));
    expect(onAction).toHaveBeenCalledWith('standard-details');
  });

  it('phone: Submit / Log buttons, waiting rows and coach actions fire their actions', () => {
    const { phone, onAction } = setup({ wide: false });
    const actions = within(phone).getByTestId('today-actions');
    fireEvent.click(within(actions).getByRole('button', { name: /Submit report/ }));
    fireEvent.click(within(actions).getByRole('button', { name: /Log today/ }));
    fireEvent.click(within(phone).getByTestId('today-waiting-confirm'));
    // The coach lives on the Week page; inactive pages are hidden from the a11y tree.
    expect(within(phone).queryByRole('button', { name: 'Open game plan' })).toBeNull();
    fireEvent.click(within(phone).getByRole('tab', { name: 'Week' }));
    fireEvent.click(within(phone).getByRole('button', { name: 'Open game plan' }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['submit', 'log-today', 'ledger-confirm', 'game-plan']);
  });

  it('monthly chart: takeaway title and a Table toggle', () => {
    const { desktop } = setup();
    const monthly = within(desktop).getByTestId('today-monthly');
    expect(within(monthly).getByRole('heading', { name: 'Best month so far: September, TTD 87,146' })).toBeInTheDocument();
    fireEvent.click(within(monthly).getByRole('button', { name: 'Table' }));
    expect(within(monthly).getByRole('table')).toBeInTheDocument();
  });

  it('nothing to say → coach says so; nothing waiting → on-track line', () => {
    const model = makeModel({
      production: null, pending: true, persistencyNow: { pct: 95, monthKey: '2026-10', kind: 'estimate' }, doNextItems: [],
      currentWeekSub: { status: 'submitted' }, actuals: { source: 'final', values: {} },
    });
    const { desktop } = setup({ model, loading: true });
    expect(within(desktop).getByTestId('today-coach-empty')).toBeInTheDocument();
    expect(within(desktop).getByTestId('today-waiting-clear')).toBeInTheDocument();
  });
});

describe('FrTodayView — loading and error (never zeros)', () => {
  it('loading: hero + monthly skeletons are aria-busy and no TTD 0 appears', () => {
    const model = makeModel({ production: null, pending: true });
    const { desktop, container } = setup({ model, loading: true });
    expect(within(desktop).getByTestId('today-hero-loading')).toHaveAttribute('aria-busy', 'true');
    expect(within(desktop).getByTestId('today-monthly-loading')).toHaveAttribute('aria-busy', 'true');
    expect(container.textContent).not.toMatch(/TTD 0\b/);
    expect(within(desktop).queryByTestId('today-tile-settled-value')).toBeNull();
    // Persistency now comes from the ledger too: skeleton, never a stale record.
    expect(within(desktop).getByTestId('today-tile-persistency')).toBeInTheDocument();
    expect(within(desktop).queryByTestId('today-tile-persistency-value')).toBeNull();
  });

  it('phone layout: loading shows the hero skeleton and no TTD 0 either', () => {
    const model = makeModel({ production: null, pending: true });
    const { phone, container } = setup({ model, loading: true, wide: false });
    expect(within(phone).getByTestId('today-hero-loading')).toHaveAttribute('aria-busy', 'true');
    expect(container.textContent).not.toMatch(/TTD 0\b/);
  });

  it('week loading and do-next loading show skeletons', () => {
    const model = makeModel({ weekLoading: true, doNextLoading: true });
    const { desktop } = setup({ model });
    expect(within(desktop).getByTestId('today-week-loading')).toHaveAttribute('aria-busy', 'true');
    expect(within(desktop).getByTestId('today-waiting-loading')).toHaveAttribute('aria-busy', 'true');
    expect(within(desktop).queryByRole('button', { name: 'Details' })).toBeNull();
  });

  it('ledger error: inline alert with Retry, tiles show "—", waiting flags incomplete', () => {
    const model = makeModel({ production: null, error: true });
    const { desktop, onRetry, container } = setup({ model, error: true });
    const alert = within(desktop).getByTestId('today-hero-error');
    expect(alert).toHaveAttribute('role', 'alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(within(desktop).getByTestId('today-tile-settled-value')).toHaveTextContent('—');
    expect(within(desktop).getByTestId('today-waiting-incomplete')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/TTD 0\b/);
  });

  it('week error: alert, no meters', () => {
    const model = makeModel({ weekError: true });
    const { desktop } = setup({ model });
    expect(within(desktop).getByTestId('today-week-error')).toHaveAttribute('role', 'alert');
    expect(within(desktop).queryByTestId('today-meters')).toBeNull();
  });
});
