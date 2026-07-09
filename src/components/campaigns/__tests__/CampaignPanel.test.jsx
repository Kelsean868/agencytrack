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

vi.mock('../../../services/persistencyService', () => ({
  getPersistencyMapForYear: vi.fn(),
}));

import {
  getCampaigns, getCampaignSubmissions, createCampaign,
} from '../../../services/campaignService';
import { getTenantUsers } from '../../../services/managerService';
import { getPersistencyMapForYear } from '../../../services/persistencyService';
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

describe('CampaignPanel — 0.1b actionable empty (manager list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCampaigns.mockResolvedValue([]);
    getTenantUsers.mockResolvedValue([]);
  });

  it('shows a "New Campaign" CTA for a manager (canCreate) when the active-campaigns list is empty', async () => {
    render(<CampaignPanel />);

    const empty = await screen.findByTestId('campaign-list-empty');
    expect(empty).toHaveTextContent(/no active campaigns/i);
    const ctas = screen.getAllByRole('button', { name: /new campaign/i });
    expect(ctas.length).toBeGreaterThan(0);
    fireEvent.click(ctas[ctas.length - 1]);
    // Opens the create-campaign form drawer.
    await waitFor(() => expect(screen.getByText('Scope')).toBeInTheDocument());
  });
});

// ── 2.9 Campaigns v2 — standings / tiers / podium / gate / projected payouts ──
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const ACTIVE_START = iso(-7);
const ACTIVE_END = iso(7);

const AGENTS = [
  { id: 'a', name: 'Ana Green', role: 'agent', unitId: 'S-01' },
  { id: 'b', name: 'Bob Blue', role: 'agent', unitId: 'S-02' },
];

const QUALIFY_CAMPAIGN = {
  id: 'camp-q', name: 'Q1 Fast Start',
  startDate: ACTIVE_START, endDate: ACTIVE_END,
  scope: { type: 'branch', unitIds: [], agentIds: [] },
  targets: [{ metric: 'apiSold', threshold: 100_000 }],
  structure: 'qualify', standingsMetric: 'apiSold', persistencyGateEnabled: true,
  tiers: [{ level: 1, name: 'Bronze', api: 75_000, apps: 8, cash: 2_000, voucher: 0 }],
  status: 'active',
};

const PLACEMENT_CAMPAIGN = {
  id: 'camp-p', name: "Closer's Cup",
  startDate: ACTIVE_START, endDate: ACTIVE_END,
  scope: { type: 'branch', unitIds: [], agentIds: [] },
  targets: [{ metric: 'applicationsSold', threshold: 5 }],
  structure: 'placement', standingsMetric: 'applicationsSold', persistencyGateEnabled: true,
  placements: [{ rank: 1, prize: 2_000 }, { rank: 2, prize: 1_000 }, { rank: 3, prize: 500 }],
  status: 'active',
};

const LEGACY_CAMPAIGN = {
  id: 'camp-legacy', name: 'Legacy Trip',
  startDate: ACTIVE_START, endDate: ACTIVE_END,
  scope: { type: 'branch', unitIds: [], agentIds: [] },
  targets: [{ metric: 'apiSold', threshold: 100_000 }],
  prize: 'Weekend Getaway', status: 'active',
};

