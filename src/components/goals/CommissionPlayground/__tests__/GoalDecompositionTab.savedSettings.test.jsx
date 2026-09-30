// @vitest-environment jsdom
//
// R2-3b (ruling 3, 29-09-2026) — the playground loads its saved assumptions
// when it opens. Order: defaults → saved → Money Needs hand-off (once) →
// history ratios for the ratios the agent did not save.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { name: 'Test Agent', commissionRate: 35 } }),
}));
const goalsMock = vi.hoisted(() => ({ setGoals: vi.fn(), getGoals: vi.fn() }));
vi.mock('../../../../services/goalsService', () => ({
  setGoals: (...a) => goalsMock.setGoals(...a),
  getGoals: (...a) => goalsMock.getGoals(...a),
}));
vi.mock('../components/CashFlowChart', () => ({ default: () => null }));
const prefsMock = vi.hoisted(() => ({ getUserPrefs: vi.fn(), setCommissionScenarios: vi.fn() }));
vi.mock('../../../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => prefsMock.getUserPrefs(...a),
  setCommissionScenarios: (...a) => prefsMock.setCommissionScenarios(...a),
  COMMISSION_SCENARIO_CAP: 6,
}));

import GoalDecompositionTab from '../tabs/GoalDecompositionTab';
import { savedPlaygroundSettings } from '../../../../utils/playgroundSettings';

const HANDOFF = 'agencytrack-playground-income-goal';
const PROPS = { submissions: [], agentId: 'a1', tenantId: 't1' };

async function open(props = {}) {
  render(<GoalDecompositionTab {...PROPS} {...props} />);
  await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
}
const val = (label) => screen.getByLabelText(label).value;
const set = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(v) } });
const FIELDS = [
  ['Tax Rate (%)', 20], ['Renewal Income (TTD)', 15000], ['Settlement Rate (%)', 75], ['Commission Rate (%)', 40],
  ['Avg Policy API (TTD)', 9000], ['Persistency Rate (%)', 85], ['CIs per Sale', 3], ['Calls per CI', 4], ['Prospects per Call', 1.5],
];

beforeEach(() => {
  localStorage.removeItem(HANDOFF);
  goalsMock.setGoals.mockReset().mockResolvedValue(undefined);
  goalsMock.getGoals.mockReset().mockResolvedValue(null);
  prefsMock.getUserPrefs.mockReset().mockResolvedValue(null);
  prefsMock.setCommissionScenarios.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); localStorage.removeItem(HANDOFF); });

