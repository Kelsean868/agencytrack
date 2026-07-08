// @vitest-environment jsdom
//
// §1 states-contract coverage for CampaignPanel's load() — previously a bare
// console.error swallow with the panel stuck rendering an empty list forever.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userProfile: { name: 'Test Manager', email: 'manager@example.com' },
    role: 'branch_manager',
    tenantId: 'tenant-test',
  }),
}));

vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('../../../services/campaignService', () => ({
  getCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  getCampaignSubmissions: vi.fn(),
}));

vi.mock('../../../services/managerService', () => ({
  getTenantUsers: vi.fn(),
}));

import { getCampaigns } from '../../../services/campaignService';
import { getTenantUsers } from '../../../services/managerService';
import CampaignPanel from '../CampaignPanel';

describe('CampaignPanel — §1 states contract (error / retry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Known-good baseline; individual tests override to reject.
    getCampaigns.mockResolvedValue([]);
    getTenantUsers.mockResolvedValue([]);
  });

  it('renders a persistent inline error card with Retry when the load fails (never a silent console.error swallow)', async () => {
    getCampaigns.mockRejectedValue(new Error('boom-campaigns'));

    render(<CampaignPanel />);

    await waitFor(() => expect(screen.getByTestId('campaign-panel-error')).toBeInTheDocument());
    expect(screen.getByTestId('campaign-panel-error')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry re-invokes the same load path and recovers on success', async () => {
    getCampaigns.mockRejectedValueOnce(new Error('boom-campaigns'));
    getCampaigns.mockResolvedValueOnce([]);

    render(<CampaignPanel />);

    await waitFor(() => expect(screen.getByTestId('campaign-panel-error')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByTestId('campaign-panel-error')).toBeNull());
    expect(getCampaigns).toHaveBeenCalledTimes(2);
    expect(getTenantUsers).toHaveBeenCalledTimes(2);
  });
});
