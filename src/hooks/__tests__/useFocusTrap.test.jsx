// @vitest-environment jsdom
//
// useFocusTrap focus-return hardening (Tier-0 dialog-a11y browser-smoke finding).
//
// The bug: PlanCatalogModal's onClose kicks off a background refresh that flips
// its trigger tile to `disabled` for the duration of the refetch. useFocusTrap's
// teardown fired `trigger.focus()` while the trigger was disabled — a silent
// no-op — so focus never returned. The fix guards focusability and retries once
// after the next paint, by which point the transient disable has cleared.
//
// These tests exercise the hook directly through a minimal harness rather than a
// full modal, so the transient-disable condition is reproduced deterministically.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import useFocusTrap from '../useFocusTrap';

function TrapHarness() {
  const modalRef = useFocusTrap({ onEscape: () => {} });
  return React.createElement(
    'div',
    { ref: modalRef, role: 'dialog', 'aria-modal': 'true' },
    React.createElement('button', null, 'Inside')
  );
}

function makeTrigger() {
  const trigger = document.createElement('button');
  trigger.textContent = 'Open';
  document.body.appendChild(trigger);
  trigger.focus();
  return trigger;
}

describe('useFocusTrap — focus return', () => {
  it('restores focus to the trigger on a clean unmount (baseline)', () => {
    const trigger = makeTrigger();
    const { unmount } = render(React.createElement(TrapHarness));
    // The trap moved focus inside the dialog on open.
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('retries focus-return after paint when the trigger is transiently disabled at teardown', async () => {
    const trigger = makeTrigger();
    const { unmount } = render(React.createElement(TrapHarness));

    // Simulate the background refresh disabling the trigger exactly as the modal
    // closes — this is the condition that made the old .focus() a silent no-op.
    trigger.disabled = true;
    unmount();
    // Immediate restore cannot land on a disabled element.
    expect(document.activeElement).not.toBe(trigger);

    // The refresh resolves and the trigger re-enables; the hook's rAF retry then
    // restores focus. Without the retry this never happens and the test fails.
    trigger.disabled = false;
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });

  it('does not throw when the trigger is detached before teardown', () => {
    const trigger = makeTrigger();
    const { unmount } = render(React.createElement(TrapHarness));

    // A full-screen takeover unmounts the trigger with no replacement. The hook
    // cannot focus a node that no longer exists — it must simply not blow up
    // (the consuming component owns redirecting focus in that case).
    trigger.remove();
    expect(() => unmount()).not.toThrow();
  });
});