describe('R2-3b — saved assumptions load back', () => {
  it('save → reopen: every saved value, the period and the settlement rate come back', async () => {
    await open();
    fireEvent.change(screen.getByTestId('income-goal-period'), { target: { value: 'weekly' } });
    set('Income Goal (TTD)', 7000);
    for (const [label, v] of FIELDS) set(label, v);
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    const saved = goalsMock.setGoals.mock.calls[0][2];
    cleanup();

    goalsMock.getGoals.mockResolvedValue(saved);
    await open();
    expect(goalsMock.getGoals).toHaveBeenLastCalledWith('t1', 'a1');
    expect(screen.getByTestId('income-goal-period').value).toBe('weekly');
    expect(val('Income Goal (TTD)')).toBe('7000');
    for (const [label, v] of FIELDS) expect(val(label), label).toBe(String(v));
  });

  it('a saved scenario replaces the values on screen without writing; reopening shows the saved settings', async () => {
    goalsMock.getGoals.mockResolvedValue({ playgroundIncomeGoal: 240000, playgroundIncomeGoalPeriod: 'monthly', playgroundSettlementRate: 70 });
    prefsMock.getUserPrefs.mockResolvedValue({
      commissionScenarios: [{ id: 'sc-1', label: 'Stretch', savedAt: '2026-09-01T00:00:00.000Z', freqKey: 'annual', inputs: { incomeGoal: 500000, settlementRate: 95 } }],
    });
    await open();
    expect(val('Income Goal (TTD)')).toBe('24000');
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-1'));
    expect(val('Income Goal (TTD)')).toBe('500000');
    expect(screen.getByTestId('income-goal-period').value).toBe('annual'); // scenarios load as Annual
    expect(val('Settlement Rate (%)')).toBe('95');
    expect(goalsMock.setGoals).not.toHaveBeenCalled();
    cleanup();
    await open();
    expect(val('Income Goal (TTD)')).toBe('24000');
    expect(val('Settlement Rate (%)')).toBe('70');
  });

  it('missing keys keep today\'s defaults; a failed read keeps all defaults', async () => {
    goalsMock.getGoals.mockResolvedValue({ playgroundSettlementRate: 70, playgroundIncomeGoalPeriod: 'fortnightly' });
    await open();
    expect(val('Settlement Rate (%)')).toBe('70');
    expect(val('Tax Rate (%)')).toBe('25');
    expect(val('Income Goal (TTD)')).toBe('300000');
    expect(screen.getByTestId('income-goal-period').value).toBe('annual');
    cleanup();
    goalsMock.getGoals.mockRejectedValue(new Error('offline'));
    await open();
    expect(val('Settlement Rate (%)')).toBe('90');
  });

  it('the Money Needs hand-off wins once over the saved income goal, then is removed', async () => {
    goalsMock.getGoals.mockResolvedValue({ playgroundIncomeGoal: 240000, playgroundIncomeGoalPeriod: 'monthly', playgroundTaxRate: 20 });
    localStorage.setItem(HANDOFF, JSON.stringify({ value: 180000, preTaxAlreadyApplied: true }));
    await open();
    expect(val('Income Goal (TTD)')).toBe('180000');
    expect(screen.getByTestId('income-goal-period').value).toBe('annual');
    expect(val('Tax Rate (%)')).toBe('20');
    expect(localStorage.getItem(HANDOFF)).toBeNull();
    cleanup();
    await open();
    expect(val('Income Goal (TTD)')).toBe('24000');
  });

  it('a saved ratio beats the history-derived ratio; an unsaved one still comes from history', async () => {
    const history = Array.from({ length: 10 }, () => ({
      status: 'submitted', ciConducted: 4, applicationsSold: 1, referralCalls: 6, followUpCalls: 2, coldCalls: 2, seminarTradeshowCalls: 0,
    }));
    goalsMock.getGoals.mockResolvedValue({ playgroundCiToSaleRatio: 1.5 });
    await open({ submissions: history });
    expect(val('CIs per Sale')).toBe('1.5');
    expect(val('Calls per CI')).toBe('2.5'); // (6 + 2 + 2) ÷ 4 from history
  });

  it('savedPlaygroundSettings maps the goals doc back and ignores non-numbers', () => {
    expect(savedPlaygroundSettings({ playgroundIncomeGoal: 430000, playgroundIncomeGoalPeriod: 'weekly', playgroundTaxRate: '25' }))
      .toEqual({ inputs: { incomeGoal: 430000 }, period: 'weekly', amount: 10000, preTaxAlreadyApplied: false });
    expect(savedPlaygroundSettings(null)).toEqual({ inputs: {}, period: 'annual', amount: null, preTaxAlreadyApplied: false });
    // A+ (30-09-2026): only a stored `true` counts.
    expect(savedPlaygroundSettings({ playgroundPreTaxAlreadyApplied: true }).preTaxAlreadyApplied).toBe(true);
    expect(savedPlaygroundSettings({ playgroundPreTaxAlreadyApplied: 'true' }).preTaxAlreadyApplied).toBe(false);
  });
});

