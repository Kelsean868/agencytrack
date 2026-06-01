/**
 * Component-level tests for WizardForm save-status behaviors:
 * retry button, Saved ✓ indicator, offline detection, ARIA, persistent-failure escalation.
 *
 * These are the first RTL render tests in the codebase. Mocking surface is intentionally
 * narrow: only AuthContext and submissionService need mocking (Step components are pure UI
 * with no Firebase imports; dateHelpers/formatters/computations are pure functions).
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- Mocks (must be declared before the WizardForm import) ---

const { mockSaveDraft, mockGetDraft, mockGetLastSubmission } = vi.hoisted(() => ({
  mockSaveDraft: vi.fn(() => Promise.resolve()),
  mockGetDraft: vi.fn(() => Promise.resolve(null)),
  mockGetLastSubmission: vi.fn(() => Promise.resolve(null)),
}));

// Step components use JSX without explicit React import (automatic runtime,
// fine in production); mock them here so the test environment doesn't need to
// resolve their JSX at runtime.
vi.mock('../steps/Step1Prospecting', () => ({ default: () => null }));
vi.mock('../steps/Step2Telephone', () => ({ default: () => null }));
vi.mock('../steps/Step3Approaches', () => ({ default: () => null }));
vi.mock('../steps/Step4ClosingSales', () => ({ default: () => null }));
vi.mock('../steps/Step5NewNames', () => ({ default: () => null }));
vi.mock('../steps/Step6DeliveriesService', () => ({ default: () => null }));
vi.mock('../steps/Step7TimeManagement', () => ({ default: () => null }));
vi.mock('../steps/Step8SelfEvaluation', () => ({ default: () => null }));
vi.mock('../steps/Step9Goals', () => ({ default: () => null }));
vi.mock('../steps/StepSocialMedia', () => ({ default: () => null }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid' },
    userProfile: { name: 'Test Agent', commissionRate: 35, email: 'agent@test.com' },
  }),
}));

vi.mock('../../../services/submissionService', () => ({
  saveDraft: mockSaveDraft,
  getDraft: mockGetDraft,
  // Legacy mock retained for any direct callers + transitive back-compat;
  // the wizard now reads via `getRecentSubmissions` instead.
  getLastSubmission: mockGetLastSubmission,
  getRecentSubmissions: vi.fn(() => Promise.resolve([])),
  submitReport: vi.fn(() => Promise.resolve()),
  sanitize: (d) => d,
}));

import WizardForm, { SaveStatusIndicator } from '../WizardForm';

// --- Helpers ---

const TEST_WEEK = '2026-05-11';

/** Render wizard in step mode (bypasses the date-picker screen). */
const renderWizard = () => render(<WizardForm onClose={vi.fn()} initialWeek={TEST_WEEK} />);

/** Flush initial mount promises (getDraft, getLastSubmission). */
const flushMount = async () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/**
 * Trigger a save and wait for it to complete inside React's act boundary.
 *
 * React 19's act(async) handles state updates that originate from the online
 * event handler: handleOnline() calls doSave.current() synchronously, and
 * the two awaited Promise.resolve() ticks drain the saveDraft microtask chain
 * before act exits — so all state setters (setSavedAt, setSaveError, setSaving)
 * are committed within act's flush.
 *
 * After this function returns, assertions can be made directly without waitFor.
 * waitFor's setInterval-based retries are faked, causing it to hang if the DOM
 * is not yet updated; since act() commits synchronously, direct assertions are
 * always safe here.
 */
const triggerAutoSave = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    await Promise.resolve();
  });
};

/**
 * Trigger a retry-button click inside an act boundary and drain the resulting
 * async save microtask chain.
 */
const clickRetry = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    await Promise.resolve();
    await Promise.resolve();
  });
};

// --- Setup ---

