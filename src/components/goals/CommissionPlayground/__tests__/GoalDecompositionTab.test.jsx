// @vitest-environment jsdom
//
// D5 (commission-v2-s2) — RTL baseline for the parked expand-dependent tests.
// S3 extends with confirm-flow coverage: the "Save as My Goals" button now
// opens a confirm dialog before writing; setGoals is called only on confirm.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userProfile: { name: 'Test Agent', commissionRate: 35 },
  }),
}));
vi.mock('../../../../services/goalsService', () => ({
  setGoals: vi.fn().mockResolvedValue(undefined),
  // R2-3b: the tab reads the saved assumptions on open (none saved here).
  getGoals: vi.fn().mockResolvedValue(null),
}));
vi.mock('../components/CashFlowChart', () => ({ default: () => null }));

// R-06 scenario chips: control the prefs round-trip so the optimistic-update
// ROLLBACK and the hydration RACE can be exercised deterministically.
// Defaults MUST be promise-returning: the tab calls getUserPrefs().then() on
// mount, so a bare vi.fn() (undefined) throws during render and takes every
// unrelated test in this file down with it.
const prefsMock = vi.hoisted(() => ({
  getUserPrefs: vi.fn(() => Promise.resolve(null)),
  setCommissionScenarios: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => prefsMock.getUserPrefs(...a),
  setCommissionScenarios: (...a) => prefsMock.setCommissionScenarios(...a),
  COMMISSION_SCENARIO_CAP: 6,
}));

// Suppress recharts ResizeObserver in jsdom
globalThis.ResizeObserver = class { observe() {}; unobserve() {}; disconnect() {} };

import { setGoals } from '../../../../services/goalsService';
import GoalDecompositionTab from '../tabs/GoalDecompositionTab';
import CommissionPlayground from '../index';

// R2-3b: the inputs render once the saved assumptions have loaded.
async function renderReady(ui) {
  const r = render(ui);
  await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
  return r;
}

