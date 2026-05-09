// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductionReportTab from '../ProductionReportTab.jsx';

// Stub the Firebase-dependent view components so routing tests don't need real Firebase
vi.mock('../AgentProductionView.jsx', () => ({
  default: () => <div data-testid="agent-view">AgentView</div>,
}));
vi.mock('../UnitManagerProductionView.jsx', () => ({
  default: () => <div data-testid="unit-manager-view">UnitManagerView</div>,
}));
vi.mock('../BranchManagerProductionView.jsx', () => ({
  default: () => <div data-testid="branch-manager-view">BranchManagerView</div>,
}));

// Stub AuthContext (views use useAuth, but mocked views don't call it)
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, userProfile: {}, role: 'agent', tenantId: 'test-tenant' }),
}));

describe('ProductionReportTab routing', () => {
  it('renders AgentProductionView for userRole=agent', () => {
    render(<ProductionReportTab userRole="agent" />);
    expect(screen.getByTestId('agent-view')).toBeInTheDocument();
  });

  it('renders UnitManagerProductionView for userRole=unit_manager', () => {
    render(<ProductionReportTab userRole="unit_manager" />);
    expect(screen.getByTestId('unit-manager-view')).toBeInTheDocument();
  });

  it('renders BranchManagerProductionView for userRole=branch_manager', () => {
    render(<ProductionReportTab userRole="branch_manager" />);
    expect(screen.getByTestId('branch-manager-view')).toBeInTheDocument();
  });

  it('renders BranchManagerProductionView for userRole=sales_manager', () => {
    render(<ProductionReportTab userRole="sales_manager" />);
    expect(screen.getByTestId('branch-manager-view')).toBeInTheDocument();
  });

  it('renders BranchManagerProductionView for userRole=tenant_admin', () => {
    render(<ProductionReportTab userRole="tenant_admin" />);
    expect(screen.getByTestId('branch-manager-view')).toBeInTheDocument();
  });

  it('renders BranchManagerProductionView for userRole=platform_admin', () => {
    render(<ProductionReportTab userRole="platform_admin" />);
    expect(screen.getByTestId('branch-manager-view')).toBeInTheDocument();
  });

  it('falls back to BranchManagerProductionView for unknown userRole', () => {
    render(<ProductionReportTab userRole="unknown_role" />);
    expect(screen.getByTestId('branch-manager-view')).toBeInTheDocument();
  });

  it('does NOT render agent view for manager roles', () => {
    render(<ProductionReportTab userRole="branch_manager" />);
    expect(screen.queryByTestId('agent-view')).not.toBeInTheDocument();
  });

  it('does NOT render branch view for agent role', () => {
    render(<ProductionReportTab userRole="agent" />);
    expect(screen.queryByTestId('branch-manager-view')).not.toBeInTheDocument();
  });
});
