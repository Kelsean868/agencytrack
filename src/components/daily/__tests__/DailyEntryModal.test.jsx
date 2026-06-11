// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getDailyEntry: vi.fn(),
  saveDailyEntry: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: hoisted.getDailyEntry,
  saveDailyEntry: hoisted.saveDailyEntry,
}));

import DailyEntryModal from '../DailyEntryModal';

const EMPTY_ENTRY = {
  qualifiedApproaches: 0, appointmentsSet: 0, ffisScheduled: 0,
  ffiConducted: 0, solutionPresentations: 0, newCIBooked: 0,
  oldCIBooked: 0, ciConducted: 0,
  newBusiness: { apps: 0, api: 0 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums: { grossAmount: 0 },
  newNamesAdded: 0, oldNamesWorked: 0, serviceContacts: 0,
  hoursWorked: null, wins: '', blockers: '', notes: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.useAuth.mockReturnValue({
    user: { uid: 'agent1' },
    userProfile: { name: 'Test Agent' },
    tenantId: 'tenant1',
  });
  hoisted.getDailyEntry.mockResolvedValue(null);
  hoisted.saveDailyEntry.mockResolvedValue(undefined);
});

describe('DailyEntryModal', () => {
  it('shows loading spinner while fetching entry', async () => {
    hoisted.getDailyEntry.mockReturnValue(new Promise(() => {}));
    render(<DailyEntryModal onClose={vi.fn()} />);
    expect(screen.getByText(/Loading today's entry/i)).toBeInTheDocument();
  });

  it('renders dialog structure with correct a11y attributes after loading', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'daily-entry-title');
  });

  it('renders "Log today" in the title', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    await screen.findByText(/Log today —/);
  });

  it('close button (×) calls onClose', async () => {
    const onClose = vi.fn();
    render(<DailyEntryModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancel button calls onClose', async () => {
    const onClose = vi.fn();
    render(<DailyEntryModal onClose={onClose} />);
    // Cancel is only shown after loading; wait for it
    const cancelBtn = await screen.findByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PPP section expands when "Add PPP details" is clicked', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    const addBtn = await screen.findByText('Add PPP details');
    fireEvent.click(addBtn);
    expect(screen.getByText('Number of PPP increases')).toBeInTheDocument();
  });

  it('PPP section collapses when Remove is clicked', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    const addBtn = await screen.findByText('Add PPP details');
    fireEvent.click(addBtn);
    // Remove button appears after expansion
    fireEvent.click(screen.getAllByText('Remove')[0]);
    await waitFor(() => expect(screen.getByText('Add PPP details')).toBeInTheDocument());
  });

  it('Lumpsums section expands when "Add lumpsum details" is clicked', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    const addBtn = await screen.findByText('Add lumpsum details');
    fireEvent.click(addBtn);
    expect(screen.getByText(/Gross lumpsum amount/i)).toBeInTheDocument();
  });

  it('PPP warning shown when avg increase < minimum (avg 500 vs 2400)', async () => {
    hoisted.getDailyEntry.mockResolvedValue({
      ...EMPTY_ENTRY,
      pppIncreases: { apps: 2, apiIncrease: 1000 }, // avg 500 < 2400
    });
    render(<DailyEntryModal onClose={vi.fn()} />);
    // PPP section auto-expands because pppIncreases.apps > 0
    await screen.findByText(/below/i);
  });

  it('save button calls saveDailyEntry with correct args', async () => {
    render(<DailyEntryModal onClose={vi.fn()} />);
    // Button is disabled={saving || loading}; wait until loading completes before clicking.
    const saveBtn = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(hoisted.saveDailyEntry).toHaveBeenCalledWith(
        'tenant1', 'agent1', 'Test Agent', expect.any(String), expect.any(Object)
      )
    );
  });

  it('save calls onClose after 600ms', async () => {
    const onClose = vi.fn();
    render(<DailyEntryModal onClose={onClose} />);
    const saveBtn = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled()); // button is disabled while loading; wait for enabled
    fireEvent.click(saveBtn);
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('displays role=alert error when save fails', async () => {
    hoisted.saveDailyEntry.mockRejectedValue(new Error('network error'));
    render(<DailyEntryModal onClose={vi.fn()} />);
    const saveBtn = await screen.findByRole('button', { name: /^save$/i });
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/save failed/i)
    );
  });

  it('pre-populates from existing entry and auto-expands PPP when pppIncreases > 0', async () => {
    hoisted.getDailyEntry.mockResolvedValue({
      ...EMPTY_ENTRY,
      pppIncreases: { apps: 1, apiIncrease: 3000 },
    });
    render(<DailyEntryModal onClose={vi.fn()} />);
    // PPP auto-expands — "Add PPP details" should be gone; "Number of PPP increases" should appear
    await screen.findByText('Number of PPP increases');
    expect(screen.queryByText('Add PPP details')).not.toBeInTheDocument();
  });

  it('load error shown with role="alert" when getDailyEntry rejects', async () => {
    hoisted.getDailyEntry.mockRejectedValue(new Error('fetch failed'));
    render(<DailyEntryModal onClose={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load/i);
  });
});
