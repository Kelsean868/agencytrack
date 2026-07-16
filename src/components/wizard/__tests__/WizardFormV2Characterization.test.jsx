// @vitest-environment jsdom
//
// Q1 — WizardForm v2 characterization tests.
//
// Locks the behaviors the v3 shell (Q4) must preserve. These are
// CHARACTERIZATION tests — encode current behavior as-is, including quirks.
// Do not "fix" behavior; note gaps inline and assert what actually happens.
//
// Suites:
//   A — draft prefill  (getDraft fields spread into formData)
//   B — submitted-draft guard  (status=submitted → no-edit interstitial)
//   C — autosave draftStatus guard  (no saveDraft when submitted)
//   D — scoring engine  (computePoints fixture + known edge cases)
//   E — weekly floor  (mapFloorToPoints(DEFAULT_WEEKLY_ACTIVITY_FLOORS) === 399)

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  getDraftMock:     vi.fn().mockResolvedValue(null),
  saveDraftMock:    vi.fn().mockResolvedValue(undefined),
  submitReportMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'agent-1' },
    userProfile: { name: 'Test Agent', commissionRate: 0, unitId: null },
    tenantId:    'tenant-1',
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  getDraft:             hoisted.getDraftMock,
  saveDraft:            hoisted.saveDraftMock,
  submitReport:         hoisted.submitReportMock,
  getLastSubmission:    vi.fn().mockResolvedValue(null),
  getRecentSubmissions: vi.fn().mockResolvedValue([]),
  getLeaderboardPoints: vi.fn().mockResolvedValue(0),
  sanitize:             (data) => data,
}));

