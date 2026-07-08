import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const FOCUSABLE_SEL = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const VARIANT_BTN = {
  danger:  'bg-danger text-white hover:bg-danger/90',
  warning: 'bg-warning text-white hover:bg-warning/90',
  primary: 'bg-primary dark:bg-primary-dark text-white hover:opacity-90',
};

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',    // 'primary' | 'danger' | 'warning'
  loading = false,
  loadingLabel,
  confirmValue,           // string — if provided, user must type this value exactly to unlock confirm
  confirmValueLabel = 'Type to confirm',
  confirmValuePlaceholder = '',
}) {
  const dialogRef = useRef(null);
  const [typed, setTyped] = useState('');
  const lastFocused = useRef(null);

  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement;
      const raf = requestAnimationFrame(() => {
        dialogRef.current?.querySelector(FOCUSABLE_SEL)?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setTyped('');
      lastFocused.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trap = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE_SEL) ?? []);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open, onCancel]);

  if (!open) return null;

  const typedMatch = confirmValue == null || typed.trim() === (confirmValue ?? '').trim();
  const confirmDisabled = loading || !typedMatch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {variant === 'danger' && <AlertTriangle size={16} className="text-danger-ink shrink-0" />}
            <p id="confirm-dialog-title" className="text-sm font-bold text-ink">{title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>

        {message && (
          <div className="text-xs text-ink-muted leading-relaxed">{message}</div>
        )}

        {confirmValue != null && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-dialog-input" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              {confirmValueLabel}
            </label>
            <input
              id="confirm-dialog-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmValuePlaceholder}
              autoComplete="off"
              className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-danger/40"
            />
          </div>
        )}

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-border/30 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 ${VARIANT_BTN[variant] ?? VARIANT_BTN.primary}`}
          >
            {loading ? (loadingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
