// @vitest-environment jsdom
/**
 * FR-6 (Option A) — the Policy ledger wires "Mark reinstated" / "Withdraw" on
 * an own lapsed policy to policiesService, keeps the drawer open on the fresh
 * doc, and offers nothing on another role's or a non-lapsed policy.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getOwnPolicies: vi.fn(),
  getPolicyHistory: vi.fn(),
  declareReinstatement: vi.fn(),
  withdrawReinstatement: vi.fn(),
  getPolicyPlans: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useFeatureFlag', () => ({ useFeatureFlag: () => false }));
vi.mock('../../../services/campaignService', () => ({ getActiveCampaignsForAgent: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies: hoisted.getOwnPolicies,
  getPolicyHistory: hoisted.getPolicyHistory,
  declareReinstatement: hoisted.declareReinstatement,
  withdrawReinstatement: hoisted.withdrawReinstatement,
  createPolicy: vi.fn(),
  transitionPolicyStatus: vi.fn(),
  selfConfirmPolicy: vi.fn(),
}));
vi.mock('../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCES: [{ value: 'referral', label: 'Referral' }],
  PROSPECTING_SOURCE_LABELS: { referral: 'Referral' },
}));
vi.mock('../../../services/planCatalogService', () => ({ getPolicyPlans: hoisted.getPolicyPlans }));

import PolicyLedgerPanel from '../PolicyLedgerPanel';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const LAPSED = {
  id: 'p1', agentId: 'agent1', ownerName: 'Lapsed Owner', insuredName: 'Lapsed Owner', policyNumber: 'TRM1',
  status: 'lapsed', statusSource: 'oipa_import', proposedAPI: 5000, productLine: 'life',
  sourceOfProspect: 'referral', cashWithApp: { collected: false, amount: '' },
};
const DECLARED = { ...LAPSED, reinstatementDeclaredAt: ts('2026-09-12T16:00:00Z'), reinstatementDeclaredBy: 'agent1' };

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({ user: { uid: 'agent1' }, userProfile: { name: 'Agent', unitId: 'um1' }, role: 'agent', tenantId: 'tenant1' });
  hoisted.getPolicyHistory.mockResolvedValue([]);
  hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [] });
  hoisted.declareReinstatement.mockResolvedValue();
  hoisted.withdrawReinstatement.mockResolvedValue();
});

async function openDrawer(id = 'p1') {
  await waitFor(() => screen.getByTestId(`policy-card-${id}`));
  fireEvent.click(screen.getByTestId(`policy-card-${id}`));
  return waitFor(() => screen.getByTestId('policy-drawer'));
}

describe('PolicyLedgerPanel — FR-6 Mark reinstated', () => {
  it('declares through the service with the caller, the doc and the note; the drawer stays open on the fresh doc', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([LAPSED]).mockResolvedValueOnce([DECLARED]);
    const onPoliciesChanged = vi.fn();
    render(<PolicyLedgerPanel onPoliciesChanged={onPoliciesChanged} />);
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Mark reinstated' }));
    fireEvent.change(within(drawer).getByLabelText('Receipt or reference (optional)'), { target: { value: 'R-77' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Confirm — mark reinstated' }));
    await waitFor(() => expect(hoisted.declareReinstatement).toHaveBeenCalledTimes(1));
    const [tenantId, declarer, policyId, policy, opts] = hoisted.declareReinstatement.mock.calls[0];
    expect(tenantId).toBe('tenant1');
    expect(declarer).toMatchObject({ uid: 'agent1', role: 'agent', unitId: 'um1' });
    expect(policyId).toBe('p1');
    expect(policy).toMatchObject({ id: 'p1', status: 'lapsed' });
    expect(opts).toEqual({ note: 'R-77' });
    await waitFor(() => expect(within(screen.getByTestId('policy-drawer')).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument());
    expect(onPoliciesChanged).toHaveBeenCalledTimes(1);
    // The ledger row carries the chip.
    expect(within(screen.getByTestId('policy-card-p1')).getByTestId('declared-reinstated-chip')).toBeInTheDocument();
  });

  it('withdraws through the service', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([DECLARED]).mockResolvedValueOnce([LAPSED]);
    render(<PolicyLedgerPanel />);
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(hoisted.withdrawReinstatement).toHaveBeenCalledWith('tenant1', expect.objectContaining({ uid: 'agent1' }), 'p1', expect.objectContaining({ id: 'p1' })));
    await waitFor(() => expect(within(screen.getByTestId('policy-drawer')).getByRole('button', { name: 'Mark reinstated' })).toBeInTheDocument());
  });

  it('a rejected write (e.g. rules not deployed yet) shows the error and changes nothing', async () => {
    hoisted.getOwnPolicies.mockResolvedValue([LAPSED]);
    hoisted.declareReinstatement.mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    render(<PolicyLedgerPanel />);
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Mark reinstated' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Confirm — mark reinstated' }));
    await waitFor(() => expect(within(drawer).getByRole('alert')).toHaveTextContent('Missing or insufficient permissions.'));
    expect(hoisted.getOwnPolicies).toHaveBeenCalledTimes(1); // no refetch
  });

  it('a role Arm G does not admit (tenant admin) gets no control', async () => {
    hoisted.useAuth.mockReturnValue({ user: { uid: 'agent1' }, userProfile: {}, role: 'tenant_admin', tenantId: 'tenant1' });
    hoisted.getOwnPolicies.mockResolvedValue([LAPSED]);
    render(<PolicyLedgerPanel />);
    const drawer = await openDrawer();
    expect(within(drawer).queryByRole('button', { name: 'Mark reinstated' })).toBeNull();
  });
});
