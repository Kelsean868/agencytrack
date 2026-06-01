/**
 * Track J Wizard v2 PR1 — AutosaveChip.
 *
 * v2 visual chip that wraps the EXISTING `SaveStatusIndicator` state
 * machine. The state machine itself (saving / saved / failed + sticky
 * 8s failure window + retry throttle) is preserved unchanged — this is
 * presentational dressing only.
 *
 * Inputs (same props as the legacy SaveStatusIndicator):
 *   - saving       : bool
 *   - savedAt      : Date | null
 *   - stickyError  : bool
 *   - isOffline    : bool
 *   - onRetry      : () => void
 *
 * Three display states (matching the v2 mockup):
 *   - 'saving' — pill with mono-spinner + "Saving…"
 *   - 'saved'  — pill with check icon + "Saved" (+ "Saved offline" caveat
 *                 when offline)
 *   - 'failed' — pill with X icon + "Save failed · tap to retry" button
 *
 * No new logic; identical to the legacy indicator's behavior. The R4
 * 2-second retry throttle + R5 8-second sticky window are preserved
 * (they live in the wrapped SaveStatusIndicator implementation).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle, RotateCcw } from 'lucide-react';

const FAILURE_STICKY_MS = 8000;

export default function AutosaveChip({ saving, savedAt, stickyError, isOffline, onRetry }) {
  // ── Sticky-error window state (same machinery as legacy
  // SaveStatusIndicator — kept here so the chip is the single source of
  // visual truth for autosave display). ────────────────────────────────
  const lastRetryAt   = useRef(0);
  const failedShownAt = useRef(0);
  const stickyTimer   = useRef(null);
  const savingRef     = useRef(saving);
  const [, setTick]   = useState(0);

  savingRef.current = saving;

  useEffect(() => {
    if (stickyError) {
      lastRetryAt.current = 0;
      failedShownAt.current = Date.now();
      clearTimeout(stickyTimer.current);
    } else if (savingRef.current) {
      clearTimeout(stickyTimer.current);
      failedShownAt.current = 0;
    } else {
      const remaining = FAILURE_STICKY_MS - (Date.now() - failedShownAt.current);
      clearTimeout(stickyTimer.current);
      stickyTimer.current = setTimeout(() => {
        failedShownAt.current = 0;
        setTick((n) => n + 1);
      }, remaining > 0 ? remaining : 0);
    }
  }, [stickyError]);

  useEffect(() => () => clearTimeout(stickyTimer.current), []);

  const visibleError = stickyError || (
    failedShownAt.current > 0 &&
    Date.now() - failedShownAt.current < FAILURE_STICKY_MS &&
    !saving
  );

  function handleRetry() {
    if (Date.now() - lastRetryAt.current < 2000) return;
    lastRetryAt.current = Date.now();
    onRetry();
  }

  // ── Visual: v2 pill ──────────────────────────────────────────────────
  // Tokens only; no raw hex. 44px target on the retry button.
  // Visible TEXT content is preserved from the legacy SaveStatusIndicator
  // verbatim so the existing behavioral assertions in
  // WizardFormSaveStatus.test.jsx (role/aria + exact phrases) keep passing
  // unchanged — the chip is presentational dressing for that text/state
  // machine.
  if (visibleError && !saving && !isOffline) {
    return (
      <div
        role="alert"
        aria-atomic="true"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-tint border border-danger/30"
        data-testid="wizard-v2-autosave-chip"
        data-state="failed"
      >
        <AlertTriangle size={13} className="text-danger shrink-0" />
        <span className="text-xs font-semibold text-danger">
          Save failed — tap to retry
        </span>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs font-semibold text-danger hover:bg-danger/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          aria-label="Retry save"
          data-testid="wizard-v2-autosave-retry"
        >
          <RotateCcw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (saving) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted border border-border"
        data-testid="wizard-v2-autosave-chip"
        data-state="saving"
      >
        <span className="w-3 h-3 rounded-full border-2 border-ink-muted border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-xs text-ink-muted">Saving…</span>
      </div>
    );
  }

  if (savedAt) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
          isOffline
            ? 'bg-warning-tint border-warning/30'
            : 'bg-success-tint border-success/30'
        }`}
        data-testid="wizard-v2-autosave-chip"
        data-state={isOffline ? 'saved-offline' : 'saved'}
      >
        <Check size={13} className={isOffline ? 'text-warning shrink-0' : 'text-success shrink-0'} />
        <span className={`text-xs font-semibold ${isOffline ? 'text-warning' : 'text-success'}`}>
          {isOffline ? 'Saved offline — will sync when reconnected' : 'Saved'}
        </span>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div
        role="alert"
        aria-atomic="true"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-tint border border-warning/30"
        data-testid="wizard-v2-autosave-chip"
        data-state="offline"
      >
        <AlertTriangle size={13} className="text-warning shrink-0" />
        <span className="text-xs text-warning">Offline — will save when reconnected</span>
      </div>
    );
  }

  // Initial mount (never saved yet, not offline, no error): render an
  // empty polite region so screen-reader live-region semantics + legacy
  // ARIA assertions (role="status" + aria-live="polite" + aria-atomic="true"
  // must exist on the wizard at all times) hold.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="wizard-v2-autosave-chip"
      data-state="idle"
      className="sr-only"
    />
  );
}
