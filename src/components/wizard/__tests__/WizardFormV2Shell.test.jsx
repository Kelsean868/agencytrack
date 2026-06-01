// @vitest-environment jsdom
//
// Track J Wizard v2 PR1 — structural shell tests.
//
// Pins the 12-step / 4-phase re-pagination + the navigation chrome.
// Computation, autosave behavior, and submit are tested separately
// (WizardFormSaveStatus.test.jsx + WizardFormV2PayloadIdentity.test.jsx).

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
  saveDraft:        vi.fn().mockResolvedValue(),
  submitReport:     vi.fn().mockResolvedValue(),
  getDraft:         vi.fn().mockResolvedValue(null),
  getLastSubmission:vi.fn().mockResolvedValue(null),
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

// Legacy step files (Step3-9, StepSocialMedia, Step5/6/7/8/9) don't carry an
// explicit `import React from 'react'` and break under vitest's classic JSX
// transform when mounted. Brief preserves these files as-is for the
// easy-revert property. Stub them inert here — the v2 tests pin the wizard's
// composition + chrome, not the legacy step components' field markup.
// (Inlined factories — vi.mock is hoisted; closure-captured helpers fail.)
vi.mock('../steps/Step3Approaches',       () => ({ default: () => <div data-testid="legacy-step3" /> }));
vi.mock('../steps/Step4ClosingSales',     () => ({ default: () => <div data-testid="legacy-step4" /> }));
vi.mock('../steps/Step5NewNames',         () => ({ default: () => <div data-testid="legacy-step5" /> }));
vi.mock('../steps/Step6DeliveriesService',() => ({ default: () => <div data-testid="legacy-step6" /> }));
vi.mock('../steps/Step7TimeManagement',   () => ({ default: () => <div data-testid="legacy-step7" /> }));
vi.mock('../steps/Step8SelfEvaluation',   () => ({ default: () => <div data-testid="legacy-step8" /> }));
vi.mock('../steps/Step9Goals',            () => ({ default: () => <div data-testid="legacy-step9" /> }));
vi.mock('../steps/StepSocialMedia',       () => ({ default: () => <div data-testid="legacy-step-social" /> }));

import WizardForm from '../WizardForm';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

