// @vitest-environment jsdom
//
// Wizard v3 fast-path Phase 1 — Confirm-screen integration tests.
//
// Pins the new `initialScreen='confirm'` entry: the wizard mounts the
// WeekConfirmView, "Looks good →" advances into the step flow at step 10
// (Rate), and the full-path (weekly / no-draft) entry is unaffected.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent-1' },
    userProfile: { name: 'Test Agent', commissionRate: 0, unitId: null },
    tenantId:    'tenant-1',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  saveDraft:              vi.fn().mockResolvedValue(),
  submitReport:           vi.fn().mockResolvedValue(),
  getDraft:               vi.fn().mockResolvedValue(null),
  getLastSubmission:      vi.fn().mockResolvedValue(null),
  getRecentSubmissions:   vi.fn().mockResolvedValue([]),
  getLeaderboardPoints:   vi.fn().mockResolvedValue(0),
  sanitize:               (data) => data,
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getLastNSundaysForDropdown: () => [
    { value: '2026-05-31', label: 'May 31, 2026' },
    { value: '2026-05-24', label: 'May 24, 2026' },
  ],
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency:     (n) => `TTD ${n}`,
  formatDateFriendly: () => 'May 31, 2026',
  formatDateDisplay:  () => 'May 31, 2026',
}));

vi.mock('../../submissions/SubmissionViewer', () => ({
  default: () => <div data-testid="submission-viewer-mock" />,
}));

import WizardForm from '../WizardForm';
import { getDraft } from '../../../services/submissionService';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('Wizard v3 — Confirm screen (fast-path entry)', () => {
  it('shows the loading state until the draft read resolves, never the empty state', async () => {
    // Hold the getDraft read open so we can observe the pre-resolve render.
    let resolveDraft;
    getDraft.mockReturnValueOnce(new Promise((res) => { resolveDraft = res; }));
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" />);
    // Before the read resolves: loader shown; NOT WeekConfirmView, NOT the empty state.
    expect(await screen.findByTestId('wizard-v2-confirm-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
    expect(screen.queryByText(/no activity logged/i)).toBeNull();
    // Resolve with a seeded daily-aggregated draft → Confirm view mounts, loader gone.
    resolveDraft({ aggregatedFromDaily: true, daysWorked: 3, ffiConducted: 2 });
    await waitFor(() => expect(screen.getByTestId('week-confirm-view')).toBeInTheDocument());
    expect(screen.queryByTestId('wizard-v2-confirm-loading')).toBeNull();
  });

  it("initialScreen='confirm' mounts WeekConfirmView with the Confirm title", async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" />);
    await waitFor(() => {
      expect(screen.getByTestId('week-confirm-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe('Confirm your week');
    // Confirm is not a step: no footer nav, no phase rail.
    expect(screen.queryByTestId('wizard-v2-footer')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-phase-progress')).toBeNull();
  });

  it('"Looks good →" advances into the step flow at step 10 (Rate your week)', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" />);
    await waitFor(() => {
      expect(screen.getByTestId('week-confirm-next')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('week-confirm-next'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 10 of 12/);
    });
    expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe('Rate your week');
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
  });

  it('full-path entry (no initialScreen) starts at step 1, no Confirm', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 1 of 12/);
  });

  it('no initialWeek + no initialScreen starts at the date picker', async () => {
    render(<WizardForm onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
    expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe('Select Week');
  });
});
