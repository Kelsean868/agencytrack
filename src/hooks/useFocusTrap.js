import { useEffect, useRef } from 'react';

/**
 * useFocusTrap — manage focus for a modal.
 *
 * Returns a ref to attach to the modal root. On mount: captures the
 * previously-focused element (the trigger) and focuses the first focusable
 * descendant. On unmount: restores focus to the captured trigger.
 *
 * Tab / Shift+Tab cycle stays within the modal.
 *
 * Escape behavior is opt-in: pass an `onEscape` handler to enable Escape-
 * dismissal. Pass `escapeDisabled: true` to suppress Escape (used during
 * mid-flight write states or when a confirmation sub-dialog owns the key).
 *
 * Extracted from BranchEditorModal (PR #60) per the SS-2 commitment from
 * C1 audit — the third consumer (BulkImportUsersModal in C2) triggers
 * extraction. EditConfigModal (B5) and BranchEditorModal (C1) intentionally
 * stay on inline duplication until next-touched (follow-up filed in
 * docs/FOLLOW_UPS.md).
 *
 * Usage:
 *   const modalRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
 *   return <div ref={modalRef} role="dialog" aria-modal="true">...</div>;
 */

const FOCUSABLE_QUERY =
  'button:not([disabled]):not([aria-hidden="true"]),' +
  '[href],' +
  'input:not([disabled]),' +
  'select:not([disabled]),' +
  'textarea:not([disabled]),' +
  '[tabindex]:not([tabindex="-1"])';

function focusableWithin(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(FOCUSABLE_QUERY));
}

// A captured trigger is focusable only if it is still in the document and not
// disabled. `.focus()` on a detached or disabled element silently no-ops, so
// guarding here is what makes the difference between real focus-return and a
// swallowed one.
function isFocusable(el) {
  return !!(el && el.isConnected && !el.disabled && typeof el.focus === 'function');
}

// Restore focus to the element that opened the modal. The trigger can be
// transiently unfocusable at teardown time — a background refresh may have just
// flipped it to `disabled`, or it may be mid-remount after a full-screen
// takeover replaced it. Try immediately; if that no-ops, retry once after the
// next paint, by which point the transient state has usually cleared. A trigger
// that is permanently gone (unmounted with no replacement) can't be focused by
// this hook — the consumer that owns the unmount must redirect focus itself.
function restoreFocusTo(trigger) {
  if (isFocusable(trigger)) {
    trigger.focus();
    if (document.activeElement === trigger) return;
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (isFocusable(trigger)) trigger.focus();
    });
  }
}

export default function useFocusTrap({ onEscape, escapeDisabled = false } = {}) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const items = focusableWithin(modalRef.current);
    if (items.length > 0 && typeof items[0].focus === 'function') {
      items[0].focus();
    }

    return () => {
      restoreFocusTo(triggerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (!escapeDisabled && typeof onEscape === 'function') {
          onEscape();
        }
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusableWithin(modalRef.current);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onEscape, escapeDisabled]);

  return modalRef;
}
