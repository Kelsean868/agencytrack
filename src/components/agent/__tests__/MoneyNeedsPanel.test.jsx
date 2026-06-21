// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser     = { uid: 'agent1' };
const mockTenantId = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, tenantId: mockTenantId }),
}));

const mockGetMoneyNeeds     = vi.fn();
const mockCreateMoneyNeeds  = vi.fn();
const mockUpdateSubCalc     = vi.fn();
const mockUpdateExpenseGroup = vi.fn();
const mockUpdateVisibility  = vi.fn();
const mockUpdateCommission  = vi.fn();
const mockRefreshPAYE       = vi.fn();

// Keep the pure helpers (annualizeAmount, computeGroupTotal, countFilledLineItems,
// calcFedValue, the CAR_* / line-id constants) real; only stub the async I/O.
vi.mock('../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getMoneyNeeds:          (...a) => mockGetMoneyNeeds(...a),
    createMoneyNeeds:       (...a) => mockCreateMoneyNeeds(...a),
    updateSubCalculator:    (...a) => mockUpdateSubCalc(...a),
    updateExpenseGroup:     (...a) => mockUpdateExpenseGroup(...a),
    updateVisibility:       (...a) => mockUpdateVisibility(...a),
    updateCommissionTargets: (...a) => mockUpdateCommission(...a),
    refreshPAYECalculation: (...a) => mockRefreshPAYE(...a),
  };
});

import MoneyNeedsPanel from '../MoneyNeedsPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function calcLine(id, label, calcKey, amount = 0) {
  return { id, label, amount, frequency: 'A', annualizedAmount: amount, calcKey, isOverridden: false };
}

function makeWorksheet() {
  return {
    year: 2026,
    visibility: 'private',
    expenseGroups: {
      fixedExpenses:       { lineItems: [] },
      livingExpenses:      { lineItems: [calcLine('seed-le-4', 'Car expenses, nonbusiness', 'carExpenses.personal')] },
      businessExpenses:    { lineItems: [
        calcLine('seed-be-4', 'Business car expenses', 'carExpenses.business'),
        calcLine('seed-be-7', 'Professional/industry expenses', 'insuranceIndustry'),
      ] },
      savingsAccumulation: { lineItems: [calcLine('seed-sa-2', 'Debt reduction (non-mortgage)', 'loansDebt')] },
      miscellaneous:       { lineItems: [] },
    },
    subCalculators: {
      insuranceIndustry: { lineItems: [], annualTotal: 0 },
      carExpenses:       { lineItems: [], annualTotalPersonal: 0, annualTotalBusiness: 0 },
      loansDebt:         { lineItems: [], annualTotal: 0 },
    },
  };
}

async function renderLoaded(ws = makeWorksheet()) {
  mockGetMoneyNeeds.mockResolvedValue(ws);
  render(<MoneyNeedsPanel />);
  await screen.findByText('Money Needs Worksheet');
  // Worksheet body (accordion buttons) renders a tick after the title resolves;
  // await one before any synchronous openGroup() to avoid a load race.
  await screen.findByRole('button', { name: /Business Expenses/i });
}

function openGroup(name) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name, 'i') }));
}