beforeEach(() => {
  // Only fake setTimeout/clearTimeout — the timers we actually need to control
  // (1500ms debounce, 3000ms savedAt fade). Leaving setImmediate real so React
  // 19's Node.js scheduler (which uses setImmediate) can flush work and commit
  // DOM updates; otherwise act() exits before React renders.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  mockSaveDraft.mockReset();
  mockGetDraft.mockResolvedValue(null);
  mockGetLastSubmission.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── 1. Retry button ──────────────────────────────────────────────────────────

describe('Retry button', () => {
  it('appears with correct text when save fails', async () => {
    mockSaveDraft.mockRejectedValue(new Error('network error'));
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByText('Save failed — tap to retry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
  });

  it('is not visible when there is no error', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument();
  });

  it('triggers another save on click; shows Saved on success; hides retry button', async () => {
    mockSaveDraft
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();

    await clickRetry();

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument();
  });
});

// ─── 2. Saved ✓ indicator ─────────────────────────────────────────────────────

describe('Saved ✓ indicator', () => {
  it('appears after a successful auto-save', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('disappears after 3 seconds', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByText('Saved')).toBeInTheDocument();

    // The savedTimer callback () => setSavedAt(null) is synchronous; sync act
    // flushes it directly without needing the React scheduler.
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});

// ─── 3. Offline detection ─────────────────────────────────────────────────────

describe('Offline detection', () => {
  it('shows offline message when the offline event fires', async () => {
    renderWizard();
    await flushMount();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText('Offline — will save when reconnected')).toBeInTheDocument();
  });

  it('clears offline message and triggers save when online event fires', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByText('Offline — will save when reconnected')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(screen.queryByText('Offline — will save when reconnected')).not.toBeInTheDocument();
    expect(mockSaveDraft).toHaveBeenCalled();
  });
});

// ─── 3b. Saved-while-offline copy (R1) ───────────────────────────────────────
//
// Firestore's persistentLocalCache resolves setDoc immediately when offline
// (write queues locally and reaches server on reconnect). Without disambiguation
// the indicator flashed bare "Saved" while the user was genuinely offline. R1
// shows "Saved offline — will sync when reconnected" instead.

describe('Saved-while-offline copy (R1)', () => {
  /** Dispatch offline, then advance the 1500ms debounce timer to fire the save. */
  const triggerOfflineAutoSave = async () => {
    act(() => { window.dispatchEvent(new Event('offline')); });
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('shows "Saved offline — will sync" copy when save resolves while offline', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerOfflineAutoSave();

    expect(
      screen.getByText('Saved offline — will sync when reconnected')
    ).toBeInTheDocument();
  });

  it('does not show bare "Saved" copy when save resolves while offline', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerOfflineAutoSave();

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('switches to bare "Saved" copy when reconnecting after an offline save', async () => {
    mockSaveDraft.mockResolvedValue(undefined);
    renderWizard();
    await flushMount();
    await triggerOfflineAutoSave();

    expect(
      screen.getByText('Saved offline — will sync when reconnected')
    ).toBeInTheDocument();

    // Online event fires another save (handler calls doSave on reconnect).
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.queryByText('Saved offline — will sync when reconnected')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});

// ─── 4. ARIA / role attributes ────────────────────────────────────────────────

describe('ARIA attributes', () => {
  it('save status container has role="status" and aria-live="polite"', () => {
    renderWizard();

    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
    expect(statusEl).toHaveAttribute('aria-atomic', 'true');
  });

  it('error message has role="alert"', async () => {
    mockSaveDraft.mockRejectedValue(new Error('fail'));
    renderWizard();
    await flushMount();
    await triggerAutoSave();

    expect(screen.getByText('Save failed — tap to retry')).toBeInTheDocument();

    const errorSpan = screen.getByText('Save failed — tap to retry').closest('[role="alert"]');
    expect(errorSpan).not.toBeNull();
  });

  it('escalated banner has role="alert"', async () => {
    mockSaveDraft.mockRejectedValue(new Error('fail'));
    renderWizard();
    await flushMount();
    await triggerAutoSave();  // failure 1

    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();

    await clickRetry();  // failure 2
    await clickRetry();  // failure 3 → escalated

    expect(screen.getByText(/Couldn't save your work/)).toBeInTheDocument();

    const banner = screen.getByText(/Couldn't save your work/).closest('[role="alert"]');
    expect(banner).not.toBeNull();
  });
});

// ─── 5. Persistent-failure escalation ────────────────────────────────────────

describe('Persistent-failure escalation', () => {
  it('shows escalated banner after 3 consecutive failures', async () => {
    mockSaveDraft.mockRejectedValue(new Error('network error'));
    renderWizard();
    await flushMount();
    await triggerAutoSave();  // failure 1

    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();

    await clickRetry();  // failure 2
    await clickRetry();  // failure 3 → escalated

    expect(
      screen.getByText(/Couldn't save your work/)
    ).toBeInTheDocument();
  });

  it('escalated banner disappears after a successful save', async () => {
    mockSaveDraft
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(undefined);

    renderWizard();
    await flushMount();
    await triggerAutoSave();  // failure 1

    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();

    await clickRetry();  // failure 2
    await clickRetry();  // failure 3 → escalated

    expect(screen.getByText(/Couldn't save your work/)).toBeInTheDocument();

    // Click "Try now" in the escalated banner — this call succeeds
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try now' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText(/Couldn't save your work/)).not.toBeInTheDocument();
  });
});

// ─── 6. Tap-target dimensions (FU#4 P2-1) ────────────────────────────────────

it('close button has 44px tap-target class (w-11 h-11)', () => {
  renderWizard();
  expect(screen.getByRole('button', { name: 'Close' }).className).toContain('w-11 h-11');
});

// ─── 6. R2–R5 Polish ─────────────────────────────────────────────────────────

describe('R2 — live-region structure', () => {
  it('polite and assertive regions are siblings, not nested', () => {
    const { container } = render(
      <SaveStatusIndicator saving={false} savedAt={null} stickyError={false} isOffline={false} onRetry={vi.fn()} />
    );
    const polite = container.querySelector('[role="status"]');
    const alert  = container.querySelector('[role="alert"]');
    expect(polite).not.toBeNull();
    expect(alert).not.toBeNull();
    expect(polite.contains(alert)).toBe(false);
    expect(alert.contains(polite)).toBe(false);
  });
});

describe('R3 — motion-reduce guard', () => {
  it('every animate-pulse in the saving indicator carries motion-reduce:animate-none', () => {
    const { container } = render(
      <SaveStatusIndicator saving={true} savedAt={null} stickyError={false} isOffline={false} onRetry={vi.fn()} />
    );
    const pulsing = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsing.length).toBeGreaterThan(0);
    pulsing.forEach((el) => {
      expect(el.className).toContain('motion-reduce:animate-none');
    });
  });
});

describe('R4 — retry throttle', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throttles rapid retry clicks to once per 2s, then allows again after the window', () => {
    const fakeNow = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

    const onRetry = vi.fn();
    render(
      <SaveStatusIndicator saving={false} savedAt={null} stickyError={true} isOffline={false} onRetry={onRetry} />
    );

    const retryBtn = screen.getByRole('button', { name: 'Retry save' });

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Second click within 2s — throttled
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Advance past 2s threshold
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow + 2001);

    // Third click — passes through
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

describe('R5 — sticky failure window', () => {
  it('holds the failed indicator visible for 8s even if a save succeeds within the window', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <SaveStatusIndicator saving={false} savedAt={null} stickyError={true} isOffline={false} onRetry={onRetry} />
    );

    expect(screen.getByText('Save failed — tap to retry')).toBeInTheDocument();

    // Advance 1s — still within the 8s sticky window
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Save failed — tap to retry')).toBeInTheDocument();

    // Transition directly to saved state (stickyError cleared by parent, savedAt set — no saving intermediate)
    act(() => {
      rerender(
        <SaveStatusIndicator saving={false} savedAt={new Date()} stickyError={false} isOffline={false} onRetry={onRetry} />
      );
    });

    // visibleError still holds via failedShownAt ref — failed visible, Saved suppressed
    expect(screen.getByText('Save failed — tap to retry')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    // Advance past the full 8s window (8100ms more brings fake clock well past the timer)
    act(() => { vi.advanceTimersByTime(8100); });

    // Swap completes — Saved now visible
    expect(screen.queryByText('Save failed — tap to retry')).not.toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
