// @vitest-environment jsdom
//
// D5 (commission-v2-s2) — RTL baseline for the parked expand-dependent tests.
// S3 extends with confirm-flow coverage: the "Save as My Goals" button now
// opens a confirm dialog before writing; setGoals is called only on confirm.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userProfile: { name: 'Test Agent', commissionRate: 35 },
  }),
}));
vi.mock('../../../../services/goalsService', () => ({
  setGoals: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../components/CashFlowChart', () => ({ default: () => null }));

// Suppress recharts ResizeObserver in jsdom
globalThis.ResizeObserver = class { observe() {}; unobserve() {}; disconnect() {} };

import { setGoals } from '../../../../services/goalsService';
import GoalDecompositionTab from '../tabs/GoalDecompositionTab';
import CommissionPlayground from '../index';

describe('GoalDecompositionTab — D5 parked RTL baseline', () => {
  beforeEach(() => {
    setGoals.mockClear();
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  afterEach(() => {
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  // ── Test 1: 7 ladder stages render ──────────────────────────────────────
  it('renders all 7 decomposition ladder stages', () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const stages = screen.getAllByTestId('commission-ladder-stage');
    expect(stages).toHaveLength(7);
  });

  // ── Test 2: localStorage income-goal persistence ─────────────────────────
  it('loads income goal from localStorage on mount', () => {
    localStorage.setItem('agencytrack-playground-income-goal', JSON.stringify(250000));
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const input = screen.getByLabelText(/income goal/i);
    expect(parseFloat(input.value)).toBe(250000);
  });

  // ── Test 3: tab switch via CommissionPlayground ───────────────────────────
  it('clicking Modal Targeting tab shows mode mix sliders', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    const tabBtn = screen.getByRole('tab', { name: /modal targeting/i });
    fireEvent.click(tabBtn);
    expect(screen.getByText(/mode mix/i)).toBeInTheDocument();
  });

  // ── Test 4 (S3): "Save as My Goals" opens confirm dialog, not direct write ─
  it('clicking Save as My Goals shows confirm dialog without calling setGoals', () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.getByTestId('commission-confirm-dialog')).toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });

  // ── Test 5 (S3): confirm dialog shows current and new API values ──────────
  it('confirm dialog shows current goal and new computed API', () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" currentGoal={84000} />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    const current = screen.getByTestId('commission-confirm-current');
    const newVal  = screen.getByTestId('commission-confirm-new');
    expect(current.textContent).toMatch(/84/); // 84,000 formatted
    expect(newVal.textContent).toMatch(/\d/);   // non-empty computed value
  });

  // ── Test 6 (S3): Cancel hides confirm without writing ────────────────────
  it('clicking Cancel hides confirm dialog without calling setGoals', () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.getByTestId('commission-confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('commission-confirm-cancel'));
    expect(screen.queryByTestId('commission-confirm-dialog')).not.toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });

  // ── Test 7 (S3): Confirm calls setGoals byte-shaped vs CareerPortal path ──
  it('clicking Set as my goal in confirm calls setGoals with personalAnnualAPI + apps', async () => {
    const onGoalSaved = vi.fn();
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" onGoalSaved={onGoalSaved} />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    fireEvent.click(screen.getByTestId('commission-confirm-btn'));
    await waitFor(() => expect(setGoals).toHaveBeenCalled());
    const [, , payload] = setGoals.mock.calls[0];
    expect(payload).toHaveProperty('personalAnnualAPI');
    expect(payload).toHaveProperty('personalAnnualApps');
    expect(payload.personalAnnualAPI).toBeGreaterThan(0);
    expect(onGoalSaved).toHaveBeenCalled();
  });

  // ── Test 8 (S3): guard rail — zero income goal does not open confirm ───────
  it('guard rail: income goal of 0 does not open confirm dialog', () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    // Drive income to 0 so decomposeFromIncome returns apiToWrite = 0
    const input = screen.getByLabelText(/income goal/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.queryByTestId('commission-confirm-dialog')).not.toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });
});
