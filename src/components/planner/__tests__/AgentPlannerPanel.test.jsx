import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    getSeriesInstances:  vi.fn(),
    createAppointment:   vi.fn(),
    createRecurringAppointments: vi.fn(),
    updateAppointment:   vi.fn(),
    setAppointmentStatus: vi.fn(),
    postponeWithRebook:  vi.fn(),
    deleteAppointment:   vi.fn(),
    undoPostpone:        vi.fn(),
    bulkUpdateAppointments: vi.fn(),
    addAppointmentNote:  vi.fn(),
  };
});
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: vi.fn(),
}));
vi.mock('../../../services/appointmentTemplateService', () => ({
  listTemplates:  vi.fn(),
  saveTemplate:   vi.fn(),
  deleteTemplate: vi.fn(),
  TEMPLATE_CAP:   20,
}));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.useToastShow, dismiss: vi.fn() }),
}));

import AgentPlannerPanel from '../AgentPlannerPanel';
import {
  getAgentWeek, getSeriesInstances, setAppointmentStatus, updateAppointment,
  createAppointment, deleteAppointment, postponeWithRebook, undoPostpone,
  bulkUpdateAppointments, addAppointmentNote,
} from '../../../services/plannerService';
import { getProspectInfo } from '../../../services/prospectInfoService';
import { listTemplates, saveTemplate, deleteTemplate } from '../../../services/appointmentTemplateService';
import { shiftDateStr, buildWeekDates } from '../planner.helpers';

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
  listTemplates.mockResolvedValue([]);
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

describe('AgentPlannerPanel — templates (Run 9 A4)', () => {
  const APPT = { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled', note: 'Dial block' };

  it('save-as-template opens the name prompt (default name) and saves + toasts success', async () => {
    saveTemplate.mockResolvedValue('tpl-new');
    getAgentWeek.mockResolvedValue([APPT]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-save-template'));

    const nameSheet = screen.getByTestId('template-name-sheet');
    expect(nameSheet).toBeInTheDocument();
    // Default name = "<TYPE> · <h:mm A>".
    expect(screen.getByTestId('template-name-input')).toHaveValue('PC · 9:00 AM');

    fireEvent.click(screen.getByTestId('template-name-save'));

    await waitFor(() => expect(saveTemplate).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ name: 'PC · 9:00 AM', type: 'PC', startTime: '09:00', durationMin: 30, note: 'Dial block' }),
      expect.objectContaining({ agentId: 'agent-1' }),
    ));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    ));
  });

  it('surfaces the friendly cap error as an error toast (20-cap path)', async () => {
    saveTemplate.mockRejectedValue(new Error('You can keep up to 20 templates — delete one to save another.'));
    getAgentWeek.mockResolvedValue([APPT]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-save-template'));
    fireEvent.click(screen.getByTestId('template-name-save'));

    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: 'You can keep up to 20 templates — delete one to save another.',
      }),
    ));
  });

  it('renders the templates picker in the book sheet and deletes via the affordance', async () => {
    deleteTemplate.mockResolvedValue();
    listTemplates.mockResolvedValue([
      { id: 'tpl-1', name: 'Morning FFI', type: 'FFI', startTime: '09:30', durationMin: 90, note: '', apiAmount: null },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-book')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-book'));
    expect(screen.getByTestId('appt-template-picker')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('template-delete-tpl-1'));
    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith('t1', 'tpl-1'));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'info' }),
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

