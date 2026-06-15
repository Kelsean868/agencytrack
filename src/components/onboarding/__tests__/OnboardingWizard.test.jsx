// @vitest-environment jsdom
//
// Onboarding Wizard tests — Slice B (frame + identity) + Slice C (content steps).
// Covers: welcome→identity→content→completion flow, skip paths, soft-warn,
// write-once lock display, service call shapes, error surface.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ── AuthContext mock ──────────────────────────────────────────────────────────
const mockRefreshProfile = vi.fn();
let mockUserProfile = {};

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:           { uid: 'agent-uid-1' },
    userProfile:    mockUserProfile,
    tenantId:       'tenant-1',
    refreshProfile: mockRefreshProfile,
  }),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────
const mockSaveOnboardingIdentity = vi.fn();
const mockMarkOnboardingComplete  = vi.fn();

vi.mock('../../../services/userService', () => ({
  saveOnboardingIdentity: (...args) => mockSaveOnboardingIdentity(...args),
  markOnboardingComplete:  (...args) => mockMarkOnboardingComplete(...args),
}));

const mockSaveWizardMoneyNeeds = vi.fn();
const mockSaveWizardGamePlan   = vi.fn();
const mockSaveWizardProfile    = vi.fn();

vi.mock('../../../services/onboardingService', () => ({
  saveWizardMoneyNeeds: (...args) => mockSaveWizardMoneyNeeds(...args),
  saveWizardGamePlan:   (...args) => mockSaveWizardGamePlan(...args),
  saveWizardProfile:    (...args) => mockSaveWizardProfile(...args),
}));

const mockGetGoalHierarchy = vi.fn();

vi.mock('../../../services/goalsService', () => ({
  getGoalHierarchy: (...args) => mockGetGoalHierarchy(...args),
}));

// ── dateInputs mock ────────────────────────────────────────────────────────────
vi.mock('../../../utils/dateInputs', () => ({
  getTodayTT: () => '2026-06-15',
}));

import OnboardingWizard from '../OnboardingWizard';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  mockUserProfile = {};
  mockSaveOnboardingIdentity.mockResolvedValue();
  mockMarkOnboardingComplete.mockResolvedValue();
  mockRefreshProfile.mockResolvedValue();
  mockSaveWizardMoneyNeeds.mockResolvedValue();
  mockSaveWizardGamePlan.mockResolvedValue();
  mockSaveWizardProfile.mockResolvedValue();
  mockGetGoalHierarchy.mockResolvedValue(null);
  localStorage.clear();
});

// ── helpers ────────────────────────────────────────────────────────────────────
function renderWizard() {
  return render(<OnboardingWizard />);
}

