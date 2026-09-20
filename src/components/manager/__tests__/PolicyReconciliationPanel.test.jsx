// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getPoliciesForManager: vi.fn(),
  confirmPolicy: vi.fn(),
  getTenantUsers: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/policiesService', () => ({
  getPoliciesForManager: hoisted.getPoliciesForManager,
  confirmPolicy: hoisted.confirmPolicy,
}));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: hoisted.getTenantUsers,
}));

import PolicyReconciliationPanel from '../PolicyReconciliationPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BM_PROFILE = { uid: 'bm1', name: 'Branch Manager', branchId: 'branch-a' };
const TENANT_ID  = 'test-tenant';

function makePolicy(overrides = {}) {
  return {
    id:         'pol-1',
    agentId:    'agent-a',
    ownerName:  'Alice Doe',
    insuredName: 'Alice Doe',
    productLine: 'life',
    status:     'settled',
    settledAPI: 5000,
    dateIssued: { toDate: () => new Date(new Date().getFullYear(), new Date().getMonth(), 15) },
    confirmedAt: null,
    ...overrides,
  };
}

function makePolicyB(overrides = {}) {
  return {
    id:         'pol-2',
    agentId:    'agent-b',
    ownerName:  'Bob Smith',
    insuredName: 'Bob Smith',
    productLine: 'life',
    status:     'settled',
    settledAPI: 8000,
    dateIssued: { toDate: () => new Date(new Date().getFullYear(), new Date().getMonth(), 20) },
    confirmedAt: null,
    ...overrides,
  };
}

const USERS = [
  { id: 'agent-a', name: 'Alice Agent', role: 'agent' },
  { id: 'agent-b', name: 'Bob Agent',   role: 'agent' },
];

