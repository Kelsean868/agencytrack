import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mock state.
const hoisted = vi.hoisted(() => ({
  savePersistency: vi.fn(),
}));

vi.mock('../../../services/persistencyService', () => ({
  savePersistency: hoisted.savePersistency,
}));

// Avoid pulling in firebase chain — formatters has no firebase dep, leave alone.

import PersistencyEntryForm from '../PersistencyEntryForm';

const RICARDO = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

function fillRicardo() {
  for (const [field, value] of Object.entries(RICARDO)) {
    const input = screen.getByTestId(`persistency-input-${field}`);
    fireEvent.change(input, { target: { value: String(value) } });
  }
}

describe('PersistencyEntryForm', () => {
  beforeEach(() => {
    hoisted.savePersistency.mockReset();
  });

  it('renders the six TTD inputs', () => {
    render(
      <PersistencyEntryForm
        monthKey="2026-02"
        agentUid="agent-1"
        agentName="Ricardo Duke"
        existingRecord={null}
        writerRole="branch_manager"
        writerUid="writer-1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByTestId('persistency-input-businessPlaced')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-notTakens')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-incPPPs')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lumpsums100')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lapses')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-reinstatements')).toBeInTheDocument();
  });

  it('updates the derived preview as inputs change (Ricardo Duke validation)', () => {
    render(
      <PersistencyEntryForm
        monthKey="2026-02"
        agentUid="agent-1"
        agentName="Ricardo Duke"
        existingRecord={null}
        writerRole="branch_manager"
        writerUid="writer-1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fillRicardo();
    // Derived persistency should match the Tatil Feb 2026 figure (74.0% rounded
    // to one decimal in the form preview).
    const persText = screen.getByTestId('derived-persistency').textContent;
    expect(persText).toMatch(/73\.9%/);
  });

  it('disables save until all six inputs are populated', () => {
    render(
      <PersistencyEntryForm
        monthKey="2026-02"
        agentUid="agent-1"
        agentName="Ricardo Duke"
        existingRecord={null}
        writerRole="branch_manager"
        writerUid="writer-1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByTestId('persistency-save-button')).toBeDisabled();
    fillRicardo();
    expect(screen.getByTestId('persistency-save-button')).not.toBeDisabled();
  });

  it('calls savePersistency with monthKey + agentUid + numeric inputs + role', async () => {
    const onSaved = vi.fn();
    hoisted.savePersistency.mockResolvedValueOnce(undefined);

    render(
      <PersistencyEntryForm
        monthKey="2026-02"
        agentUid="agent-1"
        agentName="Ricardo Duke"
        existingRecord={null}
        writerRole="branch_manager"
        writerUid="writer-1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fillRicardo();
    fireEvent.click(screen.getByTestId('persistency-save-button'));

    await waitFor(() => expect(hoisted.savePersistency).toHaveBeenCalledTimes(1));
    const [monthKey, agentUid, inputs, role] = hoisted.savePersistency.mock.calls[0];
    expect(monthKey).toBe('2026-02');
    expect(agentUid).toBe('agent-1');
    expect(role).toBe('branch_manager');
    expect(inputs.businessPlaced).toBe(RICARDO.businessPlaced);
    expect(inputs.lumpsums100).toBe(RICARDO.lumpsums100);
    expect(onSaved).toHaveBeenCalled();
  });

  it('surfaces save error inline without closing the form', async () => {
    hoisted.savePersistency.mockRejectedValueOnce(new Error('Permission denied'));

    render(
      <PersistencyEntryForm
        monthKey="2026-02"
        agentUid="agent-1"
        agentName="Ricardo Duke"
        existingRecord={null}
        writerRole="agent"
        writerUid="writer-1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fillRicardo();
    fireEvent.click(screen.getByTestId('persistency-save-button'));

    await waitFor(() => expect(screen.getByText(/Permission denied/i)).toBeInTheDocument());
    // form still rendered
    expect(screen.getByTestId('persistency-entry-form')).toBeInTheDocument();
  });
});