beforeEach(() => { vi.clearAllMocks(); });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MoneyNeedsPanel — floating calculators', () => {
  it('renders a trigger next to each calc-fed line, with the car trigger on BOTH car lines', async () => {
    await renderLoaded();
    openGroup('Living Expenses');
    openGroup('Business Expenses');
    openGroup('Savings & Accumulation');

    // Car calc → both "Car expenses, nonbusiness" (Living) and "Business car expenses" (Business).
    expect(screen.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Business car expenses calculator/i })).toBeInTheDocument();
    // Industry calc → "Professional/industry expenses".
    expect(screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i })).toBeInTheDocument();
    // Loans calc → "Debt reduction (non-mortgage)".
    expect(screen.getByRole('button', { name: /Open Debt reduction \(non-mortgage\) calculator/i })).toBeInTheDocument();
  });

  it('empty calc-fed line shows a "Build with calculator" CTA', async () => {
    await renderLoaded();
    openGroup('Savings & Accumulation');
    const trigger = screen.getByRole('button', { name: /Open Debt reduction \(non-mortgage\) calculator/i });
    expect(within(trigger).getByText(/Build with calculator/i)).toBeInTheDocument();
  });

  it('the read-only car-loan reference has no trigger', async () => {
    await renderLoaded();
    openGroup('Living Expenses');
    openGroup('Business Expenses');
    openGroup('Savings & Accumulation');
    // Only the four calc-fed lines own a trigger; the seed-ld-1 car-loan ref is not a calc-fed expense line.
    const triggers = screen.getAllByRole('button', { name: /^Open .* calculator$/i });
    expect(triggers).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Open Car loan.* calculator/i })).not.toBeInTheDocument();
  });

  it('the trailing "Sub-Calculators" section is gone', async () => {
    await renderLoaded();
    expect(screen.queryByText('Sub-Calculators')).not.toBeInTheDocument();
  });

  it('clicking a car trigger opens the Car Expenses modal calc', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: /Open Business car expenses calculator/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Car Expenses' });
    // The car calc body shows the personal/business split — proves the right calc opened.
    expect(within(dialog).getByText(/Personal \(/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Business \(/i)).toBeInTheDocument();
  });

  it('the industry trigger opens the Insurance Industry modal, not the car one', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i }));
    expect(await screen.findByRole('dialog', { name: 'Insurance Industry Expenses' })).toBeInTheDocument();
  });

  it('traps focus into the modal and returns focus to the trigger on close', async () => {
    await renderLoaded();
    openGroup('Savings & Accumulation');
    const trigger = screen.getByRole('button', { name: /Open Debt reduction \(non-mortgage\) calculator/i });
    act(() => { trigger.focus(); });
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Loans & Debt' });
    // Focus moved into the dialog (first focusable = the close button).
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    // Escape closes the modal and returns focus to the originating trigger.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Loans & Debt' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('completing the car calc prefills BOTH car lines and drops the "Build with calculator" CTA', async () => {
    await renderLoaded();
    // Saving any calc edit returns updatedGroups that feed both car lines.
    mockUpdateSubCalc.mockResolvedValue({
      rollup: {},
      updatedGroups: {
        livingExpenses:   { lineItems: [calcLine('seed-le-4', 'Car expenses, nonbusiness', 'carExpenses.personal', 500)] },
        businessExpenses: { lineItems: [
          calcLine('seed-be-4', 'Business car expenses', 'carExpenses.business', 1500),
          calcLine('seed-be-7', 'Professional/industry expenses', 'insuranceIndustry', 0),
        ] },
      },
    });

    openGroup('Living Expenses');
    openGroup('Business Expenses');

    // Before: both car lines empty → CTA present on both triggers.
    expect(within(screen.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i })).getByText(/Build with calculator/i)).toBeInTheDocument();

    // Open the car calc and add an item (auto-saves → onSubCalcSaved → prefill).
    fireEvent.click(screen.getByRole('button', { name: /Open Business car expenses calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Car Expenses' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add item/i }));

    await waitFor(() => expect(mockUpdateSubCalc).toHaveBeenCalled());

    // Both car lines now carry their prefilled values; the CTA is replaced by Recalculate.
    await waitFor(() => {
      const personalTrigger = screen.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i });
      expect(within(personalTrigger).queryByText(/Build with calculator/i)).not.toBeInTheDocument();
    });
    const businessTrigger = screen.getByRole('button', { name: /Open Business car expenses calculator/i });
    expect(within(businessTrigger).queryByText(/Build with calculator/i)).not.toBeInTheDocument();
  });

  it('long label renders its full text — no truncation', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    // "Professional/industry expenses" is long; the card layout must not truncate it.
    const labelEl = screen.getByText('Professional/industry expenses');
    expect(labelEl).toBeInTheDocument();
    expect(labelEl.className).not.toMatch(/\btruncate\b/);
  });

  it('empty calc-fed card: shows CTA and NO amount input', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    // Industry line is empty (amount=0) → CTA button, no amount spinbutton.
    const cta = screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i });
    expect(within(cta).getByText(/Build with calculator/i)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /Professional\/industry expenses amount/i })).not.toBeInTheDocument();
  });

  it('filled calc-fed card: shows Recalculate button and amount input, not CTA', async () => {
    const ws = makeWorksheet();
    ws.expenseGroups.businessExpenses = {
      lineItems: [
        calcLine('seed-be-4', 'Business car expenses', 'carExpenses.business'),
        { ...calcLine('seed-be-7', 'Professional/industry expenses', 'insuranceIndustry', 1200) },
      ],
    };
    await renderLoaded(ws);
    openGroup('Business Expenses');

    // Filled → Recalculate label, amount input present; the Recalculate button itself
    // does NOT contain "Build with calculator" (the CTA belongs to empty-state cards only).
    const reopenBtn = screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i });
    expect(within(reopenBtn).getByText('Recalculate')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Professional\/industry expenses amount/i })).toBeInTheDocument();
    expect(within(reopenBtn).queryByText(/Build with calculator/i)).not.toBeInTheDocument();
  });

  it('overridden calc-fed card: shows Reset button', async () => {
    const ws = makeWorksheet();
    ws.expenseGroups.businessExpenses = {
      lineItems: [
        calcLine('seed-be-4', 'Business car expenses', 'carExpenses.business'),
        { ...calcLine('seed-be-7', 'Professional/industry expenses', 'insuranceIndustry', 900), isOverridden: true },
      ],
    };
    await renderLoaded(ws);
    openGroup('Business Expenses');

    expect(screen.getByRole('button', { name: /Reset Professional\/industry expenses to calculator value/i })).toBeInTheDocument();
  });

  it('manual LineItemRow: label stacks above amount/freq/delete (mobile-friendly DOM structure)', async () => {
    await renderLoaded();
    openGroup('Fixed Expenses');
    mockUpdateExpenseGroup.mockResolvedValue({ totalAnnualExpenses: 0, totalAnnualAfterTax: 0, totalAnnualPreTax: 0 });
    fireEvent.click(screen.getAllByRole('button', { name: /Add item/i })[0]);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalled());

    const descInput = screen.getByRole('textbox', { name: /Expense description/i });
    const amountInput = screen.getByRole('spinbutton', { name: /Expense amount/i });
    // In the stacked layout the label input is a direct child of the flex-col container;
    // the amount input lives in a separate inner div — different immediate parents.
    expect(descInput.parentElement).not.toBe(amountInput.parentElement);
  });

  it('manual LineItemRow desktop: Description grows (flex-1 min-w-0), numeric wrapper is sm:contents, no ml-auto spacer', async () => {
    await renderLoaded();
    openGroup('Fixed Expenses');
    mockUpdateExpenseGroup.mockResolvedValue({ totalAnnualExpenses: 0, totalAnnualAfterTax: 0, totalAnnualPreTax: 0 });
    fireEvent.click(screen.getAllByRole('button', { name: /Add item/i })[0]);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalled());

    const descInput = screen.getByRole('textbox', { name: /Expense description/i });
    const amountInput = screen.getByRole('spinbutton', { name: /Expense amount/i });
    // Description absorbs all horizontal slack on desktop.
    expect(descInput.className).toMatch(/\bsm:flex-1\b/);
    expect(descInput.className).toMatch(/\bsm:min-w-0\b/);
    // The numeric wrapper (amount's parent) dissolves on desktop via sm:contents,
    // so amount/freq/annual/delete become direct columns matching the header.
    const numericWrapper = amountInput.parentElement;
    expect(numericWrapper.className).toMatch(/\bsm:contents\b/);
    // No ml-auto / spacer anywhere in the row pushing the numeric columns right.
    const row = descInput.closest('.border-b');
    expect(row).not.toBeNull();
    expect(row.querySelector('[class*="ml-auto"]')).toBeNull();
  });

  it('manual LineItemRow renders a long Description label in full (no truncation of the value)', async () => {
    const ws = makeWorksheet();
    const longLabel = 'TTAIFA Conference Registration & Professional License Renewal';
    ws.expenseGroups.fixedExpenses = {
      lineItems: [{ id: 'm1', label: longLabel, amount: 0, frequency: 'M', annualizedAmount: 0, isCustom: true }],
    };
    await renderLoaded(ws);
    openGroup('Fixed Expenses');

    // The controlled input shows the full seeded label; class is not truncate-clamped.
    const descInput = screen.getByRole('textbox', { name: /Expense description/i });
    expect(descInput.value).toBe(longLabel);
    expect(descInput.className).not.toMatch(/\btruncate\b/);
  });
});
