// §5 dense-table contract — SettlementPanel Settlement History table.
//
// Locks: sticky header cells + tabular-nums on numeric columns (API, Apps,
// Persist) + a live footer count that is honest about loaded-vs-total when
// the "Load More" pagination affordance is active.
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { user: { uid: 'mgr-1' }, userProfile: { name: 'Manager One' }, role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getSettlementsForUnit: vi.fn(),
  confirmSettlement: vi.fn(),
  deleteSettlement: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.mockShowToast, dismiss: vi.fn() }),
}));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: (...a) => hoisted.getTenantUsers(...a),
}));
vi.mock('../../../services/settlementService', () => ({
  getSettlementsForUnit: (...a) => hoisted.getSettlementsForUnit(...a),
  confirmSettlement: (...a) => hoisted.confirmSettlement(...a),
  deleteSettlement: (...a) => hoisted.deleteSettlement(...a),
}));

import SettlementPanel from '../SettlementPanel';

const AGENTS = [
  { id: 'a1', name: 'Ana Agent', role: 'agent' },
  { id: 'a2', name: 'Ben Agent', role: 'agent' },
];

function settlement(id, agentId, periodKey, api) {
  return {
    id, agentId, periodKey, periodType: 'monthly',
    settledAPI: api, settledApps: 3, persistency: 88,
    confirmedByName: 'Manager One', confirmedAt: null,
  };
}

describe('SettlementPanel — §5 dense-table (Settlement History)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { user: { uid: 'mgr-1' }, userProfile: { name: 'Manager One' }, role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue(AGENTS);
  });

  it('sticky-header th cells carry the sticky/z/bg classes, and numeric columns render tabular-nums', async () => {
    hoisted.getSettlementsForUnit.mockResolvedValue([
      settlement('s1', 'a1', '2026-01', 10000),
      settlement('s2', 'a2', '2026-02', 12000),
    ]);

    render(<SettlementPanel />);

    // The agent's name is ambiguous at page scope (it also appears as a
    // <select> option in the entry form above), so scope to the history table.
    const table = await screen.findByRole('table');

    const apiHeader = within(table).getByRole('columnheader', { name: 'API' });
    expect(apiHeader.className).toMatch(/sticky/);
    expect(apiHeader.className).toMatch(/top-0/);
    expect(apiHeader.className).toMatch(/bg-surface/);

    const agentHeader = within(table).getByRole('columnheader', { name: 'Agent' });
    expect(agentHeader.className).toMatch(/sticky/);

    // Numeric body cells: API / Apps / Persist all carry tabular-nums.
    const row = within(table).getByText('Ana Agent').closest('tr');
    const tabularCells = Array.from(row.querySelectorAll('td')).filter((td) => td.className.includes('tabular-nums'));
    expect(tabularCells.length).toBe(3);
  });

  it('footer count shows total when everything fits on one page (no pagination active)', async () => {
    hoisted.getSettlementsForUnit.mockResolvedValue([
      settlement('s1', 'a1', '2026-01', 10000),
      settlement('s2', 'a2', '2026-02', 12000),
    ]);

    render(<SettlementPanel />);

    await screen.findByRole('table');
    const footer = screen.getByTestId('settlement-history-footer-count');
    expect(footer).toHaveTextContent('2 settlements');
    // No "Load More" — not enough rows to paginate.
    expect(screen.queryByText(/load more/i)).not.toBeInTheDocument();
  });

  it('footer count is honest about loaded-vs-total when "Load More" pagination is active', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      settlement(`s${i}`, i % 2 === 0 ? 'a1' : 'a2', `2026-${String((i % 12) + 1).padStart(2, '0')}`, 1000 + i)
    );
    hoisted.getSettlementsForUnit.mockResolvedValue(many);

    render(<SettlementPanel />);

    await screen.findByText(/load more/i);
    const footer = screen.getByTestId('settlement-history-footer-count');
    expect(footer).toHaveTextContent('Showing 20 of 25 settlements');
  });
});
