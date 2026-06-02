// @vitest-environment jsdom
//
// Track J Wizard v2 PR3 — step 12 integration tests.
//
// Covers the PR3-specific flow:
//   - Step 12 renders the ReviewSubmit screen (not a step component).
//   - WeekSoFarPanel desktop rail + mobile strip are HIDDEN on step 12.
//   - Footer Next label on step 12 is "Submit Report" (not "Next · …").
//   - Edit · Step N pills jump back AND arm "Back to Review" override.
//   - "Back to Review" override returns the agent to step 12 in one click.
//   - Successful submit transitions to the Celebration screen (testid).
//
// Payload identity + canonical-compute parity are covered separately in
// WizardFormV2PayloadIdentity.test.jsx + ReviewSubmit.test.jsx.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent-1' },
    userProfile: { name: 'Test Agent', commissionRate: 7.5, unitId: null },
    tenantId:    'tenant-1',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  saveDraft:            vi.fn().mockResolvedValue(),
  submitReport:         vi.fn().mockResolvedValue(),
  getDraft:             vi.fn().mockResolvedValue(null),
  getLastSubmission:    vi.fn().mockResolvedValue(null),
  getRecentSubmissions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getLastNSundaysForDropdown: () => [{ value: '2026-05-31', label: 'May 31, 2026' }],
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency:     (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
  formatDateFriendly: () => 'May 31, 2026',
  formatDateDisplay:  () => 'May 31, 2026',
}));

vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => null }));

// All 12 steps are v2 components now (legacy steps/ retired) — they mount
// cleanly under vitest, so no inert step mocks are needed here.

import WizardForm from '../WizardForm';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

async function advanceToStep(stepN) {
  render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);
  await waitFor(() => expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument());
  for (let n = 1; n < stepN; n++) {
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
  }
}

describe('PR3 step 12 — Review screen mount', () => {
  it('renders the ReviewSubmit panel when on step 12', async () => {
    await advanceToStep(12);
    expect(screen.getByTestId('wizard-v2-review')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-step-12')).toBeInTheDocument();
  });

  it('does NOT mount the step-11 component on step 12 (Review replaces it)', async () => {
    await advanceToStep(12);
    // Step 12 mounts ReviewSubmit, not the step-11 component — assert the
    // step-11 container testid is absent while the Review testid is present.
    expect(screen.queryByTestId('wizard-v2-step-11')).toBeNull();
    expect(screen.getByTestId('wizard-v2-step-12')).toBeInTheDocument();
  });

  it('footer counter reads "Step 12 of 12"', async () => {
    await advanceToStep(12);
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 12 of 12');
  });

  it('footer Next label on step 12 = "Submit Report"', async () => {
    await advanceToStep(12);
    expect(screen.getByTestId('wizard-v2-next')).toHaveTextContent(/submit report/i);
  });

  it('hides the WeekSoFarPanel desktop rail on step 12', async () => {
    await advanceToStep(12);
    expect(screen.queryByTestId('wizard-v2-week-so-far')).toBeNull();
  });

  it('hides the mobile WeekSoFarPanel strip on step 12', async () => {
    await advanceToStep(12);
    expect(screen.queryByTestId('wizard-v2-week-so-far-mobile')).toBeNull();
  });

  it('still mounts the WeekSoFarPanel on step 11 (regression for prior steps)', async () => {
    await advanceToStep(11);
    expect(screen.getByTestId('wizard-v2-week-so-far')).toBeInTheDocument();
  });
});

describe('PR3 Edit · Step N jump-back + Back to Review', () => {
  it('clicking Edit Production navigates back to step 7', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-production-edit'));
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 7 of 12');
    // Edit pill arms "Back to Review" override.
    expect(screen.getByTestId('wizard-v2-next')).toHaveTextContent(/back to review/i);
  });

  it('"Back to Review" Next jumps straight to step 12', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-activity-edit'));
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 3 of 12');
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 12 of 12');
    expect(screen.getByTestId('wizard-v2-review')).toBeInTheDocument();
  });

  it('after returning to Review, footer Next is back to "Submit Report"', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-reflection-edit'));
    fireEvent.click(screen.getByTestId('wizard-v2-next')); // "Back to Review"
    expect(screen.getByTestId('wizard-v2-next')).toHaveTextContent(/submit report/i);
  });

  it('Edit Goals jumps to step 11 (not 12)', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-goals-edit'));
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 11 of 12');
  });
});

describe('PR3 Submit from step 12 → Celebration', () => {
  it('clicking Submit Report on step 12 calls submitReport then mounts Celebration', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-next')); // Submit Report

    const { submitReport } = await import('../../../services/submissionService');
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('wizard-v2-celebration')).toBeInTheDocument());
  });

  it('Celebration shows the entered weekStarting label in the subtitle', async () => {
    await advanceToStep(12);
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => expect(screen.getByTestId('wizard-v2-celebration')).toBeInTheDocument());
    expect(screen.getByText(/May 31, 2026/)).toBeInTheDocument();
  });
});
