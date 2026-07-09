// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useFeatureFlag: vi.fn(),
  useAuth: vi.fn(),
  getActiveCampaignsForAgent: vi.fn(),
}));

vi.mock('../../../../hooks/useFeatureFlag', () => ({ useFeatureFlag: hoisted.useFeatureFlag }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: hoisted.getActiveCampaignsForAgent,
}));

import CampaignLensPanel from '../CampaignLensPanel';

const CAMPAIGN = {
  id: 'nov', name: 'November Sprint', scope: { type: 'branch' },
  startDate: '2026-01-01', endDate: '2026-12-31',
  structure: 'qualify', tiers: [{ api: 50000 }, { api: 100000 }],
};
const POLICIES = [
  { id: 'a', ownerName: 'A. Gopaul', productLine: 'life', status: 'settled', dateSubmitted: '2026-06-01', settledAPI: 21600 },
  { id: 'b', ownerName: 'K. Baksh', productLine: 'life', status: 'submitted', dateSubmitted: '2026-06-05' },
  { id: 'c', ownerName: 'R. Mohammed', productLine: 'motor', status: 'settled', dateSubmitted: '2026-06-05', settledAPI: 500 },
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({ user: { uid: 'a1' }, userProfile: { unitId: 'u1' }, tenantId: 't1' });
  hoisted.getActiveCampaignsForAgent.mockResolvedValue([CAMPAIGN]);
});
afterEach(() => cleanup());

describe('CampaignLensPanel', () => {
  it('renders NOTHING and fires no fetch when the flag is OFF (byte-identical)', () => {
    hoisted.useFeatureFlag.mockReturnValue(false);
    const { container } = render(<CampaignLensPanel policies={POLICIES} />);
    expect(container.firstChild).toBeNull();
    expect(hoisted.getActiveCampaignsForAgent).not.toHaveBeenCalled();
  });

  it('renders the lens strip, chips and contribution badges when ON', async () => {
    hoisted.useFeatureFlag.mockReturnValue(true);
    render(<CampaignLensPanel policies={POLICIES} />);
    await waitFor(() => expect(screen.getByTestId('campaign-lens-strip')).toBeInTheDocument());
    // 1 settled-in-window life policy COUNTS; 1 submitted PENDING; motor EXCLUDED
    expect(screen.getByTestId('contribution-badge-counts')).toBeInTheDocument();
    expect(screen.getByTestId('lens-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('lens-filter-counts')).toBeInTheDocument();
    // Export proof is present but disabled (not wired)
    expect(screen.getByTestId('campaign-lens-export')).toBeDisabled();
  });

  it('filters the contribution list by state', async () => {
    hoisted.useFeatureFlag.mockReturnValue(true);
    render(<CampaignLensPanel policies={POLICIES} />);
    await waitFor(() => expect(screen.getByTestId('campaign-lens-strip')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('lens-filter-excluded'));
    // Motor policy is the only excluded one
    expect(screen.getByText('R. Mohammed')).toBeInTheDocument();
    expect(screen.queryByText('A. Gopaul')).not.toBeInTheDocument();
  });

  it('shows the honest empty state when there is no active campaign', async () => {
    hoisted.useFeatureFlag.mockReturnValue(true);
    hoisted.getActiveCampaignsForAgent.mockResolvedValue([]);
    render(<CampaignLensPanel policies={POLICIES} />);
    await waitFor(() => expect(screen.getByTestId('campaign-lens-empty')).toBeInTheDocument());
  });

  it('surfaces an error card with Retry when the campaign load fails', async () => {
    hoisted.useFeatureFlag.mockReturnValue(true);
    hoisted.getActiveCampaignsForAgent.mockRejectedValue(new Error('denied'));
    render(<CampaignLensPanel policies={POLICIES} />);
    await waitFor(() => expect(screen.getByTestId('campaign-lens-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