describe('R2-3b review fixes (CodeRabbit on #1029)', () => {
  it('a malformed hand-off does not hold the tab on loading, and is removed', async () => {
    localStorage.setItem(HANDOFF, '{not json');
    await open();
    expect(val('Income Goal (TTD)')).toBe('300000');
    expect(localStorage.getItem(HANDOFF)).toBeNull();
  });

  it('a new target starts from the defaults, not from the previous target\'s values', async () => {
    goalsMock.getGoals.mockImplementation((_t, agentId) => Promise.resolve(
      agentId === 'a1' ? { playgroundSettlementRate: 70, playgroundIncomeGoal: 240000, playgroundIncomeGoalPeriod: 'monthly' } : {},
    ));
    const { rerender } = render(<GoalDecompositionTab {...PROPS} />);
    await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
    expect(val('Settlement Rate (%)')).toBe('70');
    rerender(<GoalDecompositionTab {...PROPS} agentId="a2" />);
    await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
    await waitFor(() => expect(val('Settlement Rate (%)')).toBe('90'));
    expect(val('Income Goal (TTD)')).toBe('300000');
    expect(screen.getByTestId('income-goal-period').value).toBe('annual');
  });

  it('"From your history" labels only the ratios history actually filled', async () => {
    const history = Array.from({ length: 10 }, () => ({
      status: 'submitted', ciConducted: 4, applicationsSold: 1, referralCalls: 6, followUpCalls: 2, coldCalls: 2, seminarTradeshowCalls: 0,
    }));
    goalsMock.getGoals.mockResolvedValue({ playgroundCiToSaleRatio: 1.5 });
    await open({ submissions: history });
    const label = (text) => screen.getByText(text, { selector: 'label' }).parentElement;
    await waitFor(() => expect(label('Calls per CI').textContent).toContain('From your history'));
    expect(label('CIs per Sale').textContent).not.toContain('From your history');
  });

  // A+ (Kyron, 30-09-2026): the pre-tax flag is saved with the assumptions.
  it('a goal sent from Money Needs and saved comes back pre-tax — not grossed up for tax again', async () => {
    const ladder = () => screen.getAllByTestId('commission-ladder-stage').map((el) => el.textContent);
    localStorage.setItem(HANDOFF, JSON.stringify({ value: 180000, preTaxAlreadyApplied: true }));
    await open();
    const sentLadder = ladder();
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    const saved = goalsMock.setGoals.mock.calls[0][2];
    expect(saved.playgroundPreTaxAlreadyApplied).toBe(true);
    cleanup();
    goalsMock.getGoals.mockResolvedValue(saved);
    await open();
    expect(localStorage.getItem(HANDOFF)).toBeNull();
    expect(val('Income Goal (TTD)')).toBe('180000');
    expect(ladder()).toEqual(sentLadder);
  });

  it('a typed goal saves the flag as false, and editing the tax rate after a hand-off clears it', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    expect(goalsMock.setGoals.mock.calls[0][2].playgroundPreTaxAlreadyApplied).toBe(false);
    cleanup();
    goalsMock.setGoals.mockClear();
    goalsMock.getGoals.mockResolvedValue({ playgroundIncomeGoal: 180000, playgroundPreTaxAlreadyApplied: true });
    await open();
    set('Tax Rate (%)', 20);
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    expect(goalsMock.setGoals.mock.calls[0][2].playgroundPreTaxAlreadyApplied).toBe(false);
  });

  // CodeRabbit on #1029 (review of 004e7af4).
  it('applying a scenario clears a restored pre-tax flag (scenarios carry none)', async () => {
    goalsMock.getGoals.mockResolvedValue({ playgroundIncomeGoal: 180000, playgroundPreTaxAlreadyApplied: true });
    prefsMock.getUserPrefs.mockResolvedValue({
      commissionScenarios: [{ id: 'sc-1', label: 'Stretch', savedAt: '2026-09-01T00:00:00.000Z', freqKey: 'annual', inputs: { incomeGoal: 500000 } }],
    });
    await open();
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    expect(goalsMock.setGoals.mock.calls[0][2]).toMatchObject({ playgroundIncomeGoal: 500000, playgroundPreTaxAlreadyApplied: false });
  });

  it('ratios saved in this session are not overwritten by a later history update', async () => {
    const wk = (calls) => ({ status: 'submitted', ciConducted: 4, applicationsSold: 1, referralCalls: calls, followUpCalls: 0, coldCalls: 0 });
    const r = render(<GoalDecompositionTab {...PROPS} submissions={Array.from({ length: 10 }, () => wk(10))} />);
    await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
    expect(val('Calls per CI')).toBe('2.5');
    set('Calls per CI', 7);
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(goalsMock.setGoals).toHaveBeenCalledTimes(1));
    r.rerender(<GoalDecompositionTab {...PROPS} submissions={Array.from({ length: 10 }, () => wk(20))} />);
    expect(val('Calls per CI')).toBe('7');
    expect(screen.queryByText('From your history')).toBeNull();
  });
});