describe('CampaignPanel — 2.9 tiered standings (display-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantUsers.mockResolvedValue(AGENTS);
    getCampaignSubmissions.mockResolvedValue([
      { agentId: 'a', apiSold: 300_000, applicationsSold: 10 },
      { agentId: 'b', apiSold: 90_000, applicationsSold: 9 },
    ]);
    getPersistencyMapForYear.mockResolvedValue({});
  });

  it('a qualify campaign expands into the v2 standings block (ladder + live standings), not the legacy progress table', async () => {
    getCampaigns.mockResolvedValue([QUALIFY_CAMPAIGN]);
    render(<CampaignPanel />);

    const row = await screen.findByText('Q1 Fast Start');
    fireEvent.click(row);

    await waitFor(() => expect(screen.getByText(/live standings/i)).toBeInTheDocument());
    // Prize-tier ladder is rendered.
    expect(screen.getByText(/prize ladder/i)).toBeInTheDocument();
    expect(screen.getAllByText('Bronze').length).toBeGreaterThan(0);
    // Both advisors appear in standings; legacy table header is absent.
    expect(screen.getByText('Ana Green')).toBeInTheDocument();
    expect(screen.queryByText(/participant progress/i)).toBeNull();
    // Persistency gate strip renders (display).
    expect(screen.getByText(/persistency gate/i)).toBeInTheDocument();
  });

  it('a placement campaign expands into the podium', async () => {
    getCampaigns.mockResolvedValue([PLACEMENT_CAMPAIGN]);
    render(<CampaignPanel />);

    fireEvent.click(await screen.findByText("Closer's Cup"));

    await waitFor(() => expect(screen.getByText(/podium · top three win/i)).toBeInTheDocument());
    // Leader (Ana, 10 apps) ranks first; both advisors shown (podium + standings).
    expect(screen.getAllByText('Ana Green').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Blue').length).toBeGreaterThan(0);
  });

  it('a legacy flat campaign renders exactly as before — the progress table, no v2 standings, no crash', async () => {
    getCampaigns.mockResolvedValue([LEGACY_CAMPAIGN]);
    render(<CampaignPanel />);

    fireEvent.click(await screen.findByText('Legacy Trip'));

    await waitFor(() => expect(screen.getByText(/participant progress/i)).toBeInTheDocument());
    expect(screen.queryByText(/live standings/i)).toBeNull();
    expect(screen.queryByText(/prize ladder/i)).toBeNull();
    // Persistency is NOT fetched for legacy campaigns (read-light).
    expect(getPersistencyMapForYear).not.toHaveBeenCalled();
  });
});

describe('CampaignPanel — 2.9 form round-trips prize tiers optionally', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCampaigns.mockResolvedValue([]);
    getTenantUsers.mockResolvedValue(AGENTS);
    createCampaign.mockResolvedValue('new-id');
  });

  it('selecting "Qualify tiers", adding a tier, and saving persists tiers on the campaign doc', async () => {
    render(<CampaignPanel />);

    const ctas = await screen.findAllByRole('button', { name: /new campaign/i });
    fireEvent.click(ctas[ctas.length - 1]);
    await waitFor(() => expect(screen.getByText('Scope')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/campaign name/i), { target: { value: 'Tiered Push' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-03-31' } });
    fireEvent.change(screen.getByPlaceholderText(/threshold/i), { target: { value: '100000' } });

    // Opt into the qualify structure.
    fireEvent.click(screen.getByRole('radio', { name: /qualify tiers/i }));
    fireEvent.click(screen.getByRole('button', { name: /add tier/i }));

    fireEvent.change(screen.getByLabelText(/tier 1 name/i), { target: { value: 'Gold' } });
    fireEvent.change(screen.getByLabelText(/cash prize/i), { target: { value: '10000' } });

    fireEvent.click(screen.getByRole('button', { name: /save campaign/i }));

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = createCampaign.mock.calls[0][4];
    expect(payload.structure).toBe('qualify');
    expect(payload.tiers).toHaveLength(1);
    expect(payload.tiers[0]).toMatchObject({ name: 'Gold', cash: '10000' });
    expect(payload.standingsMetric).toBe('apiSold');
    expect(payload.persistencyGateEnabled).toBe(true);
  });

  it('a simple (legacy) campaign still saves with a free-text prize and no structure', async () => {
    render(<CampaignPanel />);

    const ctas = await screen.findAllByRole('button', { name: /new campaign/i });
    fireEvent.click(ctas[ctas.length - 1]);
    await waitFor(() => expect(screen.getByText('Scope')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/campaign name/i), { target: { value: 'Simple Trip' } });
    fireEvent.change(screen.getByLabelText(/^prize/i), { target: { value: 'Weekend Getaway' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-03-31' } });
    fireEvent.change(screen.getByPlaceholderText(/threshold/i), { target: { value: '100000' } });

    fireEvent.click(screen.getByRole('button', { name: /save campaign/i }));

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = createCampaign.mock.calls[0][4];
    expect(payload.prize).toBe('Weekend Getaway');
    expect(payload.structure).toBeNull();
    expect(payload.tiers).toEqual([]);
  });
});
