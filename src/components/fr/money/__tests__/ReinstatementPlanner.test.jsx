/**
 * ReinstatementPlanner — Kyron ruling 28-09-2026:
 *   1. both presets, "Fewest calls" and "Least money";
 *   2. a lapse that stops counting soon is flagged "Stops counting after
 *      <Mon YYYY>", in its row and in the summary line of a preset holding it;
 *   3. any mix can be ticked; running total vs the gap and the projected %.
 * Read-only: no control writes anything.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import ReinstatementPlanner from '../ReinstatementPlanner';
import { reinstatementPlan } from '../../../../lib/fr/moneyModel';

const TODAY = '2026-09-20';
const pol = (n, status, api, dateIssued, extra = {}) => ({ id: n, policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life', ...extra });
const LEDGER = [
  pol('S1', 'settled', 100000, '2025-06-01'),
  pol('L1', 'lapsed', 5000, '2025-01-10', { ownerName: '[Client A]' }),
  pol('L2', 'lapsed', 3000, '2024-11-05'),
  pol('L4', 'lapsed', 4000, '2025-03-01'),
];
const PLAN = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });

describe('ReinstatementPlanner', () => {
  it('shows the gap and BOTH presets', () => {
    render(<ReinstatementPlanner plan={PLAN} />);
    expect(screen.getByRole('heading', { name: /reinstated clears the 90% gate/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('planner-preset-fewest')).getByText('Fewest calls')).toBeInTheDocument();
    expect(within(screen.getByTestId('planner-preset-money')).getByText('Least money')).toBeInTheDocument();
  });

  it('flags the policy that stops counting soon, in its row and in a preset that holds it', () => {
    render(<ReinstatementPlanner plan={PLAN} />);
    expect(within(screen.getByTestId('planner-row-L2')).getByText('Stops counting after Oct 2026')).toBeInTheDocument();
    expect(within(screen.getByTestId('planner-row-L1')).queryByText(/Stops counting/)).toBeNull();
    for (const [id, preset] of [['fewest', PLAN.presets.fewestCalls], ['money', PLAN.presets.leastMoney]]) {
      const holdsL2 = preset.items.some((l) => l.policyNumber === 'L2');
      const line = within(screen.getByTestId(`planner-preset-${id}`)).queryByText(/stops counting after Oct 2026/);
      expect(Boolean(line)).toBe(holdsL2);
    }
  });

  it('ticking any mix updates the running total against the gap and the projected %', () => {
    render(<ReinstatementPlanner plan={PLAN} />);
    const total = screen.getByTestId('planner-running-total');
    expect(within(total).getByText(/Tick policies, or pick a preset/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /\[Client A\]/ }));
    expect(within(total).getByText(/Ticked: 1 policy/)).toBeInTheDocument();
    expect(within(total).getByText(/TTD 5,000\.00/)).toBeInTheDocument();
    expect(within(total).getByText(/%$/)).toBeInTheDocument();
  });

  it('a preset ticks exactly its policies and reads as pressed', () => {
    render(<ReinstatementPlanner plan={PLAN} />);
    const btn = screen.getByTestId('planner-preset-money');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    const want = new Set(PLAN.presets.leastMoney.items.map((l) => l.policyNumber));
    for (const l of PLAN.lapses) {
      const box = within(screen.getByTestId(`planner-row-${l.policyNumber}`)).getByRole('checkbox');
      expect(box.checked).toBe(want.has(l.policyNumber));
    }
    expect(within(screen.getByTestId('planner-running-total')).getByText(/Clears the 90% gate/)).toBeInTheDocument();
  });

  it('gate met: no presets, the list still shows', () => {
    const met = reinstatementPlan({ policies: LEDGER.filter((p) => p.policyNumber !== 'L1' && p.policyNumber !== 'L4'), todayTT: TODAY });
    render(<ReinstatementPlanner plan={met} />);
    expect(screen.queryByTestId('planner-preset-fewest')).toBeNull();
    expect(screen.getByRole('heading', { name: /at or above the 90% gate/ })).toBeInTheDocument();
  });

  it('no plan: says why, no fake figures', () => {
    render(<ReinstatementPlanner plan={null} />);
    expect(screen.getByText(/No persistency figure yet/)).toBeInTheDocument();
    expect(screen.queryByText(/TTD 0/)).toBeNull();
  });

  it('is read-only: the only controls are checkboxes, presets and the Why? disclosure', () => {
    render(<ReinstatementPlanner plan={PLAN} />);
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('data-testid'));
    expect(buttons.sort()).toEqual(['planner-preset-fewest', 'planner-preset-money']);
  });
});
