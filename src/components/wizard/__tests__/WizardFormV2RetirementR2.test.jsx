// @vitest-environment jsdom
//
// Track J retirement R2 — value-level payload-identity regression.
//
// R2 swaps the wizard's Reflection+Goals mounts (steps 9/10/11) from legacy
// Step7TimeManagement / Step8SelfEvaluation / Step9Goals to the v2
// StepHoursWorked / StepRateYourWeek / StepTargetsNextWeek. This test renders
// the wizard with the REAL v2 components mounted (steps 6/7/8 from R1 + 9/10/11
// from R2 all real), fills a fixed value set across the Reflection+Goals
// steps, submits from the step-12 Review, and asserts `submitReport` receives
// EXACTLY those values under the canonical persisted keys.
//
// Post-R3 all 12 steps are v2 components that mount cleanly under vitest, so
// no step mocks are needed; this test fills the R2 Reflection+Goals fields
// (steps 9/10/11) and asserts they reach submitReport unchanged.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  submitReportMock: vi.fn().mockResolvedValue(),
  saveDraftMock:    vi.fn().mockResolvedValue(),
  getDraftMock:     vi.fn().mockResolvedValue(null),
}));
const { submitReportMock } = hoisted;

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent-1' },
    userProfile: { name: 'Test Agent', commissionRate: 7.5, unitId: null },
    tenantId:    'tenant-1',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  saveDraft:            hoisted.saveDraftMock,
  submitReport:         hoisted.submitReportMock,
  getDraft:             hoisted.getDraftMock,
  getLastSubmission:    vi.fn().mockResolvedValue(null),
  getRecentSubmissions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getLastNSundaysForDropdown: () => [{ value: '2026-05-31', label: 'May 31' }],
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency:     (n) => `TTD ${Math.round(Number(n) || 0).toLocaleString('en-US')}`,
  formatDateFriendly: () => 'May 31, 2026',
  formatDateDisplay:  () => 'May 31, 2026',
}));

vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => null }));

// All steps render REAL (v2). Steps 9/10/11 are the focus of this R2 regression.

import WizardForm from '../WizardForm';

// Parallel full-suite load can starve CPU while WizardForm mounts all 12 v2
// steps, occasionally exceeding testing-library's default 1000ms waitFor
// budget. This file's waits time out at openWizard() under contention (passes
// 2/2 in isolation). Pin the timing by widening the wait budget — assertions
// are unchanged; this only buys headroom for a slow mount/submit under load.
const WAIT = { timeout: 5000 };

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

async function openWizard() {
  render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);
  await screen.findByTestId('wizard-v2-modal', undefined, WAIT);
}

function next() {
  fireEvent.click(screen.getByTestId('wizard-v2-next'));
}

function clickRating(label, value) {
  const card = screen.getByText(label).closest('.rounded-xl');
  fireEvent.click(within(card).getByRole('button', { name: String(value) }));
}

describe('R2 retirement — value-level payload identity (real v2 steps 9/10/11)', () => {
  it('fills Reflection+Goals fields through the real v2 components → submitReport gets exact values', async () => {
    await openWizard();

    // Steps 1→8: advance untouched (1-3 + 6-8 real v2, 4-5 mocked).
    for (let n = 1; n < 9; n++) next(); // lands on step 9

    // Step 9 — StepHoursWorked (real).
    expect(screen.getByTestId('wizard-v2-step-9')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Office Hours'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Field Hours'), { target: { value: '18' } });
    next(); // 9 → 10

    // Step 10 — StepRateYourWeek (real).
    expect(screen.getByTestId('wizard-v2-step-10')).toBeInTheDocument();
    clickRating('Planning Effectiveness & Effort', 7);
    clickRating('Time & Priority Management', 6);
    clickRating('Sales Performance & Effectiveness', 8);
    clickRating('Prospecting Effort & Effectiveness', 7);
    clickRating('Overall Rating of Your Week', 7);
    fireEvent.change(screen.getByPlaceholderText('Add any notes here…'), { target: { value: 'Solid week.' } });
    next(); // 10 → 11

    // Step 11 — StepTargetsNextWeek (real).
    expect(screen.getByTestId('wizard-v2-step-11')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Target Dials'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Target Tel Contacts'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Target F2F Attempts'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Target FFI'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Target CI'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Target Applications Sold'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Target API (TTD)'), { target: { value: '24000' } });
    fireEvent.change(screen.getByPlaceholderText('Optional — your goals for next week…'), { target: { value: 'Referral push.' } });
    next(); // 11 → 12 (Review)

    // Submit from Review.
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => expect(submitReportMock).toHaveBeenCalledTimes(1), WAIT);

    const formData = submitReportMock.mock.calls[0][4];

    // Hours (step 9).
    expect(formData.officeHours).toBe(22);
    expect(formData.fieldHours).toBe(18);
    // Ratings + notes (step 10).
    expect(formData.ratingPlanning).toBe(7);
    expect(formData.ratingTimeManagement).toBe(6);
    expect(formData.ratingSalesPerformance).toBe(8);
    expect(formData.ratingProspecting).toBe(7);
    expect(formData.ratingOverall).toBe(7);
    expect(formData.notes).toBe('Solid week.');
    // Goals (step 11).
    expect(formData.targetDials).toBe(120);
    expect(formData.targetTelContacts).toBe(55);
    expect(formData.targetF2FAttempts).toBe(15);
    expect(formData.targetFFI).toBe(6);
    expect(formData.targetCI).toBe(5);
    expect(formData.targetAppsSold).toBe(4);
    expect(formData.targetAPI).toBe(24000);
    expect(formData.goalNotes).toBe('Referral push.');
  });

  it('submitReport still receives the full Reflection+Goals canonical key set', async () => {
    await openWizard();
    for (let n = 1; n < 12; n++) next();
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => expect(submitReportMock).toHaveBeenCalledTimes(1), WAIT);

    const formData = submitReportMock.mock.calls[0][4];
    const keys = [
      'officeHours', 'fieldHours',
      'ratingPlanning', 'ratingTimeManagement', 'ratingSalesPerformance', 'ratingProspecting', 'ratingOverall', 'notes',
      'targetDials', 'targetTelContacts', 'targetF2FAttempts', 'targetFFI', 'targetCI', 'targetAppsSold', 'targetAPI', 'goalNotes',
    ];
    for (const k of keys) expect(formData).toHaveProperty(k);
  });
});
