import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTodayTT } from '../../../utils/dateInputs';

const hoisted = vi.hoisted(() => ({
  useToastShow: vi.fn(),
}));

vi.mock('../../../services/plannerService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getAgentWeek:        vi.fn(),
    createAppointment:   vi.fn(),
    createRecurringAppointments: vi.fn(),
    updateAppointment:   vi.fn(),
    setAppointmentStatus: vi.fn(),
    postponeWithRebook:  vi.fn(),
    deleteAppointment:   vi.fn(),
    undoPostpone:        vi.fn(),
  };
});
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: vi.fn(),
}));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.useToastShow, dismiss: vi.fn() }),
}));

import AgentPlannerPanel from '../AgentPlannerPanel';
import {
  getAgentWeek, setAppointmentStatus, updateAppointment,
  createAppointment, deleteAppointment, postponeWithRebook, undoPostpone,
} from '../../../services/plannerService';
import { getProspectInfo } from '../../../services/prospectInfoService';

const TODAY = getTodayTT();
const BASE_PROPS = {
  tenantId: 't1', agentId: 'agent-1', agentUnitId: 'um-9',
  agentBranchId: 'branch-7', callerRole: 'agent',
};

function ctrlZ(shiftKey = false) {
  fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey });
}
function ctrlY() {
  fireEvent.keyDown(document, { key: 'y', ctrlKey: true });
}

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

describe('undo/redo (Run 9 A1)', () => {
  it('Ctrl+Z after a create calls deleteAppointment with the new id, reloads, and toasts', async () => {
    createAppointment.mockResolvedValue('new-1');
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-book'));
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    getAgentWeek.mockClear();
    ctrlZ();
    await waitFor(() => expect(deleteAppointment).toHaveBeenCalledWith('t1', 'new-1'));
    await waitFor(() => expect(getAgentWeek).toHaveBeenCalledTimes(1)); // reload after undo
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Create appointment', variant: 'info' }),
    ));
  });

  it('Ctrl+Y after undoing a create replays createAppointment (redo) and toasts', async () => {
    createAppointment.mockResolvedValueOnce('new-1').mockResolvedValueOnce('new-2');
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-book'));
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    ctrlZ();
    await waitFor(() => expect(deleteAppointment).toHaveBeenCalledWith('t1', 'new-1'));

    ctrlY();
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Redid: Create appointment', variant: 'info' }),
    ));

    // A subsequent undo now targets the FRESH id (new-2) minted by redo, not
    // the original (new-1) — proves the history entry tracks current ids
    // via a mutable closure, per the A1 requirement.
    ctrlZ();
    await waitFor(() => expect(deleteAppointment).toHaveBeenCalledWith('t1', 'new-2'));
  });

  it('ignores Ctrl+Z while the churn dialog is open; runs once it closes', async () => {
    createAppointment.mockResolvedValue('new-1');
    getAgentWeek
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'new-1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-book'));
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(screen.getByTestId('appt-card-new-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-new-1'));
    expect(screen.getByTestId('churn-dialog')).toBeInTheDocument();
    ctrlZ();
    await new Promise((r) => setTimeout(r, 0)); // let any microtasks flush
    expect(deleteAppointment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.queryByTestId('churn-dialog')).not.toBeInTheDocument());
    ctrlZ();
    await waitFor(() => expect(deleteAppointment).toHaveBeenCalledWith('t1', 'new-1'));
  });

  it('ignores Ctrl+Z when the event target is a form field', async () => {
    createAppointment.mockResolvedValue('new-1');
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-book'));
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(deleteAppointment).not.toHaveBeenCalled();
    document.body.removeChild(input);

    // Sanity: the same shortcut on a non-form target still works.
    ctrlZ();
    await waitFor(() => expect(deleteAppointment).toHaveBeenCalledWith('t1', 'new-1'));
  });

  it('undoes a "Mark kept" status flip back to the prior status', async () => {
    setAppointmentStatus.mockResolvedValue();
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'scheduled' }])
      .mockResolvedValue([{ id: 'a1', date: TODAY, startTime: '09:00', type: 'CI', status: 'kept' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark kept' }));
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledWith('t1', 'a1', 'kept'));
    // Wait for the churn dialog to actually close (setChurn(null) is the LAST
    // step of the async handler) — asserting only on the mock call can
    // resolve before that happens, leaving the keyboard guard's dialogOpen
    // closure stale and the shortcut ignored.
    await waitFor(() => expect(screen.queryByTestId('churn-dialog')).not.toBeInTheDocument());

    ctrlZ();
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledWith('t1', 'a1', 'scheduled', {}));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Mark kept', variant: 'info' }),
    ));
  });

  it('undoes a Postpone via undoPostpone(original, new) with the Postpone label', async () => {
    postponeWithRebook.mockResolvedValue('new-77');
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' }])
      .mockResolvedValue([
        { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'postponed', rescheduledToId: 'new-77' },
      ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-postpone'));
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(postponeWithRebook).toHaveBeenCalledWith('t1', 'a1', expect.any(Object), expect.any(Object)));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    ctrlZ();
    await waitFor(() => expect(undoPostpone).toHaveBeenCalledWith('t1', 'a1', 'new-77'));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Postpone', variant: 'info' }),
    ));
  });
});

