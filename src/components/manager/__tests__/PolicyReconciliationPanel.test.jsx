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
    await waitFor(() => expect(screen.getByTestId('reconcil-empty')).toBeInTheDocument());
  });

  it('groups policies by agent — two agents produce two section headers', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy(), makePolicyB()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => {
      expect(screen.getByText('Alice Agent')).toBeInTheDocument();
      expect(screen.getByText('Bob Agent')).toBeInTheDocument();
    });
    expect(screen.getByTestId('agent-group-agent-a')).toBeInTheDocument();
    expect(screen.getByTestId('agent-group-agent-b')).toBeInTheDocument();
  });

  it('side-by-side: agent settled API and manager input are visible in same card', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('agent-api-pol-1')).toBeInTheDocument());
    expect(screen.getByTestId('agent-api-pol-1')).toHaveTextContent('$5000.00');
    expect(screen.getByTestId('manager-api-input-pol-1')).toBeInTheDocument();
  });

  it('checkbox selection — selecting a policy activates bulk-confirm button', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('policy-checkbox-pol-1')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-confirm-btn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('policy-checkbox-pol-1'));
    expect(screen.getByTestId('bulk-confirm-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-confirm-btn')).toHaveTextContent('Confirm Selected (1)');
  });

  it('bulk-confirm with blank managerSettledAPI defaults to agent settledAPI', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('policy-checkbox-pol-1')).toBeInTheDocument());

    // Select the policy (don't fill managerSettledAPI)
    fireEvent.click(screen.getByTestId('policy-checkbox-pol-1'));
    fireEvent.click(screen.getByTestId('bulk-confirm-btn'));

    await waitFor(() => expect(hoisted.confirmPolicy).toHaveBeenCalledTimes(1));
    // resolvedAPI should default to '5000' (agent's settledAPI) since input is blank
    const [, , , , resolvedAPI] = hoisted.confirmPolicy.mock.calls[0];
    expect(parseFloat(resolvedAPI)).toBe(5000);
  });

  it('select-all checkbox selects all unconfirmed policies', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy(), makePolicyB()]);
    render(<PolicyReconciliationPanel />);
    await waitFor(() => expect(screen.getByTestId('select-all-checkbox')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('select-all-checkbox'));
    expect(screen.getByTestId('bulk-confirm-btn')).toHaveTextContent('Confirm Selected (2)');
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
