import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  listFinancingMonths: vi.fn(),
  getOwnPolicies: vi.fn(),
  setFinancingProration: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', () => ({
  getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
  listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a),
  setFinancingProration: (...a) => hoisted.setFinancingProration(...a),
  // FinancingBasisBadge (rendered by the panel) reads these from the service.
  BASIS_SOURCE_LABELS: {
    'submitted-final':       'Submitted · final',
    'submitted-provisional': 'Submitted · provisional',
    'settled-confirmed':     'Settled · confirmed',
  },
}));
vi.mock('../../../services/policiesService', () => ({ getOwnPolicies: (...a) => hoisted.getOwnPolicies(...a) }));
// Real date helpers — but pin "today" to a deterministic TT month for basis math.
vi.mock('../../../utils/dateInputs', async (orig) => {
  const actual = await orig();
  return { ...actual, getTodayTT: () => '2026-06-15' };
});

import FinancingProrationPanel from '../FinancingProrationPanel';

// Externally-resolvable promise — lets a test control async resolution ORDER
// (used by the latest-request-race test below).
function makeDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const ttTs = (ymd) => ({ toDate: () => new Date(`${ymd}T04:00:00Z`) });

const TERMS = {
  effectiveDate: '2026-01-15',     // month 1 = 2026_01
  validatingAPI: 30000,
  agreedMonthlyFinancing: 8000,
  currentMonthlyFinancing: 8000,
};

// Two nb_ordinary policies submitted in Feb 2026 (month 2 → submitted-final basis).
const FEB_POLICIES = [
  { newBusinessType: 'nb_ordinary', proposedAPI: 10000, dateSubmitted: ttTs('2026-02-03') },
  { newBusinessType: 'nb_ordinary', proposedAPI: 5000,  dateSubmitted: ttTs('2026-02-20') },
];

