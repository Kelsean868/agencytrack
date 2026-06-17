import React, { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw } from 'lucide-react';

/**
 * ReloadPrompt — service-worker update prompt (prompt-to-reload).
 *
 * Wires vite-plugin-pwa's registerSW (registerType: 'prompt') so a freshly
 * deployed bundle does NOT silently take over a running session. Instead:
 *   - onNeedRefresh → a persistent, non-blocking banner appears.
 *   - The user taps "Update" → updateSW(true) activates the waiting SW and
 *     reloads to the fresh bundle. Nothing reloads without a tap (no
 *     controllerchange→reload), so unsaved input on explicit-save surfaces
 *     (Monthly Plan "Save draft", daily-entry "Save") is never lost.
 *
 * Long-open sessions detect deploys via a periodic update poll plus an update
 * check on window focus / visibilitychange.
 *
 * A dedicated banner (not the Toast primitive) guarantees the "persistent"
 * requirement: ToastProvider FIFO-evicts past MAX_TOASTS=3, which would silently
 * drop a long-lived update prompt. Renders null until an update is available.
 */

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000; // 60 min

export default function ReloadPrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSWRef = useRef(null);
  const teardownRef = useRef(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(swUrl, registration) {
        if (!registration) return;
        // Periodic poll so long-open sessions notice deploys.
        const interval = setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_POLL_INTERVAL_MS);
        // Also check when the tab regains focus / becomes visible.
        const checkForUpdate = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        window.addEventListener('focus', checkForUpdate);
        document.addEventListener('visibilitychange', checkForUpdate);
        teardownRef.current = () => {
          clearInterval(interval);
          window.removeEventListener('focus', checkForUpdate);
          document.removeEventListener('visibilitychange', checkForUpdate);
        };
      },
    });
    updateSWRef.current = updateSW;

    return () => {
      teardownRef.current?.();
    };
  }, []);

  if (!needRefresh) return null;

  const handleUpdate = () => {
    updateSWRef.current?.(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4 pointer-events-none"
      data-testid="reload-prompt"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <RefreshCw size={18} className="shrink-0 text-primary dark:text-primary-dark" aria-hidden="true" />
        <p className="flex-1 text-sm font-medium leading-snug text-ink">
          A new version is available.
        </p>
        <button
          type="button"
          onClick={handleUpdate}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Update
        </button>
      </div>
    </div>
  );
}
