import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  setFinancingTerms: vi.fn(),
  transitionFinancingStatus: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', () => ({
  getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
  setFinancingTerms: (...a) => hoisted.setFinancingTerms(...a),
  transitionFinancingStatus: (...a) => hoisted.transitionFinancingStatus(...a),
  allowedNextStatuses: () => [],            // terminal — keep the status panel inert
  DEFAULT_FINANCING_STATUS: 'not_on_financing',
  FINANCING_STATUS_LABELS: {
    not_on_financing: 'Not on financing',
    active:           'Active',
  },
}));
vi.mock('../FinancingStatusBadge', () => ({ default: ({ status }) => <span data-testid="status-badge">{status}</span> }));
vi.mock('../../../utils/dateInputs', async (orig) => {
  const actual = await orig();
  return { ...actual, getTodayTT: () => '2026-06-15' };
});

import FinancingTermsSetup from '../FinancingTermsSetup';

// Externally-resolvable promise — lets a test control async resolution ORDER.
function makeDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const termsFor = (agreed) => ({
  agreedMonthlyFinancing: agreed,
  currentMonthlyFinancing: 1000,
  validatingAPI: 30000,
  effectiveDate: '2026-01-15',
  financingStatus: 'active',
});

describe('FinancingTermsSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Ana Agent', role: 'agent' }]);
    hoisted.getFinancingTerms.mockResolvedValue(null);
    hoisted.showToast.mockReset();
  });

  it('renders the agent selector for a branch manager', async () => {
    render(<FinancingTermsSetup />);
    expect(await screen.findByTestId('financing-agent-select')).toBeInTheDocument();
  });

  // Latest-request guard (latestAgentReqRef): on rapid agent switching a slower
  // first load resolving LAST must not overwrite the newer agent's form — a
  // money-write hazard, since Save targets the displayed values.
  it('drops a stale agent load — a slow first request does not overwrite the latest agent', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Ana Agent', role: 'agent' },
      { id: 'agent-2', name: 'Bo Agent',  role: 'agent' },
    ]);
    const d1 = makeDeferred();
    const d2 = makeDeferred();
    hoisted.getFinancingTerms.mockImplementation((_t, id) =>
      id === 'agent-1' ? d1.promise : id === 'agent-2' ? d2.promise : Promise.resolve(null));

    render(<FinancingTermsSetup />);
    const select = await screen.findByTestId('financing-agent-select');

    // Select agent-1 (slow), then immediately agent-2 (fast).
    fireEvent.change(select, { target: { value: 'agent-1' } });
    fireEvent.change(select, { target: { value: 'agent-2' } });

    // Resolve the LATEST (agent-2) first → its agreed figure (2222) populates the form.
    d2.resolve(termsFor(2222));
    const agreed = await screen.findByTestId('financing-agreed');
    await waitFor(() => expect(agreed.value).toBe('2222'));

    // Now resolve the STALE (agent-1, 1111) → the guard must drop it.
    d1.resolve(termsFor(1111));
    await flush();
    expect(screen.getByTestId('financing-agreed').value).toBe('2222');
  });
});