describe('GoalDecompositionTab — D5 parked RTL baseline', () => {
  beforeEach(() => {
    setGoals.mockClear();
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  afterEach(() => {
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  // ── Test 1: 7 ladder stages render ──────────────────────────────────────
  it('renders all 7 decomposition ladder stages', async () => {
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const stages = screen.getAllByTestId('commission-ladder-stage');
    expect(stages).toHaveLength(7);
  });

  // ── Test 2: localStorage income-goal persistence ─────────────────────────
  it('loads income goal from localStorage on mount', async () => {
    localStorage.setItem('agencytrack-playground-income-goal', JSON.stringify(250000));
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const input = screen.getByLabelText(/income goal/i);
    expect(parseFloat(input.value)).toBe(250000);
  });

  // ── Test 3: tab switch via CommissionPlayground ───────────────────────────
  it('clicking Modal Targeting tab shows mode mix sliders', async () => {
    await renderReady(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    const tabBtn = screen.getByRole('tab', { name: /modal targeting/i });
    fireEvent.click(tabBtn);
    expect(screen.getByText(/mode mix/i)).toBeInTheDocument();
  });

  // ── Test 4 (S3): "Save as My Goals" opens confirm dialog, not direct write ─
  it('clicking Save as My Goals shows confirm dialog without calling setGoals', async () => {
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.getByTestId('commission-confirm-dialog')).toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });

  // ── Test 5 (S3): confirm dialog shows current and new API values ──────────
  it('confirm dialog shows current goal and new computed API', async () => {
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" currentGoal={84000} />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    const current = screen.getByTestId('commission-confirm-current');
    const newVal  = screen.getByTestId('commission-confirm-new');
    expect(current.textContent).toMatch(/84/); // 84,000 formatted
    expect(newVal.textContent).toMatch(/\d/);   // non-empty computed value
  });

  // ── Test 6 (S3): Cancel hides confirm without writing ────────────────────
  it('clicking Cancel hides confirm dialog without calling setGoals', async () => {
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.getByTestId('commission-confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('commission-confirm-cancel'));
    expect(screen.queryByTestId('commission-confirm-dialog')).not.toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });

  // ── Test 7 (S3): Confirm calls setGoals byte-shaped vs CareerPortal path ──
  it('clicking Set as my goal in confirm calls setGoals with personalAnnualAPI + apps', async () => {
    const onGoalSaved = vi.fn();
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" onGoalSaved={onGoalSaved} />);
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
  it('guard rail: income goal of 0 does not open confirm dialog', async () => {
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    // Drive income to 0 so decomposeFromIncome returns apiToWrite = 0
    const input = screen.getByLabelText(/income goal/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.queryByTestId('commission-confirm-dialog')).not.toBeInTheDocument();
    expect(setGoals).not.toHaveBeenCalled();
  });

  // ── Test 9: backward-compat — bare number localStorage ──────────────────
  it('backward-compat: bare number in localStorage loads incomeGoal without preTaxAlreadyApplied', async () => {
    localStorage.setItem('agencytrack-playground-income-goal', JSON.stringify(840000));
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const input = screen.getByLabelText(/income goal/i);
    expect(parseFloat(input.value)).toBe(840000);
    // No flag → normal gross-up applies; the confirm button is available (apiToWrite > 0).
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(screen.getByTestId('commission-confirm-dialog')).toBeInTheDocument();
  });

  // ── Test 10: new object shape sets incomeGoal + preTaxAlreadyApplied ────
  it('new object shape {value, preTaxAlreadyApplied:true} loads correct incomeGoal', async () => {
    localStorage.setItem(
      'agencytrack-playground-income-goal',
      JSON.stringify({ value: 1090000, preTaxAlreadyApplied: true }),
    );
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const input = screen.getByLabelText(/income goal/i);
    expect(parseFloat(input.value)).toBe(1090000);
  });

  // ── Test 11: manual incomeGoal edit clears preTaxAlreadyApplied ─────────
  it('manually editing Income Goal clears the preTaxAlreadyApplied flag (confirm opens, apiToWrite reflects normal gross-up)', async () => {
    localStorage.setItem(
      'agencytrack-playground-income-goal',
      JSON.stringify({ value: 1090000, preTaxAlreadyApplied: true }),
    );
    await renderReady(<GoalDecompositionTab submissions={[]} agentId="a" tenantId="t" />);
    const input = screen.getByLabelText(/income goal/i);
    // Manually override the field — flag must clear.
    fireEvent.change(input, { target: { value: '900000' } });
    expect(parseFloat(input.value)).toBe(900000);
    // Confirm dialog opens and shows a non-zero computed API (normal gross-up now active).
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    const dialog = screen.getByTestId('commission-confirm-dialog');
    expect(dialog).toBeInTheDocument();
    const newVal = screen.getByTestId('commission-confirm-new');
    // Normal gross-up: 900k / (1-0.25) = 1,200,000 pre-tax → apiToWrite > 0.
    expect(parseFloat(newVal.textContent.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0);
  });
});

// ── R-06 scenario chips: the two correctness fixes from CodeRabbit #870 ──────
describe('GoalDecompositionTab — R-06 scenario persistence', () => {
  const TAB_PROPS = { submissions: [], agentId: 'a1', tenantId: 't1' };

  beforeEach(() => {
    prefsMock.getUserPrefs.mockReset();
    prefsMock.setCommissionScenarios.mockReset();
  });

  it('ROLLS BACK the optimistic chip when the write fails (UI must not claim a save that never landed)', async () => {
    prefsMock.getUserPrefs.mockResolvedValue({ commissionScenarios: [] });
    prefsMock.setCommissionScenarios.mockRejectedValue(new Error('offline'));

    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('scenario-chips')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('scenario-save-open'));
    fireEvent.change(screen.getByTestId('scenario-name-input'), { target: { value: 'Doomed' } });
    fireEvent.click(screen.getByTestId('scenario-save-confirm'));

    // It appears optimistically, then the failed write must remove it again.
    await waitFor(() => expect(prefsMock.setCommissionScenarios).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByText('Doomed')).toBeNull();
      expect(screen.getByTestId('scenario-chips-empty')).toBeInTheDocument();
    });
  });

  it('does NOT let a slow prefs hydration clobber a scenario saved before it resolved', async () => {
    // getUserPrefs resolves LATE and with stale (empty) server state.
    let resolveHydration;
    prefsMock.getUserPrefs.mockReturnValue(new Promise((res) => { resolveHydration = res; }));
    prefsMock.setCommissionScenarios.mockResolvedValue();

    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('scenario-chips')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('scenario-save-open'));
    fireEvent.change(screen.getByTestId('scenario-name-input'), { target: { value: 'Survivor' } });
    fireEvent.click(screen.getByTestId('scenario-save-confirm'));
    await waitFor(() => expect(screen.getByText('Survivor')).toBeInTheDocument());

    // NOW the stale hydration lands — pre-fix this wiped the just-saved chip.
    resolveHydration({ commissionScenarios: [] });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('Survivor')).toBeInTheDocument();
  });
});

// ── FR round 2 R2-3: the income goal's period ────────────────────────────────
//
// The agent types an amount and picks its period; the playground turns it into
// the ANNUAL income goal (amount × divisor) that every reader already uses. The
// ladder's view-cadence chips then divide that annual figure back for display.
describe('GoalDecompositionTab — R2-3 income goal period', () => {
  const TAB_PROPS = { submissions: [], agentId: 'a1', tenantId: 't1' };
  const headStage = () => screen.getAllByTestId('commission-ladder-stage')[0].textContent;
  const chip = (name) => within(screen.getByRole('group', { name: /view cadence/i })).getByRole('button', { name });
  const enter = (amount, period) => {
    fireEvent.change(screen.getByLabelText(/income goal \(ttd\)/i), { target: { value: String(amount) } });
    fireEvent.change(screen.getByLabelText(/goal period/i), { target: { value: period } });
  };

  beforeEach(() => {
    setGoals.mockClear();
    prefsMock.getUserPrefs.mockReset();
    prefsMock.getUserPrefs.mockResolvedValue(null);
    prefsMock.setCommissionScenarios.mockReset();
    prefsMock.setCommissionScenarios.mockResolvedValue();
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  it('defaults to Annual — the typed amount IS the annual goal', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    expect(screen.getByLabelText(/goal period/i).value).toBe('annual');
    expect(headStage()).toContain('TTD 300,000');
    expect(screen.getByTestId('income-goal-conversion').textContent).toBe('TTD 300,000 a year');
  });

  it('TTD 50,000 a month → annual TTD 500,000, and the Month chip shows TTD 50,000', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(50000, 'monthly');
    expect(screen.getByTestId('income-goal-conversion').textContent)
      .toBe('TTD 50,000 a month × 10 selling months = TTD 500,000 a year');
    expect(headStage()).toContain('TTD 500,000');   // Annual chip (default view)
    fireEvent.click(chip('Month'));
    expect(headStage()).toContain('TTD 50,000');
    expect(headStage()).not.toContain('TTD 500,000');
  });

  it('changing the period keeps the typed amount and re-derives the annual goal', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(50000, 'annual');
    expect(headStage()).toContain('TTD 50,000');
    fireEvent.change(screen.getByLabelText(/goal period/i), { target: { value: 'monthly' } });
    expect(parseFloat(screen.getByLabelText(/income goal \(ttd\)/i).value)).toBe(50000);
    expect(headStage()).toContain('TTD 500,000');
  });

  it('weekly round-trip: TTD 1,000 a week → TTD 43,000 a year → Week chip shows TTD 1,000', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(1000, 'weekly');
    expect(screen.getByTestId('income-goal-conversion').textContent)
      .toBe('TTD 1,000 a week × 43 selling weeks = TTD 43,000 a year');
    expect(headStage()).toContain('TTD 43,000');
    fireEvent.click(chip('Week'));
    expect(headStage()).toContain('TTD 1,000');
  });

  it('daily round-trip: TTD 200 a day → TTD 51,600 a year → Day chip shows TTD 200', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(200, 'daily');
    expect(screen.getByTestId('income-goal-conversion').textContent)
      .toBe('TTD 200 a day × 258 selling days = TTD 51,600 a year');
    expect(headStage()).toContain('TTD 51,600');
    fireEvent.click(chip('Day'));
    expect(headStage()).toContain('TTD 200');
  });

  it('Save Assumptions sends the ANNUAL goal, its period and the settlement rate', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(50000, 'monthly');
    fireEvent.click(screen.getByRole('button', { name: /save assumptions/i }));
    await waitFor(() => expect(setGoals).toHaveBeenCalled());
    const [, , payload] = setGoals.mock.calls[0];
    expect(payload.playgroundIncomeGoal).toBe(500000);
    expect(payload.playgroundIncomeGoalPeriod).toBe('monthly');
    expect(payload.playgroundSettlementRate).toBe(90);
  });

  it('a saved scenario stores the annual goal and loads back as Annual with that same value', async () => {
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('scenario-chips')).toBeInTheDocument());
    enter(50000, 'monthly');
    fireEvent.click(screen.getByTestId('scenario-save-open'));
    fireEvent.change(screen.getByTestId('scenario-name-input'), { target: { value: 'Month plan' } });
    fireEvent.click(screen.getByTestId('scenario-save-confirm'));
    await waitFor(() => expect(prefsMock.setCommissionScenarios).toHaveBeenCalled());
    const saved = prefsMock.setCommissionScenarios.mock.calls[0][2][0];
    expect(saved.inputs.incomeGoal).toBe(500000);

    // Reload: a fresh mount hydrates that scenario; applying it restores the
    // same annual goal (scenarios carry no period — they load as Annual).
    cleanup();
    prefsMock.getUserPrefs.mockResolvedValue({ commissionScenarios: [saved] });
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    fireEvent.click(await screen.findByText('Month plan'));
    expect(screen.getByLabelText(/goal period/i).value).toBe('annual');
    expect(parseFloat(screen.getByLabelText(/income goal \(ttd\)/i).value)).toBe(500000);
    expect(headStage()).toContain('TTD 500,000');
  });

  it('an old scenario with no period (annual value) applies as Annual', async () => {
    prefsMock.getUserPrefs.mockResolvedValue({
      commissionScenarios: [{ id: 'sc-old', label: 'Old one', savedAt: '2026-01-01T00:00:00.000Z', freqKey: 'annual', inputs: { incomeGoal: 420000 } }],
    });
    await renderReady(<GoalDecompositionTab {...TAB_PROPS} />);
    enter(1000, 'weekly');
    fireEvent.click(await screen.findByText('Old one'));
    expect(screen.getByLabelText(/goal period/i).value).toBe('annual');
    expect(headStage()).toContain('TTD 420,000');
  });
});
