/**
 * FrMoneyView (Money Overview) and FrMoneyHeaderView (the header above each
 * existing calculator) — pure views: states, layouts, navigation, What if.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import FrMoneyView from '../FrMoneyView';
import FrMoneyHeaderView from '../FrMoneyHeaderView';
import { paceModel, reinstatementPlan, moneyCards, headerTiles, persistencySeries } from '../../../../lib/fr/moneyModel';

const TODAY = '2026-09-20';
const pol = (n, status, api, dateIssued) => ({ id: n, policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life' });
const LEDGER = [
  pol('S1', 'settled', 100000, '2025-06-01'),
  pol('L1', 'lapsed', 5000, '2025-01-10'),
  pol('L2', 'lapsed', 3000, '2024-11-05'),
  pol('L4', 'lapsed', 4000, '2025-03-01'),
];
const PLAN = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
const PACE = paceModel({ settledByMonth: [{ month: '2026-09', api: 87146 }], year: 2026, currentMonth: 9, goal: 688800, isMdrt: true });

function model(over = {}) {
  return {
    pace: PACE,
    plan: PLAN,
    cards: moneyCards({ hierarchy: { companyFloor: { api: 500000, apps: 40 } }, settled: 87146, plan: PLAN, financingLabel: 'Not on financing' }),
    settled: 87146,
    goal: 688800,
    isMdrt: true,
    year: 2026,
    avgApi: 12000,
    ...over,
  };
}

describe('FrMoneyView', () => {
  it('wide: pace chart, persistency, six calculator cards and What if; no pager', () => {
    render(<FrMoneyView model={model()} wide />);
    expect(screen.getByTestId('fr-money-wide')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-money-phone')).toBeNull();
    expect(screen.getByRole('heading', { name: /behind an even pace to MDRT/ })).toBeInTheDocument();
    expect(screen.getByTestId('money-persistency-card')).toBeInTheDocument();
    for (const id of ['goals', 'gameplan', 'commission', 'moneyneeds', 'persistency', 'financing']) {
      expect(screen.getByTestId(`money-card-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('money-what-if')).toBeInTheDocument();
  });

  it('phone: swipe pages Overview · Calculators · What if', () => {
    render(<FrMoneyView model={model()} wide={false} />);
    const tabs = within(screen.getByTestId('fr-money-phone')).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Overview', 'Calculators', 'What if']);
  });

  it('a card opens its tab', () => {
    const onNavigate = vi.fn();
    render(<FrMoneyView model={model()} wide onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('money-card-commission'));
    expect(onNavigate).toHaveBeenCalledWith('commission');
    fireEvent.click(screen.getByRole('button', { name: /Plan the win-back/ }));
    expect(onNavigate).toHaveBeenCalledWith('persistency');
  });

  it('loading: skeleton with aria-busy, never TTD 0', () => {
    render(<FrMoneyView model={model({ pace: null, settled: null })} wide loading />);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText(/TTD 0\b/)).toBeNull();
  });

  it('ledger error: alert + Retry', () => {
    const onRetry = vi.fn();
    render(<FrMoneyView model={model({ pace: null })} wide error onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/did not load/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('What if: extra applications move settled API and % of MDRT live', () => {
    render(<FrMoneyView model={model()} wide />);
    fireEvent.change(screen.getByLabelText('Extra applications that settle this year'), { target: { value: '3' } });
    expect(within(screen.getByTestId('what-if-settled')).getByText('TTD 123,146')).toBeInTheDocument();
    expect(within(screen.getByTestId('what-if-goal')).getByText('17.9%')).toBeInTheDocument();
  });

  it('What if: reinstating the least-money set raises projected persistency', () => {
    render(<FrMoneyView model={model()} wide />);
    const before = within(screen.getByTestId('what-if-persistency')).getByText(/%$/).textContent;
    fireEvent.click(screen.getByLabelText(/Reinstate the least-money set/));
    const after = within(screen.getByTestId('what-if-persistency')).getByText(/%$/).textContent;
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
  });

  it('no persistency figure: says so, no fake percentage', () => {
    render(<FrMoneyView model={model({ plan: null, cards: moneyCards({}) })} wide />);
    expect(within(screen.getByTestId('money-persistency-card')).getByText('No persistency figure yet.')).toBeInTheDocument();
  });
});

describe('FrMoneyHeaderView', () => {
  it('goals: four tiles and the pace chart; the calculator is said to be below', () => {
    const tiles = headerTiles('goals', { year: 2026, settled: 87146, hierarchy: { companyFloor: { api: 500000, apps: 40 } } });
    render(<FrMoneyHeaderView tab="goals" tiles={tiles} pace={PACE} />);
    for (const id of ['settled', 'floor', 'target', 'togo']) expect(screen.getByTestId(`money-tile-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId('money-tile-target')).toHaveTextContent('Not set');
    expect(screen.getByRole('heading', { name: /even pace/ })).toBeInTheDocument();
    expect(screen.getByText(/calculator is below/)).toBeInTheDocument();
  });

  it('persistency: month bars from the gate and the reinstatement planner', () => {
    const series = persistencySeries({ records: [{ monthKey: '2026-08', persistency: 0.884 }], estimate: PLAN.estimate });
    render(<FrMoneyHeaderView tab="persistency" tiles={headerTiles('persistency', { plan: PLAN })} series={series} plan={PLAN} />);
    expect(screen.getByTestId('reinstatement-planner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /months below 90%|at or above 90%/ })).toBeInTheDocument();
  });

  it('every Money tab renders a header; unknown values are "—", never TTD 0', () => {
    for (const tab of ['game-plan', 'money-needs', 'commission', 'financing']) {
      const { unmount } = render(<FrMoneyHeaderView tab={tab} tiles={headerTiles(tab, {})} />);
      expect(screen.getByTestId(`fr-money-header-${tab}`)).toBeInTheDocument();
      expect(screen.queryByText(/TTD 0\b/)).toBeNull();
      unmount();
    }
  });
});
