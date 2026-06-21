import { describe, it, expect } from 'vitest';
import { countFilledLineItems } from '../moneyNeedsService';

// Build N line items, all with the given amount (default 0).
const items = (n, amount = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i}`, amount }));

// Seed shape mirrors the scaffold: 7 + 8 + 7 + 6 + 6 = 34 named items across the
// five standard groups, all amounts 0.
const seedGroups = {
  fixedExpenses:       { lineItems: items(7) },
  livingExpenses:      { lineItems: items(8) },
  businessExpenses:    { lineItems: items(7) },
  savingsAccumulation: { lineItems: items(6) },
  miscellaneous:       { lineItems: items(6) },
};

describe('countFilledLineItems — Money Needs FILLED N/total (Game Plan v2 1.8)', () => {
  it('first-run seed (all amounts 0) → 0/34', () => {
    expect(countFilledLineItems(seedGroups)).toEqual({ filled: 0, total: 34 });
  });

  it('counts only positive amounts as filled (string amounts coerced)', () => {
    const groups = {
      ...seedGroups,
      fixedExpenses: {
        lineItems: [{ amount: 1200 }, { amount: 0 }, { amount: '500' }, ...items(4)],
      },
    };
    // fixed: 2 filled of 7; the other four groups (27 items) are all 0.
    expect(countFilledLineItems(groups)).toEqual({ filled: 2, total: 34 });
  });

  it('ignores negative and non-numeric amounts', () => {
    const groups = {
      fixedExpenses: { lineItems: [{ amount: -5 }, { amount: 'abc' }, { amount: 0 }, { amount: 10 }] },
    };
    expect(countFilledLineItems(groups)).toEqual({ filled: 1, total: 4 });
  });

  it('custom items grow the denominator (one add → 35)', () => {
    const groups = { ...seedGroups, miscellaneous: { lineItems: items(7) } };
    expect(countFilledLineItems(groups)).toEqual({ filled: 0, total: 35 });
  });

  it('null / undefined / empty groups → 0/0', () => {
    expect(countFilledLineItems(null)).toEqual({ filled: 0, total: 0 });
    expect(countFilledLineItems(undefined)).toEqual({ filled: 0, total: 0 });
    expect(countFilledLineItems({})).toEqual({ filled: 0, total: 0 });
  });
});
