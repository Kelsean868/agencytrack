// @vitest-environment jsdom
//
// Track J retirement R1 — value-level payload-identity regression.
//
// The R1 extraction swaps the wizard's Sales-phase mounts (steps 6/7/8) from
// the legacy Step3Approaches / Step4ClosingSales / Step6DeliveriesService to
// the v2 StepApproachesInterviews / StepNewBusiness / StepDeliveryService.
// This test renders the wizard with the REAL v2 components mounted, fills a
// fixed set of values across those three steps, submits from the step-12
// Review, and asserts `submitReport` receives EXACTLY those values under the
// canonical persisted keys — proving the extraction preserved shape + values.
//
// Post-R3 all 12 steps are v2 components that mount cleanly under vitest, so
// no step mocks are needed; this test still fills ONLY the R1 Sales-phase
// fields (steps 6/7/8) and asserts they reach submitReport unchanged.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

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
  getLeaderboardPoints: vi.fn().mockResolvedValue(0),
  sanitize:             (data) => data,
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

// All steps render REAL (v2). Steps 6/7/8 are the focus of this R1 regression.

import WizardForm from '../WizardForm';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

async function openWizard() {
  render(<WizardForm onClose={vi.fn()} initialWeek="2026-05-31" />);
  await waitFor(() => expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument());
}

function next() {
  fireEvent.click(screen.getByTestId('wizard-v2-next'));
}

describe('R1 retirement — value-level payload identity (real v2 steps 6/7/8)', () => {
  it('fills Sales-phase fields through the real v2 components → submitReport gets exact values', async () => {
    await openWizard();

    // Steps 1→5 (real v2 1-3 + mocked 4-5): advance untouched.
    next(); // 1 → 2
    next(); // 2 → 3
    next(); // 3 → 4
    next(); // 4 → 5
    next(); // 5 → 6

    // Step 6 — StepApproachesInterviews (real).
    expect(screen.getByTestId('wizard-v2-step-6')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Qualified Approaches'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('FFIs Conducted'), { target: { value: '6' } });
    next(); // 6 → 7

    // Step 7 — StepNewBusiness (real).
    expect(screen.getByTestId('wizard-v2-step-7')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New CIs Booked'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Old CIs Booked'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('CIs Conducted'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Applications Written'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Lives Sold'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('API (TTD)'), { target: { value: '10000' } });
    // Expand PPP + Lumpsum, fill.
    fireEvent.click(screen.getByRole('button', { name: /Add PPP details/ }));
    fireEvent.change(screen.getByLabelText('Number of PPP increases'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Total API increase (TTD)'), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /Add lumpsum details/ }));
    fireEvent.change(screen.getByLabelText('Gross lumpsum amount (TTD)'), { target: { value: '50000' } });
    next(); // 7 → 8

    // Step 8 — StepDeliveryService (real).
    expect(screen.getByTestId('wizard-v2-step-8')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New Policies Received'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Policies Delivered'), { target: { value: '4' } });
    next(); // 8 → 9

    // Steps 9/10/11 (real v2, R2) left untouched; advance to 12.
    next(); // 9 → 10
    next(); // 10 → 11
    next(); // 11 → 12 (Review)

    // Submit from Review.
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => expect(submitReportMock).toHaveBeenCalledTimes(1));

    const formData = submitReportMock.mock.calls[0][4];

    // Values entered through the v2 components persist EXACTLY.
    expect(formData.qualifiedApproaches).toBe(11);
    expect(formData.ffiConducted).toBe(6);
    expect(formData.newCIBooked).toBe(3);
    expect(formData.oldCIBooked).toBe(2);
    expect(formData.ciConducted).toBe(4);
    expect(formData.livesSold).toBe(5);
    expect(formData.newBusiness).toEqual({ apps: 2, api: 10000 });
    expect(formData.pppIncreases).toEqual({ apps: 1, apiIncrease: 3000 });
    expect(formData.lumpsums).toEqual({ grossAmount: 50000 });
    expect(formData.policiesReceived).toBe(7);
    expect(formData.policiesDelivered).toBe(4);
  });

  it('submitReport still receives the full canonical key set (no dropped/renamed field)', async () => {
    await openWizard();
    for (let n = 1; n < 12; n++) next();
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    await waitFor(() => expect(submitReportMock).toHaveBeenCalledTimes(1));

    const formData = submitReportMock.mock.calls[0][4];
    // The Sales-phase keys the R1 components own are all present.
    const salesKeys = [
      'qualifiedApproaches', 'appointmentsSet', 'ffisScheduled', 'ffiConducted', 'solutionPresentations',
      'newCIBooked', 'oldCIBooked', 'ciConducted', 'livesSold', 'newBusiness', 'pppIncreases', 'lumpsums',
      'policiesReceived', 'policiesDelivered', 'policiesOutstanding', 'hasServiceWork',
      'serviceContacts', 'premiumCollectionMeetings', 'withdrawalsLoans', 'surrenders', 'policyChanges',
      'annualReviews', 'orphanReviews', 'orphansAdopted',
      'reinstatementsSubmitted', 'reinstatementAPI', 'renewalPremiumsCollected',
    ];
    for (const k of salesKeys) {
      expect(formData).toHaveProperty(k);
    }
    // Nested production objects keep their default shape.
    expect(formData.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(formData.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(formData.lumpsums).toEqual({ grossAmount: 0 });
  });
});
