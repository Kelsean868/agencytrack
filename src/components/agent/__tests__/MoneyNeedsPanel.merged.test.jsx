// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Flag ON — must be stubbed BEFORE the panel module evaluates its top-level const,
// hence the dynamic import in beforeAll. Mirrors the GAME_PLAN_LOOP flag pattern.
vi.stubEnv('VITE_MONEY_NEEDS_MERGED_ENABLED', 'true');

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));

const mockGetMoneyNeeds = vi.fn();
vi.mock('../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getMoneyNeeds: (...a) => mockGetMoneyNeeds(...a) };
});

// Stub the allocator to a sentinel — this file proves the FLAG SWAP only; the
// allocator's own behaviour is covered by MoneyNeedsAllocator.test.jsx.
vi.mock('../MoneyNeedsAllocator', () => ({
  default: () => <div data-testid="merged-allocator-stub">allocator</div>,
}));

let MoneyNeedsPanel;
beforeAll(async () => { ({ default: MoneyNeedsPanel } = await import('../MoneyNeedsPanel')); });
beforeEach(() => { vi.clearAllMocks(); });

function makeWorksheet() {
  return {
    year: 2026,
    visibility: 'private',
    totalAnnualPreTax: 100000,
    estimatedRenewalIncome: { total: 0 },
    expenseGroups: {
      fixedExpenses: { lineItems: [] }, livingExpenses: { lineItems: [] },
      businessExpenses: { lineItems: [] }, savingsAccumulation: { lineItems: [] },
      miscellaneous: { lineItems: [] },
    },
    subCalculators: {
      insuranceIndustry: { lineItems: [], annualTotal: 0 },
      carExpenses: { lineItems: [], annualTotalPersonal: 0, annualTotalBusiness: 0 },
      loansDebt: { lineItems: [], annualTotal: 0 },
    },
  };
}

describe('MoneyNeedsPanel — flag ON (merged surface)', () => {
  it('renders the merged allocator and NOT the legacy Send to Playground', async () => {
    mockGetMoneyNeeds.mockResolvedValue(makeWorksheet());
    render(<MoneyNeedsPanel />);
    expect(await screen.findByTestId('merged-allocator-stub')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Send to Playground/i })).toBeNull();
  });
});
