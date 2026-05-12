import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import { ToastContext } from './toastContext';

/**
 * ToastProvider — context provider + queue + portal for the Toast primitive.
 *
 * Mount once near the root (App.jsx) so toasts render above all surfaces,
 * including modals (z-[60] sits above the z-50 modal layer).
 *
 * Queue cap: 3 simultaneous. New toasts append; if cap reached, the oldest
 * is auto-evicted (FIFO). Keeps SR announcements bounded.
 *
 * The portal target defaults to document.body. SSR-safe: portal renders only
 * when document is defined.
 */

const MAX_TOASTS = 3;

function generateId() {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ToastProvider({ children, max = MAX_TOASTS }) {
  const [toasts, setToasts] = useState([]);
  // Counter ensures unique ids even when toasts fire in the same tick.
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((options) => {
    counter.current += 1;
    const id = `${generateId()}_${counter.current}`;
    const toast = {
      id,
      message: options?.message ?? '',
      variant: options?.variant ?? 'info',
      duration: options?.duration ?? 3000,
      action: options?.action ?? null,
    };
    setToasts((prev) => {
      const next = [...prev, toast];
      // FIFO eviction when cap exceeded
      if (next.length > max) return next.slice(next.length - max);
      return next;
    });
    return id;
  }, [max]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalTarget && toasts.length > 0 && createPortal(
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none w-full max-w-md"
          data-testid="toast-stack"
        >
          {toasts.map((t) => (
            <Toast
              key={t.id}
              id={t.id}
              message={t.message}
              variant={t.variant}
              duration={t.duration}
              action={t.action}
              onDismiss={dismiss}
            />
          ))}
        </div>,
        portalTarget
      )}
    </ToastContext.Provider>
  );
}
