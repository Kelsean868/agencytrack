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

  // ── P2c Part 5 — sales_manager sees Policy Reconciliation (ruling 27 Sep 2026) ──
  describe('sales_manager', () => {
    const SM_PROFILE = { uid: 'sm1', name: 'Sales Mgr', branchId: 'branch-a' };
    const setupSM = (extra = {}) => hoisted.useAuth.mockReturnValue({
      userProfile: { ...SM_PROFILE, ...extra }, role: 'sales_manager', tenantId: TENANT_ID,
    });

    it('SM sees the panel (no access-denied message) and loads tenant-wide', async () => {
      setupSM();
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy(), makePolicyB({ agentId: 'agent-b' })]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('recon-row-pol-1')).toBeInTheDocument());
      expect(screen.queryByText(/you do not have access/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('recon-row-pol-2')).toBeInTheDocument();
      // Scope passed through as SM — getPoliciesForManager adds no branch clause for it.
      expect(hoisted.getPoliciesForManager).toHaveBeenCalledWith(TENANT_ID, { role: 'sales_manager', uid: 'sm1', branchId: 'branch-a' });
    });

    it('SM without canConfirmSettlements is VIEW-ONLY: no key-in, no Confirm, no Lapse tab', async () => {
      setupSM();
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('recon-row-pol-1')).toBeInTheDocument());
      expect(screen.getByTestId('recon-view-only')).toBeInTheDocument();
      expect(screen.getByTestId('ledger-api-pol-1')).toHaveTextContent(/TTD\s*5,000/);
      expect(screen.queryByTestId('manager-api-input-pol-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('manager-note-input-pol-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('confirm-btn-pol-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab-lapse')).not.toBeInTheDocument();
    });

    // P2d Part 4.2 — the "Confirm" TAB button used to sit beside "View only".
    it('SM without canConfirmSettlements sees NO Confirm button of any kind', async () => {
      setupSM();
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('recon-row-pol-1')).toBeInTheDocument());
      expect(screen.getByTestId('recon-view-only')).toBeInTheDocument();
      expect(screen.queryByTestId('tab-confirm')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeInTheDocument();
    });

    it('SM WITH canConfirmSettlements keeps the Confirm tab', async () => {
      setupSM({ canConfirmSettlements: true });
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('confirm-btn-pol-1')).toBeInTheDocument());
      expect(screen.getByTestId('tab-confirm')).toBeInTheDocument(); // the negative check above is not vacuous
    });

    it('SM WITH canConfirmSettlements may confirm (rules Arm C already allows it) but still not lapse', async () => {
      setupSM({ canConfirmSettlements: true });
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('confirm-btn-pol-1')).toBeInTheDocument());
      expect(screen.queryByTestId('recon-view-only')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab-lapse')).not.toBeInTheDocument();
    });

    it('BM keeps the full confirm controls (no view-only notice)', async () => {
      setupBM();
      hoisted.getPoliciesForManager.mockResolvedValue([makePolicy()]);
      render(<PolicyReconciliationPanel />);
      await waitFor(() => expect(screen.getByTestId('confirm-btn-pol-1')).toBeInTheDocument());
      expect(screen.queryByTestId('recon-view-only')).not.toBeInTheDocument();
      expect(screen.getByTestId('tab-lapse')).toBeInTheDocument(); // the negative SM checks are not vacuous
    });
  });
});

// Kyron ruling 2B (30-09-2026, after F-4): head-office policies are hidden on
// the Lapse tab — a manager may not change a status head office set.
describe('PolicyReconciliationPanel — Lapse tab hides head-office policies', () => {
  const openLapseTab = async () => {
    await waitFor(() => expect(screen.getByTestId('tab-lapse')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-lapse'));
  };

  it('shows a self-declared settled policy and hides a head-office one, saying how many are hidden', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([
      makePolicy({ statusSource: 'oipa_import' }),   // head office
      makePolicyB({ statusSource: 'agent' }),        // self-declared
    ]);
    render(<PolicyReconciliationPanel />);
    await openLapseTab();
    expect(screen.getByTestId('lapse-policy-card-pol-2')).toBeInTheDocument();
    expect(screen.queryByTestId('lapse-policy-card-pol-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('lapse-hidden-ho')).toHaveTextContent('1 head-office policy is not shown: head office sets its status.');
    // CodeRabbit on #1037: the count changes with the period, so screen readers are told.
    expect(screen.getByTestId('lapse-hidden-ho')).toHaveAttribute('aria-live', 'polite');
  });

  it('a policy imported from head office but whose status a person set stays listed (statusSource, not importSource)', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([makePolicy({ importSource: 'oipa_import', statusSource: 'manager' })]);
    render(<PolicyReconciliationPanel />);
    await openLapseTab();
    expect(screen.getByTestId('lapse-policy-card-pol-1')).toBeInTheDocument();
    expect(screen.queryByTestId('lapse-hidden-ho')).not.toBeInTheDocument();
  });

  it('only head-office policies: the empty state says none can be lapsed, and the note counts them', async () => {
    setupBM();
    hoisted.getPoliciesForManager.mockResolvedValue([
      makePolicy({ statusSource: 'oipa_import' }),
      makePolicyB({ statusSource: 'oipa_import' }),
    ]);
    render(<PolicyReconciliationPanel />);
    await openLapseTab();
    expect(screen.getByTestId('lapse-empty')).toHaveTextContent(/^No policies you can lapse for /);
    expect(screen.getByTestId('lapse-hidden-ho')).toHaveTextContent('2 head-office policies are not shown: head office sets their status.');
  });
});