describe('bulk operations (Run 9 A5)', () => {
  const LIVE_3 = [
    { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' },
    { id: 'a2', date: TODAY, startTime: '11:00', durationMin: 30, type: 'FFI', status: 'scheduled' },
    { id: 'a3', date: TODAY, startTime: '13:00', durationMin: 30, type: 'CI', status: 'scheduled' },
  ];

  it('Select toggle enters selection mode: bulk bar + checkboxes appear, card taps toggle selection instead of opening churn', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    expect(screen.getByTestId('planner-bulk-bar')).toBeInTheDocument();
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByTestId('appt-select-a1')).toBeInTheDocument();
    expect(screen.getByTestId('appt-select-a2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    // Selection, not churn.
    expect(screen.queryByTestId('churn-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByTestId('appt-card-a1')).toHaveAttribute('aria-pressed', 'true');

    // Plain click again deselects.
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('retired (cancelled/postponed) cards are NOT selectable — no checkbox, click is a no-op', async () => {
    getAgentWeek.mockResolvedValue([
      ...LIVE_3,
      { id: 'a4', date: TODAY, startTime: '15:00', durationMin: 30, type: 'PC', status: 'cancelled' },
      { id: 'a5', date: TODAY, startTime: '16:00', durationMin: 30, type: 'PC', status: 'postponed' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a4')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    expect(screen.queryByTestId('appt-select-a4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appt-select-a5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('appt-card-a4'));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.queryByTestId('churn-dialog')).not.toBeInTheDocument();
  });

  it('shift-click selects the range between the last-clicked card and this one (visible order)', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('appt-card-a3'), { shiftKey: true });
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByTestId('appt-card-a2')).toHaveAttribute('aria-pressed', 'true');
  });

  it('bulk cancel: confirmation sheet always shows, confirm calls the service with status patches, toasts, exits selection mode', async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 2 });
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('appt-card-a2'));
    fireEvent.click(screen.getByTestId('bulk-cancel'));

    const confirmSheet = screen.getByTestId('bulk-cancel-confirm');
    expect(confirmSheet).toBeInTheDocument();
    expect(confirmSheet).toHaveTextContent('Cancel 2 appointments?');
    // No cap warning under 200.
    expect(screen.queryByTestId('bulk-cap-ack')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-cancel-confirm-apply'));
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a1', patch: { status: 'cancelled' } },
      { id: 'a2', patch: { status: 'cancelled' } },
    ]));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cancelled 2 appointments', variant: 'info' }),
    ));
    // Selection mode exited.
    await waitFor(() => expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument());
    expect(screen.queryByTestId('bulk-cancel-confirm')).not.toBeInTheDocument();
  });

  it('bulk move (set-date mode): applies the chosen date to every selected appointment', async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 2 });
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('appt-card-a3'));
    fireEvent.click(screen.getByTestId('bulk-move'));

    expect(screen.getByTestId('bulk-move-sheet')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('bulk-move-date'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByTestId('bulk-move-apply'));

    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a1', patch: { date: '2026-09-01' } },
      { id: 'a3', patch: { date: '2026-09-01' } },
    ]));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Moved 2 appointments', variant: 'info' }),
    ));
    await waitFor(() => expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument());
  });

  it('bulk move (shift mode): shifts each appointment relative to its OWN date', async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 1 });
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a2'));
    fireEvent.click(screen.getByTestId('bulk-move'));

    fireEvent.click(screen.getByTestId('bulk-move-mode-shift'));
    fireEvent.click(screen.getByTestId('bulk-move-shift-plus')); // 1 -> 2
    expect(screen.getByTestId('bulk-move-shift-value')).toHaveTextContent('+2 days');
    fireEvent.click(screen.getByTestId('bulk-move-apply'));

    const expected = shiftDateStr(TODAY, 2);
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a2', patch: { date: expected } },
    ]));
  });

  it('R6 cap gate: selecting >200 requires the acknowledgement tick before the confirm button enables', async () => {
    const MANY = Array.from({ length: 201 }, (_, i) => ({
      id: `b${i}`,
      date: TODAY,
      startTime: `${String(Math.floor(i / 12)).padStart(2, '0')}:${String((i % 12) * 5).padStart(2, '0')}`,
      durationMin: 5,
      type: 'PC',
      status: 'scheduled',
    }));
    bulkUpdateAppointments.mockResolvedValue({ count: 201 });
    getAgentWeek.mockResolvedValue(MANY);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-b0')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-b0'));
    fireEvent.click(screen.getByTestId('appt-card-b200'), { shiftKey: true });
    expect(screen.getByText('201 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-cancel'));
    const sheet = screen.getByTestId('bulk-cancel-confirm');
    // NB: the component renders a typographic apostrophe (&rsquo;) — match loosely.
    expect(sheet).toHaveTextContent(/changing 201 appointments/);
    const apply = screen.getByTestId('bulk-cancel-confirm-apply');
    expect(apply).toBeDisabled();

    fireEvent.click(screen.getByTestId('bulk-cap-ack'));
    expect(apply).not.toBeDisabled();
    fireEvent.click(apply);
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledTimes(1));
    expect(bulkUpdateAppointments.mock.calls[0][1]).toHaveLength(201);
  });

  it("pushes ONE undo entry per bulk op — Ctrl+Z writes back each doc's PRIOR values", async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 2 });
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' },
      { id: 'a2', date: TODAY, startTime: '11:00', durationMin: 30, type: 'FFI', status: 'confirmed' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('appt-card-a2'));
    fireEvent.click(screen.getByTestId('bulk-cancel'));
    fireEvent.click(screen.getByTestId('bulk-cancel-confirm-apply'));
    await waitFor(() => expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument());

    bulkUpdateAppointments.mockClear();
    ctrlZ();
    // Undo writes back each doc's PRIOR status (scheduled / confirmed — not a blanket value).
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a1', patch: { status: 'scheduled' } },
      { id: 'a2', patch: { status: 'confirmed' } },
    ]));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Bulk cancel (2)', variant: 'info' }),
    ));

    // Redo replays the forward patches.
    bulkUpdateAppointments.mockClear();
    ctrlY();
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a1', patch: { status: 'cancelled' } },
      { id: 'a2', patch: { status: 'cancelled' } },
    ]));
  });

  it("undo after a bulk move writes back each doc's PRIOR date", async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 1 });
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('bulk-move'));
    fireEvent.change(screen.getByTestId('bulk-move-date'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByTestId('bulk-move-apply'));
    await waitFor(() => expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument());

    bulkUpdateAppointments.mockClear();
    ctrlZ();
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'a1', patch: { date: TODAY } },
    ]));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Bulk move (1)', variant: 'info' }),
    ));
  });

  it('surfaces a failed bulk op via an error toast (never silent) and stays in selection mode', async () => {
    bulkUpdateAppointments.mockRejectedValue(new Error(
      'Bulk update stopped: 1 of 2 batches committed (400 of 450 appointments applied). boom',
    ));
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('bulk-cancel'));
    fireEvent.click(screen.getByTestId('bulk-cancel-confirm-apply'));

    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringContaining('1 of 2 batches committed'),
      }),
    ));
    // Selection retained for retry; the confirm sheet closed.
    expect(screen.getByTestId('planner-bulk-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cancel-confirm')).not.toBeInTheDocument();
  });

  it('Escape exits selection mode when no dialog is open', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    expect(screen.getByTestId('planner-bulk-bar')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument();
    // Re-entering selection mode starts from a cleared selection.
    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('Escape with a bulk sheet open closes the SHEET (focus trap), not selection mode', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('bulk-move'));
    expect(screen.getByTestId('bulk-move-sheet')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('bulk-move-sheet')).not.toBeInTheDocument());
    expect(screen.getByTestId('planner-bulk-bar')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('exiting selection mode via the toggle clears the selection and hides checkboxes', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appt-select-a1')).not.toBeInTheDocument();
    // Cards are churn-tappable again.
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    expect(screen.getByTestId('churn-dialog')).toBeInTheDocument();
  });

  it('the bulk-clear button exits selection mode', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('bulk-clear'));
    expect(screen.queryByTestId('planner-bulk-bar')).not.toBeInTheDocument();
  });

  it('A2 plain-key shortcuts stay functional while selection mode is ON (arrows still switch views)', async () => {
    getAgentWeek.mockResolvedValue(LIVE_3);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('planner-select-toggle'));
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByTestId('planner-view-week')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByTestId('planner-view-today')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('reschedule update-in-place (Run 9 F3b — R4)', () => {
  it('reschedule saves via updateAppointment on the SAME doc — never rebook, never create', async () => {
    updateAppointment.mockResolvedValue();
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' }])
      .mockResolvedValue([{ id: 'a1', date: '2026-09-15', startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-reschedule'));
    // Re-titled sheet, edit mechanics (no rebook grammar).
    expect(screen.getByRole('heading', { name: 'Reschedule appointment' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(updateAppointment).toHaveBeenCalledWith(
      't1', 'a1', expect.objectContaining({ date: '2026-09-15' }),
    ));
    // Identity preserved — the SAME doc id, not a rebooked/created new doc.
    expect(updateAppointment.mock.calls[0][1]).toBe('a1');
    expect(postponeWithRebook).not.toHaveBeenCalled();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('rescheduling a SERIES instance keeps series metadata (no series keys in the patch, same id, no scope sheet)', async () => {
    updateAppointment.mockResolvedValue();
    getAgentWeek.mockResolvedValue([
      {
        id: 'a3', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled',
        seriesId: 'series-1', repeatRule: 'weekly', seriesPos: 2, seriesTotal: 6,
      },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a3')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a3'));
    fireEvent.click(screen.getByTestId('churn-action-reschedule'));
    // Reschedule opens the sheet DIRECTLY — no SeriesEditChoice (contrast with Edit) —
    // and shows the "only this occurrence moves" note.
    expect(screen.queryByTestId('series-edit-choice')).not.toBeInTheDocument();
    expect(screen.getByTestId('reschedule-series-note')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(updateAppointment).toHaveBeenCalled());
    const [tid, id, data] = updateAppointment.mock.calls[0];
    expect(tid).toBe('t1');
    expect(id).toBe('a3'); // same doc — series linkage intact
    // The write carries NO series metadata: the stored linkage survives untouched.
    expect(data).not.toHaveProperty('seriesId');
    expect(data).not.toHaveProperty('seriesPos');
    expect(data).not.toHaveProperty('seriesTotal');
    expect(data).not.toHaveProperty('repeatRule');
    expect(data).not.toHaveProperty('daysOfWeek');
  });

  it('undo of a reschedule writes the prior date/startTime back, toasting "Undid: Reschedule"', async () => {
    updateAppointment.mockResolvedValue();
    getAgentWeek
      .mockResolvedValueOnce([{ id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' }])
      .mockResolvedValue([{ id: 'a1', date: '2026-09-15', startTime: '14:00', durationMin: 30, type: 'PC', status: 'scheduled' }]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-reschedule'));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByTestId('appt-save'));
    await waitFor(() => expect(updateAppointment).toHaveBeenCalledWith(
      't1', 'a1', expect.objectContaining({ date: '2026-09-15', startTime: '14:00' }),
    ));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    updateAppointment.mockClear();
    ctrlZ();
    // Undo writes back the PRIOR date/startTime (A1 diff mechanic — buildUpdatePatch
    // skips the undefined optional-field diffs, so only real priors land).
    await waitFor(() => expect(updateAppointment).toHaveBeenCalledWith(
      't1', 'a1', expect.objectContaining({ date: TODAY, startTime: '09:00' }),
    ));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Reschedule', variant: 'info' }),
    ));
  });
});

describe('postpone regression (unchanged by F3b)', () => {
  it('postpone still rebooks via postponeWithRebook — never an update-in-place', async () => {
    postponeWithRebook.mockResolvedValue('new-1');
    updateAppointment.mockResolvedValue();
    getAgentWeek.mockResolvedValue([
      { id: 'a1', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a1'));
    fireEvent.click(screen.getByTestId('churn-action-postpone'));
    expect(screen.getByTestId('appointment-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(postponeWithRebook).toHaveBeenCalledWith('t1', 'a1', expect.any(Object), expect.any(Object)));
    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it('series postpone still renders the scope-lock + amber consequence panel', async () => {
    getAgentWeek.mockResolvedValue([
      {
        id: 'a3', date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled',
        seriesId: 'series-1', repeatRule: 'weekly', seriesPos: 2, seriesTotal: 6,
      },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a3')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('appt-card-a3'));
    fireEvent.click(screen.getByTestId('churn-action-postpone'));
    expect(screen.getByRole('heading', { name: 'Postpone appointment' })).toBeInTheDocument();
    expect(screen.getByTestId('postpone-series-block')).toBeInTheDocument();
    expect(screen.getByTestId('postpone-scope-series-disabled')).toBeInTheDocument();
    expect(screen.getByTestId('postpone-consequence')).toBeInTheDocument();
    // Reschedule is NOT offered as a series-scope choice here — it's a separate churn action.
    expect(screen.queryByTestId('reschedule-series-note')).not.toBeInTheDocument();
  });
});

describe('series edit propagation (Run 9 F3d — R1/R2)', () => {
  const instance = (over) => ({
    date: TODAY, startTime: '09:00', durationMin: 30, type: 'PC', status: 'scheduled',
    note: 'orig', seriesId: 's-1', repeatRule: 'weekly', ...over,
  });

  function openChooser(cardId) {
    fireEvent.click(screen.getByTestId(`appt-card-${cardId}`));
    fireEvent.click(screen.getByTestId('churn-action-edit'));
    return screen.getByTestId('series-edit-choice');
  }

  it('a series card raises the chooser with three live scope options', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'a1' })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    openChooser('a1');
    expect(screen.getByTestId('series-edit-this-only')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-future')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-all')).toBeInTheDocument();
    // The old disabled "soon" treatment is gone.
    expect(screen.queryByTestId('series-edit-all-future')).not.toBeInTheDocument();
  });

  it('"this only" opens the plain single-doc Edit sheet — a regression of the F3b path, not propagate', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'a1' })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    openChooser('a1');
    fireEvent.click(screen.getByTestId('series-edit-this-only'));
    expect(screen.getByRole('heading', { name: 'Edit appointment' })).toBeInTheDocument();
    expect(screen.queryByTestId('series-propagate-scope-line')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).not.toBeDisabled();
  });

  it('"this and future" opens the propagate sheet — title, scope line, disabled date + note', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'a1' })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    openChooser('a1');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    expect(screen.getByRole('heading', { name: 'Edit series' })).toBeInTheDocument();
    expect(screen.getByTestId('series-propagate-scope-line'))
      .toHaveTextContent('Applies to this and all future occurrences');
    expect(screen.getByTestId('series-propagate-date-note')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });

  it('"all" opens the propagate sheet whose scope line names current + future', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'a1' })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a1')).toBeInTheDocument());
    openChooser('a1');
    fireEvent.click(screen.getByTestId('series-edit-all'));
    expect(screen.getByTestId('series-propagate-scope-line'))
      .toHaveTextContent('Applies to all current + future occurrences');
  });

  it('propagates ONLY changed fields to scheduled/confirmed in-window instances; excludes past; skips completed/cancelled; never writes date', async () => {
    const PAST = shiftDateStr(TODAY, -7);
    const FUT1 = shiftDateStr(TODAY, 7);
    const FUT2 = shiftDateStr(TODAY, 14);
    const FUT3 = shiftDateStr(TODAY, 21);
    bulkUpdateAppointments.mockResolvedValue({ count: 2 });
    getAgentWeek.mockResolvedValue([instance({ id: 'anchor' })]);
    getSeriesInstances.mockResolvedValue([
      instance({ id: 'past',      date: PAST,  status: 'scheduled' }),
      instance({ id: 'anchor',    date: TODAY, status: 'scheduled' }),
      instance({ id: 'fut1',      date: FUT1,  status: 'confirmed' }),
      instance({ id: 'futCancel', date: FUT2,  status: 'cancelled' }),
      instance({ id: 'futKept',   date: FUT3,  status: 'kept' }),
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-anchor')).toBeInTheDocument());
    openChooser('anchor');
    fireEvent.click(screen.getByTestId('series-edit-future'));

    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(getSeriesInstances).toHaveBeenCalledWith('t1', 'agent-1', 's-1'));
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledTimes(1));
    const [, updates] = bulkUpdateAppointments.mock.calls[0];
    // Past excluded (< anchor); cancelled + kept skipped; only scheduled/confirmed remain.
    expect(updates.map((u) => u.id)).toEqual(['anchor', 'fut1']);
    // Only the changed field — no date / status / series metadata.
    updates.forEach((u) => expect(u.patch).toEqual({ note: 'updated' }));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Updated 2 of 4 — 2 completed/cancelled kept as-is',
        variant: 'info',
      }),
    ));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());
  });

  it('future scope anchors on the TAPPED occurrence date (earlier in-window occurrences excluded)', async () => {
    const SAT = buildWeekDates(TODAY)[6]; // last day of the loaded week — always renders + >= today
    const NEXT = shiftDateStr(SAT, 7);
    bulkUpdateAppointments.mockResolvedValue({ count: 3 });
    getAgentWeek.mockResolvedValue([instance({ id: 'sat', date: SAT })]);
    getSeriesInstances.mockResolvedValue([
      instance({ id: 'today', date: TODAY }),
      instance({ id: 'sat',   date: SAT }),
      instance({ id: 'next',  date: NEXT }),
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-week')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-view-week'));
    await waitFor(() => expect(screen.getByTestId('appt-card-sat')).toBeInTheDocument());
    openChooser('sat');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledTimes(1));
    const ids = bulkUpdateAppointments.mock.calls[0][1].map((u) => u.id);
    // Anchor = the tapped Saturday → only date >= SAT. Computed from the spec so
    // the assertion is weekday-agnostic (on Saturdays TODAY === SAT and 'today'
    // is legitimately included).
    const expected = [
      { id: 'today', date: TODAY }, { id: 'sat', date: SAT }, { id: 'next', date: NEXT },
    ].filter((i) => i.date >= SAT).map((i) => i.id);
    expect(ids).toEqual(expected);
  });

  it('all scope anchors on TODAY — the today-dated occurrence is always included', async () => {
    const SAT = buildWeekDates(TODAY)[6];
    const NEXT = shiftDateStr(SAT, 7);
    bulkUpdateAppointments.mockResolvedValue({ count: 3 });
    getAgentWeek.mockResolvedValue([instance({ id: 'sat', date: SAT })]);
    getSeriesInstances.mockResolvedValue([
      instance({ id: 'today', date: TODAY }),
      instance({ id: 'sat',   date: SAT }),
      instance({ id: 'next',  date: NEXT }),
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-view-week')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-view-week'));
    await waitFor(() => expect(screen.getByTestId('appt-card-sat')).toBeInTheDocument());
    openChooser('sat');
    fireEvent.click(screen.getByTestId('series-edit-all'));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledTimes(1));
    const ids = bulkUpdateAppointments.mock.calls[0][1].map((u) => u.id);
    expect(ids).toEqual(['today', 'sat', 'next']); // every non-past occurrence
  });

  it('captures each instance\'s OWN prior value; undo restores per-instance state (R2), toasts "Undid: Edit series (N)"', async () => {
    bulkUpdateAppointments.mockResolvedValue({ count: 2 });
    getAgentWeek.mockResolvedValue([instance({ id: 'anchor', startTime: '09:00' })]);
    getSeriesInstances.mockResolvedValue([
      instance({ id: 'anchor', date: TODAY, startTime: '09:00' }),
      instance({ id: 'fut1', date: shiftDateStr(TODAY, 7), startTime: '10:30' }),
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-anchor')).toBeInTheDocument());
    openChooser('anchor');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'anchor', patch: { startTime: '14:00' } },
      { id: 'fut1', patch: { startTime: '14:00' } },
    ]));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());

    bulkUpdateAppointments.mockClear();
    ctrlZ();
    // Undo writes back EACH doc's own prior startTime, not a blanket value.
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'anchor', patch: { startTime: '09:00' } },
      { id: 'fut1', patch: { startTime: '10:30' } },
    ]));
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Undid: Edit series (2)', variant: 'info' }),
    ));
  });

  it('an empty diff (no field changed) closes the sheet without querying the series or writing', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'anchor' })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-anchor')).toBeInTheDocument());
    openChooser('anchor');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    fireEvent.click(screen.getByTestId('appt-save')); // nothing changed

    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());
    expect(getSeriesInstances).not.toHaveBeenCalled();
    expect(bulkUpdateAppointments).not.toHaveBeenCalled();
  });

  it('when only completed/cancelled instances remain in-window, nothing is written', async () => {
    getAgentWeek.mockResolvedValue([instance({ id: 'anchor', status: 'kept' })]);
    getSeriesInstances.mockResolvedValue([
      instance({ id: 'anchor', date: TODAY, status: 'kept' }),
      instance({ id: 'fut1', date: shiftDateStr(TODAY, 7), status: 'cancelled' }),
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-anchor')).toBeInTheDocument());
    openChooser('anchor');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(getSeriesInstances).toHaveBeenCalled());
    expect(bulkUpdateAppointments).not.toHaveBeenCalled();
    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No scheduled occurrences to update', variant: 'info' }),
    ));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());
  });

  it('a failed bulk propagation surfaces the service message verbatim (never silent) and closes the sheet', async () => {
    bulkUpdateAppointments.mockRejectedValue(new Error(
      'Bulk update stopped: 1 of 2 batches committed (400 of 450 appointments applied). boom',
    ));
    getAgentWeek.mockResolvedValue([instance({ id: 'anchor' })]);
    getSeriesInstances.mockResolvedValue([instance({ id: 'anchor', date: TODAY })]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-anchor')).toBeInTheDocument());
    openChooser('anchor');
    fireEvent.click(screen.getByTestId('series-edit-future'));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTestId('appt-save'));

    await waitFor(() => expect(hoisted.useToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringContaining('1 of 2 batches committed'),
      }),
    ));
    await waitFor(() => expect(screen.queryByTestId('appointment-sheet')).not.toBeInTheDocument());
  });
});