function setupBM() {
  hoisted.useAuth.mockReturnValue({
    userProfile: BM_PROFILE,
    role:        'branch_manager',
    tenantId:    TENANT_ID,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.getTenantUsers.mockResolvedValue(USERS);
  hoisted.getPoliciesForManager.mockResolvedValue([]);
  hoisted.confirmPolicy.mockResolvedValue(undefined);
});

describe('PolicyReconciliationPanel', () => {

  it('shows access-denied message for unit_manager without canConfirmSettlements', () => {
    hoisted.useAuth.mockReturnValue({
      userProfile: { uid: 'um1', name: 'Unit Mgr', branchId: 'branch-a' },
      role: 'unit_manager',
      tenantId: TENANT_ID,
    });
    render(<PolicyReconciliationPanel />);
    expect(screen.getByText(/you do not have access/i)).toBeInTheDocument();
  });

  it('shows loading indicator while fetching', async () => {
    setupBM();
    // Never resolves during this test
    hoisted.getPoliciesForManager.mockReturnValue(new Promise(() => {}));
    render(<PolicyReconciliationPanel />);
    expect(screen.getByTestId('reconcil-loading')).toBeInTheDocument();
  });

  it('shows error when load fails', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockRejectedValue(new Error('Firestore error'));
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('reconcil-error')).toBeInTheDocument());
    expect(screen.getByTestId('reconcil-error')).toHaveTextContent('Firestore error');
  });

  it('shows empty state when no unconfirmed settled policies', async () => {
    setupBM();
    render(<PolicyReconciliationPanel />);
    await screen.findByTestId('reconcil-empty');
  });

  it('worklist renders a row per unconfirmed policy (flat, not agent-grouped)', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy(), makePolicyB()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('recon-row-pol-1')).toBeInTheDocument());
    expect(screen.getByTestId('recon-row-pol-2')).toBeInTheDocument();
    // Owner names visible; no agent-group section wrappers.
    expect(screen.getByText('Alice Doe')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-group-agent-a')).not.toBeInTheDocument();
  });

  it('row shows the ledger figure ("from circular" framing) and the key-in input', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('ledger-api-pol-1')).toBeInTheDocument());
    expect(screen.getByTestId('ledger-api-pol-1')).toHaveTextContent(/TTD\s*5,000/);
    expect(screen.getByTestId('manager-api-input-pol-1')).toBeInTheDocument();
    // Honest framing — no "Tatil Report" anywhere; "from circular" present.
    expect(screen.queryByText(/Tatil Report/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/from circular/i).length).toBeGreaterThan(0);
  });

  it('pending-reconciliation hero + 3 tiles render from existing data', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy(), makePolicyB()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('pending-hero')).toBeInTheDocument());
    expect(screen.getByTestId('recon-tile-toReconcile')).toBeInTheDocument();
    expect(screen.getByTestId('recon-tile-flagged')).toBeInTheDocument();
    expect(screen.getByTestId('recon-tile-confirmed')).toBeInTheDocument();
    // 2 unconfirmed settled in period → "To reconcile" count = 2; hero = Σ settledAPI = TTD 13.0K.
    expect(screen.getByTestId('recon-tile-count-toReconcile')).toHaveTextContent('2');
    expect(screen.getByTestId('pending-value')).toHaveTextContent(/TTD\s*13\.0K/);
  });

  it('an IMPORTED settled policy is absent from "To reconcile"', async () => {
    // 117 imported settled policies sat in this worklist asking a manager to
    // confirm a status head office had already decided. `confirmedAt` is null on
    // all of them and always will be — the import never writes a confirmation,
    // because no manager step exists on that path.
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([
      makePolicy({ statusSource: 'oipa_import' }),
      makePolicyB(), // hand-keyed, still needs the manager
    ]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('pending-hero')).toBeInTheDocument());

    // Only the hand-keyed one remains, and the pending value follows it.
    expect(screen.getByTestId('recon-tile-count-toReconcile')).toHaveTextContent('1');
    expect(screen.getByTestId('pending-value')).toHaveTextContent(/TTD\s*8\.0K/);
  });

  it('an imported policy CHANGED BY HAND is still in "To reconcile"', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([
      makePolicy({ importSource: 'oipa_import', statusSource: 'manager' }),
      makePolicyB(),
    ]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('pending-hero')).toBeInTheDocument());
    expect(screen.getByTestId('recon-tile-count-toReconcile')).toHaveTextContent('2');
  });

  it('NO bulk "Confirm all clean" control — per-policy confirm only (unsafe-bulk dropped)', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('confirm-btn-pol-1')).toBeInTheDocument());
    expect(screen.queryByTestId('confirm-all-clean-btn')).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirm all/i)).not.toBeInTheDocument();
  });

  it('per-policy confirm with a blank key-in defaults to the ledger figure', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('confirm-btn-pol-1')).toBeInTheDocument());

    // Leave the key-in blank → Confirm → resolvedAPI defaults to the ledger settledAPI (5000).
    fireEvent.click(screen.getByTestId('confirm-btn-pol-1'));
    await waitFor(() => expect(hoisted.confirmPolicy).toHaveBeenCalledTimes(1));
    const [, , , , resolvedAPI] = hoisted.confirmPolicy.mock.calls[0];
    expect(parseFloat(resolvedAPI)).toBe(5000);
  });

  it('individual confirm calls confirmPolicy with the entered manager API', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('manager-api-input-pol-1')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('manager-api-input-pol-1'), { target: { value: '5500' } });
    fireEvent.click(screen.getByTestId('confirm-btn-pol-1'));

    await waitFor(() => expect(hoisted.confirmPolicy).toHaveBeenCalledTimes(1));
    const [, , , , resolvedAPI] = hoisted.confirmPolicy.mock.calls[0];
    expect(resolvedAPI).toBe('5500');
  });

  it('UM with canConfirmSettlements can access the panel', async () => {
    hoisted.useAuth.mockReturnValue({
      userProfile: { uid: 'um1', name: 'Unit Mgr', branchId: 'branch-a', canConfirmSettlements: true },
      role: 'unit_manager',
      tenantId: TENANT_ID,
    });
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/Policy Reconciliation/)).toBeInTheDocument());
    expect(screen.queryByText(/you do not have access/i)).not.toBeInTheDocument();
  });
});
