// @vitest-environment jsdom
/**
 * R2-9 — FR Money needs port. The FR look must print the SAME figures and send
 * the SAME service arguments as the Nexus panel (pinned by
 * MoneyNeedsPanel.characterization.test.jsx), from the same fixtures.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { makeWorksheet, ROLLUP, YEAR, TENANT, UID } from '../../../agent/__tests__/moneyNeedsCharFixtures';
import {
  payeWhy, moneyNeedsLadder, moneyNeedsDonut, moneyNeedsSubCalcs, moneyNeedsRow, FR_FREQUENCIES, groupShort,
} from '../moneyNeedsModel';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));

const mockGetMoneyNeeds = vi.fn();
const mockUpdateSubCalc = vi.fn();
const mockUpdateExpenseGroup = vi.fn();
const mockUpdateVisibility = vi.fn();
const mockUpdateCommission = vi.fn();
const mockRefreshPAYE = vi.fn();

vi.mock('../../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getMoneyNeeds: (...a) => mockGetMoneyNeeds(...a),
    updateSubCalculator: (...a) => mockUpdateSubCalc(...a),
    updateExpenseGroup: (...a) => mockUpdateExpenseGroup(...a),
    updateVisibility: (...a) => mockUpdateVisibility(...a),
    updateCommissionTargets: (...a) => mockUpdateCommission(...a),
    refreshPAYECalculation: (...a) => mockRefreshPAYE(...a),
  };
});

import MoneyNeedsPanel from '../../../agent/MoneyNeedsPanel';

const KEY = 'agencytrack-playground-income-goal';
let viewportWidth = 1440;
const realMatchMedia = window.matchMedia;

function stubViewport(width) {
  viewportWidth = width;
  window.matchMedia = (q) => {
    const m = /min-width:\s*(\d+)px/.exec(q);
    return {
      matches: m ? viewportWidth >= Number(m[1]) : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };
}

async function renderFr(ws = makeWorksheet(), props = {}) {
  mockGetMoneyNeeds.mockResolvedValue(ws);
  const utils = render(<MoneyNeedsPanel look="fr" {...props} />);
  await screen.findByTestId('fr-money-needs');
  return { ws, ...utils };
}

const groupButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`, 'i') });
const openGroup = (name) => fireEvent.click(groupButton(name));

beforeEach(() => {
  vi.clearAllMocks();
  stubViewport(1440);
  mockUpdateExpenseGroup.mockResolvedValue(ROLLUP);
  mockUpdateVisibility.mockResolvedValue(undefined);
  mockRefreshPAYE.mockResolvedValue(ROLLUP);
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

describe('FR Money needs — look switch', () => {
  it('look="fr" renders the FR layout in place of the Nexus worksheet', async () => {
    await renderFr();
    expect(screen.getByTestId('fr-money-needs').dataset.layout).toBe('desktop');
    expect(screen.queryByText('Money Needs Worksheet')).toBeNull();
    expect(screen.queryByTestId('mn-composition')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Your money needs roll-up' })).toBeInTheDocument();
  });

  it('no look prop keeps the Nexus panel', async () => {
    mockGetMoneyNeeds.mockResolvedValue(makeWorksheet());
    render(<MoneyNeedsPanel />);
    await screen.findByText('Money Needs Worksheet');
    expect(screen.queryByTestId('fr-money-needs')).toBeNull();
  });

  it('tablet width: one column, inspector inline', async () => {
    stubViewport(900);
    await renderFr();
    expect(screen.getByTestId('fr-money-needs').dataset.layout).toBe('tablet');
  });

  it('phone width: five group pages in a pager, each group mounted once, no collapse', async () => {
    stubViewport(390);
    await renderFr();
    expect(screen.getByTestId('fr-money-needs').dataset.layout).toBe('phone');
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Fixed', 'Living', 'Business', 'Savings', 'Misc']);
    for (const k of ['fixedExpenses', 'livingExpenses', 'businessExpenses', 'savingsAccumulation', 'miscellaneous']) {
      expect(screen.getAllByTestId(`fr-mn-group-${k}`)).toHaveLength(1);
    }
    expect(screen.queryByRole('button', { name: /^Fixed Expenses/ })).toBeNull();
  });

  it('empty state and year select still work under FR', async () => {
    mockGetMoneyNeeds.mockResolvedValue(null);
    render(<MoneyNeedsPanel look="fr" />);
    expect(await screen.findByText(`No ${YEAR} worksheet yet`)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Select year' }), { target: { value: String(YEAR - 1) } });
    await waitFor(() => expect(mockGetMoneyNeeds).toHaveBeenLastCalledWith(TENANT, UID, YEAR - 1));
  });
});

describe('FR Money needs — same figures as the Nexus panel', () => {
  it('tally, group headers and worksheet total', async () => {
    await renderFr();
    expect(screen.getByTestId('fr-mn-tally').textContent).toBe('10 of 11 filled');
    const expected = [
      ['Fixed Expenses', '2 of 2 filled', 'TTD 64,200'],
      ['Living Expenses', '2 of 2 filled', 'TTD 31,198'],
      ['Business Expenses', '3 of 3 filled', 'TTD 11,902'],
      ['Savings & Accumulation', '2 of 2 filled', 'TTD 5,400'],
      ['Miscellaneous', '1 of 2 filled', 'TTD 2,400'],
    ];
    for (const [label, count, total] of expected) {
      const text = groupButton(label).textContent;
      expect(text).toContain(count);
      expect(text).toContain(total);
    }
    expect(screen.getByTestId('fr-mn-worksheet-total').textContent).toContain('TTD 115,100 a year');
  });

  it('the inspector ladder prints the PAYE build-up figures', async () => {
    await renderFr();
    const v = (id) => screen.getByTestId(`fr-mn-ladder-${id}`).textContent;
    expect(v('afterTax')).toContain('TTD 115,100');
    expect(v('paye')).toContain('+ TTD 8,366.67');
    expect(v('preTax')).toContain('TTD 123,466.67');
    expect(v('renewals')).toContain('− TTD 10,000');
    expect(v('commission')).toContain('TTD 113,466.67');
    fireEvent.click(within(screen.getByTestId('fr-mn-ladder-paye')).getByRole('button', { name: 'Why?' }));
    expect(v('paye')).toContain('Personal allowance TTD 90,000, tax-free.');
  });

  it('where the money goes: the table shows the same shares as the Nexus chips', async () => {
    await renderFr();
    const card = screen.getByTestId('fr-mn-donut');
    expect(within(card).getByText('Fixed Expenses is your biggest group — 56% of the year')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Table' }));
    const rows = within(card).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual([
      'Fixed ExpensesTTD 64,20056%',
      'Living ExpensesTTD 31,19827%',
      'Business ExpensesTTD 11,90210%',
      'Savings & AccumulationTTD 5,4005%',
      'MiscellaneousTTD 2,4002%',
    ]);
  });

  it('sub-calculator cards print the stored totals and split', async () => {
    await renderFr();
    expect(screen.getByTestId('fr-mn-subcalc-insuranceIndustry').textContent).toContain('TTD 3,500');
    expect(screen.getByTestId('fr-mn-subcalc-insuranceIndustry').textContent).toContain('2 of 2');
    const car = screen.getByTestId('fr-mn-subcalc-carExpenses').textContent;
    expect(car).toContain('Personal · 33.3%TTD 2,398');
    expect(car).toContain('Business · 66.7%TTD 4,802');
    expect(screen.getByTestId('fr-mn-subcalc-loansDebt').textContent).toContain('TTD 1,800');
  });

  it('open group rows print the same yearly figures', async () => {
    await renderFr();
    openGroup('Fixed Expenses');
    expect(screen.getByTestId('fr-mn-row-seed-fe-0').textContent).toContain('TTD 54,000');
    expect(screen.getByTestId('fr-mn-row-seed-fe-1').textContent).toContain('TTD 10,200');
    openGroup('Savings & Accumulation');
    expect(screen.getByTestId('fr-mn-row-seed-sa-2').textContent).toContain('Edited');
    expect(screen.getByTestId('fr-mn-row-seed-sa-2').textContent).toContain('TTD 1,200');
  });
});

describe('FR Money needs — same writes as the Nexus panel', () => {
  it('manual amount + blur → identical updateExpenseGroup arguments', async () => {
    const { ws } = await renderFr();
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

  it('a frequency button saves at once, like the Nexus select', async () => {
    const { ws } = await renderFr();
    openGroup('Miscellaneous');
    const freq = within(screen.getByTestId('fr-mn-row-seed-mi-2')).getByRole('group');
    expect(within(freq).getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(freq).getByRole('button', { name: 'Quarterly' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    const [, , , key, group] = mockUpdateExpenseGroup.mock.calls[0];
    expect(key).toBe('miscellaneous');
    expect(group.lineItems[1]).toEqual({ ...ws.expenseGroups.miscellaneous.lineItems[1], frequency: 'Q', amount: 0, annualizedAmount: 0 });
    expect(group.groupAnnualTotal).toBe(2400);
  });

  it('Add a line / Delete → the same line payloads', async () => {
    await renderFr();
    openGroup('Miscellaneous');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    expect(mockUpdateExpenseGroup.mock.calls[0][4].lineItems[2]).toEqual({
      id: expect.any(String), label: '', amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true,
    });
    fireEvent.click(within(screen.getByTestId('fr-mn-row-seed-mi-2')).getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(2));
    expect(mockUpdateExpenseGroup.mock.calls[1][4].lineItems.map((i) => i.id)).toEqual(['seed-mi-0', expect.any(String)]);
  });

  it('calc-fed override and Reset → the same payloads', async () => {
    await renderFr();
    openGroup('Business Expenses');
    const industry = screen.getByRole('spinbutton', { name: 'Professional/industry expenses amount' });
    fireEvent.change(industry, { target: { value: '4000' } });
    fireEvent.blur(industry);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(1));
    expect(mockUpdateExpenseGroup.mock.calls[0][4].lineItems[2]).toMatchObject({ id: 'seed-be-7', amount: 4000, annualizedAmount: 4000, isOverridden: true });

    openGroup('Savings & Accumulation');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Debt reduction (non-mortgage) to calculator value' }));
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalledTimes(2));
    const [, , , key, group] = mockUpdateExpenseGroup.mock.calls[1];
    expect(key).toBe('savingsAccumulation');
    expect(group.lineItems[1]).toMatchObject({ id: 'seed-sa-2', amount: 1800, frequency: 'A', annualizedAmount: 1800, isOverridden: false });
    expect(group.groupAnnualTotal).toBe(6000);
  });

  it('Adjust amounts opens the same sub-calculator modal and saves the same payload', async () => {
    const { ws } = await renderFr();
    mockUpdateSubCalc.mockResolvedValue({ rollup: ROLLUP, updatedGroups: {} });
    fireEvent.click(within(screen.getByTestId('fr-mn-subcalc-insuranceIndustry')).getByRole('button', { name: /Adjust amounts/ }));
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
    fireEvent.click(within(dlg).getByRole('button', { name: /Done — use this figure/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a row calculator button opens the car modal (calcKey → carExpenses)', async () => {
    await renderFr();
    openGroup('Living Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Open Car expenses, nonbusiness calculator' }));
    expect(screen.getByRole('dialog', { name: 'Car Expenses' })).toBeInTheDocument();
  });

  it('share toggle, commission targets and PAYE refresh write the same arguments', async () => {
    const ws = makeWorksheet({ payeBracketsVersionId: 'default-2025' });
    await renderFr(ws);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Share with my Unit Manager and Branch Manager' }));
    await waitFor(() => expect(mockUpdateVisibility).toHaveBeenCalledWith(TENANT, UID, YEAR, 'shared'));

    mockUpdateCommission.mockResolvedValue({ firstYearCommissionsRequired: 1, firstYearCommissionsTargets: { life: 65000, ah: 20000, property: 0, motor: 0 } });
    const life = screen.getByRole('spinbutton', { name: 'Life commission target' });
    fireEvent.change(life, { target: { value: '65000' } });
    fireEvent.blur(life);
    await waitFor(() => expect(mockUpdateCommission).toHaveBeenCalledTimes(1));
    expect(mockUpdateCommission.mock.calls[0].slice(0, 4)).toEqual([TENANT, UID, YEAR, { life: '65000', ah: 20000, property: 0, motor: 0 }]);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh PAYE Calculation' }));
    await waitFor(() => expect(mockRefreshPAYE).toHaveBeenCalledWith(TENANT, UID, YEAR, ws.expenseGroups));
  });

  it('Send to Playground: same localStorage payload, ack, Game plan', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const onOpenTab = vi.fn();
    await renderFr(makeWorksheet(), { onOpenTab });
    fireEvent.click(screen.getByRole('button', { name: 'Send to Playground' }));
    expect(setItem).toHaveBeenCalledWith(KEY, JSON.stringify({ value: 113466.66666666667, preTaxAlreadyApplied: true }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Target sent' })).getByRole('button', { name: 'Continue to Game Plan →' }));
    expect(onOpenTab).toHaveBeenCalledWith('game-plan');
  });

  it('"Use this in my game plan" navigates only (no write); absent without onOpenTab', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const onOpenTab = vi.fn();
    const { unmount } = await renderFr(makeWorksheet(), { onOpenTab });
    fireEvent.click(screen.getByTestId('fr-mn-to-game-plan'));
    expect(onOpenTab).toHaveBeenCalledWith('game-plan');
    expect(setItem).not.toHaveBeenCalled();
    expect(mockUpdateExpenseGroup).not.toHaveBeenCalled();
    unmount();
    await renderFr();
    expect(screen.queryByTestId('fr-mn-to-game-plan')).toBeNull();
  });
});

describe('moneyNeedsModel — formatting only', () => {
  it('payeWhy is written from the live bracket config', () => {
    expect(payeWhy()).toBe('Personal allowance TTD 90,000, tax-free. 25% on the next TTD 1,000,000 of chargeable income, 30% above that.');
  });

  it('ladder: no renewals → no renewal row and the "all of it" note; empty worksheet → empty', () => {
    const l = moneyNeedsLadder({ totalAnnualAfterTax: 100, totalAnnualPreTax: 100, payeGrossUp: 0, renewals: 0, commissionsRequired: 100 });
    expect(l.rows.map((r) => r.id)).toEqual(['afterTax', 'paye', 'preTax', 'commission']);
    expect(l.rows[3].note).toBe('all of it — no renewal income yet');
    expect(moneyNeedsLadder({ totalAnnualAfterTax: 0, totalAnnualPreTax: 0, payeGrossUp: 0, renewals: 0, commissionsRequired: 0 })).toEqual({ empty: true, rows: [] });
  });

  it('donut: null with nothing funded; titles the biggest segment', () => {
    expect(moneyNeedsDonut({ segments: [], total: 0 })).toBeNull();
    const d = moneyNeedsDonut({ total: 10, segments: [
      { key: 'fixedExpenses', label: 'Fixed Expenses', total: 3, pct: 30 },
      { key: 'livingExpenses', label: 'Living Expenses', total: 7, pct: 70 },
    ] });
    expect(d.title).toBe('Living Expenses is your biggest group — 70% of the year');
    expect(d.parts).toEqual([
      { key: 'fixedExpenses', label: 'Fixed Expenses', value: 3 },
      { key: 'livingExpenses', label: 'Living Expenses', value: 7 },
    ]);
  });

  it('sub-calcs read stored totals; rows format without recomputing', () => {
    const cards = moneyNeedsSubCalcs({}, { personalPct: 33.3, businessPct: 66.7 });
    expect(cards.map((c) => c.value ?? c.split.map((s) => s.value).join('/'))).toEqual(['TTD 0', 'TTD 0/TTD 0', 'TTD 0']);
    const row = moneyNeedsRow({ id: 'x', label: 'L', amount: 0, frequency: 'M', calcKey: 'carExpenses.business' }, 0);
    expect(row).toMatchObject({ amount: '', calcFed: true, calcId: 'carExpenses', filled: false, yearly: 'TTD 0' });
  });

  it('frequencies derive from the shared list; unknown group short name throws in dev', () => {
    expect(FR_FREQUENCIES.map((f) => `${f.value}:${f.label}`)).toEqual(['M:Monthly', 'Q:Quarterly', 'S:Semi-Annual', 'A:Annual']);
    expect(() => groupShort('nope', 'Nope')).toThrow(/no short name/);
  });
});
