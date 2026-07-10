import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getTodayTT } from '../../../utils/dateInputs';

vi.mock('../../../services/plannerService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getAgentWeek:        vi.fn(),
    createAppointment:   vi.fn(),
    updateAppointment:   vi.fn(),
    setAppointmentStatus: vi.fn(),
    postponeWithRebook:  vi.fn(),
  };
});
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: vi.fn(),
}));

import AgentPlannerPanel from '../AgentPlannerPanel';
import { getAgentWeek, setAppointmentStatus, updateAppointment } from '../../../services/plannerService';
import { getProspectInfo } from '../../../services/prospectInfoService';

const TODAY = getTodayTT();
const BASE_PROPS = {
  tenantId: 't1', agentId: 'agent-1', agentUnitId: 'um-9',
  agentBranchId: 'branch-7', callerRole: 'agent',
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgentWeek.mockResolvedValue([]);
  getProspectInfo.mockResolvedValue([]);
});

describe('AgentPlannerPanel', () => {
  it('renders the Planner heading + view pills once loaded', async () => {
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-today')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument();
    expect(screen.getByTestId('planner-view-week')).toBeInTheDocument();
    expect(screen.getByTestId('planner-view-followups')).toBeInTheDocument();
  });

  it('shows the actionable empty state when nothing is booked today', async () => {
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());
    expect(screen.getByText('Nothing booked today')).toBeInTheDocument();
  });

  it('renders an error + Retry when the week read fails', async () => {
    getAgentWeek.mockRejectedValueOnce(new Error('boom'));
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('Could not load your planner.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('renders today appointment cards time-ordered', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a2', date: TODAY, startTime: '14:00', type: 'FFI', status: 'scheduled', prospectId: 'p1' },
      { id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled', prospectId: 'p1' },
    ]);
    getProspectInfo.mockResolvedValue([{ id: 'p1', clientName: 'Marsha Singh' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    const cards = screen.getAllByTestId(/appt-card-/);
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['appt-card-a1', 'appt-card-a2']);
  });

  it('derives the follow-up worklist from the prospect prep list', async () => {
    getProspectInfo.mockResolvedValue([
      { id: 'p1', clientName: 'Anand Maharaj', intendedAppointmentDate: '2020-01-01' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-followups')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-view-followups'));
    expect(screen.getByTestId('followup-row-p1')).toBeInTheDocument();
    expect(screen.getByText('Anand Maharaj')).toBeInTheDocument();
  });

  it('hands a kept-appointment seed to Daily Capture via onCarryToDaily', async () => {
    const onCarryToDaily = vi.fn();
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'kept', prospectId: 'p1' },
      { id: 'a2', date: TODAY, startTime: '11:00', type: 'SALE', status: 'kept', apiAmount: 2000 },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} onCarryToDaily={onCarryToDaily} />);
    await waitFor(() => expect(screen.getByTestId('planner-handoff')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-carry-daily'));
    expect(onCarryToDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        ciConducted: 1,
        newBusiness: { apps: 1, api: 2000 },
      }),
    );
  });

  it('opens the churn dialog and marks an appointment kept', async () => {
    setAppointmentStatus.mockResolvedValue();
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled', prospectId: 'p1' }])
      .mockResolvedValue([{ id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'kept', prospectId: 'p1' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    expect(screen.getByTestId('churn-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark kept' }));
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledWith('t1', 'a1', 'kept'));
  });

  it('exposes an "Edit details" action in the churn dialog for an own appointment', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled', note: 'Original note' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    expect(screen.getByTestId('churn-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('churn-action-edit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument();
  });

  it('opens the sheet in edit mode prefilled with the appointment values', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled', note: 'Original note' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-edit'));
    // Sheet opens in edit mode (title switches) with the current values hydrated.
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit appointment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    expect(screen.getByLabelText('Start time')).toHaveValue('09:00');
    expect(screen.getByLabelText(/Note/)).toHaveValue('Original note');
    // Create-only affordance is absent in edit mode.
    expect(screen.queryByTestId('appt-save-another')).not.toBeInTheDocument();
  });

  it('saves an edit through updateAppointment with the changed fields', async () => {
    updateAppointment.mockResolvedValue();
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled', note: 'Original note' }])
      .mockResolvedValue([{ id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled', note: 'Reviewed note' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-edit'));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Reviewed note' } });
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(updateAppointment).toHaveBeenCalledWith(
      't1', 'a1',
      expect.objectContaining({ note: 'Reviewed note', startTime: '09:00', type: 'PC' }),
    ));
  });
});
