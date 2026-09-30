// @vitest-environment jsdom
/**
 * Money needs — CHARACTERIZATION, merged-surface flag ON (R2-9 commit 1).
 * With VITE_MONEY_NEEDS_MERGED_ENABLED=true the panel hands the loaded
 * worksheet and its tab navigation to MoneyNeedsAllocator (the allocator's own
 * Send → Game plan payload is pinned by MoneyNeedsAllocator.test.jsx). This
 * pins the hand-off arguments and the adaptive first-run open group. Must pass
 * UNCHANGED after the FR port.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { makeWorksheet, YEAR, TENANT, UID } from './moneyNeedsCharFixtures';

vi.stubEnv('VITE_MONEY_NEEDS_MERGED_ENABLED', 'true');

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));

const mockGetMoneyNeeds = vi.fn();
vi.mock('../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getMoneyNeeds: (...a) => mockGetMoneyNeeds(...a) };
});

const allocatorProps = vi.fn();
vi.mock('../MoneyNeedsAllocator', () => ({
  default: (props) => {
    allocatorProps(props);
    return <div data-testid="merged-allocator-stub">allocator</div>;
  },
}));

let MoneyNeedsPanel;
beforeAll(async () => { ({ default: MoneyNeedsPanel } = await import('../MoneyNeedsPanel')); });
beforeEach(() => { vi.clearAllMocks(); });

describe('Money needs characterization — merged flag ON', () => {
  it('passes the loaded worksheet and onOpenTab to the allocator; no legacy targets panel', async () => {
    const ws = makeWorksheet();
    const onOpenTab = vi.fn();
    mockGetMoneyNeeds.mockResolvedValue(ws);
    render(<MoneyNeedsPanel onOpenTab={onOpenTab} />);
    await screen.findByTestId('merged-allocator-stub');
    expect(mockGetMoneyNeeds).toHaveBeenCalledWith(TENANT, UID, YEAR);
    const last = allocatorProps.mock.calls.at(-1)[0];
    expect(last.worksheet).toBe(ws);
    expect(last.onOpenTab).toBe(onOpenTab);
    expect(screen.queryByText('Commission Targets')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to Playground' })).toBeNull();
  });

  it('a first-run (all-zero) worksheet opens the first group; a filled one stays compact', async () => {
    const empty = makeWorksheet();
    for (const g of Object.values(empty.expenseGroups)) {
      g.lineItems = g.lineItems.map((i) => ({ ...i, amount: 0, annualizedAmount: 0 }));
    }
    mockGetMoneyNeeds.mockResolvedValue(empty);
    const { unmount } = render(<MoneyNeedsPanel />);
    await waitFor(() => expect(
      screen.getByRole('button', { name: /^Fixed Expenses/ }).getAttribute('aria-expanded'),
    ).toBe('true'));
    unmount();

    mockGetMoneyNeeds.mockResolvedValue(makeWorksheet());
    render(<MoneyNeedsPanel />);
    const fixed2 = await screen.findByRole('button', { name: /^Fixed Expenses/ });
    expect(fixed2.getAttribute('aria-expanded')).toBe('false');
  });
});
