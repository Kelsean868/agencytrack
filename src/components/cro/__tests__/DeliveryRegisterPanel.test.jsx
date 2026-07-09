// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { getTodayTT } from '../../../utils/dateInputs';

const hoisted = vi.hoisted(() => ({
  getDeliverablePolicies: vi.fn(),
  recordPolicyDelivery:   vi.fn(),
  listBranches:           vi.fn(),
  toastShow:              vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 't1', user: { uid: 'cro-1' } }),
}));
vi.mock('../../../services/policiesService', () => ({
  getDeliverablePolicies: hoisted.getDeliverablePolicies,
  recordPolicyDelivery:   hoisted.recordPolicyDelivery,
}));
vi.mock('../../../services/branchService', () => ({
  listBranches: hoisted.listBranches,
}));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.toastShow, dismiss: vi.fn() }),
}));

import DeliveryRegisterPanel from '../DeliveryRegisterPanel';

const UNDELIVERED = {
  id: 'u1', status: 'settled', policyDeliveryDate: null, dateIssued: '2026-01-10',
  ownerName: 'Anil Boodram', policyNumber: 'TL-08661', agentNumber: 'A001', branchId: 'b1', settledAPI: 36000,
};
const UNDELIVERED_2 = {
  id: 'u2', status: 'settled', policyDeliveryDate: null, dateIssued: '2026-01-12',
  ownerName: 'Sara Khan', policyNumber: 'TL-08655', agentNumber: 'A002', branchId: 'b1', settledAPI: 18600,
};
const DELIVERED = {
  id: 'd1', status: 'settled', policyDeliveryDate: '2026-02-01', dateIssued: '2026-01-05',
  ownerName: 'Renee Baptiste', policyNumber: 'TL-08455', agentNumber: 'A003', branchId: 'b1', settledAPI: 21600,
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.listBranches.mockResolvedValue([{ id: 'b1', name: 'South Branch' }]);
  hoisted.recordPolicyDelivery.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('DeliveryRegisterPanel — four states', () => {
  it('shows the loading skeleton before data resolves', async () => {
    let resolve;
    hoisted.getDeliverablePolicies.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<DeliveryRegisterPanel />);
    expect(screen.getByTestId('delivery-register-loading')).toBeInTheDocument();
    resolve([]);
    await waitFor(() => expect(screen.getByTestId('delivery-register-empty')).toBeInTheDocument());
  });

  it('shows the error state + Retry when the load fails', async () => {
    hoisted.getDeliverablePolicies.mockRejectedValueOnce(new Error('boom'));
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getByTestId('delivery-register-error')).toBeInTheDocument());
    // Retry re-invokes the load
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByTestId('delivery-register-empty')).toBeInTheDocument());
  });

  it('shows an empty state for the To-deliver filter when there is nothing to deliver', async () => {
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([DELIVERED]);
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getByTestId('delivery-register-empty')).toBeInTheDocument());
  });
});

describe('DeliveryRegisterPanel — register split', () => {
  it('defaults to the To-deliver filter showing only undelivered settled policies', async () => {
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([UNDELIVERED, UNDELIVERED_2, DELIVERED]);
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getAllByTestId('delivery-row')).toHaveLength(2));
    expect(screen.getByText('Anil Boodram')).toBeInTheDocument();
    expect(screen.getByText('Sara Khan')).toBeInTheDocument();
    expect(screen.queryByText('Renee Baptiste')).toBeNull();
    // branch name resolved from the branch map
    expect(screen.getAllByText('South Branch').length).toBeGreaterThan(0);
  });

  it('switching to the Delivered filter shows delivered policies only', async () => {
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([UNDELIVERED, DELIVERED]);
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getByText('Anil Boodram')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Delivered/ }));
    await waitFor(() => expect(screen.getByText('Renee Baptiste')).toBeInTheDocument());
    expect(screen.queryByText('Anil Boodram')).toBeNull();
  });
});

describe('DeliveryRegisterPanel — mark delivered', () => {
  it('records delivery with deliveredBy + today, then flips the row to delivered', async () => {
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([UNDELIVERED]);
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getByTestId('mark-delivered-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mark-delivered-btn'));
    expect(screen.getByTestId('mark-delivered-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mark-delivered-confirm'));

    await waitFor(() => expect(hoisted.recordPolicyDelivery).toHaveBeenCalledOnce());
    expect(hoisted.recordPolicyDelivery).toHaveBeenCalledWith('t1', 'u1', {
      deliveredBy: 'cro-1',
      deliveryDate: getTodayTT(),
    });
    // Toast + local state flip: To-deliver is now empty
    await waitFor(() => expect(screen.getByTestId('delivery-register-empty')).toBeInTheDocument());
    expect(hoisted.toastShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('surfaces a permission-denied error inside the dialog and does not flip the row', async () => {
    hoisted.getDeliverablePolicies.mockResolvedValueOnce([UNDELIVERED]);
    const err = new Error('denied'); err.code = 'permission-denied';
    hoisted.recordPolicyDelivery.mockRejectedValueOnce(err);
    render(<DeliveryRegisterPanel />);
    await waitFor(() => expect(screen.getByTestId('mark-delivered-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mark-delivered-btn'));
    fireEvent.click(screen.getByTestId('mark-delivered-confirm'));

    await waitFor(() => expect(screen.getByText(/only a CRO can confirm delivery/i)).toBeInTheDocument());
    // dialog stays open; row still present
    expect(screen.getByTestId('mark-delivered-dialog')).toBeInTheDocument();
  });
});