async function openWizardAt(initialWeek = '2026-05-31') {
  render(<WizardForm onClose={vi.fn()} initialWeek={initialWeek} />);
  // Auth loads + getDraft resolves; the step screen renders.
  await waitFor(() => {
    expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PhaseProgress + 12-dot bar
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — PhaseProgress', () => {
  it('renders 12 step dots grouped into 4 phases', async () => {
    await openWizardAt();
    expect(screen.getByTestId('wizard-v2-phase-progress')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-phase-label-activity')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-phase-label-sales')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-phase-label-reflection')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-phase-label-goals')).toBeInTheDocument();
    for (let n = 1; n <= 12; n++) {
      expect(screen.getByTestId(`wizard-v2-step-dot-${n}`)).toBeInTheDocument();
    }
  });

  it('step 1 is current; steps 2-12 are future; activity label is active', async () => {
    await openWizardAt();
    expect(screen.getByTestId('wizard-v2-step-dot-1')).toHaveAttribute('data-state', 'current');
    for (let n = 2; n <= 12; n++) {
      expect(screen.getByTestId(`wizard-v2-step-dot-${n}`)).toHaveAttribute('data-state', 'future');
    }
    expect(screen.getByTestId('wizard-v2-phase-label-activity')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('wizard-v2-phase-label-sales')).toHaveAttribute('data-state', 'future');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Footer nav (Back / Next) + step counter
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — footer nav', () => {
  it('renders "Step 1 of 12" counter on initial mount', async () => {
    await openWizardAt();
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 1 of 12/);
  });

  it('Next button is labeled with the upcoming step title', async () => {
    await openWizardAt();
    expect(screen.getByTestId('wizard-v2-next').textContent).toMatch(/Seminars & tradeshows/);
  });

  it('clicking Next advances step 1 → 2; counter + active dot follow', async () => {
    await openWizardAt();
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 2 of 12/);
    expect(screen.getByTestId('wizard-v2-step-dot-2')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('wizard-v2-step-dot-1')).toHaveAttribute('data-state', 'past');
  });

  it('Back from step 2 goes back to step 1; from step 1 goes back to date picker', async () => {
    await openWizardAt();
    fireEvent.click(screen.getByTestId('wizard-v2-next')); // → step 2
    fireEvent.click(screen.getByTestId('wizard-v2-back')); // → step 1
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 1 of 12/);
    fireEvent.click(screen.getByTestId('wizard-v2-back')); // → date picker
    expect(screen.queryByTestId('wizard-v2-footer')).toBeNull();
    expect(screen.getByText('Select Week')).toBeInTheDocument();
  });

  it('advances across all 4 phase boundaries (1→2, 5→6, 8→9, 10→11)', async () => {
    await openWizardAt();
    for (let n = 1; n <= 10; n++) {
      expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(new RegExp(`Step ${n} of 12`));
      fireEvent.click(screen.getByTestId('wizard-v2-next'));
    }
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 11 of 12/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dot tappability — visited only
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — dot tappability', () => {
  it('visited dot is tappable; future dot is disabled', async () => {
    await openWizardAt();
    fireEvent.click(screen.getByTestId('wizard-v2-next')); // → step 2
    fireEvent.click(screen.getByTestId('wizard-v2-next')); // → step 3
    const dot1 = screen.getByTestId('wizard-v2-step-dot-1');
    const dot5 = screen.getByTestId('wizard-v2-step-dot-5');
    expect(dot1).toHaveAttribute('data-visited', 'true');
    expect(dot1).not.toBeDisabled();
    expect(dot5).toHaveAttribute('data-visited', 'false');
    expect(dot5).toBeDisabled();
    // Tap a visited dot → jumps back
    fireEvent.click(dot1);
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 1 of 12/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal frame
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — modal frame', () => {
  it('renders as a fixed-inset modal with role=dialog + aria-modal=true', async () => {
    await openWizardAt();
    const modal = screen.getByTestId('wizard-v2-modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.className).toContain('fixed');
    expect(modal.className).toContain('inset-0');
  });

  it('close button fires onClose', async () => {
    const onClose = vi.fn();
    render(<WizardForm onClose={onClose} initialWeek="2026-05-31" />);
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('wizard-v2-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 11 is the final step (PR1) — Next button labelled "Submit Report"
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — PR1 final step (11)', () => {
  it('Next label flips to "Submit Report" on step 11; step 12 (Review) is deferred to PR3', async () => {
    await openWizardAt();
    for (let n = 1; n < 11; n++) fireEvent.click(screen.getByTestId('wizard-v2-next'));
    expect(screen.getByTestId('wizard-v2-step-counter').textContent).toMatch(/Step 11 of 12/);
    expect(screen.getByTestId('wizard-v2-next').textContent).toMatch(/Submit Report/);
    // Step 12's dot exists but is future-state (PR3 placeholder).
    expect(screen.getByTestId('wizard-v2-step-dot-12')).toHaveAttribute('data-state', 'future');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step titles per phase
// ─────────────────────────────────────────────────────────────────────────────
describe('Wizard v2 — step titles per phase', () => {
  const titles = [
    'Letters & outreach',
    'Seminars & tradeshows',
    'Calls & face-to-face',
    'Social & content',
    'New names added',
    'Approaches & interviews',
    'New business this week',
    'Delivery & service',
    'Hours worked',
    'Rate your week',
    'Targets for next week',
  ];
  it('matches v2 mockup pagination', async () => {
    await openWizardAt();
    for (let i = 0; i < titles.length; i++) {
      expect(screen.getByTestId('wizard-v2-step-title').textContent).toBe(titles[i]);
      if (i < titles.length - 1) fireEvent.click(screen.getByTestId('wizard-v2-next'));
    }
  });
});