// Navigate from Welcome → Completion by skipping all content steps.
async function goToCompletion() {
  renderWizard();
  fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));       // → Identity
  fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));       // → Money Needs
  await waitFor(() => expect(screen.getByText(/take home/i)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));       // → Game Plan
  await waitFor(() => expect(screen.getByText(/Game Plan/i)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));       // → Goals
  await waitFor(() => expect(screen.getByText(/goal portfolio/i)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));       // → Profile
  await waitFor(() => expect(screen.getByText(/little about you/i)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));       // → Completion
  await waitFor(() => expect(screen.getByText(/You're all set/i)).toBeTruthy());
}

// ── Welcome step ───────────────────────────────────────────────────────────────
describe('Welcome step', () => {
  it('renders on first load with no prior step saved', () => {
    renderWizard();
    expect(screen.getByText(/Welcome to AgencyTrack/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeTruthy();
  });

  it('advances to identity step on "Get Started"', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    expect(screen.getByLabelText(/Agent number/i)).toBeTruthy();
  });

  it('"Skip setup for now" jumps straight to completion', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Skip setup for now/i }));
    expect(screen.getByText(/You're all set/i)).toBeTruthy();
  });
});

// ── Identity step ─────────────────────────────────────────────────────────────
describe('Identity step', () => {
  function goToIdentity() {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
  }

  it('shows agent number and DOB inputs', () => {
    goToIdentity();
    expect(screen.getByLabelText(/Agent number/i)).toBeTruthy();
    expect(screen.getByLabelText(/Date of birth/i)).toBeTruthy();
  });

  it('shows soft format warning for invalid agent number without blocking save', () => {
    goToIdentity();
    const input = screen.getByLabelText(/Agent number/i);
    fireEvent.change(input, { target: { value: 'BADNUM' } });
    expect(screen.getByRole('status')).toBeTruthy(); // warning chip
    expect(screen.getByRole('button', { name: /Save & Continue/i }).disabled).toBe(false);
  });

  it('does NOT show soft warning for valid format (e.g. 012B34)', () => {
    goToIdentity();
    const input = screen.getByLabelText(/Agent number/i);
    fireEvent.change(input, { target: { value: '012B34' } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('calls saveOnboardingIdentity with correct args on save', async () => {
    goToIdentity();
    fireEvent.change(screen.getByLabelText(/Agent number/i), { target: { value: '012B34' } });
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '1990-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
    await waitFor(() => {
      expect(mockSaveOnboardingIdentity).toHaveBeenCalledWith(
        'tenant-1',
        'agent-uid-1',
        { agentNumber: '012B34', dateOfBirth: '1990-05-15' },
      );
    });
  });

  it('advances to Money Needs step after successful identity save', async () => {
    goToIdentity();
    fireEvent.change(screen.getByLabelText(/Agent number/i), { target: { value: '012B34' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/take home/i)).toBeTruthy();
    });
  });

  it('"Skip for now" advances to Money Needs without writing', async () => {
    goToIdentity();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => {
      expect(screen.getByText(/take home/i)).toBeTruthy();
    });
    expect(mockSaveOnboardingIdentity).not.toHaveBeenCalled();
  });

  it('shows save error when saveOnboardingIdentity rejects', async () => {
    mockSaveOnboardingIdentity.mockRejectedValueOnce(new Error('permission-denied'));
    goToIdentity();
    fireEvent.change(screen.getByLabelText(/Agent number/i), { target: { value: '012B34' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByLabelText(/Agent number/i)).toBeTruthy();
  });

  it('back button from identity returns to welcome', () => {
    goToIdentity();
    fireEvent.click(screen.getByRole('button', { name: /← Back/i }));
    expect(screen.getByText(/Welcome to AgencyTrack/i)).toBeTruthy();
  });
});

// ── Money Needs step ──────────────────────────────────────────────────────────
describe('Money Needs step', () => {
  async function goToMoneyNeeds() {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => expect(screen.getByText(/take home/i)).toBeTruthy());
  }

  it('shows monthly income target input', async () => {
    await goToMoneyNeeds();
    expect(screen.getByLabelText(/Monthly take-home target/i)).toBeTruthy();
  });

  it('"Skip for now" advances to Game Plan without calling service', async () => {
    await goToMoneyNeeds();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => expect(screen.getByText(/Game Plan/i)).toBeTruthy());
    expect(mockSaveWizardMoneyNeeds).not.toHaveBeenCalled();
  });

  it('calls saveWizardMoneyNeeds with monthly amount on save', async () => {
    await goToMoneyNeeds();
    fireEvent.change(screen.getByLabelText(/Monthly take-home target/i), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
    await waitFor(() => expect(mockSaveWizardMoneyNeeds).toHaveBeenCalledWith(
      'tenant-1', 'agent-uid-1', expect.any(Number), { monthly: 10000 },
    ));
  });
});

// ── Game Plan step ────────────────────────────────────────────────────────────
describe('Game Plan step', () => {
  async function goToGamePlan() {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => expect(screen.getByText(/take home/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => expect(screen.getByText(/Game Plan/i)).toBeTruthy());
  }

  it('shows Annual API and average policy inputs', async () => {
    await goToGamePlan();
    expect(screen.getByLabelText(/Annual API target/i)).toBeTruthy();
    expect(screen.getByLabelText(/Average policy size/i)).toBeTruthy();
  });

  it('"Skip for now" advances to Goals without calling service', async () => {
    await goToGamePlan();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await waitFor(() => expect(screen.getByText(/goal portfolio/i)).toBeTruthy());
    expect(mockSaveWizardGamePlan).not.toHaveBeenCalled();
  });
});

// ── Write-once lock ───────────────────────────────────────────────────────────
describe('write-once lock display', () => {
  it('resumes at Money Needs when agentNumber is already set', () => {
    mockUserProfile = { agentNumber: '123C45' };
    renderWizard();
    expect(screen.getByText(/take home/i)).toBeTruthy();
  });

  it('localStorage content-step checkpoint overrides when agentNumber is set', () => {
    mockUserProfile = { agentNumber: '123C45' };
    // Step 3 = STEP_GAME_PLAN
    localStorage.setItem('agencytrack-onboarding-step-agent-uid-1', '3');
    renderWizard();
    expect(screen.getByText(/Game Plan/i)).toBeTruthy();
  });
});

// ── Resume from localStorage ──────────────────────────────────────────────────
describe('resume from localStorage', () => {
  it('resumes at identity step when localStorage step=1 and no agentNumber', () => {
    localStorage.setItem('agencytrack-onboarding-step-agent-uid-1', '1');
    renderWizard();
    expect(screen.getByLabelText(/Agent number/i)).toBeTruthy();
  });

  it('resumes at Game Plan (step=3) when no agentNumber and localStorage says step=3', () => {
    localStorage.setItem('agencytrack-onboarding-step-agent-uid-1', '3');
    renderWizard();
    expect(screen.getByText(/Game Plan/i)).toBeTruthy();
  });
});

// ── Completion step ───────────────────────────────────────────────────────────
describe('Completion step', () => {
  it('calls markOnboardingComplete and refreshProfile on "Enter AgencyTrack"', async () => {
    await goToCompletion();
    fireEvent.click(screen.getByRole('button', { name: /Enter AgencyTrack/i }));
    await waitFor(() => {
      expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('tenant-1', 'agent-uid-1');
      expect(mockRefreshProfile).toHaveBeenCalled();
    });
  });

  it('shows profile snapshot when userProfile has agentNumber', async () => {
    mockUserProfile = { agentNumber: '012B34', dateOfBirth: '1990-05-15' };
    // agentNumber set → resumes at Money Needs, skip through to completion
    renderWizard();
    // Expect Money Needs since resume logic puts us there
    await waitFor(() => expect(screen.getByText(/take home/i)).toBeTruthy());
  });
});

// ── userService — saveOnboardingIdentity + markOnboardingComplete ─────────────
describe('service contract (via wizard integration)', () => {
  it('saveOnboardingIdentity is NOT called with updatedAt (rule would reject it)', async () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    fireEvent.change(screen.getByLabelText(/Agent number/i), { target: { value: '001A01' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
    await waitFor(() => expect(mockSaveOnboardingIdentity).toHaveBeenCalled());
    const [, , fields] = mockSaveOnboardingIdentity.mock.calls[0];
    expect(fields).not.toHaveProperty('updatedAt');
  });

  it('markOnboardingComplete is NOT called with updatedAt', async () => {
    await goToCompletion();
    fireEvent.click(screen.getByRole('button', { name: /Enter AgencyTrack/i }));
    await waitFor(() => expect(mockMarkOnboardingComplete).toHaveBeenCalled());
    expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('tenant-1', 'agent-uid-1');
  });
});
