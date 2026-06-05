// @vitest-environment jsdom
//
// D5 (commission-v2-s2) — RTL baseline for the parked expand-dependent tests.
// These were parked in S1 because GoalDecompositionTab and ModalTargetingTab
// lacked `import React from 'react'`, blocking Vitest mounting. D5 adds the
// import to both files; these 4 tests are the complement.
//
// CashFlowChart is mocked to avoid recharts / ResizeObserver in jsdom.

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

  // ── Test 4: setGoals write path ───────────────────────────────────────────
  it('clicking Save as My Goals calls setGoals with personalAnnualAPI', async () => {
    render(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    fireEvent.click(screen.getByRole('button', { name: /save as my goals/i }));
    await waitFor(() => expect(setGoals).toHaveBeenCalled());
    const [, , payload] = setGoals.mock.calls[0];
    expect(payload).toHaveProperty('personalAnnualAPI');
    expect(payload).toHaveProperty('personalAnnualApps');
    expect(payload.personalAnnualAPI).toBeGreaterThan(0);
  });
});
