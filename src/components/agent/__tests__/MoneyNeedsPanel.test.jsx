// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    // Single-open accordion — verify each group's triggers by opening it in turn.
    openGroup('Living Expenses');
    expect(screen.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i })).toBeInTheDocument();

    openGroup('Business Expenses'); // closes Living
    expect(screen.getByRole('button', { name: /Open Business car expenses calculator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i })).toBeInTheDocument();

    openGroup('Savings & Accumulation'); // closes Business
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
    // Single-open: verify trigger counts per group, then confirm no car-loan trigger anywhere.
    openGroup('Living Expenses');
    expect(screen.getAllByRole('button', { name: /^Open .* calculator$/i })).toHaveLength(1);

    openGroup('Business Expenses');
    expect(screen.getAllByRole('button', { name: /^Open .* calculator$/i })).toHaveLength(2);

    openGroup('Savings & Accumulation');
    expect(screen.getAllByRole('button', { name: /^Open .* calculator$/i })).toHaveLength(1);

    // Car-loan is a read-only display item in the sub-calc modal — it never gets a trigger button.
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

    // Single-open: open Business first, verify CTA on business line.
    openGroup('Business Expenses');
    expect(within(screen.getByRole('button', { name: /Open Business car expenses calculator/i })).getByText(/Build with calculator/i)).toBeInTheDocument();

    // Open the car calc and add an item (auto-saves → onSubCalcSaved → prefill).
    fireEvent.click(screen.getByRole('button', { name: /Open Business car expenses calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Car Expenses' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add item/i }));
    await waitFor(() => expect(mockUpdateSubCalc).toHaveBeenCalled());

    // Business car line CTA replaced by Recalculate.
    await waitFor(() => {
      const businessTrigger = screen.getByRole('button', { name: /Open Business car expenses calculator/i });
      expect(within(businessTrigger).queryByText(/Build with calculator/i)).not.toBeInTheDocument();
    });

    // Close the modal (Done footer close), then switch to Living Expenses to verify the personal car line.
    fireEvent.click(within(dialog).getByRole('button', { name: /Done — use this figure/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Car Expenses' })).not.toBeInTheDocument());

    openGroup('Living Expenses'); // closes Business
    await waitFor(() => {
      const personalTrigger = screen.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i });
      expect(within(personalTrigger).queryByText(/Build with calculator/i)).not.toBeInTheDocument();
    });
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

  it('manual LineItemRow renders as a card (description heading full-width, amount row beneath)', async () => {
    await renderLoaded();
    openGroup('Fixed Expenses');
    mockUpdateExpenseGroup.mockResolvedValue({ totalAnnualExpenses: 0, totalAnnualAfterTax: 0, totalAnnualPreTax: 0 });
    fireEvent.click(screen.getAllByRole('button', { name: /Add item/i })[0]);
    await waitFor(() => expect(mockUpdateExpenseGroup).toHaveBeenCalled());

    const descInput = screen.getByRole('textbox', { name: /Expense description/i });
    // Card container: rounded-xl border bg-surface.
    const card = descInput.parentElement;
    expect(card.className).toMatch(/\brounded-xl\b/);
    expect(card.className).toMatch(/\bborder\b/);
    expect(card.className).toMatch(/\bbg-surface\b/);
    // Description is the full-width heading — font-semibold, bg-surface-muted, no sm:flex-1.
    expect(descInput.className).toMatch(/\bw-full\b/);
    expect(descInput.className).toMatch(/\bfont-semibold\b/);
    expect(descInput.className).toMatch(/\bbg-surface-muted\b/);
    expect(descInput.className).not.toMatch(/\bsm:flex-1\b/);
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

  it('calc-modal rows use the STACKED layout (full-width label, no sm:flex-1, no flat column header)', async () => {
    mockUpdateSubCalc.mockResolvedValue({ rollup: {}, updatedGroups: {} });
    await renderLoaded();
    openGroup('Business Expenses');

    // Open the Insurance Industry calc modal and add a line item.
    fireEvent.click(screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Insurance Industry Expenses' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add item/i }));
    const descInput = await within(dialog).findByRole('textbox', { name: /Expense description/i });

    // Stacked mode: label is full-width and does NOT take the main-panel sm:flex-1.
    expect(descInput.className).toMatch(/\bw-full\b/);
    expect(descInput.className).not.toMatch(/\bsm:flex-1\b/);
    // The always-stacked outer row has no sm:flex-row.
    expect(descInput.parentElement.className).not.toMatch(/\bsm:flex-row\b/);
    // The flat column header (Description/Amount/Frequency/Annual) is gone in the modal.
    expect(within(dialog).queryByText('Description')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Frequency')).not.toBeInTheDocument();
  });
});

// ── Fixtures for PAYE summary tests ──────────────────────────────────────────
function makeWorksheetWithPAYE() {
  return {
    ...makeWorksheet(),
    totalAnnualAfterTax: 840000,
    totalAnnualPreTax: 1090000,
    estimatedRenewalIncome: { total: 0 },
    firstYearCommissionsTargets: { life: 0, ah: 0, property: 0, motor: 0 },
  };
}

describe('MoneyNeedsPanel — PAYESummary display (Bug 2)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('headline is gross (totalAnnualPreTax = "= Income you must earn"); after-tax is the build-up base', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    // PR #735: gross is now "= Income you must earn" (additive summation line).
    expect(screen.getByText('= Income you must earn')).toBeInTheDocument();
    // After-tax take-home is the build-up base (first row), labelled with budget link.
    expect(screen.getByText('After-tax take-home (= your annual budget)')).toBeInTheDocument();
    // Both formatted values present.
    expect(screen.getAllByText(/1,090,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/840,000/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('MoneyNeedsPanel — Send to Playground send-path (Bug 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  afterEach(() => {
    localStorage.removeItem('agencytrack-playground-income-goal');
  });

  it('Send to Playground writes { value, preTaxAlreadyApplied:true } — not a bare number', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    const sendBtn = screen.getByRole('button', { name: /send to playground/i });
    fireEvent.click(sendBtn);
    const stored = JSON.parse(localStorage.getItem('agencytrack-playground-income-goal'));
    // Must be an object with the flag — never a bare number.
    expect(typeof stored).toBe('object');
    expect(stored.preTaxAlreadyApplied).toBe(true);
    // Value = totalAnnualPreTax (1,090,000) − renewals (0) = 1,090,000 — NOT 1,453,333.
    expect(stored.value).toBe(1090000);
    expect(stored.value).not.toBe(1453333);
  });
});

// ── Fixtures for clarity PR tests ────────────────────────────────────────────
function makeWorksheetWithRenewals(renewalTotal = 100000) {
  return {
    ...makeWorksheetWithPAYE(),
    estimatedRenewalIncome: { total: renewalTotal },
  };
}

describe('MoneyNeedsPanel — summary clarity (income build-up order + grand total)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('Total annual budget line renders below categories with worksheet.totalAnnualAfterTax', async () => {
    await renderLoaded(makeWorksheetWithPAYE()); // totalAnnualAfterTax = 840,000
    const budgetLine = screen.getByTestId('budget-total-line');
    expect(budgetLine).toBeInTheDocument();
    expect(budgetLine).toHaveTextContent('840,000');
  });

  it('Total annual budget and PAYESummary After-tax take-home show the identical value', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    const budgetLine = screen.getByTestId('budget-total-line');
    const afterTaxLabel = screen.getByText('After-tax take-home (= your annual budget)');
    // Both read from worksheet.totalAnnualAfterTax = 840,000 — never a re-sum.
    expect(budgetLine).toHaveTextContent('840,000');
    expect(afterTaxLabel.closest('div')).toHaveTextContent('840,000');
  });

  it('income section order: After-tax take-home → + PAYE → = Income you must earn → commissions', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    const afterTax = screen.getByText('After-tax take-home (= your annual budget)');
    const paye     = screen.getByText('+ PAYE');
    const gross    = screen.getByText('= Income you must earn');
    const comms    = screen.getByText('1st-year commissions required');
    // DOM order (pre-order depth-first): each item precedes the next.
    expect(afterTax.compareDocumentPosition(paye)  & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paye.compareDocumentPosition(gross)     & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gross.compareDocumentPosition(comms)    & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gross-up is shown additively as "+ PAYE", not "− PAYE gross-up"', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    expect(screen.getByText('+ PAYE')).toBeInTheDocument();
    expect(screen.queryByText(/− PAYE/)).not.toBeInTheDocument();
    expect(screen.queryByText('− PAYE gross-up')).not.toBeInTheDocument();
  });

  it('"= Income you must earn" value carries text-lg font-bold (visually dominant)', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    // The gross value (1,090,000) must appear in a text-lg font-bold element.
    const grossValues = screen.getAllByText(/1,090,000/);
    const headlineEl = grossValues.find(
      (el) => el.className.includes('font-bold') && el.className.includes('text-lg'),
    );
    expect(headlineEl).toBeDefined();
  });

  it('renewals=0: explanatory note "no renewal income yet" is present on commissions line', async () => {
    await renderLoaded(makeWorksheetWithPAYE()); // estimatedRenewalIncome.total = 0
    expect(screen.getByText(/no renewal income yet/i)).toBeInTheDocument();
  });

  it('renewals>0: commissions line shows a different value from gross, renewal offset is visible', async () => {
    await renderLoaded(makeWorksheetWithRenewals(100000)); // renewals = 100,000
    // commissionsRequired = 1,090,000 − 100,000 = 990,000 ≠ 1,090,000 (gross).
    expect(screen.getByText('− Renewal income')).toBeInTheDocument();
    expect(screen.queryByText(/no renewal income yet/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/990,000/).length).toBeGreaterThanOrEqual(1);
  });

  it('CommissionTargetsPanel renders AFTER PAYESummary in the DOM', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    const incomeHeader = screen.getByText('The income your lifestyle requires');
    const commHeader   = screen.getByText('Commission Targets');
    // PAYESummary's header must precede CommissionTargetsPanel's header in DOM order.
    expect(incomeHeader.compareDocumentPosition(commHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no value changed vs pre-PR: gross=1,090,000 after-tax=840,000 PAYE=250,000 (renewals=0)', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    expect(screen.getAllByText(/1,090,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/840,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/250,000/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('MoneyNeedsPanel — accordion group header (mobile truncation fix)', () => {
  it('header stacks on mobile (flex-col sm:flex-row) with the full label and metrics on a separate line', async () => {
    await renderLoaded();

    const headerBtn = screen.getByRole('button', { name: /Business Expenses/i });
    // Header switches from a single justify-between row to a stacking layout.
    expect(headerBtn.className).toMatch(/\bflex-col\b/);
    expect(headerBtn.className).toMatch(/\bsm:flex-row\b/);

    // The group label renders in full — no truncate clamp; it grows to fill line 1.
    const labelEl = within(headerBtn).getByText('Business Expenses');
    expect(labelEl.className).not.toMatch(/\btruncate\b/);
    expect(labelEl.className).toMatch(/\bflex-1\b/);
    expect(labelEl.className).toMatch(/\bmin-w-0\b/);

    // The "{filled} of {total} filled" count is in the mobile sub-row, NOT inside the
    // label's line-1 span (that crowding was the original truncation cause).
    const countEl = within(headerBtn).getByText(/of .* filled/i);
    expect(labelEl.parentElement.contains(countEl)).toBe(false);
  });

  it('header toggle still opens and closes the group', async () => {
    await renderLoaded();
    const headerBtn = screen.getByRole('button', { name: /Fixed Expenses/i });
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(headerBtn);
    expect(headerBtn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(headerBtn);
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('MoneyNeedsPanel — single-open accordion + rev 4-5 features', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('opening one group collapses the previously open group', async () => {
    await renderLoaded();
    const fixedBtn  = screen.getByRole('button', { name: /Fixed Expenses/i });
    const livingBtn = screen.getByRole('button', { name: /Living Expenses/i });

    fireEvent.click(fixedBtn);
    expect(fixedBtn.getAttribute('aria-expanded')).toBe('true');
    expect(livingBtn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(livingBtn);
    expect(livingBtn.getAttribute('aria-expanded')).toBe('true');
    expect(fixedBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the open group again collapses it (all groups closed)', async () => {
    await renderLoaded();
    const fixedBtn = screen.getByRole('button', { name: /Fixed Expenses/i });
    fireEvent.click(fixedBtn);
    expect(fixedBtn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(fixedBtn);
    expect(fixedBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('Send to Playground shows ack modal with "Target sent!" confirmation', async () => {
    await renderLoaded(makeWorksheetWithPAYE());
    fireEvent.click(screen.getByRole('button', { name: /send to playground/i }));
    expect(await screen.findByText('Target sent!')).toBeInTheDocument();
    expect(screen.getByText('Saved to your Commission Playground')).toBeInTheDocument();
  });

  it('"Continue to Game Plan" fires onOpenTab("game-plan") and closes ack modal', async () => {
    const mockOnOpenTab = vi.fn();
    mockGetMoneyNeeds.mockResolvedValue(makeWorksheetWithPAYE());
    render(<MoneyNeedsPanel onOpenTab={mockOnOpenTab} />);
    await screen.findByText('Money Needs Worksheet');
    await screen.findByRole('button', { name: /Business Expenses/i });

    fireEvent.click(screen.getByRole('button', { name: /send to playground/i }));
    const continueBtn = await screen.findByRole('button', { name: /Continue to Game Plan/i });
    fireEvent.click(continueBtn);
    expect(mockOnOpenTab).toHaveBeenCalledWith('game-plan');
    await waitFor(() => expect(screen.queryByText('Target sent!')).not.toBeInTheDocument());
  });

  it('"Stay here" closes ack modal without firing onOpenTab', async () => {
    const mockOnOpenTab = vi.fn();
    mockGetMoneyNeeds.mockResolvedValue(makeWorksheetWithPAYE());
    render(<MoneyNeedsPanel onOpenTab={mockOnOpenTab} />);
    await screen.findByText('Money Needs Worksheet');
    await screen.findByRole('button', { name: /Business Expenses/i });

    fireEvent.click(screen.getByRole('button', { name: /send to playground/i }));
    await screen.findByText('Target sent!');
    fireEvent.click(screen.getByRole('button', { name: /Stay here/i }));
    await waitFor(() => expect(screen.queryByText('Target sent!')).not.toBeInTheDocument());
    expect(mockOnOpenTab).not.toHaveBeenCalled();
  });

  it('Done footer renders with "Annual total" label and close button inside the sub-calc modal', async () => {
    const ws = {
      ...makeWorksheet(),
      subCalculators: {
        insuranceIndustry: { lineItems: [], annualTotal: 2400 },
        carExpenses:       { lineItems: [], annualTotalPersonal: 0, annualTotalBusiness: 0 },
        loansDebt:         { lineItems: [], annualTotal: 0 },
      },
    };
    await renderLoaded(ws);
    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: /Open Professional\/industry expenses calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Insurance Industry Expenses' });

    expect(within(dialog).getByText(/Annual total/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Done — use this figure/i })).toBeInTheDocument();
  });

  it('Done footer close button closes the modal', async () => {
    await renderLoaded();
    openGroup('Savings & Accumulation');
    fireEvent.click(screen.getByRole('button', { name: /Open Debt reduction \(non-mortgage\) calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Loans & Debt' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Done — use this figure/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Loans & Debt' })).not.toBeInTheDocument());
  });

  it('car Done footer shows personal and business split labels', async () => {
    await renderLoaded();
    openGroup('Business Expenses');
    fireEvent.click(screen.getByRole('button', { name: /Open Business car expenses calculator/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Car Expenses' });

    // Car calc footer branches into two labeled totals (not a single total).
    expect(within(dialog).getByText('personal')).toBeInTheDocument();
    expect(within(dialog).getByText('business')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Done — use this figure/i })).toBeInTheDocument();
  });
});