describe('keyboard shortcuts (Run 9 A2)', () => {
  const TWO_APPTS = [
    { id: 'a1', date: TODAY, startTime: '09:00', type: 'PC', status: 'scheduled' },
    { id: 'a2', date: TODAY, startTime: '11:00', type: 'FFI', status: 'scheduled' },
  ];

  function pressKey(key, opts = {}) {
    fireEvent.keyDown(document, { key, ...opts });
  }

  it('n opens the booking sheet (same as the Book button)', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());
    pressKey('n');
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();
  });

  it('ignores n when the event target is a form field', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n' });
    expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument();
    document.body.removeChild(input);
  });

  it('? (Shift+/) opens the shortcuts reference sheet, listing A1 undo/redo, and Escape closes it', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());
    pressKey('?', { shiftKey: true });
    const dialog = screen.getByTestId('planner-shortcuts-sheet');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Undo the last action/)).toBeInTheDocument();
    expect(screen.getByText(/Redo the last undone action/)).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('planner-shortcuts-sheet')).not.toBeInTheDocument());
  });

  it('the header "?" icon button also opens the shortcuts sheet', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-shortcuts-open')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-shortcuts-open'));
    expect(screen.getByTestId('planner-shortcuts-sheet')).toBeInTheDocument();
  });

  it('plain-key shortcuts (including ?) are ignored while another planner sheet is open', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-today-empty')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-book'));
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();

    pressKey('?', { shiftKey: true });
    expect(screen.queryByTestId('planner-shortcuts-sheet')).not.toBeInTheDocument();

    pressKey('ArrowRight');
    expect(screen.getByTestId('planner-view-today')).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft/ArrowRight cycle the view pills Today <-> Week <-> Follow-ups and clamp at the ends', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-today')).toHaveAttribute('aria-selected', 'true'));

    pressKey('ArrowRight');
    expect(screen.getByTestId('planner-view-week')).toHaveAttribute('aria-selected', 'true');
    pressKey('ArrowRight');
    expect(screen.getByTestId('planner-view-followups')).toHaveAttribute('aria-selected', 'true');
    pressKey('ArrowRight'); // clamped — no further view past the last one
    expect(screen.getByTestId('planner-view-followups')).toHaveAttribute('aria-selected', 'true');

    pressKey('ArrowLeft');
    expect(screen.getByTestId('planner-view-week')).toHaveAttribute('aria-selected', 'true');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('planner-view-today')).toHaveAttribute('aria-selected', 'true');
    pressKey('ArrowLeft'); // clamped — no further view before the first one
    expect(screen.getByTestId('planner-view-today')).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown/ArrowUp rove focus through the visible appointment cards, wrapping at the ends', async () => {
    getAgentWeek.mockResolvedValue(TWO_APPTS);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a2')).toBeInTheDocument());

    pressKey('ArrowDown'); // nothing focused yet -> first card
    expect(screen.getByTestId('appt-card-a1')).toHaveFocus();
    pressKey('ArrowDown');
    expect(screen.getByTestId('appt-card-a2')).toHaveFocus();
    pressKey('ArrowDown'); // wraps past the last card back to the first
    expect(screen.getByTestId('appt-card-a1')).toHaveFocus();
    pressKey('ArrowUp'); // wraps back to the last card
    expect(screen.getByTestId('appt-card-a2')).toHaveFocus();
  });

  it('Enter on a focused appointment card opens the churn dialog via native <button> activation (no duplicate handler)', async () => {
    getAgentWeek.mockResolvedValue(TWO_APPTS);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    screen.getByTestId('appt-card-a1').focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('churn-dialog')).toBeInTheDocument();
  });

  it('e opens Edit for the focused (non-series) appointment card', async () => {
    getAgentWeek.mockResolvedValue(TWO_APPTS);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    screen.getByTestId('appt-card-a1').focus();
    pressKey('e');
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit appointment' })).toBeInTheDocument();
  });

  it('e on a focused SERIES card raises the SeriesEditChoice scope sheet instead of editing directly', async () => {
    getAgentWeek.mockResolvedValue([
      {
        id: 'a3', date: TODAY, startTime: '09:00', type: 'PC', status: 'scheduled',
        seriesId: 'series-1', repeatRule: 'weekly', daysOfWeek: ['MON'],
      },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a3')).toBeInTheDocument());
    screen.getByTestId('appt-card-a3').focus();
    pressKey('e');
    expect(screen.getByTestId('series-edit-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument();
  });

  it('e is a no-op when no appointment card is focused', async () => {
    getAgentWeek.mockResolvedValue(TWO_APPTS);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    pressKey('e');
    expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument();
  });
});

describe('conflict detection (Run 9 A3 — R7 warn-only)', () => {
  it('badges both cards when two appointments overlap on the same date', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '10:00', durationMin: 60, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '10:30', durationMin: 30, type: 'FFI', status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    expect(screen.getByTestId('appt-conflict-a1')).toBeInTheDocument();
    expect(screen.getByTestId('appt-conflict-a2')).toBeInTheDocument();
    expect(screen.getAllByText('Overlaps')).toHaveLength(2);
  });

  it('does not badge non-overlapping appointments', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '11:00', durationMin: 30, type: 'FFI', status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    expect(screen.queryByTestId('appt-conflict-a1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appt-conflict-a2')).not.toBeInTheDocument();
  });

  it('does not badge a RETIRED (cancelled) appointment even if its old slot overlaps another', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '10:00', durationMin: 60, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '10:15', durationMin: 30, type: 'FFI', status: 'cancelled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    // a1 no longer overlaps anything active (a2 is retired) — neither carries the badge.
    expect(screen.queryByTestId('appt-conflict-a1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appt-conflict-a2')).not.toBeInTheDocument();
  });

  it('never obscures the status pill — both the conflict badge and status pill render', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '10:00', durationMin: 60, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '10:30', durationMin: 30, type: 'FFI', status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-conflict-a1')).toBeInTheDocument());
    const card = screen.getByTestId('appt-card-a1');
    expect(card).toHaveTextContent('Overlaps');
    expect(card).toHaveTextContent('Scheduled');
  });

  it('badges both cards in the Week view too', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '10:00', durationMin: 60, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '10:30', durationMin: 30, type: 'FFI', status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-week')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-view-week'));
    await waitFor(() => expect(screen.getByTestId('appt-conflict-a1')).toBeInTheDocument());
    expect(screen.getByTestId('appt-conflict-a2')).toBeInTheDocument();
  });
});