describe('FinancingProrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // clear call history between tests (spies are module-level)
    hoisted.authValue = { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Ana Agent', role: 'agent' }]);
    hoisted.getFinancingTerms.mockResolvedValue(TERMS);
    hoisted.getOwnPolicies.mockResolvedValue(FEB_POLICIES);
    hoisted.listFinancingMonths.mockResolvedValue([]);
    hoisted.setFinancingProration.mockResolvedValue({ id: 'agent-1_2026_02' });
    hoisted.showToast.mockReset();
  });

  it('blocks unit_manager (defense-in-depth guard)', () => {
    hoisted.authValue = { userProfile: {}, role: 'unit_manager', tenantId: 't1' };
    render(<FinancingProrationPanel />);
    expect(screen.getByText(/Branch Managers and above/i)).toBeInTheDocument();
  });

  it('renders the agent selector for a branch manager', async () => {
    render(<FinancingProrationPanel />);
    expect(await screen.findByTestId('proration-agent-select')).toBeInTheDocument();
  });

  it('computes the readout for a submitted-final month and confirms a draw', async () => {
    render(<FinancingProrationPanel />);
    const select = await screen.findByTestId('proration-agent-select');
    fireEvent.change(select, { target: { value: 'agent-1' } });

    // Month defaults to today (2026-06) — switch to Feb 2026 (month 2, submitted-final).
    const month = await screen.findByTestId('proration-month');
    fireEvent.change(month, { target: { value: '2026-02' } });

    const readout = await screen.findByTestId('proration-readout');
    expect(readout).toHaveAttribute('data-basis', 'submitted-final');
    // actualAPI = 10000 + 5000 = 15000; proration = 15000/30000 = 50%; suggested = 8000 × .5 = 4000
    expect(screen.getByTestId('proration-actual-api')).toHaveTextContent(/15,000/);
    expect(screen.getByTestId('proration-ratio')).toHaveTextContent('50%');
    expect(screen.getByTestId('proration-suggested')).toHaveTextContent(/4,000/);

    // Confirm a managerFinancing figure and save.
    fireEvent.change(screen.getByTestId('proration-manager-input'), { target: { value: '4000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm financing/i }));

    await waitFor(() => expect(hoisted.setFinancingProration).toHaveBeenCalledTimes(1));
    const [, , month2, proration] = hoisted.setFinancingProration.mock.calls[0];
    expect(month2).toBe('2026_02');
    expect(proration).toMatchObject({
      validatingAPI: 30000,
      actualAPI: 15000,
      suggestedFinancing: 4000,
      basisSource: 'submitted-final',
      managerFinancing: 4000,
      adjustmentPct: 0.5, // (8000 − 4000) / 8000
    });
  });

  it('a current in-flight M4+ month is provisional — read-only, no confirm form', async () => {
    // June 2026 is month 6 (≥4) and equals "today" → submitted-provisional.
    hoisted.getOwnPolicies.mockResolvedValue([
      { newBusinessType: 'nb_ordinary', proposedAPI: 9000, dateSubmitted: ttTs('2026-06-05') },
    ]);
    render(<FinancingProrationPanel />);
    fireEvent.change(await screen.findByTestId('proration-agent-select'), { target: { value: 'agent-1' } });

    const readout = await screen.findByTestId('proration-readout');
    expect(readout).toHaveAttribute('data-basis', 'submitted-provisional');
    expect(screen.getByTestId('proration-provisional-note')).toBeInTheDocument();
    expect(screen.queryByTestId('proration-manager-input')).not.toBeInTheDocument();
  });

  it('renders a negative adjustment as +X% (no double-negative sign)', async () => {
    render(<FinancingProrationPanel />);
    fireEvent.change(await screen.findByTestId('proration-agent-select'), { target: { value: 'agent-1' } });
    fireEvent.change(await screen.findByTestId('proration-month'), { target: { value: '2026-02' } });
    await screen.findByTestId('proration-readout');

    // managerFinancing 7000 > current 8000 → adjustmentPct = (8000−7000)/8000 = +0.125 (a 13% cut) → −13%
    fireEvent.change(screen.getByTestId('proration-manager-input'), { target: { value: '7000' } });
    expect(screen.getByTestId('proration-adjustment')).toHaveTextContent('−13%');

    // managerFinancing 8500 (above current 8000, still ≤ agreed) → adjustmentPct = −0.0625 → +6% (no "−-6%")
    fireEvent.change(screen.getByTestId('proration-manager-input'), { target: { value: '8500' } });
    const adj = screen.getByTestId('proration-adjustment');
    expect(adj).toHaveTextContent('+6%');
    expect(adj.textContent).not.toMatch(/−-|\+-|-−/);
  });

  it('rejects a confirmed figure above the agreed ceiling', async () => {
    render(<FinancingProrationPanel />);
    fireEvent.change(await screen.findByTestId('proration-agent-select'), { target: { value: 'agent-1' } });
    fireEvent.change(await screen.findByTestId('proration-month'), { target: { value: '2026-02' } });
    await screen.findByTestId('proration-readout');

    fireEvent.change(screen.getByTestId('proration-manager-input'), { target: { value: '9000' } }); // > agreed 8000
    fireEvent.click(screen.getByRole('button', { name: /confirm financing/i }));

    expect(await screen.findByTestId('proration-validation-error')).toHaveTextContent(/can't exceed the agreed/i);
    expect(hoisted.setFinancingProration).not.toHaveBeenCalled();
  });

  // Latest-request guard (latestAgentReqRef): on rapid agent switching a slower
  // first load resolving LAST must not overwrite the newer agent's view — a
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
    hoisted.getOwnPolicies.mockResolvedValue([]);
    hoisted.listFinancingMonths.mockResolvedValue([]);

    render(<FinancingProrationPanel />);
    const select = await screen.findByTestId('proration-agent-select');

    // Select agent-1 (slow), then immediately agent-2 (fast).
    fireEvent.change(select, { target: { value: 'agent-1' } });
    fireEvent.change(select, { target: { value: 'agent-2' } });

    // Resolve the LATEST (agent-2) first → its validating API (50,000) displays.
    d2.resolve({ ...TERMS, validatingAPI: 50000 });
    const validating = await screen.findByTestId('proration-validating-api');
    await waitFor(() => expect(validating).toHaveTextContent(/50,000/));

    // Now resolve the STALE (agent-1, 30,000) → the guard must drop it.
    d1.resolve({ ...TERMS, validatingAPI: 30000 });
    await flush();
    expect(screen.getByTestId('proration-validating-api')).toHaveTextContent(/50,000/);
    expect(screen.getByTestId('proration-validating-api')).not.toHaveTextContent(/30,000/);
  });
});
