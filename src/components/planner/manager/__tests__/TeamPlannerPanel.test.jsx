import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getTodayTT } from '../../../../utils/dateInputs';

vi.mock('../../../../services/plannerService', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getTeamWeek: vi.fn() };
});
vi.mock('../../../../services/managerService', () => ({ getTenantUsers: vi.fn() }));
vi.mock('../../../../services/goalsService', () => ({ getCompanyMinimums: vi.fn() }));

import TeamPlannerPanel from '../TeamPlannerPanel';
import { getTeamWeek } from '../../../../services/plannerService';
import { getTenantUsers } from '../../../../services/managerService';
import { getCompanyMinimums } from '../../../../services/goalsService';

const TODAY = getTodayTT();

beforeEach(() => {
  vi.clearAllMocks();
  getTeamWeek.mockResolvedValue([]);
  getTenantUsers.mockResolvedValue([]);
  getCompanyMinimums.mockResolvedValue(null);
});

describe('TeamPlannerPanel', () => {
  it('renders the Team Planner heading + private-view marker', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Marsha Singh' }]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-planner-rows')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Team Planner' })).toBeInTheDocument();
    expect(screen.getByText(/Private coaching view/)).toBeInTheDocument();
  });

  it('passes the caller role through to the role-split read', async () => {
    render(<TeamPlannerPanel tenantId="t1" callerRole="branch_manager" uid="bm-2" branchId="b7" />);
    await waitFor(() => expect(getTeamWeek).toHaveBeenCalled());
    expect(getTeamWeek).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 't1', role: 'branch_manager', uid: 'bm-2', branchId: 'b7',
    }));
  });

  it('renders one row per booked agent with the resolved name', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled' },
      { id: 'x2', agentId: 'agent-2', date: TODAY, startTime: '10:00', type: 'FFI', status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Marsha Singh' },
      { id: 'agent-2', name: 'Anand Maharaj' },
    ]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-row-agent-1')).toBeInTheDocument());
    expect(screen.getByText('Marsha Singh')).toBeInTheDocument();
    expect(screen.getByText('Anand Maharaj')).toBeInTheDocument();
  });

  // §2A guard — the manager headline is a coaching number. Support work and
  // non-production blocks must not inflate it.
  it('counts only selling types in the per-agent headline total', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI',    status: 'scheduled' },
      { id: 'x2', agentId: 'agent-1', date: TODAY, startTime: '10:00', type: 'SEM',   status: 'scheduled' },
      { id: 'x3', agentId: 'agent-1', date: TODAY, startTime: '11:00', type: 'ADMIN', status: 'scheduled' },
      { id: 'x4', agentId: 'agent-1', date: TODAY, startTime: '12:00', type: 'PAPER', status: 'scheduled' },
      { id: 'x5', agentId: 'agent-1', date: TODAY, startTime: '13:00', type: 'FREE',  status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Marsha Singh' }]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-row-agent-1')).toBeInTheDocument());
    // 5 booked, but only CI + SEM are selling activity.
    expect(screen.getByText('2 selling booked this week')).toBeInTheDocument();
    // NEGATIVE CONTROL: the unfiltered total would read 5. If the isSellingType
    // filter is removed, the assertion above fails AND this one starts matching.
    expect(screen.queryByText('5 selling booked this week')).not.toBeInTheDocument();
  });

  it('still shows non-selling appointments in the drill — nothing is hidden', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI',    status: 'scheduled' },
      { id: 'x3', agentId: 'agent-1', date: TODAY, startTime: '11:00', type: 'ADMIN', status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Marsha Singh' }]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-row-agent-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('team-row-agent-1'));
    expect(screen.getByTestId('coaching-drill')).toBeInTheDocument();
    // The excluded ADMIN block is still visible to the coach.
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('opens the read-only coaching drill on row click', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Marsha Singh' }]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-row-agent-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('team-row-agent-1'));
    expect(screen.getByTestId('coaching-drill')).toBeInTheDocument();
    expect(screen.getByText('This week · read-only')).toBeInTheDocument();
  });

  it('exposes no appointment edit affordance (read-only guarantee)', async () => {
    getTeamWeek.mockResolvedValue([
      { id: 'x1', agentId: 'agent-1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled' },
    ]);
    getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Marsha Singh' }]);
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-row-agent-1')).toBeInTheDocument());
    // Drilling into an agent opens the read-only coaching view, never the
    // agent's churn dialog or its edit action.
    fireEvent.click(screen.getByTestId('team-row-agent-1'));
    expect(screen.getByTestId('coaching-drill')).toBeInTheDocument();
    expect(screen.queryByTestId('churn-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('churn-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
  });

  it('shows the empty state when no bookings exist this week', async () => {
    render(<TeamPlannerPanel tenantId="t1" callerRole="unit_manager" uid="um-9" branchId="b7" />);
    await waitFor(() => expect(screen.getByTestId('team-planner-empty')).toBeInTheDocument());
    expect(screen.getByText('No bookings this week')).toBeInTheDocument();
  });
});
