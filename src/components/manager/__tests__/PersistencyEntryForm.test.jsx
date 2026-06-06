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

import PersistencyEntryForm from '../PersistencyEntryForm';

const RICARDO = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

const EXISTING_RECORD = {
  businessPlaced: 200000,
  notTakens: 5000,
  incPPPs: 10000,
  lumpsums100: 3000,
  lapses: 50000,
  reinstatements: 12000,
};

function fillRicardo() {
  for (const [field, value] of Object.entries(RICARDO)) {
    const input = screen.getByTestId(`persistency-input-${field}`);
    fireEvent.change(input, { target: { value: String(value) } });
  }
}

const DEFAULT_PROPS = {
  tenantId: 't1',
  monthKey: '2026-02',
  agentUid: 'agent-1',
  agentName: 'Ricardo Duke',
  existingRecord: null,
  writerRole: 'branch_manager',
  writerUid: 'writer-1',
  onClose: () => {},
  onSaved: () => {},
};

describe('PersistencyEntryForm', () => {
  beforeEach(() => {
    hoisted.savePersistency.mockReset();
  });

  it('renders as a right-side drawer with dialog role', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-entry-form')).toBeInTheDocument();
  });

  it('shows the gold precedence banner with agent name and month', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    const banner = screen.getByTestId('pers-precedence-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Ricardo Duke');
    expect(banner).toHaveTextContent('February');
    expect(banner).toHaveTextContent('read-only');
  });

  it('renders the six TTD inputs', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-notTakens')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-incPPPs')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lumpsums100')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lapses')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-reinstatements')).toBeInTheDocument();
  });

  it('prefills inputs when existingRecord is provided (prefill arm)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} existingRecord={EXISTING_RECORD} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toHaveValue(200000);
    expect(screen.getByTestId('persistency-input-lapses')).toHaveValue(50000);
    expect(screen.getByTestId('persistency-input-reinstatements')).toHaveValue(12000);
  });

  it('renders empty inputs when existingRecord is null (empty arm)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} existingRecord={null} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toHaveValue(null);
    expect(screen.getByTestId('persistency-input-lapses')).toHaveValue(null);
  });

  it('updates the derived preview as inputs change (Ricardo Duke validation)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    fillRicardo();
    // Derived persistency should match the Tatil Feb 2026 figure (73.9% rounded
    // to one decimal in the form preview).
    const persText = screen.getByTestId('derived-persistency').textContent;
    expect(persText).toMatch(/73\.9%/);
  });

  it('disables save until all six inputs are populated', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /save.*lock/i })).toBeDisabled();
    fillRicardo();
    expect(screen.getByRole('button', { name: /save.*lock/i })).not.toBeDisabled();
  });

  it('save button label includes month name', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /save.*lock.*February/i })).toBeInTheDocument();
  });

  it('calls savePersistency with monthKey + agentUid + numeric inputs + role', async () => {
    const onSaved = vi.fn();
    hoisted.savePersistency.mockResolvedValueOnce(undefined);

    render(<PersistencyEntryForm {...DEFAULT_PROPS} onSaved={onSaved} />);
    fillRicardo();
    fireEvent.click(screen.getByRole('button', { name: /save.*lock/i }));

    await waitFor(() => expect(hoisted.savePersistency).toHaveBeenCalledTimes(1));
    const [tenantId, monthKey, agentUid, inputs, role] = hoisted.savePersistency.mock.calls[0];
    expect(tenantId).toBe('t1');
    expect(monthKey).toBe('2026-02');
    expect(agentUid).toBe('agent-1');
    expect(role).toBe('branch_manager');
    expect(inputs.businessPlaced).toBe(RICARDO.businessPlaced);
    expect(inputs.lumpsums100).toBe(RICARDO.lumpsums100);
    expect(onSaved).toHaveBeenCalled();
  });

  it('surfaces save error inline without closing the form', async () => {
    hoisted.savePersistency.mockRejectedValueOnce(new Error('Permission denied'));

    render(<PersistencyEntryForm {...DEFAULT_PROPS} writerRole="agent" />);
    fillRicardo();
    fireEvent.click(screen.getByRole('button', { name: /save.*lock/i }));

    await waitFor(() => expect(screen.getByText(/Permission denied/i)).toBeInTheDocument());
    // form still rendered
    expect(screen.getByTestId('persistency-entry-form')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PersistencyEntryForm {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<PersistencyEntryForm {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
