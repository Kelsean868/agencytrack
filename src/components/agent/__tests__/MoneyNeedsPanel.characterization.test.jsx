// @vitest-environment jsdom
/**
 * Money needs — CHARACTERIZATION suite (R2-9 commit 1, brief
 * docs/briefs/fr-round2-program.md § R2-7/R2-8/R2-9).
 *
 * Pins today's computed outputs and write arguments of MoneyNeedsPanel (the
 * default look) BEFORE the FR visual port. It must pass UNCHANGED after the
 * port; any assertion edit is a STOP (brief §3).
 *
 * Money needs has no tabs, period chips or saved scenarios (those belong to the
 * Commission playground, R2-7). Its equivalents are pinned here: the year
 * switch, the empty/start state, every expense group, the three
 * sub-calculators, the PAYE build-up, the commission targets, every save
 * action, and the hand-off to the Commission playground (localStorage payload)
 * with its onward navigation to the Game plan.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { makeWorksheet, ROLLUP, YEAR, TENANT, UID } from './moneyNeedsCharFixtures';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));

const mockGetMoneyNeeds = vi.fn();
const mockCreateMoneyNeeds = vi.fn();
const mockUpdateSubCalc = vi.fn();
const mockUpdateExpenseGroup = vi.fn();
const mockUpdateVisibility = vi.fn();
const mockUpdateCommission = vi.fn();
const mockRefreshPAYE = vi.fn();

// Pure helpers stay real; only the async I/O is stubbed (to capture arguments).
vi.mock('../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getMoneyNeeds: (...a) => mockGetMoneyNeeds(...a),
    createMoneyNeeds: (...a) => mockCreateMoneyNeeds(...a),
    updateSubCalculator: (...a) => mockUpdateSubCalc(...a),
    updateExpenseGroup: (...a) => mockUpdateExpenseGroup(...a),
    updateVisibility: (...a) => mockUpdateVisibility(...a),
    updateCommissionTargets: (...a) => mockUpdateCommission(...a),
    refreshPAYECalculation: (...a) => mockRefreshPAYE(...a),
  };
});

import MoneyNeedsPanel from '../MoneyNeedsPanel';

const KEY = 'agencytrack-playground-income-goal';

async function renderLoaded(ws = makeWorksheet(), props = {}) {
  mockGetMoneyNeeds.mockResolvedValue(ws);
  const utils = render(<MoneyNeedsPanel {...props} />);
  await screen.findByRole('button', { name: /Business Expenses/i });
  return { ws, ...utils };
}

const groupButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`, 'i') });
const openGroup = (name) => fireEvent.click(groupButton(name));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateExpenseGroup.mockResolvedValue(ROLLUP);
  mockUpdateVisibility.mockResolvedValue(undefined);
  mockRefreshPAYE.mockResolvedValue(ROLLUP);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Money needs characterization — load, year, empty state', () => {
  it('loads the current year for the signed-in agent', async () => {
    await renderLoaded();
    expect(mockGetMoneyNeeds).toHaveBeenCalledTimes(1);
    expect(mockGetMoneyNeeds).toHaveBeenCalledWith(TENANT, UID, YEAR);
  });

  it('the year select offers last, this and next year and reloads on change', async () => {
    await renderLoaded();
    const select = screen.getByRole('combobox', { name: 'Select year' });
    expect(within(select).getAllByRole('option').map((o) => o.value)).toEqual([
      String(YEAR - 1), String(YEAR), String(YEAR + 1),
    ]);
    mockGetMoneyNeeds.mockResolvedValue(null);
    fireEvent.change(select, { target: { value: String(YEAR + 1) } });
    await screen.findByText(`No ${YEAR + 1} worksheet yet`);
    expect(mockGetMoneyNeeds).toHaveBeenLastCalledWith(TENANT, UID, YEAR + 1);
  });

  it('empty state: Start creates the worksheet for the selected year', async () => {
    mockGetMoneyNeeds.mockResolvedValue(null);
    mockCreateMoneyNeeds.mockResolvedValue(makeWorksheet());
    render(<MoneyNeedsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: `Start ${YEAR} worksheet` }));
    expect(mockCreateMoneyNeeds).toHaveBeenCalledWith(TENANT, UID, YEAR);
    await screen.findByRole('button', { name: /Fixed Expenses/i });
  });

  it('load failure shows the retry copy', async () => {
    mockGetMoneyNeeds.mockRejectedValue(new Error('offline'));
    render(<MoneyNeedsPanel />);
    expect(await screen.findByText('Could not load worksheet. Check your connection and try again.')).toBeInTheDocument();
  });
});

describe('Money needs characterization — printed figures', () => {
  it('worksheet-wide filled tally', async () => {
    await renderLoaded();
    expect(screen.getByTestId('money-needs-filled-counter').textContent).toBe('Filled 10/11');
  });

  it('every group header: filled count and yearly subtotal', async () => {
    await renderLoaded();
    const expected = [
      ['Fixed Expenses', '2 of 2 filled', 'TTD 64,200 / yr'],
      ['Living Expenses', '2 of 2 filled', 'TTD 31,198 / yr'],
      ['Business Expenses', '3 of 3 filled', 'TTD 11,902 / yr'],
      ['Savings & Accumulation', '2 of 2 filled', 'TTD 5,400 / yr'],
      ['Miscellaneous', '1 of 2 filled', 'TTD 2,400 / yr'],
    ];
    for (const [label, count, total] of expected) {
      const text = groupButton(label).textContent;
      expect(text).toContain(count);
      expect(text).toContain(total);
    }
  });

  it('open group rows: manual lines print their yearly figure; calc-fed lines their state', async () => {
    await renderLoaded();
    openGroup('Fixed Expenses');
    expect(screen.getByDisplayValue('Rent or mortgage payments')).toBeInTheDocument();
    expect(screen.getByText('TTD 54,000 / yr')).toBeInTheDocument();
    expect(screen.getByText('TTD 10,200 / yr')).toBeInTheDocument();

    openGroup('Savings & Accumulation');
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Debt reduction (non-mortgage) to calculator value' })).toBeInTheDocument();
    expect(screen.getByText('TTD 1,200 / yr')).toBeInTheDocument();
  });

  it('where the money goes: one chip per funded group with its whole-number share', async () => {
    await renderLoaded();
    const chips = ['fixedExpenses', 'livingExpenses', 'businessExpenses', 'savingsAccumulation', 'miscellaneous']
      .map((k) => screen.getByTestId(`mn-composition-chip-${k}`).textContent);
    expect(chips).toEqual([
      'Fixed Expenses56%',
      'Living Expenses27%',
      'Business Expenses10%',
      'Savings & Accumulation5%',
      'Miscellaneous2%',
    ]);
  });

  it('budget total and the PAYE build-up', async () => {
    await renderLoaded();
    expect(screen.getByTestId('budget-total-line').textContent).toBe('Total annual budgetTTD 115,100');
    expect(screen.getByText('After-tax take-home (= your annual budget)').nextSibling.textContent).toBe('TTD 115,100');
    expect(screen.getByText('+ PAYE').nextSibling.textContent).toBe('+ TTD 8,366.67');
    expect(screen.getByText('= Income you must earn').nextSibling.textContent).toBe('TTD 123,466.67');
    expect(screen.getByText('− Renewal income').nextSibling.textContent).toBe('− TTD 10,000');
    expect(screen.getByText('1st-year commissions required').parentElement.nextSibling.textContent).toBe('TTD 113,466.67');
  });

  it('commission targets: required figure, per-line inputs and total', async () => {
    await renderLoaded();
    expect(screen.getByText('Required 1st-Year Commissions').nextSibling.textContent).toBe('TTD 113,466.67');
    expect(screen.getByText('Estimated Renewal Income').nextSibling.textContent).toBe('− TTD 10,000');
    expect(screen.getByRole('spinbutton', { name: 'Life commission target' }).value).toBe('60000');
    expect(screen.getByRole('spinbutton', { name: 'A&H commission target' }).value).toBe('20000');
    expect(screen.getByRole('spinbutton', { name: 'Property commission target' }).value).toBe('');
    expect(screen.getByRole('spinbutton', { name: 'Motor commission target' }).value).toBe('');
    expect(screen.getByText('Total').nextSibling.textContent).toBe('TTD 80,000');
  });

  it('sub-calculator Done footers print the stored totals', async () => {
    await renderLoaded();
    openGroup('Living Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Open Car expenses, nonbusiness calculator' }));
    const car = screen.getByRole('dialog', { name: 'Car Expenses' });
    expect(within(car).getByText('Personal (33.3%):', { exact: false }).textContent).toContain('TTD 2,398');
    expect(within(car).getByText('Business (66.7%):', { exact: false }).textContent).toContain('TTD 4,802');
    expect(within(car).getByText('Car loan (from Loans & Debt):', { exact: false }).textContent).toContain('TTD 1,800');
    expect(within(car).getByText('Annual total').parentElement.textContent).toContain('TTD 2,398personal');
    expect(within(car).getByText('Annual total').parentElement.textContent).toContain('TTD 4,802business');
    fireEvent.click(within(car).getByRole('button', { name: /Done — use this figure/ }));
    expect(screen.queryByRole('dialog')).toBeNull();

    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Open Professional/industry expenses calculator' }));
    const ii = screen.getByRole('dialog', { name: 'Insurance Industry Expenses' });
    expect(within(ii).getByText('Annual total').parentElement.textContent).toContain('TTD 3,500/ yr');
  });
});

describe('Money needs characterization — save actions (exact arguments)', () => {
  it('editing a manual amount saves the whole group on blur', async () => {
    const { ws } = await renderLoaded();
    openGroup('Fixed Expenses');
    const utilities = screen.getAllByRole('spinbutton', { name: 'Expense amount' })[1];
    fireEvent.change(utilities, { target: { value: '900' } });
    fireEvent.blur(utilities);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const updatedGroup = {
      lineItems: [
        { ...ws.expenseGroups.fixedExpenses.lineItems[0] },
        { ...ws.expenseGroups.fixedExpenses.lineItems[1], amount: 900, annualizedAmount: 10800 },
      ],
      subCalculatorRefs: [],
      groupAnnualTotal: 64800,
    };
    expect(mockUpdateExpenseGroup).toHaveBeenCalledWith(
      TENANT, UID, YEAR, 'fixedExpenses', updatedGroup,
      { ...ws.expenseGroups, fixedExpenses: updatedGroup },
    );
  });

  it('changing a frequency saves immediately', async () => {
    const { ws } = await renderLoaded();
    openGroup('Miscellaneous');
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Frequency' })[1], { target: { value: 'Q' } });
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const [, , , key, group] = mockUpdateExpenseGroup.mock.calls[0];
    expect(key).toBe('miscellaneous');
    expect(group.lineItems[1]).toEqual({ ...ws.expenseGroups.miscellaneous.lineItems[1], frequency: 'Q', amount: 0, annualizedAmount: 0 });
    expect(group.groupAnnualTotal).toBe(2400);
  });

  it('Add item appends an empty monthly custom line and saves', async () => {
    await renderLoaded();
    openGroup('Miscellaneous');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const group = mockUpdateExpenseGroup.mock.calls[0][4];
    expect(group.lineItems).toHaveLength(3);
    expect(group.lineItems[2]).toEqual({
      id: expect.any(String), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true,
    });
    expect(group.groupAnnualTotal).toBe(2400);
  });

  it('Delete removes the line and saves', async () => {
    await renderLoaded();
    openGroup('Miscellaneous');
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete expense' })[1]);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const group = mockUpdateExpenseGroup.mock.calls[0][4];
    expect(group.lineItems.map((i) => i.id)).toEqual(['seed-mi-0']);
  });

  it('editing a calc-fed amount marks it overridden; Reset re-syncs it to the calculator', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    const industry = screen.getByRole('spinbutton', { name: 'Professional/industry expenses amount' });
    fireEvent.change(industry, { target: { value: '4000' } });
    fireEvent.blur(industry);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const edited = mockUpdateExpenseGroup.mock.calls[0][4].lineItems[2];
    expect(edited).toMatchObject({ id: 'seed-be-7', amount: 4000, annualizedAmount: 4000, isOverridden: true });

    openGroup('Savings & Accumulation');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Debt reduction (non-mortgage) to calculator value' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(2));
    const [, , , key, group] = mockUpdateExpenseGroup.mock.calls[1];
    expect(key).toBe('savingsAccumulation');
    expect(group.lineItems[1]).toMatchObject({ id: 'seed-sa-2', amount: 1800, frequency: 'A', annualizedAmount: 1800, isOverridden: false });
    expect(group.groupAnnualTotal).toBe(6000);
  });

  it('a failed group save shows the connection message', async () => {
    mockUpdateExpenseGroup.mockRejectedValue(new Error('offline'));
    await renderLoaded();
    openGroup('Fixed Expenses');
    fireEvent.blur(screen.getAllByRole('spinbutton', { name: 'Expense amount' })[0]);
    expect(await screen.findByText('Save failed — check connection.')).toBeInTheDocument();
  });

  it('Insurance Industry calculator saves its lines and total', async () => {
    const { ws } = await renderLoaded();
    mockUpdateSubCalc.mockResolvedValue({ rollup: ROLLUP, updatedGroups: {} });
    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Open Professional/industry expenses calculator' }));
    const dlg = screen.getByRole('dialog', { name: 'Insurance Industry Expenses' });
    const amount = within(dlg).getAllByRole('spinbutton', { name: 'Expense amount' })[1];
    fireEvent.change(amount, { target: { value: '3200' } });
    fireEvent.blur(amount);
    await waitFor(() => expect(mockUpdateSubCalc).toHaveBeenCalledTimes(1));
    expect(mockUpdateSubCalc).toHaveBeenCalledWith(TENANT, UID, YEAR, 'insuranceIndustry', {
      lineItems: [
        ws.subCalculators.insuranceIndustry.lineItems[0],
        { ...ws.subCalculators.insuranceIndustry.lineItems[1], amount: 3200, annualizedAmount: 3200 },
      ],
      annualTotal: 3700,
    }, ws);
  });

  it('Car Expenses calculator saves the 33.3 / 66.7 split', async () => {
    const { ws } = await renderLoaded();
    mockUpdateSubCalc.mockResolvedValue({ rollup: ROLLUP, updatedGroups: {} });
    openGroup('Living Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Open Car expenses, nonbusiness calculator' }));
    const dlg = screen.getByRole('dialog', { name: 'Car Expenses' });
    const amount = within(dlg).getByRole('spinbutton', { name: 'Expense amount' });
    fireEvent.change(amount, { target: { value: '700' } });
    fireEvent.blur(amount);
    await waitFor(() => expect(mockUpdateSubCalc).toHaveBeenCalledTimes(1));
    expect(mockUpdateSubCalc).toHaveBeenCalledWith(TENANT, UID, YEAR, 'carExpenses', {
      lineItems: [{ ...ws.subCalculators.carExpenses.lineItems[0], amount: 700, annualizedAmount: 8400 }],
      withLoan: false,
      personalSharePct: 33.3,
      businessSharePct: 66.7,
      annualTotalPersonal: 2797,
      annualTotalBusiness: 5603,
    }, ws);
  });

  it('Loans & Debt calculator: Add item saves an empty monthly line', async () => {
    const { ws } = await renderLoaded();
    mockUpdateSubCalc.mockResolvedValue({ rollup: ROLLUP, updatedGroups: {} });
    openGroup('Savings & Accumulation');
    fireEvent.click(screen.getByRole('button', { name: 'Open Debt reduction (non-mortgage) calculator' }));
    const dlg = screen.getByRole('dialog', { name: 'Loans & Debt' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(mockUpdateSubCalc).toHaveBeenCalledTimes(1));
    expect(mockUpdateSubCalc).toHaveBeenCalledWith(TENANT, UID, YEAR, 'loansDebt', {
      lineItems: [
        ws.subCalculators.loansDebt.lineItems[0],
        { id: expect.any(String), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true },
      ],
      annualTotal: 1800,
    }, ws);
  });

  it('share toggle writes the visibility', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Share with my Unit Manager and Branch Manager' }));
    await waitFor(() => expect(mockUpdateVisibility).toHaveBeenCalledWith(TENANT, UID, YEAR, 'shared'));
  });

  it('commission targets save on blur with the typed values', async () => {
    const { ws } = await renderLoaded();
    mockUpdateCommission.mockResolvedValue({
      firstYearCommissionsRequired: 113466.67,
      firstYearCommissionsTargets: { life: 65000, ah: 20000, property: 0, motor: 0 },
    });
    const life = screen.getByRole('spinbutton', { name: 'Life commission target' });
    fireEvent.change(life, { target: { value: '65000' } });
    fireEvent.blur(life);
    await waitFor(() => expect(mockUpdateCommission).toHaveBeenCalledTimes(1));
    expect(mockUpdateCommission).toHaveBeenCalledWith(
      TENANT, UID, YEAR, { life: '65000', ah: 20000, property: 0, motor: 0 }, ws,
    );
  });

  it('an outdated PAYE bracket version offers a refresh that re-runs the rollup', async () => {
    const ws = makeWorksheet({ payeBracketsVersionId: 'default-2025' });
    await renderLoaded(ws);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh PAYE Calculation' }));
    await waitFor(() => expect(mockRefreshPAYE).toHaveBeenCalledWith(TENANT, UID, YEAR, ws.expenseGroups));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Refresh PAYE Calculation' })).toBeNull());
  });
});

describe('Money needs characterization — hand-off to the Commission playground', () => {
  it('Send to Playground writes the required commission, then offers the Game plan', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const onOpenTab = vi.fn();
    await renderLoaded(makeWorksheet(), { onOpenTab });
    fireEvent.click(screen.getByRole('button', { name: 'Send to Playground' }));
    expect(setItem).toHaveBeenCalledWith(KEY, JSON.stringify({ value: 113466.66666666667, preTaxAlreadyApplied: true }));
    const ack = screen.getByRole('dialog', { name: 'Target sent' });
    expect(within(ack).getByText('Saved to your Commission Playground')).toBeInTheDocument();
    fireEvent.click(within(ack).getByRole('button', { name: 'Continue to Game Plan →' }));
    expect(onOpenTab).toHaveBeenCalledWith('game-plan');
    expect(screen.queryByRole('dialog', { name: 'Target sent' })).toBeNull();
  });

  it('Send to Playground is disabled while nothing is required', async () => {
    await renderLoaded(makeWorksheet({ totalAnnualPreTax: 10000, estimatedRenewalIncome: { total: 10000 } }));
    expect(screen.getByRole('button', { name: 'Send to Playground' })).toBeDisabled();
  });
});
