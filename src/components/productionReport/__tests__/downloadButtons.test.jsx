// @vitest-environment jsdom
//
// Item 2.5 — "Download report" CTA wiring + honest DataSourceBadge across the
// three production-report views.
//  - Agent view: renders the CTA only when onDownloadPDF is supplied and calls
//    it (wires to the host dashboard's existing generateAgentPDF flow).
//  - Unit / Branch views: self-generate via generateUnitPDF / generateBranchPDF,
//    fed the view's OWN already-derived rows (no refetch).
//  - Every view shows the honest "Estimated" badge (submissions-only, no
//    settlement fetch).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useLeaderboard: vi.fn(),
  getAgentSubmissions: vi.fn(),
  getTenantUsers: vi.fn(),
  getAllYTDSubmissions: vi.fn(),
  getAgentHistory: vi.fn(),
  generateUnitPDF: vi.fn(),
  generateBranchPDF: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useLeaderboard', () => ({ default: hoisted.useLeaderboard }));
vi.mock('../../../services/submissionService', () => ({ getAgentSubmissions: hoisted.getAgentSubmissions }));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: hoisted.getTenantUsers,
  getAllYTDSubmissions: hoisted.getAllYTDSubmissions,
}));
vi.mock('../../../services/persistencyService', () => ({ getAgentHistory: hoisted.getAgentHistory }));
vi.mock('../../../services/exportService', () => ({
  generateUnitPDF: hoisted.generateUnitPDF,
  generateBranchPDF: hoisted.generateBranchPDF,
}));

import AgentProductionView from '../AgentProductionView';
import UnitManagerProductionView from '../UnitManagerProductionView';
import BranchManagerProductionView from '../BranchManagerProductionView';

const YEAR = new Date().getFullYear();

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useLeaderboard.mockReturnValue({
    loading: false, error: null, doc: null,
    byPeriod: { week: [], mtd: [], qtd: [], ytd: [] }, branchId: 'b1',
  });
  hoisted.getAgentSubmissions.mockResolvedValue([]);
  hoisted.getTenantUsers.mockResolvedValue([]);
  hoisted.getAllYTDSubmissions.mockResolvedValue([]);
  hoisted.getAgentHistory.mockResolvedValue([]);
  hoisted.generateUnitPDF.mockResolvedValue(undefined);
  hoisted.generateBranchPDF.mockResolvedValue(undefined);
});

describe('AgentProductionView — download CTA', () => {
  beforeEach(() => {
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'me' }, userProfile: { name: 'Ann', unitId: null }, tenantId: 't1',
    });
  });

  it('renders no download button when onDownloadPDF is absent', async () => {
    render(<AgentProductionView />);
    await screen.findByTestId('agent-production-rank-pill');
    expect(screen.queryByTestId('agent-production-download')).toBeNull();
  });

  it('renders the CTA and calls onDownloadPDF when supplied', async () => {
    const onDownloadPDF = vi.fn();
    render(<AgentProductionView onDownloadPDF={onDownloadPDF} />);
    const btn = await screen.findByTestId('agent-production-download');
    expect(btn).toHaveTextContent(/Download report/i);
    fireEvent.click(btn);
    expect(onDownloadPDF).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA while generating', async () => {
    render(<AgentProductionView onDownloadPDF={vi.fn()} generating />);
    const btn = await screen.findByTestId('agent-production-download');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/Generating/i);
  });

  it('shows the honest Estimated badge (submissions only)', async () => {
    render(<AgentProductionView onDownloadPDF={vi.fn()} />);
    await screen.findByTestId('agent-production-rank-pill');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });
});

describe('UnitManagerProductionView — download CTA feeds generateUnitPDF', () => {
  beforeEach(() => {
    hoisted.useAuth.mockReturnValue({
      userProfile: { name: 'Marsha', unitId: 'u1', unitName: 'South · 02' }, tenantId: 't1',
    });
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'a1', role: 'agent', unitId: 'u1', name: 'Riaz' },
    ]);
    hoisted.getAllYTDSubmissions.mockResolvedValue([
      { agentId: 'a1', status: 'submitted', weekStarting: `${YEAR}-01-05`, newBusiness: { api: 10000, apps: 1 }, applicationsSold: 1 },
    ]);
  });

  it('calls generateUnitPDF with the view rows on click (YTD)', async () => {
    render(<UnitManagerProductionView />);
    // switch to YTD so the Jan submission is in-window deterministically
    fireEvent.click(await screen.findByRole('tab', { name: 'YTD' }));
    const btn = await screen.findByTestId('unit-production-download');
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.generateUnitPDF).toHaveBeenCalledTimes(1));
    const arg = hoisted.generateUnitPDF.mock.calls[0][0];
    expect(arg.orgLabel).toBe('South · 02');
    expect(arg.managerName).toBe('Marsha');
    expect(arg.period).toBe('ytd');
    expect(Array.isArray(arg.roster)).toBe(true);
    expect(arg.roster[0]).toMatchObject({ name: 'Riaz', totalApi: 10000, totalApps: 1 });
    expect(arg.totals.totalApi).toBe(10000);
  });

  it('shows the honest Estimated badge', async () => {
    render(<UnitManagerProductionView />);
    await screen.findByTestId('unit-production-download');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });
});

describe('BranchManagerProductionView — download CTA feeds generateBranchPDF', () => {
  beforeEach(() => {
    hoisted.useAuth.mockReturnValue({
      userProfile: { name: 'Trevor', branchName: 'South Branch' }, tenantId: 't1',
    });
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'a1', role: 'agent', unitId: 'u1', name: 'Riaz' },
      { id: 'm1', role: 'unit_manager', unitName: 'South · 01' },
    ]);
    hoisted.getAllYTDSubmissions.mockResolvedValue([
      { agentId: 'a1', status: 'submitted', weekStarting: `${YEAR}-01-05`, newBusiness: { api: 12000, apps: 2 }, applicationsSold: 2 },
    ]);
  });

  it('calls generateBranchPDF with totals + roster + compliance on click (YTD)', async () => {
    render(<BranchManagerProductionView />);
    fireEvent.click(await screen.findByRole('tab', { name: 'YTD' }));
    const btn = await screen.findByTestId('branch-production-download');
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.generateBranchPDF).toHaveBeenCalledTimes(1));
    const arg = hoisted.generateBranchPDF.mock.calls[0][0];
    expect(arg.orgLabel).toBe('South Branch');
    expect(arg.managerName).toBe('Trevor');
    expect(arg.totals.totalApi).toBe(12000);
    expect(arg.roster[0]).toMatchObject({ name: 'Riaz', totalApi: 12000 });
    expect(arg.compliance).toBeTruthy();
  });

  it('shows the honest Estimated badge', async () => {
    render(<BranchManagerProductionView />);
    await screen.findByTestId('branch-production-download');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });
});
