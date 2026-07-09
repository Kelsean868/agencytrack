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
import { mapFloorToPoints } from '../../daily/DailyCaptureV2.helpers';

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
    const loadingContainer = await screen.findByTestId('wizard-v2-confirm-loading');
    expect(loadingContainer).toBeInTheDocument();
    // 0.1b — the loader is a PanelSkeleton (aria-busy status region), not a spinner.
    expect(loadingContainer.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(loadingContainer.querySelector('.animate-spin')).toBeFalsy();
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

describe('Wizard v3 — fast-path back-navigation (Confirm ↔ step 10)', () => {
  it('Back from step 10 returns to the Confirm screen when entered via the fast path', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" />);
    await waitFor(() => {
      expect(screen.getByTestId('week-confirm-next')).toBeInTheDocument();
    });
    // Advance Confirm → step 10.
    fireEvent.click(screen.getByTestId('week-confirm-next'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 10 of 12/);
    });
    // Back from step 10 → Confirm, NOT step 9.
    fireEvent.click(screen.getByTestId('wizard-v2-back'));
    await waitFor(() => {
      expect(screen.getByTestId('week-confirm-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe('Confirm your week');
  });

  it('full-path Back from step 10 decrements to step 9 (regression guard)', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialStep={10} />);
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 10 of 12/);
    });
    // No fast-path origin → Back decrements to step 9 (Hours worked), no Confirm.
    fireEvent.click(screen.getByTestId('wizard-v2-back'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 9 of 12/);
    });
    expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe('Hours worked');
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
  });

  // Gemini #723: once the agent descends below step 10 (here, via the phase rail),
  // the Confirm-return shortcut is stale. After walking back up to step 10, Back
  // must decrement to step 9 — NOT jump back to Confirm.
  it('clears the Confirm shortcut after descending below step 10 via the phase rail', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" />);
    await waitFor(() => {
      expect(screen.getByTestId('week-confirm-next')).toBeInTheDocument();
    });
    // Confirm → step 10.
    fireEvent.click(screen.getByTestId('week-confirm-next'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 10 of 12/);
    });
    // Jump back to step 9 via the rail (a visited dot) → cameFromConfirm clears.
    fireEvent.click(screen.getByTestId('wizard-v2-step-dot-9'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 9 of 12/);
    });
    // Walk forward back to step 10.
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 10 of 12/);
    });
    // Back now decrements to step 9 (full-path behavior), NOT Confirm.
    fireEvent.click(screen.getByTestId('wizard-v2-back'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 9 of 12/);
    });
    expect(screen.queryByTestId('week-confirm-view')).toBeNull();
  });
});

describe('Wizard v3 — Confirm points-earned-vs-floor readout', () => {
  const SEEDED_DRAFT = { aggregatedFromDaily: true, daysWorked: 3, ffiConducted: 2 };
  const FLOORS_LOW  = { factFindsCompleted: 1 };          // small floor → met
  const FLOORS_HIGH = { applicationsSubmitted: 100 };     // large floor → not met

  it('renders the readout and shows "Floor met" when earned ≥ floor', async () => {
    getDraft.mockResolvedValueOnce({ ...SEEDED_DRAFT });
    render(
      <WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" floors={FLOORS_LOW} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-confirm-points')).toBeInTheDocument();
    });
    const floor = mapFloorToPoints(FLOORS_LOW); // 5
    expect(screen.getByTestId('wizard-v2-confirm-points-value').textContent)
      .toMatch(new RegExp(`/ ${floor} pts`));
    expect(screen.getByTestId('wizard-v2-confirm-floor-met')).toBeInTheDocument();
  });

  it('hides "Floor met" when earned < floor', async () => {
    getDraft.mockResolvedValueOnce({ ...SEEDED_DRAFT });
    render(
      <WizardForm onClose={vi.fn()} initialWeek="2026-05-31" initialScreen="confirm" floors={FLOORS_HIGH} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-confirm-points')).toBeInTheDocument();
    });
    const floor = mapFloorToPoints(FLOORS_HIGH); // 2500
    expect(screen.getByTestId('wizard-v2-confirm-points-value').textContent)
      .toMatch(new RegExp(`/ ${floor} pts`));
    expect(screen.queryByTestId('wizard-v2-confirm-floor-met')).toBeNull();
  });
});

// BUG-101 — the STEP screen must be gated on draftLoaded exactly like the
// Confirm screen: no editable step body until the getDraft read resolves, so a
// value typed pre-resolve can't be clobbered by the late draft merge.
describe('Wizard — step-screen draft gate (BUG-101)', () => {
  it('shows the loading state and gates the step body until the draft read resolves', async () => {
    // Hold getDraft open so the pre-resolve step render is observable.
    let resolveDraft;
    getDraft.mockReturnValueOnce(new Promise((res) => { resolveDraft = res; }));
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);

    // Pre-resolve: loading skeleton shown, step body NOT rendered (no editable
    // inputs to type into and lose).
    const loadingContainer = await screen.findByTestId('wizard-v2-step-loading');
    expect(loadingContainer).toBeInTheDocument();
    // 0.1b — PanelSkeleton (aria-busy status region), not a spinner.
    expect(loadingContainer.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByTestId('wizard-v2-step-1')).toBeNull();

    // Resolve with no draft (fresh week) → step 1 mounts, loader gone.
    resolveDraft(null);
    await waitFor(() => expect(screen.getByTestId('wizard-v2-step-1')).toBeInTheDocument());
    expect(screen.queryByTestId('wizard-v2-step-loading')).toBeNull();
  });

  it('a submitted week never renders the step body (loading → interstitial)', async () => {
    let resolveDraft;
    getDraft.mockReturnValueOnce(new Promise((res) => { resolveDraft = res; }));
    render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);

    expect(await screen.findByTestId('wizard-v2-step-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-v2-step-1')).toBeNull();

    // Resolve as a submitted week → interstitial mounts, step body never rendered.
    resolveDraft({ status: 'submitted', agentId: 'agent-1', weekStarting: '2026-05-31' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Already submitted' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('wizard-v2-step-1')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-step-loading')).toBeNull();
    // Footer is gone on the submitted screen (screen !== 'step').
    expect(screen.queryByTestId('wizard-v2-footer')).toBeNull();
  });
});