vi.mock('../../../utils/dateHelpers', () => ({
  getLastNSundaysForDropdown: () => [
    { value: '2026-05-31', label: 'May 31, 2026' },
  ],
  // Celebration's gold WEEK-N medal calls this on submit — stubbed so the
  // submit→Celebration mount in this file doesn't crash on an undefined
  // import from the mocked module.
  weekNumber: () => 22,
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
import { computePoints } from '../../../lib/computePoints';
import { mapFloorToPoints } from '../../daily/DailyCaptureV2.helpers';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';

const WEEK = '2026-05-31';

function renderWizard() {
  render(<WizardForm onClose={vi.fn()} initialWeek={WEEK} />);
}

async function waitForModal() {
  await waitFor(() => {
    expect(screen.getByTestId('wizard-v2-modal')).toBeInTheDocument();
  });
}


// Navigate from step 1 to submit: 11 Next clicks advance to step 12,
// the 12th Next click calls handleSubmit (FINAL_STEP guard in handleNext).
function clickThroughToSubmit() {
  for (let n = 1; n < 12; n++) {
    fireEvent.click(screen.getByTestId('wizard-v2-next'));
  }
  fireEvent.click(screen.getByTestId('wizard-v2-next'));
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  hoisted.getDraftMock.mockResolvedValue(null);
  hoisted.saveDraftMock.mockResolvedValue(undefined);
  hoisted.submitReportMock.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// A — Draft prefill
// ─────────────────────────────────────────────────────────────────────────────
describe('A — draft prefill', () => {
  it('getDraft non-submitted fields spread into formData before step 1 renders', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'draft',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
      coldCalls:    7,
    });

    renderWizard();
    await waitForModal();
    clickThroughToSubmit();

    await waitFor(() => {
      expect(hoisted.submitReportMock).toHaveBeenCalledTimes(1);
    });

    // submitReport signature: (tenantId, uid, agentName, weekStarting, formData, commissionRate, unitId)
    const formDataArg = hoisted.submitReportMock.mock.calls[0][4];
    expect(formDataArg.coldCalls).toBe(7);
  });

  it('non-prefilled fields remain at INITIAL_DATA defaults when draft only partially fills state', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'draft',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
      coldCalls:    7,
    });

    renderWizard();
    await waitForModal();
    clickThroughToSubmit();

    await waitFor(() => expect(hoisted.submitReportMock).toHaveBeenCalledTimes(1));

    const formDataArg = hoisted.submitReportMock.mock.calls[0][4];
    expect(formDataArg.referralCalls).toBe(0);
    expect(formDataArg.ffiConducted).toBe(0);
    expect(formDataArg.newBusiness).toEqual({ apps: 0, api: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B — Submitted-draft guard
// ─────────────────────────────────────────────────────────────────────────────
describe('B — submitted-draft guard', () => {
  it('status=submitted → "Already submitted" interstitial, no step form', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'submitted',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
    });

    renderWizard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Already submitted' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('wizard-v2-footer')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-step-counter')).toBeNull();
  });

  it('status=submitted → "View Submission" and "Pick Different Week" buttons present', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'submitted',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
    });

    renderWizard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Already submitted' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'View Submission' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick Different Week' })).toBeInTheDocument();
  });

  it('status=submitted → submitReport never called (no active form to submit)', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'submitted',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
    });

    renderWizard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Already submitted' })).toBeInTheDocument();
    });
    expect(hoisted.submitReportMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C — Autosave draftStatus guard
// ─────────────────────────────────────────────────────────────────────────────
describe('C — autosave draftStatus guard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call saveDraft after 1500ms when draftStatus is submitted', async () => {
    hoisted.getDraftMock.mockResolvedValue({
      status:       'submitted',
      agentId:      'agent-1',
      weekStarting: WEEK,
      updatedAt:    null,
      submittedAt:  null,
    });

    renderWizard();
    // Cannot use findByRole/waitFor here: fake timers are installed in beforeEach,
    // so waitFor's internal polling (setTimeout) deadlocks. Flush the getDraft
    // microtask chain directly — Promise.resolve() advances one microtask tick,
    // two rounds drain the getDraft.then() → setState chain.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance past the debounce window; doSave.current fires but is guarded
    // by `if (draftStatus === 'submitted') return` — saveDraft must not run.
    // vi.advanceTimersByTimeAsync flushes microtasks scheduled by the timer callback.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(hoisted.saveDraftMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D — Scoring engine characterization
// ─────────────────────────────────────────────────────────────────────────────

// Known fixture — update ONLY when computePoints logic intentionally changes.
// Each annotation shows the derivation from POINTS_WEIGHTS in gamificationConfig.js.
const FIXTURE_SCORING = {
  // ── Prospecting ───────────────────────────────────────────────────────────
  referralCalls:         20,   //
  followUpCalls:         15,   //
  coldCalls:             10,   //
  seminarTradeshowCalls:  5,   // dials = 50 → 50 × 1 = 50
  prospectingLettersSent: 30,  // capped at 20 → 20 × 1 = 20
  referralsObtained:      4,   // 4 × 3 = 12
  namesFromOther:        15,   //
  namesFromColdCanvass:   5,   // otherNewNames = 20 → 20 × 1 = 20
  seminarsConducted:      1,   // 1 × 10 = 10
  // ── Advancing ─────────────────────────────────────────────────────────────
  f2fAttempts:            8,   // 8 × 2 = 16
  appointmentsSet:        6,   // 6 × 3 = 18
  ffiConducted:           3,   // 3 × 5 = 15
  ciConducted:            2,   // 2 × 10 = 20
  // ── Closing ───────────────────────────────────────────────────────────────
  version: 2,                  // → reads newBusiness.{apps,api}
  newBusiness: { apps: 1, api: 5500 }, // 1 × 25 = 25; Math.floor(5500/1000) × 1 = 5
  // ── Service ───────────────────────────────────────────────────────────────
  serviceCalls:           3,   // 3 × 1 = 3
  policiesDelivered:      2,   // 2 × 3 = 6
  // Total: 50+20+12+20+10+16+18+15+20+25+5+3+6 = 220
};

describe('D — scoring engine (computePoints)', () => {
  it('returns 220 for the known characterization fixture', () => {
    expect(computePoints(FIXTURE_SCORING)).toBe(220);
  });

  it('returns 0 for an empty object (safe floor)', () => {
    expect(computePoints({})).toBe(0);
  });

  it('caps prospectingLettersSent at 20 regardless of input value', () => {
    expect(computePoints({ prospectingLettersSent: 100 })).toBe(
      computePoints({ prospectingLettersSent: 20 }),
    );
  });

  it('resolves v2 production via newBusiness nested shape when version===2', () => {
    // 2 × 25 + Math.floor(3000/1000) × 1 = 50 + 3 = 53
    expect(computePoints({ version: 2, newBusiness: { apps: 2, api: 3000 } })).toBe(53);
  });

  it('resolves v1 production via flat applicationsSold/apiSold when version is absent', () => {
    // Same numeric result as the v2 equivalent
    expect(computePoints({ applicationsSold: 2, apiSold: 3000 })).toBe(53);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E — Weekly floor
// ─────────────────────────────────────────────────────────────────────────────
describe('E — weekly floor (mapFloorToPoints)', () => {
  it('mapFloorToPoints(DEFAULT_WEEKLY_ACTIVITY_FLOORS) === 399', () => {
    // Derivation: coldCalls(60)×1 + appointmentsSet(20)×3 + ffiConducted(10)×5
    // + ciConducted(10)×10 + applicationsSold(1)×25 + api(4800÷1000)×1
    // + namesFromOther(100)×1 = 60+60+50+100+25+4+100 = 399
    expect(mapFloorToPoints(DEFAULT_WEEKLY_ACTIVITY_FLOORS)).toBe(399);
  });

  it('returns 0 for null floors (safe default)', () => {
    expect(mapFloorToPoints(null)).toBe(0);
  });

  it('returns 0 for empty object floors', () => {
    expect(mapFloorToPoints({})).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F — initialStep prop (Q4 v3 shell)
//
// Keystone tests: WizardForm mounts the correct step when initialStep is given.
// resolvePath.test.js covers the helper; these cover the render boundary —
// that WizardForm's useState(initialStep ?? 1) actually determines which step
// component lands on screen.
//
// initialWeek is required for both tests: it drives screen='step' (not 'date'),
// which is what enables the step counter and step title to render at all.
// ─────────────────────────────────────────────────────────────────────────────
describe('F — initialStep prop (Q4 v3 shell)', () => {
  it('initialStep={10} mounts StepRateYourWeek: title "Rate your week", counter "Step 10 of 12"', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek={WEEK} initialStep={10} />);
    await waitForModal();
    expect(screen.getByTestId('wizard-v2-step-title')).toHaveTextContent('Rate your week');
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 10 of 12');
  });

  it('no initialStep → step 1 default: title "Letters & outreach", counter "Step 1 of 12"', async () => {
    render(<WizardForm onClose={vi.fn()} initialWeek={WEEK} />);
    await waitForModal();
    expect(screen.getByTestId('wizard-v2-step-title')).toHaveTextContent('Letters & outreach');
    expect(screen.getByTestId('wizard-v2-step-counter')).toHaveTextContent('Step 1 of 12');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G — draft-read FAILURE guard (data-integrity)
//
// A getDraft READ FAILURE must NOT fall through to a fresh, auto-saving form —
// that would overwrite the very draft the read failed to load. On failure the
// wizard surfaces an error card, hides the step form + footer, hard-guards
// autosave, and offers Retry to re-run the load.
// ─────────────────────────────────────────────────────────────────────────────
describe('G — draft-read failure guard', () => {
  it('absent draft (null) → fresh step form, NO error card', async () => {
    hoisted.getDraftMock.mockResolvedValue(null);

    renderWizard();
    await waitForModal();

    // Fresh form renders; no error card.
    await waitFor(() => {
      expect(screen.getByTestId('wizard-v2-step-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('wizard-v2-draft-error')).toBeNull();
    expect(screen.getByTestId('wizard-v2-footer')).toBeInTheDocument();
  });

  describe('read failure → error card + no autosave (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('getDraft rejects → error card + Retry shown, step form + footer NOT rendered, no saveDraft after 1500ms', async () => {
      hoisted.getDraftMock.mockRejectedValue(new Error('network down'));

      renderWizard();
      // Same microtask-drain rationale as suite C: fake timers are installed, so
      // waitFor would deadlock. Drain the getDraft rejection chain (reject
      // propagates through the empty .then to the .catch) → setState.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Error card + Retry surfaced.
      expect(screen.getByTestId('wizard-v2-draft-error')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-v2-draft-error-retry')).toBeInTheDocument();
      // Form body + footer suppressed (no editable/navigable surface over the
      // unread draft).
      expect(screen.queryByTestId('wizard-v2-step-1')).toBeNull();
      expect(screen.queryByTestId('wizard-v2-footer')).toBeNull();

      // Advance past the autosave debounce — doSave.current fires but is guarded
      // by `if (draftLoadError) return`; saveDraft must NOT run (no overwrite).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(hoisted.saveDraftMock).not.toHaveBeenCalled();
    });
  });

  describe('Retry re-runs the load (real timers)', () => {
    it('Retry → getDraft called again; success with a draft loads its fields', async () => {
      hoisted.getDraftMock
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue({
          status:       'draft',
          agentId:      'agent-1',
          weekStarting: WEEK,
          updatedAt:    null,
          submittedAt:  null,
          coldCalls:    7,
        });

      renderWizard();
      await waitForModal();
      await waitFor(() => {
        expect(screen.getByTestId('wizard-v2-draft-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('wizard-v2-draft-error-retry'));

      // Error clears, form returns.
      await waitFor(() => {
        expect(screen.queryByTestId('wizard-v2-draft-error')).toBeNull();
        expect(screen.getByTestId('wizard-v2-step-1')).toBeInTheDocument();
      });
      // getDraft ran twice: once on mount (failed), once on Retry (succeeded).
      expect(hoisted.getDraftMock).toHaveBeenCalledTimes(2);

      // The retried draft's field is really in formData (survives to submit).
      clickThroughToSubmit();
      await waitFor(() => expect(hoisted.submitReportMock).toHaveBeenCalledTimes(1));
      expect(hoisted.submitReportMock.mock.calls[0][4].coldCalls).toBe(7);
    });

    it('Retry → success with null draft yields a fresh wizard (defaults)', async () => {
      hoisted.getDraftMock
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue(null);

      renderWizard();
      await waitForModal();
      await waitFor(() => {
        expect(screen.getByTestId('wizard-v2-draft-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('wizard-v2-draft-error-retry'));

      await waitFor(() => {
        expect(screen.queryByTestId('wizard-v2-draft-error')).toBeNull();
        expect(screen.getByTestId('wizard-v2-step-1')).toBeInTheDocument();
      });
      expect(hoisted.getDraftMock).toHaveBeenCalledTimes(2);

      // Fresh form → INITIAL_DATA defaults submit through.
      clickThroughToSubmit();
      await waitFor(() => expect(hoisted.submitReportMock).toHaveBeenCalledTimes(1));
      expect(hoisted.submitReportMock.mock.calls[0][4].coldCalls).toBe(0);
    });
  });
});
