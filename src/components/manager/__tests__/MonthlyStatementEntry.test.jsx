import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  listFinancingMonths: vi.fn(),
  setFinancingMonth: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', () => ({
  getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
  listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a),
  setFinancingMonth: (...a) => hoisted.setFinancingMonth(...a),
  detectSkippedMonths: () => [],
  deriveBasisSource: () => 'submitted-final',
  financingMonthIndex: () => 6,
  financingCeiling: (x) => (x == null ? null : x * 6),
}));
// Sub-components rendered by the panel — stub to keep this race test focused.
vi.mock('../FinancingBasisBadge', () => ({ default: () => <span data-testid="basis-badge" /> }));
vi.mock('../LedgerTimelineStrip', () => ({ default: () => <div data-testid="ledger-timeline" /> }));
vi.mock('../../../utils/dateInputs', async (orig) => {
  const actual = await orig();
  return { ...actual, getTodayTT: () => '2026-06-15' };
});

import MonthlyStatementEntry from '../MonthlyStatementEntry';

// Externally-resolvable promise — lets a test control async resolution ORDER.
function makeDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const termsFor = (current) => ({
  effectiveDate: '2026-01-15',
  currentMonthlyFinancing: current,
  agreedMonthlyFinancing: 9999,
  validatingAPI: 30000,
});

describe('MonthlyStatementEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Ana Agent', role: 'agent' }]);
    hoisted.getFinancingTerms.mockResolvedValue(null);
    hoisted.listFinancingMonths.mockResolvedValue([]);
    hoisted.showToast.mockReset();
  });

  it('renders the agent selector for a branch manager', async () => {
    render(<MonthlyStatementEntry />);
    expect(await screen.findByTestId('financing-ledger-agent-select')).toBeInTheDocument();
  });

  // Latest-request guard (latestAgentReqRef): on rapid agent switching a slower
  // first load resolving LAST must not overwrite the newer agent's ledger — a
  // money-write hazard, since Save targets the displayed agent.
  it('drops a stale agent load — a slow first request does not overwrite the latest agent', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Ana Agent', role: 'agent' },
      { id: 'agent-2', name: 'Bo Agent',  role: 'agent' },
    ]);
    const d1 = makeDeferred();
    const d2 = makeDeferred();
    hoisted.getFinancingTerms.mockImplementation((_t, id) =>
      id === 'agent-1' ? d1.promise : id === 'agent-2' ? d2.promise : Promise.resolve(null));
    hoisted.listFinancingMonths.mockResolvedValue([]);

    render(<MonthlyStatementEntry />);
    const select = await screen.findByTestId('financing-ledger-agent-select');

    // Select agent-1 (slow), then immediately agent-2 (fast).
    fireEvent.change(select, { target: { value: 'agent-1' } });
    fireEvent.change(select, { target: { value: 'agent-2' } });

    // Resolve the LATEST (agent-2) first → ceiling = 6 × 2000 = 12000 displays.
    d2.resolve(termsFor(2000));
    const meter = await screen.findByTestId('financing-ceiling-meter');
    await waitFor(() => expect(meter).toHaveAttribute('data-ceiling', '12000'));

    // Now resolve the STALE (agent-1, current 1000 → ceiling 6000) → must be dropped.
    d1.resolve(termsFor(1000));
    await flush();
    expect(screen.getByTestId('financing-ceiling-meter')).toHaveAttribute('data-ceiling', '12000');
  });
});
