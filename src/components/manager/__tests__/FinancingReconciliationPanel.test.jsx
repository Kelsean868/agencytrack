import React from 'react';
import { render, screen, waitFor, fireEvent, configure } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The panel's confirm→reload→recompute cycle spans several async hops; under full-suite
// load the default 1000ms async-util timeout is too tight. Widen it for this file.
configure({ asyncUtilTimeout: 5000 });

// K6 amendment — gap-fill guard (no silent assume-zero). Services are mocked; the
// reconciliation lib (financingReconciliation) and date helpers run REAL so the gap
// enumeration + worksheet math are exercised end-to-end.
const hoisted = vi.hoisted(() => ({
  authValue: { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  listFinancingMonths: vi.fn(),
  getFinancingReconciliation: vi.fn(),
  reconcileFinancing: vi.fn(),
  transitionFinancingStatus: vi.fn(),
  setFinancingMonth: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', () => ({
  getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
  listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a),
  getFinancingReconciliation: (...a) => hoisted.getFinancingReconciliation(...a),
  reconcileFinancing: (...a) => hoisted.reconcileFinancing(...a),
  transitionFinancingStatus: (...a) => hoisted.transitionFinancingStatus(...a),
  setFinancingMonth: (...a) => hoisted.setFinancingMonth(...a),
  // FinancingStatusBadge (rendered by the panel) reads these from the service.
  FINANCING_STATUS_LABELS: {
    not_on_financing:         'Not on financing',
    on_financing:             'On Financing',
    reconciling:              'Reconciling',
    post_financing_repayment: 'Post-fin. repayment',
    cleared:                  'Cleared',
  },
}));
// Pin "today" to a deterministic TT month: 2026-04 → manual_election, reconMonthKey 2026_04.
vi.mock('../../../utils/dateInputs', async (orig) => {
  const actual = await orig();
  return { ...actual, getTodayTT: () => '2026-04-20' };
});

import FinancingReconciliationPanel from '../FinancingReconciliationPanel';

// effectiveDate month 1 = 2026_01; status reconciling so the gap card + worksheet render.
const TERMS = {
  effectiveDate: '2026-01-15',
  financingStatus: 'reconciling',
  currentMonthlyFinancing: 8000,
  agreedMonthlyFinancing: 8000,
  validatingAPI: 30000,
};

const M = (month, runningBalance) => ({
  month, agentId: 'agent-1', tenantId: 't1',
  financingPaid: 8000, netCommission: 4000, bonusOffset: 0, runningBalance,
});

async function selectAgent() {
  const select = await screen.findByTestId('recon-agent-select');
  fireEvent.change(select, { target: { value: 'agent-1' } });
}

describe('FinancingReconciliationPanel — gap-fill (K6 amendment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { userProfile: { name: 'B. Manager' }, role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Ana Agent', role: 'agent' }]);
    hoisted.getFinancingTerms.mockResolvedValue(TERMS);
    hoisted.getFinancingReconciliation.mockResolvedValue(null);
    hoisted.reconcileFinancing.mockResolvedValue({ id: 'agent-1_2026' });
    hoisted.setFinancingMonth.mockResolvedValue({ id: 'agent-1_2026_03' });
    hoisted.listFinancingMonths.mockResolvedValue([]);
    hoisted.showToast.mockReset();
  });

  it('blocks unit_manager (defense-in-depth guard)', () => {
    hoisted.authValue = { userProfile: {}, role: 'unit_manager', tenantId: 't1' };
    render(<FinancingReconciliationPanel />);
    expect(screen.getByText(/Branch Managers and above/i)).toBeInTheDocument();
  });

  it('flags trailing + middle gaps, badges the math-critical ones, disables settle', async () => {
    // Entered 2026_01, 2026_02 → gaps 2026_03 (month 3, waiver) and 2026_04 (recon month, closing).
    hoisted.listFinancingMonths.mockResolvedValue([M('2026_01', 8000), M('2026_02', 16000)]);
    render(<FinancingReconciliationPanel />);
    await selectAgent();

    expect(await screen.findByTestId('recon-gaps')).toBeInTheDocument();
    const waiverGap = await screen.findByTestId('recon-gap-2026_03');
    const closingGap = await screen.findByTestId('recon-gap-2026_04');
    expect(waiverGap).toHaveTextContent(/affects waiver/i);
    expect(closingGap).toHaveTextContent(/affects closing/i);

    // Owing outcome (closing 16000, no waiver — service < 12) → settle button disabled.
    const settle = screen.getByRole('button', { name: /start garnish/i });
    expect(settle).toBeDisabled();
    expect(screen.getByTestId('recon-worksheet-preliminary')).toBeInTheDocument();
  });

  it('never flags an entered (present) month', async () => {
    // Entered 2026_01, 2026_02, 2026_04 → only 2026_03 is a gap.
    hoisted.listFinancingMonths.mockResolvedValue([M('2026_01', 8000), M('2026_02', 16000), M('2026_04', 32000)]);
    render(<FinancingReconciliationPanel />);
    await selectAgent();

    expect(await screen.findByTestId('recon-gap-2026_03')).toBeInTheDocument();
    expect(screen.queryByTestId('recon-gap-2026_01')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recon-gap-2026_02')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recon-gap-2026_04')).not.toBeInTheDocument();
  });

  it('confirms a gap: pre-filled carry-forward $0 month written with the gap-fill source flag', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([M('2026_01', 8000), M('2026_02', 16000), M('2026_04', 32000)]);
    render(<FinancingReconciliationPanel />);
    await selectAgent();
    await screen.findByTestId('recon-gap-2026_03', {}, { timeout: 5000 });

    // Pre-fill: runningBalance carries from 2026_02 (16000); flows pre-fill 0.
    expect(screen.getByTestId('gap-2026_03-rb')).toHaveValue(16000);
    expect(screen.getByTestId('gap-2026_03-fp')).toHaveValue(0);

    // Manager affirmatively confirms (per-row action — not a silent accept).
    fireEvent.click(screen.getByRole('button', { name: /confirm month/i }));

    await waitFor(() => expect(hoisted.setFinancingMonth).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [tenantId, agentId, month, statement, actor] = hoisted.setFinancingMonth.mock.calls[0];
    expect(tenantId).toBe('t1');
    expect(agentId).toBe('agent-1');
    expect(month).toBe('2026_03');
    expect(statement).toMatchObject({
      financingPaid: '0', netCommission: '0', bonusOffset: '0',
      runningBalance: '16000', source: 'reconciliation_gap_fill',
    });
    expect(actor).toMatchObject({ role: 'branch_manager' });
  });

  it('once every gap is confirmed the gap card clears and settle enables', async () => {
    // First load has the 2026_03 gap; the post-confirm reload returns the complete ledger.
    hoisted.listFinancingMonths
      .mockResolvedValueOnce([M('2026_01', 8000), M('2026_02', 16000), M('2026_04', 32000)])
      .mockResolvedValue([M('2026_01', 8000), M('2026_02', 16000), M('2026_03', 16000), M('2026_04', 32000)]);
    render(<FinancingReconciliationPanel />);
    await selectAgent();
    await screen.findByTestId('recon-gap-2026_03', {}, { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: /confirm month/i }));

    await waitFor(() => expect(screen.queryByTestId('recon-gaps')).not.toBeInTheDocument(), { timeout: 5000 });
    const settle = screen.getByRole('button', { name: /start garnish/i });
    expect(settle).toBeEnabled();
  });
});