// ── Planner v2 E1/E5: desktop board (lg+) ──────────────────────────────────
// isDesktop is matchMedia-driven; jsdom has no matchMedia, so the tests above
// exercise the mobile layer. Here we stub matchMedia → desktop and assert the
// board replaces the single-column view pills (the drift-guard premise the six
// Run-9 smokes rely on), while the interactive card + Follow-ups view survive.
describe('AgentPlannerPanel — E1 desktop board (lg+)', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => { window.matchMedia = realMatchMedia; });

  it('at lg+ renders the desktop board instead of the single-column view pills', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'x1', date: TODAY, startTime: '09:00', type: 'FFI', durationMin: 60, status: 'scheduled' },
    ]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-desktop-board')).toBeInTheDocument());
    // Mobile view pills are NOT rendered on the desktop board (drift-guard premise).
    expect(screen.queryByTestId('planner-view-today')).toBeNull();
    expect(screen.queryByTestId('planner-view-week')).toBeNull();
    // The board's own toggle is present, including the preserved Follow-ups view.
    expect(screen.getByTestId('planner-span-3day')).toBeInTheDocument();
    expect(screen.getByTestId('planner-span-followups')).toBeInTheDocument();
    // The seeded appt renders as a real card (churn/select wiring preserved).
    expect(screen.getByTestId('appt-card-x1')).toBeInTheDocument();
  });

  it('switching the board toggle to Week renders 7 day columns', async () => {
    getAgentWeek.mockResolvedValue([]);
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-desktop-board')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('planner-span-week'));
    await waitFor(() => {
      const cols = document.querySelectorAll('[data-testid^="planner-day-col-"]');
      expect(cols).toHaveLength(7);
    });
  });

  it('E2: dropping a card on another day column calls postponeWithRebook with the new date (undo-able)', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'x1', date: TODAY, startTime: '09:00', durationMin: 60, type: 'FFI', status: 'scheduled' },
    ]);
    postponeWithRebook.mockResolvedValue('new-id');
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-desktop-board')).toBeInTheDocument());
    // default span 3day → today + next two; drop x1 onto the +1 day column
    const dtInit = { dataTransfer: { setData: vi.fn(), effectAllowed: '' } };
    fireEvent.dragStart(screen.getByTestId('planner-drag-x1'), dtInit);
    const nextDay = shiftDateStr(TODAY, 1);
    fireEvent.drop(screen.getByTestId(`planner-day-col-${nextDay}`), dtInit);
    await waitFor(() => expect(postponeWithRebook).toHaveBeenCalledWith(
      't1', 'x1',
      expect.objectContaining({ date: nextDay, startTime: '09:00', type: 'FFI' }),
      expect.objectContaining({ agentId: 'agent-1' }),
    ));
  });
});

