import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppointmentSheet from '../AppointmentSheet';

/**
 * Run 9 A3 — sheet conflict warning. R7: warn-only, the Save button is never
 * disabled by a conflict. Scope is the loaded week's appointments, passed in
 * via the `appointments` prop (AgentPlannerPanel passes its `appts` state).
 */
describe('AppointmentSheet conflict warning (Run 9 A3, R7 warn-only)', () => {
  const OTHER = { id: 'other-1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' };

  it('renders no warning when the chosen slot does not overlap anything', () => {
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '09:00' }}
        appointments={[OTHER]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-conflict-warning')).not.toBeInTheDocument();
  });

  it('renders the warning line naming the clash once a chosen time overlaps another appointment', () => {
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '09:00' }}
        appointments={[OTHER]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-conflict-warning')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:15' } });

    const warning = screen.getByTestId('appt-conflict-warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute('aria-live', 'polite');
    expect(warning).toHaveTextContent('Overlaps your 10:00 AM appointment');
  });

  it('does not disable Save when a conflict is showing, and Save still fires (R7)', () => {
    const onSave = vi.fn();
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '10:15' }}
        appointments={[OTHER]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('appt-conflict-warning')).toBeInTheDocument();
    const saveBtn = screen.getByTestId('appt-save');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('edit mode excludes the appointment being edited from the comparison (no self-conflict)', () => {
    render(
      <AppointmentSheet
        mode="edit"
        initial={{ id: 'self-1', date: '2026-06-22', startTime: '10:00', durationMin: 60 }}
        appointments={[{ id: 'self-1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' }]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-conflict-warning')).not.toBeInTheDocument();
  });

  it('edit mode still warns of a genuine conflict against a DIFFERENT appointment', () => {
    render(
      <AppointmentSheet
        mode="edit"
        initial={{ id: 'self-1', date: '2026-06-22', startTime: '10:15', durationMin: 60 }}
        appointments={[
          { id: 'self-1', date: '2026-06-22', startTime: '10:15', durationMin: 60, status: 'scheduled' },
          OTHER,
        ]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('appt-conflict-warning')).toHaveTextContent('Overlaps your 10:00 AM appointment');
  });

  it('ignores a RETIRED (cancelled) appointment when checking for a conflict', () => {
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '10:15' }}
        appointments={[{ ...OTHER, status: 'cancelled' }]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-conflict-warning')).not.toBeInTheDocument();
  });
});

/**
 * Run 9 A4 — templates picker. Create-only; hidden entirely when there are no
 * templates. Applying a template fills the appointment SHAPE (type / time /
 * duration / note / free label / api) into the form, leaving the chosen date.
 */
describe('AppointmentSheet templates picker (Run 9 A4)', () => {
  const TPL = {
    id: 'tpl-1', name: 'Morning FFI', type: 'FFI',
    startTime: '09:30', durationMin: 90, note: 'bring quote', apiAmount: null,
  };

  it('is hidden entirely when the agent has no templates', () => {
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '09:00' }}
        templates={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-template-picker')).not.toBeInTheDocument();
  });

  it('is hidden in edit mode even with templates present', () => {
    render(
      <AppointmentSheet
        mode="edit"
        initial={{ id: 'a1', date: '2026-06-22', startTime: '09:00', durationMin: 30 }}
        templates={[TPL]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('appt-template-picker')).not.toBeInTheDocument();
  });

  it('applying a template fills type / start time / duration / note into the form', () => {
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '08:00' }}
        templates={[TPL]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // Duration control starts at the initial default (30).
    expect(screen.getByLabelText('Length (minutes)')).toHaveValue('30');

    fireEvent.click(screen.getByTestId('template-apply-tpl-1'));

    expect(screen.getByLabelText('Start time')).toHaveValue('09:30');
    expect(screen.getByLabelText('Length (minutes)')).toHaveValue('90');
    expect(screen.getByLabelText(/^Note/)).toHaveValue('bring quote');
    // FFI type button is now pressed.
    expect(screen.getByRole('button', { name: 'F.F.I' })).toHaveAttribute('aria-pressed', 'true');
    // Date is left as chosen (templates carry no date).
    expect(screen.getByLabelText('Date')).toHaveValue('2026-06-22');
  });

  it('fires onDeleteTemplate with the template id from the delete affordance', () => {
    const onDeleteTemplate = vi.fn();
    render(
      <AppointmentSheet
        mode="create"
        initial={{ date: '2026-06-22', startTime: '08:00' }}
        templates={[TPL]}
        onSave={vi.fn()}
        onDeleteTemplate={onDeleteTemplate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('template-delete-tpl-1'));
    expect(onDeleteTemplate).toHaveBeenCalledWith('tpl-1');
  });
});