// ── Planner v2 E4: per-appointment notes (add-note) ────────────────────────
describe('AgentPlannerPanel — E4 add-note', () => {
  it('adding a note in the edit sheet calls addAppointmentNote (during=true for a live today appt)', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'x1', date: TODAY, startTime: '09:00', durationMin: 60, type: 'FFI', status: 'scheduled', note: '' },
    ]);
    addAppointmentNote.mockResolvedValue();
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-x1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-x1'));               // churn dialog
    await waitFor(() => expect(screen.getByTestId('churn-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('churn-action-edit'));          // → edit sheet
    await waitFor(() => expect(screen.getByTestId('note-add-input')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('note-add-input'), { target: { value: 'call went well' } });
    fireEvent.click(screen.getByTestId('note-add-btn'));
    await waitFor(() => expect(addAppointmentNote).toHaveBeenCalledWith(
      't1', 'x1', expect.objectContaining({ text: 'call went well', during: true }),
    ));
  });
});

// ── Planner v2 E3: running-late cascade ────────────────────────────────────
describe('AgentPlannerPanel — E3 running-late', () => {
  it('churn "Running late" opens the cascade sheet; push calls bulkUpdateAppointments with shifted times', async () => {
    getAgentWeek.mockResolvedValue([
      { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled', type: 'FFI' },
      { id: 'b', date: TODAY, startTime: '11:00', durationMin: 30, status: 'scheduled', type: 'CI' },
    ]);
    bulkUpdateAppointments.mockResolvedValue({ count: 1 });
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('appt-card-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('appt-card-a'));
    await waitFor(() => expect(screen.getByTestId('churn-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('churn-running-late'));
    await waitFor(() => expect(screen.getByTestId('running-late-sheet')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('late-push-apply'));   // default +20 / next
    await waitFor(() => expect(bulkUpdateAppointments).toHaveBeenCalledWith('t1', [
      { id: 'b', patch: { startTime: '11:20' } },
    ]));
  });
});
